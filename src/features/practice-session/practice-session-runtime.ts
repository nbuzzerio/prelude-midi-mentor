import { createActiveTimeAccumulator, getActiveTimeMs, pauseActiveTime, resumeActiveTime, type ActiveTimeAccumulator } from "@/lib/practice/active-time";
import type { PracticeExerciseEntry, PracticeSessionPreset } from "./practice-session-types";
import type { PracticeSessionEngineResult } from "./practice-session-engine-result";

export type PracticeSessionRunSnapshot = Readonly<{ presetId: string; presetName: string; exercises: readonly PracticeExerciseEntry[] }>;
export type PracticeSessionExerciseDisposition = "completed" | "skipped" | "ended-before-target";
export type PracticeSessionWorkPhase = "prescribed" | "bonus";

type ExerciseEvidenceBase = Readonly<{ sequence: number; exerciseId: string; exerciseIndex: number; occurredAt: number; occurredAtActiveMs: number }>;
export type PracticeSessionLifecycleEvidence =
  | (ExerciseEvidenceBase & Readonly<{ type: "exercise-entered" }>)
  | (ExerciseEvidenceBase & Readonly<{ type: "unit-completed"; phase: PracticeSessionWorkPhase }>)
  | (ExerciseEvidenceBase & Readonly<{ type: "target-reached" }>)
  | (ExerciseEvidenceBase & Readonly<{ type: "bonus-started" }>)
  | (ExerciseEvidenceBase & Readonly<{ type: "exercise-ended"; outcome: PracticeSessionExerciseDisposition }>)
  | Readonly<{ sequence: number; type: "session-ended"; occurredAt: number; occurredAtActiveMs: number; reason: "completed" | "ended" }>;

export type PracticeSessionExerciseRecord = Readonly<{
  exerciseId: string; exerciseIndex: number; label: string; startedAt: number; endedAt: number | null;
  actual: number | null; prescribedUnitsCompleted: number; bonusUnitsCompleted: number;
  prescribedTime: ActiveTimeAccumulator; bonusTime: ActiveTimeAccumulator;
  latestEngineResult: PracticeSessionEngineResult | null;
  targetBoundaryEngineResult: PracticeSessionEngineResult | null;
  targetAchieved: boolean; bonusUsed: boolean; disposition: PracticeSessionExerciseDisposition | null;
}>;

type RunBase = Readonly<{
  runId: string; snapshot: PracticeSessionRunSnapshot; startedAt: number;
  records: readonly PracticeSessionExerciseRecord[]; evidence: readonly PracticeSessionLifecycleEvidence[];
}>;
export type ActivePracticeSessionRun = RunBase & Readonly<{
  status: "active"; activeExerciseIndex: number; activeExerciseToken: string;
  completionPresentation: "practicing" | "target-complete" | "bonus"; foreground: boolean;
}>;
export type CompletedPracticeSessionRun = RunBase & Readonly<{ status: "summary"; endedAt: number; endReason: "completed" | "ended" }>;
export type PracticeSessionRunState = ActivePracticeSessionRun | CompletedPracticeSessionRun;

type ScopedEvent = Readonly<{ runId: string; exerciseToken: string; exerciseId: string }>;
export type PracticeSessionRunEvent =
  | Readonly<{ type: "CLEAR_RUN" }>
  | Readonly<{ type: "START_RUN"; runId: string; startedAt: number; firstExerciseToken: string; snapshot: PracticeSessionRunSnapshot; foreground?: boolean }>
  | (ScopedEvent & Readonly<{ type: "UNIT_COMPLETED"; at: number }>)
  | (ScopedEvent & Readonly<{ type: "ENGINE_RESULT_CHANGED"; result: PracticeSessionEngineResult }>)
  | (ScopedEvent & Readonly<{ type: "TARGET_REACHED"; at: number }>)
  | (ScopedEvent & Readonly<{ type: "KEEP_PLAYING"; at: number }>)
  | (ScopedEvent & Readonly<{ type: "VISIBILITY_CHANGED"; at: number; foreground: boolean }>)
  | (ScopedEvent & Readonly<{ type: "ADVANCE"; endedAt: number; nextStartedAt?: number; nextExerciseToken?: string }>)
  | (ScopedEvent & Readonly<{ type: "SKIP"; endedAt: number; nextStartedAt?: number; nextExerciseToken?: string }>)
  | (ScopedEvent & Readonly<{ type: "END"; endedAt: number }>);

