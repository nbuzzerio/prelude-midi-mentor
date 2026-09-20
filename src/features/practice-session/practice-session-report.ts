import { getPracticeSessionExerciseActiveTime, type PracticeSessionRunState } from "./practice-session-runtime";
import type { PracticeExerciseEntry } from "./practice-session-types";
import type { PracticeSessionEngineResult } from "./practice-session-engine-result";

export type PracticeSessionReportExerciseOutcome = "completed" | "skipped" | "ended-before-target" | "never-entered" | "in-progress";

export type PracticeSessionExerciseReport = Readonly<{
  exerciseIndex: number;
  exerciseId: string;
  label: string;
  engine: PracticeExerciseEntry["engine"];
  prescription: PracticeExerciseEntry;
  entered: boolean;
  outcome: PracticeSessionReportExerciseOutcome;
  prescribedUnitsCompleted: number;
  bonusUnitsCompleted: number;
  prescribedActiveDurationMs: number;
  bonusActiveDurationMs: number;
  totalActiveDurationMs: number;
  targetReached: boolean;
  bonusUsed: boolean;
  targetBoundaryEngineResult: PracticeSessionEngineResult | null;
  finalEngineResult: PracticeSessionEngineResult | null;
}>;

export type PracticeSessionReport = Readonly<{
  runId: string;
  presetId: string;
  presetName: string;
  totalActiveDurationMs: number;
  enteredExerciseCount: number;
  targetReachedCount: number;
  skippedCount: number;
  endedBeforeTargetCount: number;
  neverEnteredCount: number;
  bonusExerciseCount: number;
  exercises: readonly PracticeSessionExerciseReport[];
}>;

export function derivePracticeSessionReport(run: PracticeSessionRunState, at: number = run.status === "summary" ? run.endedAt : run.startedAt): PracticeSessionReport {
  const recordsByIndex = new Map(run.records.map((record) => [record.exerciseIndex, record]));
  const exercises = run.snapshot.exercises.map((entry, exerciseIndex): PracticeSessionExerciseReport => {
    const record = recordsByIndex.get(exerciseIndex);
    if (!record) return {
      exerciseIndex, exerciseId: entry.id, label: entry.label, engine: entry.engine, prescription: entry,
      entered: false, outcome: "never-entered", prescribedUnitsCompleted: 0, bonusUnitsCompleted: 0,
      prescribedActiveDurationMs: 0, bonusActiveDurationMs: 0, totalActiveDurationMs: 0,
      targetReached: false, bonusUsed: false,
      targetBoundaryEngineResult: null, finalEngineResult: null,
    };
    const timing = getPracticeSessionExerciseActiveTime(record, at);
    return {
      exerciseIndex, exerciseId: entry.id, label: record.label, engine: entry.engine, prescription: entry,
      entered: true, outcome: record.disposition ?? "in-progress",
      prescribedUnitsCompleted: record.prescribedUnitsCompleted,
      bonusUnitsCompleted: record.bonusUnitsCompleted,
      ...timing, targetReached: record.targetAchieved, bonusUsed: record.bonusUsed,
      targetBoundaryEngineResult: record.targetBoundaryEngineResult, finalEngineResult: record.latestEngineResult,
    };
  });
  return Object.freeze({
    runId: run.runId, presetId: run.snapshot.presetId, presetName: run.snapshot.presetName,
    totalActiveDurationMs: exercises.reduce((total, exercise) => total + exercise.totalActiveDurationMs, 0),
    enteredExerciseCount: exercises.filter(({ entered }) => entered).length,
    targetReachedCount: exercises.filter(({ targetReached }) => targetReached).length,
    skippedCount: exercises.filter(({ outcome }) => outcome === "skipped").length,
    endedBeforeTargetCount: exercises.filter(({ outcome }) => outcome === "ended-before-target").length,
    neverEnteredCount: exercises.filter(({ outcome }) => outcome === "never-entered").length,
    bonusExerciseCount: exercises.filter(({ bonusUsed }) => bonusUsed).length,
    exercises: Object.freeze(exercises),
  });
}
