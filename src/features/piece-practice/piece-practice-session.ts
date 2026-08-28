import { gradePiecePracticeTarget, type PiecePracticeAttempt, type PiecePracticeGrade } from "./piece-practice-validation";
import type { PiecePracticeCheck, PiecePracticeMeasure, PiecePracticePiece, PiecePracticeTarget } from "./piece-practice-types";

export const PIECE_PRACTICE_ROLLED_WINDOW_QUARTER_BEATS = 1.5;

export function getPiecePracticeRolledWindowMs(tempoBpm: number): number {
  if (!Number.isFinite(tempoBpm) || tempoBpm <= 0) throw new Error("Piece Practice tempo must be positive.");
  return (60_000 / tempoBpm) * PIECE_PRACTICE_ROLLED_WINDOW_QUARTER_BEATS;
}

export type PiecePracticeCheckProgress = Readonly<{
  checkId: string;
  completed: boolean;
  accumulatedMidiNumbers: readonly number[];
  startedAtMs: number | null;
}>;

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
  currentCheckProgress: readonly PiecePracticeCheckProgress[];
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

function progressForTarget(target: PiecePracticeTarget | undefined): readonly PiecePracticeCheckProgress[] {
  return target?.checks.map(({ id }) => ({ checkId: id, completed: false, accumulatedMidiNumbers: [], startedAtMs: null })) ?? [];
}

