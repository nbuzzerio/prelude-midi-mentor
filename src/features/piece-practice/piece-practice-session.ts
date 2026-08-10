import { gradePiecePracticeTarget, type PiecePracticeAttempt, type PiecePracticeGrade } from "./piece-practice-validation";
import type { PiecePracticeMeasure, PiecePracticePiece, PiecePracticeTarget } from "./piece-practice-types";

export type PiecePracticeSessionStatus = "practicing" | "awaiting-explicit-measure-advance" | "piece-complete";

export type PiecePracticeSessionState = Readonly<{
  startMeasureIndex: number;
  currentMeasureIndex: number;
  currentTargetIndex: number | null;
  completedTargetCount: number;
  completedMeasureCount: number;
  completedMeasureIndexes: readonly number[];
  incorrectAttemptCount: number;
  currentTargetIncorrectAttemptCount: number;
  status: PiecePracticeSessionStatus;
  startedAtMs: number;
}>;

export type CreatePiecePracticeSessionResult =
  | Readonly<{ ok: true; state: PiecePracticeSessionState }>
  | Readonly<{ ok: false; reason: "invalid-start-measure" }>;

export type SubmitPiecePracticeAttemptResult =
  | Readonly<{ accepted: false; reason: "not-practicing" | "stale-target"; state: PiecePracticeSessionState }>
  | Readonly<{ accepted: true; grade: PiecePracticeGrade; state: PiecePracticeSessionState }>;

export type AdvancePiecePracticeMeasureResult =
  | Readonly<{ advanced: false; reason: "not-awaiting-explicit-advance"; state: PiecePracticeSessionState }>
  | Readonly<{ advanced: true; state: PiecePracticeSessionState }>;

export type PiecePracticeProgress = Readonly<{
  currentMeasureNumber: number;
  totalPieceMeasures: number;
  practiceMeasureCount: number;
  practicedMeasureCount: number;
  completedTargetCount: number;
  incorrectAttemptCount: number;
  elapsedMs: number;
  status: PiecePracticeSessionStatus;
}>;

function requireTimestamp(timestampMs: number): void {
  if (!Number.isFinite(timestampMs) || timestampMs < 0) throw new Error("Piece Practice timestamps must be finite non-negative numbers.");
}

function stateForMeasure(base: Omit<PiecePracticeSessionState, "currentMeasureIndex" | "currentTargetIndex" | "status" | "currentTargetIncorrectAttemptCount">, measure: PiecePracticeMeasure): PiecePracticeSessionState {
  const hasTargets = measure.targets.length > 0;
  return {
    ...base,
    currentMeasureIndex: measure.measureIndex,
    currentTargetIndex: hasTargets ? 0 : null,
    currentTargetIncorrectAttemptCount: 0,
    status: hasTargets ? "practicing" : "awaiting-explicit-measure-advance",
  };
}

export function createPiecePracticeSession(piece: PiecePracticePiece, options: Readonly<{ startMeasureIndex: number; startedAtMs: number }>): CreatePiecePracticeSessionResult {
  requireTimestamp(options.startedAtMs);
  const measure = piece.measures[options.startMeasureIndex];
  if (!Number.isInteger(options.startMeasureIndex) || options.startMeasureIndex < 0 || !measure) {
    return { ok: false, reason: "invalid-start-measure" };
  }
  return {
    ok: true,
    state: stateForMeasure({
      startMeasureIndex: options.startMeasureIndex,
      completedTargetCount: 0,
      completedMeasureCount: 0,
      completedMeasureIndexes: [],
      incorrectAttemptCount: 0,
      startedAtMs: options.startedAtMs,
    }, measure),
  };
}

export function getCurrentPiecePracticeTarget(piece: PiecePracticePiece, state: PiecePracticeSessionState): PiecePracticeTarget | null {
  if (state.status !== "practicing" || state.currentTargetIndex === null) return null;
  return piece.measures[state.currentMeasureIndex]?.targets[state.currentTargetIndex] ?? null;
}

function completeCurrentMeasure(piece: PiecePracticePiece, state: PiecePracticeSessionState): PiecePracticeSessionState {
  const completedMeasureIndexes = state.completedMeasureIndexes.includes(state.currentMeasureIndex)
    ? state.completedMeasureIndexes
    : [...state.completedMeasureIndexes, state.currentMeasureIndex].sort((left, right) => left - right);
  const completedBase = {
    ...state,
    completedMeasureIndexes,
    completedMeasureCount: completedMeasureIndexes.length,
    currentTargetIncorrectAttemptCount: 0,
  };
  const nextMeasure = piece.measures[state.currentMeasureIndex + 1];
  if (!nextMeasure) {
    return { ...completedBase, currentTargetIndex: null, status: "piece-complete" };
  }
  return stateForMeasure(completedBase, nextMeasure);
}

