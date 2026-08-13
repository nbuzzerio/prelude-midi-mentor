import { describe, expect, it } from "vitest";

import {
  createMelodyContinuousAttemptSummary,
  summarizeMelodyContinuousPractice,
} from "./melody-continuous-practice";
import type { MelodyAttemptResult } from "./melody-scoring";
import type { MelodyExercise } from "./melody-types";

const exercise = { id: "exercise", seed: "seed" } as MelodyExercise;
const result = (
  pitch: number,
  movement: number | null,
  timing: number,
  status: "correct" | "wrong-pitch" = "correct",
): MelodyAttemptResult => ({
  attacks: [{ status }] as unknown as MelodyAttemptResult["attacks"],
  exerciseId: exercise.id,
  extraAttackCount: 0,
  extras: [],
  missedAttackCount: 0,
  movementScorePercent: movement,
  movements: [],
  pitchScorePercent: pitch,
  timingScorePercent: timing,
});

describe("Melody Continuous Practice summaries", () => {
  it("retains compact attempt identity and exact pitch-perfect status", () => {
    const first = createMelodyContinuousAttemptSummary(
      1,
      exercise,
      result(100, null, 40),
    );
    const second = createMelodyContinuousAttemptSummary(
      2,
      exercise,
      result(99, 80, 60, "wrong-pitch"),
      first,
    );
    expect(first.pitchPerfect).toBe(true);
    expect(second.pitchPerfect).toBe(false);
    expect(second.repeatedPreviousExercise).toBe(true);
  });

  it("rounds averages and excludes undefined movement scores", () => {
    const history = [
      createMelodyContinuousAttemptSummary(1, exercise, result(100, null, 40)),
      createMelodyContinuousAttemptSummary(2, exercise, result(50, 81, 61)),
    ];
    expect(summarizeMelodyContinuousPractice(history)).toEqual({
      attemptsCompleted: 2,
      averageMovement: 81,
      averagePitch: 75,
      averageTiming: 51,
      pitchPerfectAttempts: 2,
    });
  });
});
