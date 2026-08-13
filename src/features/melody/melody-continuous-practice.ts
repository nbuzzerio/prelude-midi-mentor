import { shouldTryAnotherFromPedal } from "./melody-pedal-result-action";
import type { MelodyAttemptResult } from "./melody-scoring";
import type { MelodyExercise } from "./melody-types";

export const MELODY_CONTINUOUS_ATTEMPT_TARGETS = [5, 10, 20] as const;
export type MelodyContinuousAttemptTarget =
  (typeof MELODY_CONTINUOUS_ATTEMPT_TARGETS)[number];

export type MelodyContinuousAttemptSummary = Readonly<{
  attemptNumber: number;
  exerciseId: string;
  exerciseSeed: MelodyExercise["seed"];
  repeatedPreviousExercise: boolean;
  pitchScorePercent: number;
  movementScorePercent: number | null;
  timingScorePercent: number;
  missedAttackCount: number;
  extraAttackCount: number;
  pitchPerfect: boolean;
}>;

export function createMelodyContinuousAttemptSummary(
  attemptNumber: number,
  exercise: MelodyExercise,
  result: MelodyAttemptResult,
  previous?: MelodyContinuousAttemptSummary,
): MelodyContinuousAttemptSummary {
  return Object.freeze({
    attemptNumber,
    exerciseId: exercise.id,
    exerciseSeed: exercise.seed,
    repeatedPreviousExercise: previous?.exerciseId === exercise.id,
    pitchScorePercent: result.pitchScorePercent,
    movementScorePercent: result.movementScorePercent,
    timingScorePercent: result.timingScorePercent,
    missedAttackCount: result.missedAttackCount,
    extraAttackCount: result.extraAttackCount,
    pitchPerfect: shouldTryAnotherFromPedal(result),
  });
}

export function summarizeMelodyContinuousPractice(
  history: readonly MelodyContinuousAttemptSummary[],
) {
  if (history.length === 0) {
    throw new Error("A Continuous Practice summary requires at least one completed attempt.");
  }
  const average = (values: readonly number[]) =>
    Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  const movements = history.flatMap(({ movementScorePercent }) =>
    movementScorePercent === null ? [] : [movementScorePercent],
  );
  return Object.freeze({
    attemptsCompleted: history.length,
    pitchPerfectAttempts: history.filter(({ pitchPerfect }) => pitchPerfect)
      .length,
    averagePitch: average(history.map(({ pitchScorePercent }) => pitchScorePercent)),
    averageMovement: movements.length === 0 ? null : average(movements),
    averageTiming: average(history.map(({ timingScorePercent }) => timingScorePercent)),
  });
}
