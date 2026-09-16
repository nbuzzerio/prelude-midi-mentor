import { gradePiecePracticeTarget, type PiecePracticeAttempt, type PiecePracticeGrade } from "./piece-practice-validation";
import type { PiecePracticeCheck, PiecePracticeMeasure, PiecePracticePiece, PiecePracticeTarget } from "./piece-practice-types";
import { getPiecePracticeBoundaryReattackPitches } from "./piece-practice-input";
import {
  derivePiecePracticeMeasureDiagnostics,
  getPiecePracticeHesitationThresholdMs,
  getPiecePracticeTargetExpectedWindowMs,
  snapshotPiecePracticePitches,
  type PiecePracticeMeasureDiagnostic,
  type PiecePracticeMeasureTiming,
  type PiecePracticeMistakeEvidence,
  type PiecePracticeMistakeEvidenceDraft,
  type PiecePracticeSkipEvidence,
  type PiecePracticeTargetTiming,
} from "./piece-practice-evidence";

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
  endMeasureIndex: number | null;
  currentMeasureIndex: number;
  currentTargetIndex: number | null;
  completedTargetCount: number;
  skippedTargetCount: number;
  currentMeasureCompletedTargetCount: number;
  completedMeasureCount: number;
  completedMeasureIndexes: readonly number[];
  mistakeEvidence: readonly PiecePracticeMistakeEvidence[];
  skipEvidence: readonly PiecePracticeSkipEvidence[];
  targetTimings: readonly PiecePracticeTargetTiming[];
  measureTimings: readonly PiecePracticeMeasureTiming[];
  activeElapsedMs: number;
  activeSinceMs: number;
  clockPaused: boolean;
  completedAtActiveMs: number | null;
  currentMeasureEnteredAtActiveMs: number;
  currentTargetActivatedAtActiveMs: number | null;
  currentCheckProgress: readonly PiecePracticeCheckProgress[];
  boundaryReattackPending: boolean;
  status: PiecePracticeSessionStatus;
  startedAtMs: number;
}>;

export type CreatePiecePracticeSessionResult =
  | Readonly<{ ok: true; state: PiecePracticeSessionState }>
  | Readonly<{ ok: false; reason: "invalid-start-measure" | "invalid-end-measure" | "end-before-start" }>;

export type PiecePracticeMeasureResult = PiecePracticeMeasureDiagnostic;

export type SubmitPiecePracticeAttemptResult =
  | Readonly<{ accepted: false; reason: "not-practicing" | "stale-target"; state: PiecePracticeSessionState }>
  | Readonly<{ accepted: true; grade: PiecePracticeGrade; state: PiecePracticeSessionState }>;

export type AdvancePiecePracticeMeasureResult =
  | Readonly<{ advanced: false; reason: "not-awaiting-explicit-advance"; state: PiecePracticeSessionState }>
  | Readonly<{ advanced: true; state: PiecePracticeSessionState }>;

export type SkipPiecePracticeTargetResult =
  | Readonly<{ skipped: false; reason: "no-authored-target"; state: PiecePracticeSessionState }>
  | Readonly<{ skipped: true; state: PiecePracticeSessionState }>;

export type PiecePracticeProgress = Readonly<{
  currentMeasureNumber: number;
  totalPieceMeasures: number;
  practiceMeasureCount: number;
  practicedMeasureCount: number;
  completedTargetCount: number;
  skippedTargetCount: number;
  incorrectAttemptCount: number;
  elapsedMs: number;
  status: PiecePracticeSessionStatus;
}>;

function requireTimestamp(timestampMs: number): void {
  if (!Number.isFinite(timestampMs) || timestampMs < 0) throw new Error("Piece Practice timestamps must be finite non-negative numbers.");
}

function progressForTarget(target: PiecePracticeTarget | null | undefined): readonly PiecePracticeCheckProgress[] {
  return target?.checks.map(({ id }) => ({ checkId: id, completed: false, accumulatedMidiNumbers: [], startedAtMs: null })) ?? [];
}

