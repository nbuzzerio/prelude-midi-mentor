import { practiceSessionRunReducer, getPracticeSessionExerciseActiveTime, type PracticeSessionRunState, type PracticeSessionRunEvent } from "./practice-session-runtime";
import { createProgramRecordBase, programCalendarNow, summarizeProgramMetrics, PROGRAM_ATTEMPT_LIMITS as L, type ProgramAttempt, type ProgramOccurrence, type ProgramSkip } from "./practice-program-attempt";
import type { PracticeProgramRevision } from "./practice-program-types";
import { IndexedDbPracticeAttempts } from "./persistence/practice-attempt-indexeddb";
import { PracticeAttemptOwnership } from "./persistence/practice-attempt-ownership";

export type ProgramExecutionState = Readonly<{
  queue: readonly ProgramOccurrence[]; index: number; run: PracticeSessionRunState | null;
  record: ProgramAttempt | null; durable: ProgramAttempt | null; saving: boolean; error: string; changed: number;
}>;
type Store = Pick<IndexedDbPracticeAttempts, "save" | "close">;
type Options = Readonly<{ store?: Store; ownership?: PracticeAttemptOwnership; createId?: () => string; wallNow?: () => number; clockNow?: () => number }>;
/** One native single-exercise run per actual attempt. No grading or engine ownership duplication. */
export class PracticeProgramExecutor {
  private state: ProgramExecutionState = { queue: [], index: 0, run: null, record: null, durable: null, saving: false, error: "", changed: 0 };
  private listeners = new Set<() => void>(); private release: (() => void) | null = null;
  private store: Store; private ownership: PracticeAttemptOwnership; private id: () => string;
  private wall: () => number; private clock: () => number; private ownerId: string;
  private attached = 0; private epoch = 0; private disposed = false; private foreground = true;
  private writing: Promise<void> | null = null; private requested = false; private pendingSkip: ProgramSkip | null = null;
  private starting: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null; private lastClock = 0;
  constructor(public readonly program: PracticeProgramRevision, options: Options = {}) {
    this.store = options.store ?? new IndexedDbPracticeAttempts(); this.ownership = options.ownership ?? new PracticeAttemptOwnership();
    this.id = options.createId ?? (() => crypto.randomUUID()); this.wall = options.wallNow ?? Date.now; this.clock = options.clockNow ?? (() => performance.now()); this.ownerId = this.id();
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<ProgramExecutionState>) { this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(); }
  private at() { this.lastClock = Math.max(this.lastClock, this.clock()); return this.lastClock; }
  now = () => this.at();
  private wallAt() { return Math.max(this.wall(), this.state.record ? Date.parse(this.state.record.updatedAt) : 0); }
  get busy() { return this.state.saving || !!this.state.error || !!this.state.record && !this.state.durable?.closed; }
  select(exerciseIds: readonly string[]) {
    if (this.busy || this.state.run) return;
    if (exerciseIds.length > L.queue || exerciseIds.some(id => !this.program.program.exercises.some(exercise => exercise.id === id))) throw Error("Invalid or oversized exercise queue.");
    this.update({ queue: exerciseIds.map(exerciseId => ({ exerciseId, occurrenceId: this.id() })), index: 0 });
  }
  private snapshot(closed: boolean, interrupted = false): ProgramAttempt {
    const original = this.state.record!; const run = this.state.run; const record = run?.records[0]; const at = this.at();
    const timing = record ? getPracticeSessionExerciseActiveTime(record, run?.status === "summary" ? run.endedAt : at) : { prescribedActiveDurationMs: 0, bonusActiveDurationMs: 0, totalActiveDurationMs: 0 };
    const updatedAt = new Date(this.wallAt()).toISOString();
    return { ...original, writeVersion: (this.state.durable?.writeVersion ?? 0) + 1,
      activeDurationMs: timing.totalActiveDurationMs, prescribedDurationMs: timing.prescribedActiveDurationMs, bonusDurationMs: timing.bonusActiveDurationMs,
      prescribedUnits: record?.prescribedUnitsCompleted ?? 0, bonusUnits: record?.bonusUnitsCompleted ?? 0,
      metrics: summarizeProgramMetrics(record?.latestEngineResult ?? null),
      targetMetrics: summarizeProgramMetrics(record?.targetBoundaryEngineResult ?? null),
      outcome: record?.targetAchieved ? "completed" : closed ? interrupted ? "interrupted" : "stopped-early" : "in-progress",
      closed, endedAt: closed ? updatedAt : null, updatedAt, leaseUntilMs: closed ? 0 : this.wallAt() + L.leaseMs };
  }
  async start() {
    if (this.disposed || !this.foreground || this.busy || this.state.run || !this.state.queue[this.state.index]) return;
    const attemptId = this.id(), occurrence = this.state.queue[this.state.index]!;
    const calendar = programCalendarNow(this.wall());
    const record: ProgramAttempt = { ...createProgramRecordBase(this.program, occurrence, attemptId, calendar), kind: "attempt", attemptId, ownerId: this.ownerId,
      writeVersion: 0, outcome: "in-progress", closed: false, updatedAt: calendar.utcStartedAt, endedAt: null, leaseUntilMs: this.wall() + L.leaseMs,
      activeDurationMs: 0, prescribedDurationMs: 0, bonusDurationMs: 0, prescribedUnits: 0, bonusUnits: 0, metrics: null, targetMetrics: null };
    this.update({ record, durable: null, saving: true, error: "" });
    this.starting = this.saveStart().finally(() => { this.starting = null; }); await this.starting;
  }
  private async saveStart() {
    const record = this.state.record!;
    try {
      this.release ??= await this.ownership.acquire(record.attemptId);
      if (!this.release) throw Error("Another tab owns this attempt. No engine was started.");
      const durable = await this.store.save(record, null) as ProgramAttempt;
      this.update({ durable, saving: false, error: "", changed: this.state.changed + 1 });
      if (this.disposed || !this.foreground) { this.update({ record: { ...record, outcome: "interrupted" } }); await this.persist(true, true); return; }
      const run = practiceSessionRunReducer(null, { type: "START_RUN", runId: record.attemptId, firstExerciseToken: record.attemptId, startedAt: this.at(), foreground: true,
        snapshot: { presetId: this.program.programId, presetName: this.program.program.title, exercises: [structuredClone(record.exercise)] } });
      this.update({ run });
    } catch (error) { this.update({ saving: false, error: error instanceof Error ? error.message : "Attempt start could not be saved. Retry before playing." }); }
  }
  handle = (event: PracticeSessionRunEvent) => {
    if (this.disposed || this.state.run?.status !== "active") return;
    const current = this.state.run;
    if (!("exerciseToken" in event) || event.runId !== current.runId || event.exerciseToken !== current.activeExerciseToken || event.exerciseId !== current.snapshot.exercises[0]!.id) return;
    if (event.type === "VISIBILITY_CHANGED" && !event.foreground) { this.interrupt(); return; }
    const run = practiceSessionRunReducer(this.state.run, event); if (run === this.state.run || !run) return;
    const priorTarget = this.state.run.records[0]!.targetAchieved;
    this.update({ run });
    if (run.status === "summary") void this.persist(true);
    else if (!priorTarget && run.records[0]!.targetAchieved || event.type === "KEEP_PLAYING") void this.persist(false);
  };
  private freeze() {
    const run = this.state.run;
    if (run?.status !== "active") return;
    this.update({ run: practiceSessionRunReducer(run, { type: "END", runId: run.runId, exerciseId: run.snapshot.exercises[0]!.id, exerciseToken: run.activeExerciseToken, endedAt: this.at() }) });
  }
  interrupt = () => { if (this.state.run?.status === "active") { this.freeze(); void this.persist(true, true); } };
  setForeground(value: boolean) { this.foreground = value; if (!value) this.interrupt(); }
  private persist(closed: boolean, interrupted = false): Promise<void> {
    if (!this.state.durable || this.state.durable.closed) return Promise.resolve();
    if (closed) this.freeze();
    if (!this.state.record?.closed) this.update({ record: this.snapshot(closed, interrupted) }); this.requested = true;
    if (this.writing) return this.writing;
    this.writing = (async () => {
      while (this.requested) {
        this.requested = false;
        const pending = { ...this.state.record!, writeVersion: this.state.durable!.writeVersion + 1 };
        this.update({ saving: true });
        try {
          const durable = await this.store.save(pending, this.state.durable!.writeVersion) as ProgramAttempt;
          this.update({ durable, saving: false, error: "", changed: this.state.changed + 1 });
          if (durable.closed) { this.release?.(); this.release = null; this.requested = false; }
        } catch (error) {
          this.freeze(); this.requested = false;
          this.update({ record: this.state.record!.closed ? this.state.record : this.snapshot(true, true), saving: false, error: error instanceof Error ? error.message : "Results are pending. Retry saving before leaving." });
          break;
        }
      }
    })().finally(() => { this.writing = null; }); return this.writing;
  }
  async retry() {
    if (this.state.saving || !this.state.error) return;
    this.update({ error: "" });
    if (this.pendingSkip) { await this.saveSkip(); return; }
    if (!this.state.durable) { this.update({ saving: true }); this.starting = this.saveStart().finally(() => { this.starting = null; }); await this.starting; return; }
    await this.persist(this.state.record!.closed, this.state.record!.outcome === "interrupted");
  }
  next() { if (this.busy || this.state.run?.status !== "summary") return; this.update({ index: this.state.index + 1, run: null, record: null, durable: null }); }
  repeat() {
    if (this.busy || this.state.run?.status !== "summary" || this.state.queue.length >= L.queue) return;
    const queue = [...this.state.queue]; queue.splice(this.state.index + 1, 0, { exerciseId: this.state.record!.exerciseId, occurrenceId: this.id() });
    this.update({ queue }); this.next(); void this.start();
  }
  async skip() {
    if (this.busy || this.state.run || !this.state.queue[this.state.index]) return;
    const calendar = programCalendarNow(this.wall());
    this.pendingSkip = { ...createProgramRecordBase(this.program, this.state.queue[this.state.index]!, this.id(), calendar), kind: "skip", skippedAt: calendar.utcStartedAt };
    await this.saveSkip();
  }
  private async saveSkip() {
    this.update({ saving: true, error: "" });
    try { await this.store.save(this.pendingSkip!, null); this.pendingSkip = null; this.update({ saving: false, index: this.state.index + 1, changed: this.state.changed + 1 }); }
    catch (error) { this.update({ saving: false, error: error instanceof Error ? error.message : "Skip evidence is pending. Retry saving." }); }
  }
  returnToPool() { if (this.busy) return false; this.update({ queue: [], index: 0, run: null, record: null, durable: null }); return true; }
  attach() {
    this.attached++; this.epoch++; this.disposed = false;
    const background = () => { if (document.visibilityState === "hidden") this.interrupt(); };
    const beforeUnload = (event: BeforeUnloadEvent) => { if (this.busy) { event.preventDefault(); event.returnValue = ""; } };
    document.addEventListener("visibilitychange", background); document.addEventListener("freeze", this.interrupt);
    window.addEventListener("pagehide", this.interrupt); window.addEventListener("beforeunload", beforeUnload);
    this.timer ??= setInterval(() => {
      if (this.state.run?.status === "active" && !this.state.error) {
        if (this.snapshot(false).activeDurationMs >= L.durationMs) this.interrupt(); else void this.persist(false);
      }
    }, L.checkpointMs);
    return () => {
      document.removeEventListener("visibilitychange", background); document.removeEventListener("freeze", this.interrupt);
      window.removeEventListener("pagehide", this.interrupt); window.removeEventListener("beforeunload", beforeUnload);
      this.attached--; const epoch = ++this.epoch;
      queueMicrotask(() => { if (this.attached || epoch !== this.epoch) return; this.interrupt(); this.disposed = true; if (this.timer) clearInterval(this.timer); this.timer = null;
        void Promise.allSettled([this.writing, this.starting]).finally(() => { this.release?.(); this.release = null; this.store.close(); }); });
    };
  }
}
