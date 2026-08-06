import { describe, expect, it } from "vitest";
import {
  INITIAL_EAR_TRAINING_STATS,
  applyEarTrainingCompletion,
  applyEarTrainingIncorrectAttempt,
  getEarTrainingAccuracy,
} from "./ear-training-stats";

describe("ear-training statistics", () => {
  it("counts at most one incorrect attempt per target", () => {
    const first = applyEarTrainingIncorrectAttempt(INITIAL_EAR_TRAINING_STATS, false);
    const repeated = applyEarTrainingIncorrectAttempt(first, true);
    expect(first.incorrectAttempts).toBe(1);
    expect(repeated).toBe(first);
  });

  it("does not award streak credit after a mistake", () => {
    const initial = { ...INITIAL_EAR_TRAINING_STATS, streak: 3 };
    const failed = applyEarTrainingIncorrectAttempt(initial, false);
    const completed = applyEarTrainingCompletion(failed, 1200, true);
    expect(completed).toMatchObject({ completed: 1, incorrectAttempts: 1, streak: 0 });
    expect(getEarTrainingAccuracy(completed)).toBe(50);
  });

  it("increments streak for a clean completion", () => {
    expect(applyEarTrainingCompletion(INITIAL_EAR_TRAINING_STATS, 900, false)).toMatchObject({ completed: 1, streak: 1, totalResponseTimeMs: 900 });
  });
});