function effectiveEndMeasureIndex(piece: PiecePracticePiece, state: Pick<PiecePracticeSessionState, "endMeasureIndex">): number {
  return state.endMeasureIndex ?? piece.measures.length - 1;
}

function activeElapsedAt(state: PiecePracticeSessionState, atMs: number): number {
  requireTimestamp(atMs);
  return state.activeElapsedMs + (state.clockPaused ? 0 : Math.max(0, atMs - state.activeSinceMs));
}

function snapshotClock(state: PiecePracticeSessionState, atMs: number): PiecePracticeSessionState {
  return { ...state, activeElapsedMs: activeElapsedAt(state, atMs), activeSinceMs: atMs };
}

function appendMistakeEvidence(state: PiecePracticeSessionState, evidence: PiecePracticeMistakeEvidenceDraft, atMs: number): PiecePracticeSessionState {
  const current = snapshotClock(state, atMs);
  return { ...current, mistakeEvidence: [...current.mistakeEvidence, { ...evidence, sequence: current.mistakeEvidence.length, occurredAtActiveMs: current.activeElapsedMs } as PiecePracticeMistakeEvidence] };
}

function addBoundaryReattacks(piece: PiecePracticePiece, measure: PiecePracticeMeasure, target: PiecePracticeTarget | undefined): PiecePracticeTarget | null {
  const boundaryPitches = getPiecePracticeBoundaryReattackPitches(piece, measure.measureIndex);
  if (boundaryPitches.length === 0) return target ?? null;
  const base = target?.startTick === 0 ? target : undefined;
  const normal = base?.checks.find(({ kind }) => kind === "normal");
  const attackedPitches = [...(normal?.attackedPitches ?? []), ...boundaryPitches]
    .filter((pitch, index, all) => all.findIndex((candidate) => candidate.sourceEventId === pitch.sourceEventId && candidate.sourcePitchId === pitch.sourcePitchId) === index);
  const normalCheck: PiecePracticeCheck = {
    id: `${measure.sourceMeasureId}:boundary-attack`, kind: "normal",
    sourceEventIds: [...new Set(attackedPitches.map(({ sourceEventId }) => sourceEventId))].sort(),
    expectedMidiNumbers: [...new Set(attackedPitches.map(({ midiNumber }) => midiNumber))].sort((left, right) => left - right),
    attackedPitches,
  };
  return {
    id: `${measure.sourceMeasureId}:boundary-target`, measureIndex: measure.measureIndex, sourceMeasureId: measure.sourceMeasureId,
    startTick: 0, absoluteStartTick: measure.absoluteStartTick,
    checks: [normalCheck, ...(base?.checks.filter(({ kind }) => kind !== "normal") ?? [])],
    sourceEventIds: [...new Set([...(base?.sourceEventIds ?? []), ...normalCheck.sourceEventIds])].sort(),
    expectedMidiNumbers: [...new Set([...(base?.expectedMidiNumbers ?? []), ...normalCheck.expectedMidiNumbers])].sort((left, right) => left - right),
    attackedPitches: [...(base?.attackedPitches ?? []), ...boundaryPitches],
  };
}

function targetForState(piece: PiecePracticePiece, state: Pick<PiecePracticeSessionState, "currentMeasureIndex" | "currentTargetIndex" | "boundaryReattackPending">): PiecePracticeTarget | null {
  const measure = piece.measures[state.currentMeasureIndex];
  if (!measure) return null;
  const target = state.currentTargetIndex === null || state.currentTargetIndex < 0 ? undefined : measure.targets[state.currentTargetIndex];
  return state.boundaryReattackPending ? addBoundaryReattacks(piece, measure, target) : target ?? null;
}

