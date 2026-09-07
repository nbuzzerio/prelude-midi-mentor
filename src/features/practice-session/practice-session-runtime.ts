import type { PracticeExerciseEntry, PracticeSessionPreset } from "./practice-session-types";

export type PracticeSessionRunSnapshot = Readonly<{
  presetId: string;
  presetName: string;
  exercises: readonly PracticeExerciseEntry[];
}>;

export type PracticeSessionExerciseDisposition = "completed" | "skipped" | "not-reached";

export type PracticeSessionExerciseRecord = Readonly<{
  exerciseId: string;
  exerciseIndex: number;
  label: string;
  startedAt: number;
  endedAt: number | null;
  actual: number | null;
  targetAchieved: boolean;
  bonusUsed: boolean;
  disposition: PracticeSessionExerciseDisposition | null;
}>;

export type ActivePracticeSessionRun = Readonly<{
  status: "active";
  runId: string;
  snapshot: PracticeSessionRunSnapshot;
  startedAt: number;
  activeExerciseIndex: number;
  activeExerciseToken: string;
  completionPresentation: "practicing" | "target-complete" | "bonus";
  records: readonly PracticeSessionExerciseRecord[];
}>;

export type CompletedPracticeSessionRun = Readonly<{
  status: "summary";
  runId: string;
  snapshot: PracticeSessionRunSnapshot;
  startedAt: number;
  endedAt: number;
  endReason: "completed" | "ended";
  records: readonly PracticeSessionExerciseRecord[];
}>;

export type PracticeSessionRunState = ActivePracticeSessionRun | CompletedPracticeSessionRun;

type ScopedEvent = Readonly<{ runId: string; exerciseToken: string; exerciseId: string }>;
export type PracticeSessionRunEvent =
  | Readonly<{ type: "CLEAR_RUN" }>
  | Readonly<{ type: "START_RUN"; runId: string; startedAt: number; firstExerciseToken: string; snapshot: PracticeSessionRunSnapshot }>
  | (ScopedEvent & Readonly<{ type: "UNIT_COMPLETED" }>)
  | (ScopedEvent & Readonly<{ type: "TARGET_REACHED" }>)
  | (ScopedEvent & Readonly<{ type: "KEEP_PLAYING" }>)
  | (ScopedEvent & Readonly<{ type: "ADVANCE"; endedAt: number; nextStartedAt?: number; nextExerciseToken?: string }>)
  | (ScopedEvent & Readonly<{ type: "SKIP"; endedAt: number; nextStartedAt?: number; nextExerciseToken?: string }>)
  | (ScopedEvent & Readonly<{ type: "END"; endedAt: number }>);

export function createPracticeSessionRunSnapshot(preset: PracticeSessionPreset): PracticeSessionRunSnapshot {
  const copy = JSON.parse(JSON.stringify(preset)) as PracticeSessionPreset;
  return { presetId: copy.id, presetName: copy.name, exercises: copy.exercises };
}

function createRecord(entry: PracticeExerciseEntry, exerciseIndex: number, startedAt: number): PracticeSessionExerciseRecord {
  return {
    exerciseId: entry.id,
    exerciseIndex,
    label: entry.label,
    startedAt,
    endedAt: null,
    actual: entry.engine === "melody" ? null : 0,
    targetAchieved: false,
    bonusUsed: false,
    disposition: null,
  };
}

function matchesActive(state: PracticeSessionRunState, event: ScopedEvent): state is ActivePracticeSessionRun {
  if (state.status !== "active" || state.runId !== event.runId || state.activeExerciseToken !== event.exerciseToken) return false;
  return state.snapshot.exercises[state.activeExerciseIndex]?.id === event.exerciseId;
}

function replaceActiveRecord(state: ActivePracticeSessionRun, change: (record: PracticeSessionExerciseRecord) => PracticeSessionExerciseRecord): ActivePracticeSessionRun {
  const records = [...state.records];
  records[records.length - 1] = change(records[records.length - 1]!);
  return { ...state, records };
}

function finishCurrent(
  state: ActivePracticeSessionRun,
  endedAt: number,
  disposition: PracticeSessionExerciseDisposition,
): readonly PracticeSessionExerciseRecord[] {
  const records = [...state.records];
  records[records.length - 1] = { ...records[records.length - 1]!, endedAt, disposition };
  return records;
}