export function createPracticeSessionRunSnapshot(preset: PracticeSessionPreset): PracticeSessionRunSnapshot {
  const copy = JSON.parse(JSON.stringify(preset)) as PracticeSessionPreset;
  return { presetId: copy.id, presetName: copy.name, exercises: copy.exercises };
}

function createRecord(entry: PracticeExerciseEntry, exerciseIndex: number, startedAt: number, foreground: boolean): PracticeSessionExerciseRecord {
  return {
    exerciseId: entry.id, exerciseIndex, label: entry.label, startedAt, endedAt: null,
    actual: entry.engine === "melody" ? null : 0, prescribedUnitsCompleted: 0, bonusUnitsCompleted: 0,
    prescribedTime: createActiveTimeAccumulator(startedAt, foreground), bonusTime: createActiveTimeAccumulator(startedAt, false),
    latestEngineResult: null, targetBoundaryEngineResult: null,
    targetAchieved: false, bonusUsed: false, disposition: null,
  };
}
function immutableEngineResultSnapshot<T extends PracticeSessionEngineResult>(value: T): T {
  const copy = (candidate: unknown): unknown => {
    if (Array.isArray(candidate)) return Object.freeze(candidate.map(copy));
    if (candidate !== null && typeof candidate === "object") {
      return Object.freeze(Object.fromEntries(Object.entries(candidate).map(([key, nested]) => [key, copy(nested)])));
    }
    return candidate;
  };
  return copy(value) as T;
}