function stateForMeasure(piece: PiecePracticePiece, base: Omit<PiecePracticeSessionState, "currentMeasureIndex" | "currentTargetIndex" | "status" | "currentCheckProgress" | "boundaryReattackPending" | "currentMeasureCompletedTargetCount" | "currentMeasureEnteredAtActiveMs" | "currentTargetActivatedAtActiveMs">, measure: PiecePracticeMeasure, boundaryReattack: boolean): PiecePracticeSessionState {
  const boundaryPitches = boundaryReattack ? getPiecePracticeBoundaryReattackPitches(piece, measure.measureIndex) : [];
  const boundaryBeforeFirstTarget = boundaryPitches.length > 0 && (measure.targets[0]?.startTick ?? Number.POSITIVE_INFINITY) > 0;
  const hasTargets = measure.targets.length > 0 || boundaryPitches.length > 0;
  const partial = {
    ...base,
    currentMeasureIndex: measure.measureIndex,
    currentTargetIndex: hasTargets ? boundaryBeforeFirstTarget ? -1 : 0 : null,
    boundaryReattackPending: boundaryPitches.length > 0,
    currentMeasureCompletedTargetCount: 0,
    currentMeasureEnteredAtActiveMs: base.activeElapsedMs,
    currentTargetActivatedAtActiveMs: hasTargets ? base.activeElapsedMs : null,
    status: hasTargets ? "practicing" as const : "awaiting-explicit-measure-advance" as const,
  };
  return { ...partial, currentCheckProgress: progressForTarget(targetForState(piece, partial)) };
}

export function createPiecePracticeSession(piece: PiecePracticePiece, options: Readonly<{ startMeasureIndex: number; endMeasureIndex?: number | null; startedAtMs: number }>): CreatePiecePracticeSessionResult {
  requireTimestamp(options.startedAtMs);
  const measure = piece.measures[options.startMeasureIndex];
  if (!Number.isInteger(options.startMeasureIndex) || options.startMeasureIndex < 0 || !measure) {
    return { ok: false, reason: "invalid-start-measure" };
  }
  const endMeasureIndex = options.endMeasureIndex ?? null;
  if (endMeasureIndex !== null && (!Number.isInteger(endMeasureIndex) || endMeasureIndex < 0 || !piece.measures[endMeasureIndex])) {
    return { ok: false, reason: "invalid-end-measure" };
  }
  if (endMeasureIndex !== null && endMeasureIndex < options.startMeasureIndex) {
    return { ok: false, reason: "end-before-start" };
  }
  return {
    ok: true,
    state: stateForMeasure(piece, {
      startMeasureIndex: options.startMeasureIndex,
      endMeasureIndex,
      completedTargetCount: 0,
      skippedTargetCount: 0,
      completedMeasureCount: 0,
      completedMeasureIndexes: [],
      mistakeEvidence: [],
      skipEvidence: [],
      targetTimings: [],
      measureTimings: piece.measures.slice(options.startMeasureIndex, (endMeasureIndex ?? piece.measures.length - 1) + 1).map(({ measureIndex, sourceMeasureId }) => ({ measureIndex, sourceMeasureId, activeDurationMs: 0 })),
      activeElapsedMs: 0,
      activeSinceMs: options.startedAtMs,
      clockPaused: false,
      completedAtActiveMs: null,
      startedAtMs: options.startedAtMs,
    }, measure, true),
  };
}

export function getCurrentPiecePracticeTarget(piece: PiecePracticePiece, state: PiecePracticeSessionState): PiecePracticeTarget | null {
  if (state.status !== "practicing" || state.currentTargetIndex === null) return null;
  return targetForState(piece, state);
}