function stateForMeasure(base: Omit<PiecePracticeSessionState, "currentMeasureIndex" | "currentTargetIndex" | "status" | "currentTargetIncorrectAttemptCount" | "currentCheckProgress">, measure: PiecePracticeMeasure): PiecePracticeSessionState {
  const hasTargets = measure.targets.length > 0;
  return {
    ...base,
    currentMeasureIndex: measure.measureIndex,
    currentTargetIndex: hasTargets ? 0 : null,
    currentTargetIncorrectAttemptCount: 0,
    currentCheckProgress: progressForTarget(measure.targets[0]),
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
    currentCheckProgress: [],
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
  const normalCheck = target.checks.find((check) => check.kind === "normal" && !state.currentCheckProgress.find(({ checkId }) => checkId === check.id)?.completed);
  if (!normalCheck) return { accepted: false, reason: "stale-target", state };
  const grade = gradePiecePracticeTarget({ ...target, ...normalCheck, checks: target.checks }, input.attempt);
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

  const currentCheckProgress = state.currentCheckProgress.map((progress) => progress.checkId === normalCheck.id ? { ...progress, completed: true } : progress);
  if (!currentCheckProgress.every(({ completed }) => completed)) return { accepted: true, grade, state: { ...state, currentCheckProgress } };
  const measure = piece.measures[state.currentMeasureIndex];
  if (!measure) return { accepted: false, reason: "not-practicing", state };
  const completedTargetCount = state.completedTargetCount + 1;
  const nextTargetIndex = (state.currentTargetIndex ?? 0) + 1;
  const advancedState = nextTargetIndex < measure.targets.length
    ? { ...state, completedTargetCount, currentTargetIndex: nextTargetIndex, currentTargetIncorrectAttemptCount: 0, currentCheckProgress: progressForTarget(measure.targets[nextTargetIndex]) }
    : completeCurrentMeasure(piece, { ...state, completedTargetCount });
  return { accepted: true, grade, state: advancedState };
}

export type SubmitPiecePracticePitchResult = Readonly<{
  accepted: boolean;
  matched: boolean;
  incorrect: boolean;
  state: PiecePracticeSessionState;
}>;

function advanceCompletedTarget(piece: PiecePracticePiece, state: PiecePracticeSessionState): PiecePracticeSessionState {
  const measure = piece.measures[state.currentMeasureIndex];
  if (!measure) return state;
  const completedTargetCount = state.completedTargetCount + 1;
  const nextTargetIndex = (state.currentTargetIndex ?? 0) + 1;
  return nextTargetIndex < measure.targets.length
    ? { ...state, completedTargetCount, currentTargetIndex: nextTargetIndex, currentTargetIncorrectAttemptCount: 0, currentCheckProgress: progressForTarget(measure.targets[nextTargetIndex]) }
    : completeCurrentMeasure(piece, { ...state, completedTargetCount });
}

export function submitPiecePracticePitch(piece: PiecePracticePiece, state: PiecePracticeSessionState, input: Readonly<{
  targetId: string;
  midiNumber: number;
  atMs: number;
  completeSingleNormalCheck?: boolean;
}>): SubmitPiecePracticePitchResult {
  requireTimestamp(input.atMs);
  const currentState = expirePiecePracticeRolledChecks(piece, state, input.atMs);
  const target = getCurrentPiecePracticeTarget(piece, currentState);
  if (!target || target.id !== input.targetId) return { accepted: false, matched: false, incorrect: false, state: currentState };
  const pendingChecks = target.checks.filter((check) => !currentState.currentCheckProgress.find(({ checkId }) => checkId === check.id)?.completed);
  const matchingRolled = pendingChecks.filter((check): check is Extract<PiecePracticeCheck, { kind: "rolled-chord" }> => check.kind === "rolled-chord" && check.expectedMidiNumbers.includes(input.midiNumber));
  const matchingNormal = pendingChecks.find((check) => check.kind === "normal" && check.expectedMidiNumbers.includes(input.midiNumber));
  const matchingSingleNormal = input.completeSingleNormalCheck !== false && matchingNormal?.expectedMidiNumbers.length === 1 ? matchingNormal : undefined;
  const matched = matchingRolled.length > 0 || Boolean(matchingSingleNormal);
  if (!matched) {
    const incorrect = !matchingNormal && pendingChecks.some(({ kind }) => kind === "rolled-chord");
    return { accepted: true, matched: false, incorrect, state: incorrect ? {
      ...currentState,
      incorrectAttemptCount: currentState.incorrectAttemptCount + 1,
      currentTargetIncorrectAttemptCount: currentState.currentTargetIncorrectAttemptCount + 1,
    } : currentState };
  }

  const currentCheckProgress = currentState.currentCheckProgress.map((progress) => {
    const check = target.checks.find(({ id }) => id === progress.checkId);
    if (!check || progress.completed) return progress;
    if (check.kind === "normal") return check.id === matchingSingleNormal?.id ? { ...progress, completed: true } : progress;
    if (!matchingRolled.some(({ id }) => id === check.id)) return progress;
    const accumulatedMidiNumbers = [...new Set([...progress.accumulatedMidiNumbers, input.midiNumber])].sort((left, right) => left - right);
    return {
      ...progress,
      accumulatedMidiNumbers,
      startedAtMs: progress.startedAtMs ?? input.atMs,
      completed: check.expectedMidiNumbers.every((midiNumber) => accumulatedMidiNumbers.includes(midiNumber)),
    };
  });
  const next = { ...currentState, currentCheckProgress };
  return { accepted: true, matched: true, incorrect: false, state: currentCheckProgress.every(({ completed }) => completed) ? advanceCompletedTarget(piece, next) : next };
}

export function expirePiecePracticeRolledChecks(piece: PiecePracticePiece, state: PiecePracticeSessionState, atMs: number): PiecePracticeSessionState {
  requireTimestamp(atMs);
  const target = getCurrentPiecePracticeTarget(piece, state);
  if (!target) return state;
  const windowMs = getPiecePracticeRolledWindowMs(piece.tempoBpm);
  let expiredCount = 0;
  const currentCheckProgress = state.currentCheckProgress.map((progress) => {
    const check = target.checks.find(({ id }) => id === progress.checkId);
    if (check?.kind !== "rolled-chord" || progress.completed || progress.startedAtMs === null || atMs < progress.startedAtMs + windowMs) return progress;
    expiredCount += 1;
    return { ...progress, accumulatedMidiNumbers: [], startedAtMs: null };
  });
  return expiredCount > 0 ? {
    ...state,
    currentCheckProgress,
    incorrectAttemptCount: state.incorrectAttemptCount + expiredCount,
    currentTargetIncorrectAttemptCount: state.currentTargetIncorrectAttemptCount + expiredCount,
  } : state;
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