function activeDuration(record: PracticeSessionExerciseRecord, at: number): number {
  return getActiveTimeMs(record.prescribedTime, at) + getActiveTimeMs(record.bonusTime, at);
}
function totalActiveMs(records: readonly PracticeSessionExerciseRecord[], at: number): number {
  return records.reduce((total, record) => total + activeDuration(record, at), 0);
}
function appendEvidence<T extends Omit<PracticeSessionLifecycleEvidence, "sequence">>(state: Pick<RunBase, "evidence">, item: T): PracticeSessionLifecycleEvidence {
  return Object.freeze({ ...item, sequence: state.evidence.length }) as PracticeSessionLifecycleEvidence;
}
function exerciseEvidence(
  state: ActivePracticeSessionRun, record: PracticeSessionExerciseRecord, at: number,
  item: Readonly<{ type: "exercise-entered" | "target-reached" | "bonus-started" }>
    | Readonly<{ type: "unit-completed"; phase: PracticeSessionWorkPhase }>
    | Readonly<{ type: "exercise-ended"; outcome: PracticeSessionExerciseDisposition }>,
): PracticeSessionLifecycleEvidence {
  return appendEvidence(state, { ...item, exerciseId: record.exerciseId, exerciseIndex: record.exerciseIndex, occurredAt: at, occurredAtActiveMs: totalActiveMs(state.records, at) });
}
function matchesActive(state: PracticeSessionRunState, event: ScopedEvent): state is ActivePracticeSessionRun {
  return state.status === "active" && state.runId === event.runId && state.activeExerciseToken === event.exerciseToken
    && state.snapshot.exercises[state.activeExerciseIndex]?.id === event.exerciseId;
}
function replaceActiveRecord(state: ActivePracticeSessionRun, record: PracticeSessionExerciseRecord): ActivePracticeSessionRun {
  const records = [...state.records]; records[records.length - 1] = record; return { ...state, records };
}
function pauseRecord(record: PracticeSessionExerciseRecord, at: number): PracticeSessionExerciseRecord {
  return { ...record, prescribedTime: pauseActiveTime(record.prescribedTime, at), bonusTime: pauseActiveTime(record.bonusTime, at) };
}
function finishCurrent(state: ActivePracticeSessionRun, endedAt: number, disposition: PracticeSessionExerciseDisposition) {
  const current = { ...pauseRecord(state.records.at(-1)!, endedAt), endedAt, disposition };
  const records = [...state.records]; records[records.length - 1] = current;
  const withRecord = { ...state, records };
  return { records, current, endedEvidence: exerciseEvidence(withRecord, current, endedAt, { type: "exercise-ended", outcome: disposition }) };
}
function finishSession(state: ActivePracticeSessionRun, records: readonly PracticeSessionExerciseRecord[], priorEvidence: readonly PracticeSessionLifecycleEvidence[], endedAt: number, reason: "completed" | "ended"): CompletedPracticeSessionRun {
  return {
    status: "summary", runId: state.runId, snapshot: state.snapshot, startedAt: state.startedAt, endedAt, endReason: reason, records,
    evidence: [...priorEvidence, appendEvidence({ evidence: priorEvidence }, { type: "session-ended", occurredAt: endedAt, occurredAtActiveMs: totalActiveMs(records, endedAt), reason })],
  };
}
function advanceOrFinish(state: ActivePracticeSessionRun, event: Extract<PracticeSessionRunEvent, { type: "ADVANCE" | "SKIP" }>, disposition: "completed" | "skipped"): PracticeSessionRunState {
  const finished = finishCurrent(state, event.endedAt, disposition);
  const evidenceAfterEnd = [...state.evidence, finished.endedEvidence];
  const nextIndex = state.activeExerciseIndex + 1;
  const nextEntry = state.snapshot.exercises[nextIndex];
  if (!nextEntry) return finishSession(state, finished.records, evidenceAfterEnd, event.endedAt, "completed");
  if (event.nextStartedAt === undefined || event.nextExerciseToken === undefined) return state;
  const nextRecord = createRecord(nextEntry, nextIndex, event.nextStartedAt, state.foreground);
  const enteredState = { ...state, records: [...finished.records, nextRecord], evidence: evidenceAfterEnd };
  return {
    ...state, activeExerciseIndex: nextIndex, activeExerciseToken: event.nextExerciseToken, completionPresentation: "practicing",
    records: enteredState.records, evidence: [...evidenceAfterEnd, exerciseEvidence(enteredState, nextRecord, event.nextStartedAt, { type: "exercise-entered" })],
  };
}

