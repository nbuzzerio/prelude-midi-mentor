import { shouldTryAnotherFromPedal } from "./melody-pedal-result-action";
import type { MelodyAttemptResult } from "./melody-scoring";
import type { MelodyExercise } from "./melody-types";

export const MELODY_CONTINUOUS_DURATION_MINUTES = [1, 2, 3, 5] as const;
export type MelodyContinuousDurationMinutes =
  (typeof MELODY_CONTINUOUS_DURATION_MINUTES)[number];
export const DEFAULT_MELODY_CONTINUOUS_DURATION_MINUTES: MelodyContinuousDurationMinutes = 5;

export type MelodyContinuousDiagnosticTrial = Readonly<{
  id: string;
  originalOrder: number;
  exercise: MelodyExercise;
  originalResult: MelodyAttemptResult;
  retryResults: readonly MelodyAttemptResult[];
}>;

export function getMelodyContinuousDurationMs(
  durationMinutes: MelodyContinuousDurationMinutes,
): number {
  return durationMinutes * 60_000;
}

export function createMelodyContinuousDeadline(
  startedAtMs: number,
  durationMinutes: MelodyContinuousDurationMinutes,
): number {
  if (!Number.isFinite(startedAtMs)) {
    throw new Error("A Continuous Practice start time must be finite.");
  }
  return startedAtMs + getMelodyContinuousDurationMs(durationMinutes);
}

export function getMelodyContinuousRemainingMs(
  deadlineMs: number,
  nowMs: number,
): number {
  return Math.max(0, deadlineMs - nowMs);
}

export function canStartMelodyContinuousDiagnosticTrial(
  deadlineMs: number,
  nowMs: number,
): boolean {
  return nowMs < deadlineMs;
}

export function createMelodyContinuousDiagnosticTrial(
  originalOrder: number,
  exercise: MelodyExercise,
  originalResult: MelodyAttemptResult,
): MelodyContinuousDiagnosticTrial {
  return Object.freeze({
    id: `melody-diagnostic-${originalOrder}-${exercise.id}`,
    originalOrder,
    exercise,
    originalResult,
    retryResults: Object.freeze([]),
  });
}

export function appendMelodyContinuousTrialRetry(
  trials: readonly MelodyContinuousDiagnosticTrial[],
  trialId: string,
  result: MelodyAttemptResult,
): readonly MelodyContinuousDiagnosticTrial[] {
  const trialIndex = trials.findIndex(({ id }) => id === trialId);
  if (trialIndex < 0) {
    throw new Error(`Cannot append a Melody retry: unknown diagnostic trial "${trialId}".`);
  }
  const trial = trials[trialIndex]!;
  const updatedTrial = Object.freeze({
    ...trial,
    retryResults: Object.freeze([...trial.retryResults, result]),
  });
  return Object.freeze(trials.map((candidate, index) =>
    index === trialIndex ? updatedTrial : candidate));
}

export function getMelodyContinuousTrialLatestResult(
  trial: MelodyContinuousDiagnosticTrial,
): MelodyAttemptResult {
  return trial.retryResults.at(-1) ?? trial.originalResult;
}

export function getMelodyContinuousTrialRetryCount(
  trial: MelodyContinuousDiagnosticTrial,
): number {
  return trial.retryResults.length;
}

export function isMelodyContinuousTrialInitiallyPitchPerfect(
  trial: MelodyContinuousDiagnosticTrial,
): boolean {
  return shouldTryAnotherFromPedal(trial.originalResult);
}

export function isMelodyContinuousTrialMastered(
  trial: MelodyContinuousDiagnosticTrial,
): boolean {
  return isMelodyContinuousTrialInitiallyPitchPerfect(trial)
    || trial.retryResults.some(shouldTryAnotherFromPedal);
}

export function doesMelodyContinuousTrialNeedReview(
  trial: MelodyContinuousDiagnosticTrial,
): boolean {
  return !isMelodyContinuousTrialMastered(trial);
}

export function getMelodyContinuousTrialsNeedingReview(
  trials: readonly MelodyContinuousDiagnosticTrial[],
): readonly MelodyContinuousDiagnosticTrial[] {
  return Object.freeze(
    [...trials]
      .sort((left, right) => left.originalOrder - right.originalOrder)
      .filter(doesMelodyContinuousTrialNeedReview),
  );
}

export function getNextMelodyContinuousTrialNeedingReviewId(
  trials: readonly MelodyContinuousDiagnosticTrial[],
  currentTrialId: string | null,
): string | null {
  const orderedTrials = [...trials].sort(
    (left, right) => left.originalOrder - right.originalOrder,
  );
  if (currentTrialId === null) {
    return orderedTrials.find(doesMelodyContinuousTrialNeedReview)?.id ?? null;
  }
  const currentIndex = orderedTrials.findIndex(({ id }) => id === currentTrialId);
  if (currentIndex < 0) {
    throw new Error(`Cannot find the next Melody trial: unknown diagnostic trial "${currentTrialId}".`);
  }
  for (let offset = 1; offset < orderedTrials.length; offset += 1) {
    const candidate = orderedTrials[(currentIndex + offset) % orderedTrials.length]!;
    if (doesMelodyContinuousTrialNeedReview(candidate)) return candidate.id;
  }
  return null;
}

export function summarizeMelodyContinuousPractice(
  trials: readonly MelodyContinuousDiagnosticTrial[],
) {
  const average = (values: readonly number[]) =>
    values.length === 0
      ? null
      : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  const results = trials.map(({ originalResult }) => originalResult);
  const movements = results.flatMap(({ movementScorePercent }) =>
    movementScorePercent === null ? [] : [movementScorePercent],
  );
  const initiallyPitchPerfectTrials = trials.filter(
    isMelodyContinuousTrialInitiallyPitchPerfect,
  ).length;
  const currentlyMasteredTrials = trials.filter(isMelodyContinuousTrialMastered).length;
  const needsReviewTrials = trials.length - currentlyMasteredTrials;
  return Object.freeze({
    trialsCompleted: trials.length,
    initiallyPitchPerfectTrials,
    needsReviewTrials,
    currentlyMasteredTrials,
    trialsMasteredThroughRepair: currentlyMasteredTrials - initiallyPitchPerfectTrials,
    totalReviewRetries: trials.reduce(
      (total, trial) => total + getMelodyContinuousTrialRetryCount(trial),
      0,
    ),
    allTrialsMastered: trials.length > 0 && needsReviewTrials === 0,
    averagePitch: average(results.map(({ pitchScorePercent }) => pitchScorePercent)),
    averageMovement: average(movements),
    averageTiming: average(results.map(({ timingScorePercent }) => timingScorePercent)),
  });
}