export function submitPiecePracticeAttempt(piece: PiecePracticePiece, state: PiecePracticeSessionState, input: Readonly<{
  targetId: string;
  attempt: PiecePracticeAttempt;
}>): SubmitPiecePracticeAttemptResult {
  const target = getCurrentPiecePracticeTarget(piece, state);
  if (!target) return { accepted: false, reason: "not-practicing", state };
  if (input.targetId !== target.id) return { accepted: false, reason: "stale-target", state };
  const grade = gradePiecePracticeTarget(target, input.attempt);
  if (!grade.correct) {
    return {
      accepted: true,
      grade,
      state: {
        ...state,
        incorrectAttemptCount: state.incorrectAttemptCount + 1,
        currentTargetIncorrectAttemptCount: state.currentTargetIncorrectAttemptCount + 1,
      },
    };
  }

  const measure = piece.measures[state.currentMeasureIndex];
  if (!measure) return { accepted: false, reason: "not-practicing", state };
  const completedTargetCount = state.completedTargetCount + 1;
  const nextTargetIndex = (state.currentTargetIndex ?? 0) + 1;
  const advancedState = nextTargetIndex < measure.targets.length
    ? { ...state, completedTargetCount, currentTargetIndex: nextTargetIndex, currentTargetIncorrectAttemptCount: 0 }
    : completeCurrentMeasure(piece, { ...state, completedTargetCount });
  return { accepted: true, grade, state: advancedState };
}

export function advancePiecePracticeNoAttackMeasure(piece: PiecePracticePiece, state: PiecePracticeSessionState): AdvancePiecePracticeMeasureResult {
  const measure = piece.measures[state.currentMeasureIndex];
  if (state.status !== "awaiting-explicit-measure-advance" || !measure || measure.targets.length !== 0) {
    return { advanced: false, reason: "not-awaiting-explicit-advance", state };
  }
  return { advanced: true, state: completeCurrentMeasure(piece, state) };
}

export function restartCurrentPiecePracticeMeasure(piece: PiecePracticePiece, state: PiecePracticeSessionState): PiecePracticeSessionState {
  const measure = piece.measures[state.currentMeasureIndex];
  if (!measure) return state;
  const wasCompleted = state.completedMeasureIndexes.includes(state.currentMeasureIndex);
  const completedMeasureIndexes = wasCompleted
    ? state.completedMeasureIndexes.filter((measureIndex) => measureIndex !== state.currentMeasureIndex)
    : state.completedMeasureIndexes;
  const completedInCurrentMeasure = wasCompleted
    ? measure.targets.length
    : state.status === "practicing" ? state.currentTargetIndex ?? 0 : 0;
  const completedTargetCount = Math.max(0, state.completedTargetCount - completedInCurrentMeasure);
  return stateForMeasure({
    ...state,
    completedTargetCount,
    completedMeasureCount: completedMeasureIndexes.length,
    completedMeasureIndexes,
  }, measure);
}

export function restartPiecePractice(piece: PiecePracticePiece, state: PiecePracticeSessionState, startedAtMs: number): PiecePracticeSessionState {
  requireTimestamp(startedAtMs);
  const measure = piece.measures[state.startMeasureIndex];
  if (!measure) return state;
  return stateForMeasure({
    startMeasureIndex: state.startMeasureIndex,
    completedTargetCount: 0,
    completedMeasureCount: 0,
    completedMeasureIndexes: [],
    incorrectAttemptCount: 0,
    startedAtMs,
  }, measure);
}

export function getPiecePracticeElapsedMs(state: PiecePracticeSessionState, nowMs: number): number {
  requireTimestamp(nowMs);
  return Math.max(0, nowMs - state.startedAtMs);
}

export function getPiecePracticeProgress(piece: PiecePracticePiece, state: PiecePracticeSessionState, nowMs: number): PiecePracticeProgress {
  return {
    currentMeasureNumber: state.currentMeasureIndex + 1,
    totalPieceMeasures: piece.measures.length,
    practiceMeasureCount: piece.measures.length - state.startMeasureIndex,
    practicedMeasureCount: state.completedMeasureCount,
    completedTargetCount: state.completedTargetCount,
    incorrectAttemptCount: state.incorrectAttemptCount,
    elapsedMs: getPiecePracticeElapsedMs(state, nowMs),
    status: state.status,
  };
}