function advanceOrFinish(
  state: ActivePracticeSessionRun,
  event: Extract<PracticeSessionRunEvent, { type: "ADVANCE" | "SKIP" }>,
  disposition: "completed" | "skipped",
): PracticeSessionRunState {
  const records = finishCurrent(state, event.endedAt, disposition);
  const nextIndex = state.activeExerciseIndex + 1;
  const nextEntry = state.snapshot.exercises[nextIndex];
  if (!nextEntry) return { status: "summary", runId: state.runId, snapshot: state.snapshot, startedAt: state.startedAt, endedAt: event.endedAt, endReason: "completed", records };
  if (event.nextStartedAt === undefined || event.nextExerciseToken === undefined) return state;
  return {
    ...state,
    activeExerciseIndex: nextIndex,
    activeExerciseToken: event.nextExerciseToken,
    completionPresentation: "practicing",
    records: [...records, createRecord(nextEntry, nextIndex, event.nextStartedAt)],
  };
}

export function practiceSessionRunReducer(state: PracticeSessionRunState | null, event: PracticeSessionRunEvent): PracticeSessionRunState | null {
  if (event.type === "CLEAR_RUN") return null;
  if (event.type === "START_RUN") {
    const first = event.snapshot.exercises[0];
    if (!first) return state;
    return {
      status: "active", runId: event.runId, snapshot: event.snapshot, startedAt: event.startedAt,
      activeExerciseIndex: 0, activeExerciseToken: event.firstExerciseToken,
      completionPresentation: "practicing", records: [createRecord(first, 0, event.startedAt)],
    };
  }
  if (state === null || !matchesActive(state, event)) return state;
  const entry = state.snapshot.exercises[state.activeExerciseIndex]!;
  if (event.type === "UNIT_COMPLETED") {
    if (state.completionPresentation === "target-complete") return state;
    const current = state.records[state.records.length - 1]!;
    if (current.actual === null) return state;
    const actual = current.actual + 1;
    const numericTarget = "count" in entry.target ? entry.target.count : null;
    const newlyAchieved = !current.targetAchieved && numericTarget !== null && actual >= numericTarget;
    const next = replaceActiveRecord(state, (record) => ({ ...record, actual, targetAchieved: record.targetAchieved || newlyAchieved }));
    return newlyAchieved ? { ...next, completionPresentation: "target-complete" } : next;
  }
  if (event.type === "TARGET_REACHED") {
    const current = state.records[state.records.length - 1]!;
    if (current.targetAchieved) return state;
    if (entry.target.kind !== "complete-scale-repertoire" && entry.target.kind !== "configured-timed-practice") return state;
    return { ...replaceActiveRecord(state, (record) => ({ ...record, targetAchieved: true })), completionPresentation: "target-complete" };
  }
  if (event.type === "KEEP_PLAYING") {
    if (!state.records[state.records.length - 1]!.targetAchieved) return state;
    return { ...replaceActiveRecord(state, (record) => ({ ...record, bonusUsed: true })), completionPresentation: "bonus" };
  }
  if (event.type === "ADVANCE") {
    if (!state.records[state.records.length - 1]!.targetAchieved) return state;
    return advanceOrFinish(state, event, "completed");
  }
  if (event.type === "SKIP") return advanceOrFinish(state, event, "skipped");
  const achieved = state.records[state.records.length - 1]!.targetAchieved;
  return {
    status: "summary", runId: state.runId, snapshot: state.snapshot, startedAt: state.startedAt,
    endedAt: event.endedAt, endReason: "ended",
    records: finishCurrent(state, event.endedAt, achieved ? "completed" : "not-reached"),
  };
}

export function getPracticeSessionProgressText(entry: PracticeExerciseEntry, actual: number | null): string {
  if (entry.engine === "melody") return `Target: ${entry.config.continuousDurationMinutes} minutes`;
  const count = actual ?? 0;
  if (entry.engine === "sequences" && entry.target.kind === "complete-scale-repertoire") return `${count} / ${entry.config.scaleRepertoire.length} scales`;
  if (entry.target.kind === "correct-answers") return `${count} / ${entry.target.count} correct`;
  if (entry.target.kind === "correct-identifications") return `${count} / ${entry.target.count} correct`;
  if (entry.target.kind === "completed-sequences") return `${count} / ${entry.target.count} completed`;
  return `${count} completed`;
}

export function getPracticeSessionRecordSummary(record: PracticeSessionExerciseRecord, entry: PracticeExerciseEntry): string {
  if (record.disposition === "skipped") return "Skipped";
  const prefix = record.disposition === "completed" ? "Completed" : "Not reached";
  if (entry.engine === "melody") return `${prefix} · timed practice`;
  if (record.actual === null) return prefix;
  if (entry.target.kind === "complete-scale-repertoire") return `${prefix} · ${record.actual} scales`;
  if (entry.target.kind === "correct-answers" || entry.target.kind === "correct-identifications") return `${prefix} · ${record.actual} / ${entry.target.count} correct`;
  return `${prefix} · ${record.actual} / ${entry.target.count} completed`;
}