function completeCurrentMeasure(piece: PiecePracticePiece, state: PiecePracticeSessionState, atMs: number): PiecePracticeSessionState {
  const current = snapshotClock(state, atMs);
  const completedMeasureIndexes = state.completedMeasureIndexes.includes(state.currentMeasureIndex)
    ? state.completedMeasureIndexes
    : [...state.completedMeasureIndexes, state.currentMeasureIndex].sort((left, right) => left - right);
  const completedBase = {
    ...current,
    completedMeasureIndexes,
    completedMeasureCount: completedMeasureIndexes.length,
    currentCheckProgress: [],
    currentTargetActivatedAtActiveMs: null,
    measureTimings: current.measureTimings.map((timing) => timing.measureIndex === current.currentMeasureIndex
      ? { ...timing, activeDurationMs: timing.activeDurationMs + Math.max(0, current.activeElapsedMs - current.currentMeasureEnteredAtActiveMs) }
      : timing),
  };
  if (state.currentMeasureIndex >= effectiveEndMeasureIndex(piece, state)) {
    return { ...completedBase, currentTargetIndex: null, status: "piece-complete", completedAtActiveMs: completedBase.activeElapsedMs };
  }
  const nextMeasure = piece.measures[state.currentMeasureIndex + 1];
  if (!nextMeasure) return { ...completedBase, currentTargetIndex: null, status: "piece-complete" };
  return stateForMeasure(piece, completedBase, nextMeasure, false);
}

export function submitPiecePracticeAttempt(piece: PiecePracticePiece, state: PiecePracticeSessionState, input: Readonly<{
  targetId: string;
  attempt: PiecePracticeAttempt;
  atMs?: number;
}>): SubmitPiecePracticeAttemptResult {
  const target = getCurrentPiecePracticeTarget(piece, state);
  if (!target) return { accepted: false, reason: "not-practicing", state };
  if (input.targetId !== target.id) return { accepted: false, reason: "stale-target", state };
  const normalCheck = target.checks.find((check) => check.kind === "normal" && !state.currentCheckProgress.find(({ checkId }) => checkId === check.id)?.completed);
  if (!normalCheck) return { accepted: false, reason: "stale-target", state };
  const grade = gradePiecePracticeTarget({ ...target, ...normalCheck, checks: target.checks }, input.attempt);
  const atMs = input.atMs ?? state.activeSinceMs;
  if (!grade.correct) {
    return {
      accepted: true,
      grade,
      state: appendMistakeEvidence(state, {
        kind: "normal-attempt",
        measureIndex: target.measureIndex,
        sourceMeasureId: target.sourceMeasureId,
        targetId: target.id,
        checkId: normalCheck.id,
        expectedPitches: snapshotPiecePracticePitches(normalCheck.attackedPitches),
        receivedMidiNumbers: grade.receivedMidiNumbers,
        missingMidiNumbers: grade.missingMidiNumbers,
        extraMidiNumbers: grade.extraMidiNumbers,
        unexpectedHeldMidiNumbers: grade.unexpectedHeldMidiNumbers,
      }, atMs),
    };
  }

  const currentCheckProgress = state.currentCheckProgress.map((progress) => progress.checkId === normalCheck.id ? { ...progress, completed: true } : progress);
  if (!currentCheckProgress.every(({ completed }) => completed)) return { accepted: true, grade, state: snapshotClock({ ...state, currentCheckProgress }, atMs) };
  return { accepted: true, grade, state: advanceCompletedTarget(piece, { ...state, currentCheckProgress }, atMs) };
}

export type SubmitPiecePracticePitchResult = Readonly<{
  accepted: boolean;
  matched: boolean;
  incorrect: boolean;
  state: PiecePracticeSessionState;
}>;