export function practiceSessionRunReducer(state: PracticeSessionRunState | null, event: PracticeSessionRunEvent): PracticeSessionRunState | null {
  if (event.type === "CLEAR_RUN") return null;
  if (event.type === "START_RUN") {
    const first = event.snapshot.exercises[0]; if (!first) return state;
    const foreground = event.foreground ?? true;
    const record = createRecord(first, 0, event.startedAt, foreground);
    const initial: ActivePracticeSessionRun = { status: "active", runId: event.runId, snapshot: event.snapshot, startedAt: event.startedAt, activeExerciseIndex: 0, activeExerciseToken: event.firstExerciseToken, completionPresentation: "practicing", foreground, records: [record], evidence: [] };
    return { ...initial, evidence: [exerciseEvidence(initial, record, event.startedAt, { type: "exercise-entered" })] };
  }
  if (state === null || !matchesActive(state, event)) return state;
  const entry = state.snapshot.exercises[state.activeExerciseIndex]!;
  const current = state.records.at(-1)!;
  if (event.type === "ENGINE_RESULT_CHANGED") {
    if (event.result.engine !== entry.engine) return state;
    return replaceActiveRecord(state, { ...current, latestEngineResult: immutableEngineResultSnapshot(event.result) });
  }
  if (event.type === "VISIBILITY_CHANGED") {
    if (state.foreground === event.foreground) return state;
    let changed = current;
    if (!event.foreground) changed = pauseRecord(current, event.at);
    else if (state.completionPresentation === "practicing") changed = { ...current, prescribedTime: resumeActiveTime(current.prescribedTime, event.at) };
    else if (state.completionPresentation === "bonus") changed = { ...current, bonusTime: resumeActiveTime(current.bonusTime, event.at) };
    return { ...replaceActiveRecord(state, changed), foreground: event.foreground };
  }
  if (event.type === "UNIT_COMPLETED") {
    if (state.completionPresentation === "target-complete" || current.actual === null) return state;
    const phase: PracticeSessionWorkPhase = state.completionPresentation === "bonus" ? "bonus" : "prescribed";
    const prescribedUnitsCompleted = current.prescribedUnitsCompleted + (phase === "prescribed" ? 1 : 0);
    const bonusUnitsCompleted = current.bonusUnitsCompleted + (phase === "bonus" ? 1 : 0);
    const actual = prescribedUnitsCompleted + bonusUnitsCompleted;
    const numericTarget = "count" in entry.target ? entry.target.count : null;
    const newlyAchieved = !current.targetAchieved && numericTarget !== null && actual >= numericTarget;
    const nextRecord = { ...current, actual, prescribedUnitsCompleted, bonusUnitsCompleted, targetAchieved: current.targetAchieved || newlyAchieved, prescribedTime: newlyAchieved ? pauseActiveTime(current.prescribedTime, event.at) : current.prescribedTime, targetBoundaryEngineResult: newlyAchieved ? current.latestEngineResult : current.targetBoundaryEngineResult };
    const next = replaceActiveRecord(state, nextRecord);
    const unit = exerciseEvidence(next, nextRecord, event.at, { type: "unit-completed", phase });
    if (!newlyAchieved) return { ...next, evidence: [...state.evidence, unit] };
    const withUnit = { ...next, evidence: [...state.evidence, unit] };
    return { ...withUnit, completionPresentation: "target-complete", evidence: [...withUnit.evidence, exerciseEvidence(withUnit, nextRecord, event.at, { type: "target-reached" })] };
  }
  if (event.type === "TARGET_REACHED") {
    if (current.targetAchieved || (entry.target.kind !== "complete-scale-repertoire" && entry.target.kind !== "configured-timed-practice")) return state;
    const nextRecord = { ...current, targetAchieved: true, prescribedTime: pauseActiveTime(current.prescribedTime, event.at), targetBoundaryEngineResult: current.latestEngineResult };
    const next = replaceActiveRecord(state, nextRecord);
    return { ...next, completionPresentation: "target-complete", evidence: [...state.evidence, exerciseEvidence(next, nextRecord, event.at, { type: "target-reached" })] };
  }
  if (event.type === "KEEP_PLAYING") {
    if (!current.targetAchieved || state.completionPresentation !== "target-complete") return state;
    const nextRecord = { ...current, bonusUsed: true, bonusTime: state.foreground ? resumeActiveTime(current.bonusTime, event.at) : current.bonusTime };
    const next = replaceActiveRecord(state, nextRecord);
    return { ...next, completionPresentation: "bonus", evidence: [...state.evidence, exerciseEvidence(next, nextRecord, event.at, { type: "bonus-started" })] };
  }
  if (event.type === "ADVANCE") {
    if (!current.targetAchieved) return state;
    return advanceOrFinish(state, event, "completed");
  }
  if (event.type === "SKIP") return advanceOrFinish(state, event, "skipped");
  const disposition = current.targetAchieved ? "completed" : "ended-before-target";
  const finished = finishCurrent(state, event.endedAt, disposition);
  return finishSession(state, finished.records, [...state.evidence, finished.endedEvidence], event.endedAt, "ended");
}

export function getPracticeSessionExerciseActiveTime(record: PracticeSessionExerciseRecord, at: number) {
  const prescribedActiveDurationMs = getActiveTimeMs(record.prescribedTime, at);
  const bonusActiveDurationMs = getActiveTimeMs(record.bonusTime, at);
  return { prescribedActiveDurationMs, bonusActiveDurationMs, totalActiveDurationMs: prescribedActiveDurationMs + bonusActiveDurationMs };
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