function recordTargetTiming(piece: PiecePracticePiece, state: PiecePracticeSessionState, target: PiecePracticeTarget, atMs: number, outcome: "completed" | "skipped"): PiecePracticeSessionState {
  const current = snapshotClock(state, atMs);
  const activatedAtActiveMs = current.currentTargetActivatedAtActiveMs ?? current.activeElapsedMs;
  const responseDurationMs = Math.max(0, current.activeElapsedMs - activatedAtActiveMs);
  const expectedWindowMs = getPiecePracticeTargetExpectedWindowMs(piece, target);
  const hesitationThresholdMs = getPiecePracticeHesitationThresholdMs(expectedWindowMs);
  return {
    ...current,
    targetTimings: [...current.targetTimings, {
      sequence: current.targetTimings.length,
      measureIndex: target.measureIndex,
      sourceMeasureId: target.sourceMeasureId,
      targetId: target.id,
      sourceEventIds: target.sourceEventIds,
      expectedPitches: snapshotPiecePracticePitches(target.attackedPitches),
      activatedAtActiveMs,
      completedAtActiveMs: current.activeElapsedMs,
      responseDurationMs,
      expectedWindowMs,
      hesitationThresholdMs,
      isHesitation: outcome === "completed" && responseDurationMs > hesitationThresholdMs,
      outcome,
    }],
  };
}

function advanceCompletedTarget(piece: PiecePracticePiece, state: PiecePracticeSessionState, atMs: number): PiecePracticeSessionState {
  const measure = piece.measures[state.currentMeasureIndex];
  if (!measure) return state;
  const target = getCurrentPiecePracticeTarget(piece, state);
  if (!target) return state;
  const timed = recordTargetTiming(piece, state, target, atMs, "completed");
  const completedBoundaryOnly = state.boundaryReattackPending && state.currentTargetIndex === -1;
  if (!completedBoundaryOnly) return advancePastAuthoredTarget(piece, timed, {
    completedTargetCount: state.completedTargetCount + 1,
    currentMeasureCompletedTargetCount: state.currentMeasureCompletedTargetCount + 1,
  }, atMs);
  const nextTargetIndex = 0;
  const withoutBoundary = { ...timed, boundaryReattackPending: false };
  return nextTargetIndex < measure.targets.length
    ? { ...withoutBoundary, currentTargetIndex: nextTargetIndex, currentTargetActivatedAtActiveMs: withoutBoundary.activeElapsedMs, currentCheckProgress: progressForTarget(measure.targets[nextTargetIndex]) }
    : completeCurrentMeasure(piece, withoutBoundary, atMs);
}

function advancePastAuthoredTarget(
  piece: PiecePracticePiece,
  state: PiecePracticeSessionState,
  counters: Partial<Pick<PiecePracticeSessionState, "completedTargetCount" | "skippedTargetCount" | "currentMeasureCompletedTargetCount">>,
  atMs: number,
): PiecePracticeSessionState {
  const measure = piece.measures[state.currentMeasureIndex];
  if (!measure || state.currentTargetIndex === null || state.currentTargetIndex < 0) return state;
  const nextTargetIndex = state.currentTargetIndex + 1;
  const advanced = { ...state, ...counters, boundaryReattackPending: false };
  return nextTargetIndex < measure.targets.length
    ? { ...advanced, currentTargetIndex: nextTargetIndex, currentTargetActivatedAtActiveMs: advanced.activeElapsedMs, currentCheckProgress: progressForTarget(measure.targets[nextTargetIndex]) }
    : completeCurrentMeasure(piece, advanced, atMs);
}

export function skipCurrentPiecePracticeTarget(piece: PiecePracticePiece, state: PiecePracticeSessionState, atMs = state.activeSinceMs): SkipPiecePracticeTargetResult {
  const measure = piece.measures[state.currentMeasureIndex];
  if (state.status !== "practicing" || state.currentTargetIndex === null || state.currentTargetIndex < 0 || !measure?.targets[state.currentTargetIndex]) {
    return { skipped: false, reason: "no-authored-target", state };
  }
  const target = measure.targets[state.currentTargetIndex];
  const timed = recordTargetTiming(piece, state, target, atMs, "skipped");
  const skipped = { ...timed, skipEvidence: [...timed.skipEvidence, { sequence: timed.skipEvidence.length, measureIndex: target.measureIndex, sourceMeasureId: target.sourceMeasureId, targetId: target.id, occurredAtActiveMs: timed.activeElapsedMs }] };
  return {
    skipped: true,
    state: advancePastAuthoredTarget(piece, skipped, { skippedTargetCount: state.skippedTargetCount + 1 }, atMs),
  };
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
    if (!incorrect) return { accepted: true, matched: false, incorrect: false, state: currentState };
    const rolled = pendingChecks.find((check): check is Extract<PiecePracticeCheck, { kind: "rolled-chord" }> => check.kind === "rolled-chord")!;
    const progress = currentState.currentCheckProgress.find(({ checkId }) => checkId === rolled.id);
    return { accepted: true, matched: false, incorrect: true, state: appendMistakeEvidence(currentState, {
      kind: "rolled-unexpected-pitch",
      measureIndex: target.measureIndex,
      sourceMeasureId: target.sourceMeasureId,
      targetId: target.id,
      checkId: rolled.id,
      expectedPitches: snapshotPiecePracticePitches(rolled.attackedPitches),
      receivedMidiNumber: input.midiNumber,
      accumulatedMidiNumbers: progress?.accumulatedMidiNumbers ?? [],
    }, input.atMs) };
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
  return {
    accepted: true,
    matched: true,
    incorrect: false,
    state: currentCheckProgress.every(({ completed }) => completed)
      ? advanceCompletedTarget(piece, next, input.atMs)
      : snapshotClock(next, input.atMs),
  };
}

export function expirePiecePracticeRolledChecks(piece: PiecePracticePiece, state: PiecePracticeSessionState, atMs: number): PiecePracticeSessionState {
  requireTimestamp(atMs);
  const target = getCurrentPiecePracticeTarget(piece, state);
  if (!target) return state;
  const windowMs = getPiecePracticeRolledWindowMs(piece.tempoBpm);
  const expired: Array<{ check: Extract<PiecePracticeCheck, { kind: "rolled-chord" }>; accumulatedMidiNumbers: readonly number[] }> = [];
  const currentCheckProgress = state.currentCheckProgress.map((progress) => {
    const check = target.checks.find(({ id }) => id === progress.checkId);
    if (check?.kind !== "rolled-chord" || progress.completed || progress.startedAtMs === null || atMs < progress.startedAtMs + windowMs) return progress;
    expired.push({ check, accumulatedMidiNumbers: progress.accumulatedMidiNumbers });
    return { ...progress, accumulatedMidiNumbers: [], startedAtMs: null };
  });
  if (expired.length === 0) return state;
  return expired.reduce<PiecePracticeSessionState>((current, { check, accumulatedMidiNumbers }) => appendMistakeEvidence(current, {
    kind: "rolled-timeout",
    measureIndex: target.measureIndex,
    sourceMeasureId: target.sourceMeasureId,
    targetId: target.id,
    checkId: check.id,
    expectedPitches: snapshotPiecePracticePitches(check.attackedPitches),
    accumulatedMidiNumbers,
    missingMidiNumbers: check.expectedMidiNumbers.filter((midiNumber) => !accumulatedMidiNumbers.includes(midiNumber)),
    windowMs,
  }, atMs), { ...state, currentCheckProgress });
}

export function advancePiecePracticeNoAttackMeasure(piece: PiecePracticePiece, state: PiecePracticeSessionState, atMs = state.activeSinceMs): AdvancePiecePracticeMeasureResult {
  const measure = piece.measures[state.currentMeasureIndex];
  if (state.status !== "awaiting-explicit-measure-advance" || !measure || measure.targets.length !== 0) {
    return { advanced: false, reason: "not-awaiting-explicit-advance", state };
  }
  return { advanced: true, state: completeCurrentMeasure(piece, state, atMs) };
}

export function restartCurrentPiecePracticeMeasure(piece: PiecePracticePiece, state: PiecePracticeSessionState, atMs = state.activeSinceMs): PiecePracticeSessionState {
  const measure = piece.measures[state.currentMeasureIndex];
  if (!measure) return state;
  const wasCompleted = state.completedMeasureIndexes.includes(state.currentMeasureIndex);
  const completedMeasureIndexes = wasCompleted
    ? state.completedMeasureIndexes.filter((measureIndex) => measureIndex !== state.currentMeasureIndex)
    : state.completedMeasureIndexes;
  const completedTargetCount = Math.max(0, state.completedTargetCount - state.currentMeasureCompletedTargetCount);
  const current = snapshotClock(state, atMs);
  const restarted = stateForMeasure(piece, {
    ...current,
    completedTargetCount,
    completedMeasureCount: completedMeasureIndexes.length,
    completedMeasureIndexes,
  }, measure, true);
  return {
    ...restarted,
    currentMeasureEnteredAtActiveMs: wasCompleted ? current.activeElapsedMs : state.currentMeasureEnteredAtActiveMs,
  };
}

export function restartPiecePractice(piece: PiecePracticePiece, state: PiecePracticeSessionState, startedAtMs: number): PiecePracticeSessionState {
  requireTimestamp(startedAtMs);
  const measure = piece.measures[state.startMeasureIndex];
  if (!measure) return state;
  return stateForMeasure(piece, {
    startMeasureIndex: state.startMeasureIndex,
    endMeasureIndex: state.endMeasureIndex,
    completedTargetCount: 0,
    skippedTargetCount: 0,
    completedMeasureCount: 0,
    completedMeasureIndexes: [],
      mistakeEvidence: [],
      skipEvidence: [],
      targetTimings: [],
      measureTimings: state.measureTimings.map((result) => ({ ...result, activeDurationMs: 0 })),
      activeElapsedMs: 0,
      activeSinceMs: startedAtMs,
      clockPaused: false,
      completedAtActiveMs: null,
    startedAtMs,
  }, measure, true);
}

export function getPiecePracticeElapsedMs(state: PiecePracticeSessionState, nowMs: number): number {
  requireTimestamp(nowMs);
  return state.completedAtActiveMs ?? activeElapsedAt(state, nowMs);
}

export function pausePiecePracticeClock(state: PiecePracticeSessionState, atMs: number): PiecePracticeSessionState {
  if (state.clockPaused || state.status === "piece-complete") return state;
  return { ...snapshotClock(state, atMs), clockPaused: true };
}

export function resumePiecePracticeClock(state: PiecePracticeSessionState, atMs: number): PiecePracticeSessionState {
  requireTimestamp(atMs);
  if (!state.clockPaused || state.status === "piece-complete") return state;
  const pausedDurationMs = Math.max(0, atMs - state.activeSinceMs);
  return {
    ...state,
    clockPaused: false,
    activeSinceMs: atMs,
    currentCheckProgress: state.currentCheckProgress.map((progress) => progress.startedAtMs === null
      ? progress
      : { ...progress, startedAtMs: progress.startedAtMs + pausedDurationMs }),
  };
}

export function getPiecePracticeProgress(piece: PiecePracticePiece, state: PiecePracticeSessionState, nowMs: number): PiecePracticeProgress {
  return {
    currentMeasureNumber: state.currentMeasureIndex + 1,
    totalPieceMeasures: piece.measures.length,
    practiceMeasureCount: effectiveEndMeasureIndex(piece, state) - state.startMeasureIndex + 1,
    practicedMeasureCount: state.completedMeasureCount,
    completedTargetCount: state.completedTargetCount,
    skippedTargetCount: state.skippedTargetCount,
    incorrectAttemptCount: state.mistakeEvidence.length,
    elapsedMs: getPiecePracticeElapsedMs(state, nowMs),
    status: state.status,
  };
}

export function getPiecePracticeMeasureResults(state: PiecePracticeSessionState): readonly PiecePracticeMeasureResult[] {
  return derivePiecePracticeMeasureDiagnostics(state);
}
