import { describe, expect, it } from "vitest";

import {
  appendMelodyContinuousTrialRetry,
  canStartMelodyContinuousDiagnosticTrial,
  createMelodyContinuousDeadline,
  createMelodyContinuousDiagnosticTrial,
  DEFAULT_MELODY_CONTINUOUS_DURATION_MINUTES,
  doesMelodyContinuousTrialNeedReview,
  getMelodyContinuousRemainingMs,
  getMelodyContinuousTrialLatestResult,
  getMelodyContinuousTrialRetryCount,
  getMelodyContinuousTrialsNeedingReview,
  getNextMelodyContinuousTrialNeedingReviewId,
  isMelodyContinuousTrialInitiallyPitchPerfect,
  isMelodyContinuousTrialMastered,
  MELODY_CONTINUOUS_DURATION_MINUTES,
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

const trial = (originalOrder: number, originalResult: MelodyAttemptResult) =>
  createMelodyContinuousDiagnosticTrial(
    originalOrder,
    { ...exercise, id: `exercise-${originalOrder}` } as MelodyExercise,
    originalResult,
  );

describe("Melody Continuous Practice timing", () => {
  it("offers one through five minute choices with a five-minute default", () => {
    expect(MELODY_CONTINUOUS_DURATION_MINUTES).toEqual([1, 2, 3, 5]);
    expect(DEFAULT_MELODY_CONTINUOUS_DURATION_MINUTES).toBe(5);
  });

  it("derives deadlines and remaining time from authoritative timestamps", () => {
    const deadline = createMelodyContinuousDeadline(12_345, 2);
    expect(deadline).toBe(132_345);
    expect(getMelodyContinuousRemainingMs(deadline, 42_345)).toBe(90_000);
    expect(getMelodyContinuousRemainingMs(deadline, 140_000)).toBe(0);
  });

  it("allows a new trial only before the deadline", () => {
    expect(canStartMelodyContinuousDiagnosticTrial(60_000, 59_999)).toBe(true);
    expect(canStartMelodyContinuousDiagnosticTrial(60_000, 60_000)).toBe(false);
    expect(canStartMelodyContinuousDiagnosticTrial(60_000, 60_001)).toBe(false);
  });
});

describe("Melody Continuous Practice history", () => {
  it("retains the exact exercise and complete immutable original result", () => {
    const originalResult = result(67, 74, 90, "wrong-pitch");
    const diagnosticTrial = createMelodyContinuousDiagnosticTrial(3, exercise, originalResult);
    expect(diagnosticTrial).toMatchObject({
      id: "melody-diagnostic-3-exercise",
      originalOrder: 3,
      exercise,
      originalResult,
      retryResults: [],
    });
    expect(Object.isFrozen(diagnosticTrial)).toBe(true);
    expect(Object.isFrozen(diagnosticTrial.retryResults)).toBe(true);
  });

  it("appends an immutable retry to only the exact stable trial ID", () => {
    const first = trial(1, result(40, 50, 60, "wrong-pitch"));
    const second = trial(2, result(70, 80, 90, "wrong-pitch"));
    const previousRetry = result(80, 81, 82, "wrong-pitch");
    const withPreviousRetry = appendMelodyContinuousTrialRetry([first, second], first.id, previousRetry);
    const newRetry = result(100, 90, 70);
    const updated = appendMelodyContinuousTrialRetry(withPreviousRetry, first.id, newRetry);

    expect(updated).not.toBe(withPreviousRetry);
    expect(Object.isFrozen(updated)).toBe(true);
    expect(updated[0]).not.toBe(withPreviousRetry[0]);
    expect(updated[1]).toBe(second);
    expect(updated[0]!.originalResult).toBe(first.originalResult);
    expect(updated[0]!.retryResults).toEqual([previousRetry, newRetry]);
    expect(updated[0]!.retryResults[0]).toBe(previousRetry);
    expect(Object.isFrozen(updated[0])).toBe(true);
    expect(Object.isFrozen(updated[0]!.retryResults)).toBe(true);
  });

  it("throws descriptively when appending to an unknown trial", () => {
    expect(() => appendMelodyContinuousTrialRetry(
      [trial(1, result(40, 50, 60, "wrong-pitch"))],
      "missing-trial",
      result(100, 100, 100),
    )).toThrow(/unknown diagnostic trial "missing-trial"/);
  });

  it("derives latest result and retry count without replacing the original", () => {
    const original = result(40, 50, 60, "wrong-pitch");
    const retryOne = result(70, 80, 90, "wrong-pitch");
    const retryTwo = result(100, 95, 85);
    const initial = trial(1, original);
    const retried = appendMelodyContinuousTrialRetry(
      appendMelodyContinuousTrialRetry([initial], initial.id, retryOne),
      initial.id,
      retryTwo,
    )[0]!;

    expect(getMelodyContinuousTrialLatestResult(initial)).toBe(original);
    expect(getMelodyContinuousTrialLatestResult(retried)).toBe(retryTwo);
    expect(getMelodyContinuousTrialRetryCount(initial)).toBe(0);
    expect(getMelodyContinuousTrialRetryCount(retried)).toBe(2);
  });

  it("derives mastery from the original or any retry and never revokes it", () => {
    const perfectOriginal = trial(1, result(100, 20, 30));
    const imperfectOriginal = trial(2, result(90, 100, 100, "wrong-pitch"));
    const failedAgain = appendMelodyContinuousTrialRetry(
      [imperfectOriginal], imperfectOriginal.id, result(95, 100, 100, "wrong-pitch"),
    )[0]!;
    const mastered = appendMelodyContinuousTrialRetry(
      [failedAgain], failedAgain.id, result(100, 40, 50),
    )[0]!;
    const laterFailure = appendMelodyContinuousTrialRetry(
      [mastered], mastered.id, result(80, 90, 90, "wrong-pitch"),
    )[0]!;

    expect(isMelodyContinuousTrialInitiallyPitchPerfect(perfectOriginal)).toBe(true);
    expect(isMelodyContinuousTrialMastered(perfectOriginal)).toBe(true);
    expect(doesMelodyContinuousTrialNeedReview(perfectOriginal)).toBe(false);
    expect(isMelodyContinuousTrialInitiallyPitchPerfect(imperfectOriginal)).toBe(false);
    expect(isMelodyContinuousTrialMastered(failedAgain)).toBe(false);
    expect(doesMelodyContinuousTrialNeedReview(failedAgain)).toBe(true);
    expect(isMelodyContinuousTrialMastered(mastered)).toBe(true);
    expect(isMelodyContinuousTrialMastered(laterFailure)).toBe(true);
  });

  it("summarizes original diagnostic results and excludes undefined movement", () => {
    const trials = [
      createMelodyContinuousDiagnosticTrial(1, exercise, result(100, null, 40)),
      createMelodyContinuousDiagnosticTrial(2, exercise, result(50, 81, 61)),
    ];
    expect(summarizeMelodyContinuousPractice(trials)).toEqual({
      trialsCompleted: 2,
      initiallyPitchPerfectTrials: 2,
      needsReviewTrials: 0,
      currentlyMasteredTrials: 2,
      trialsMasteredThroughRepair: 0,
      totalReviewRetries: 0,
      allTrialsMastered: true,
      averageMovement: 81,
      averagePitch: 75,
      averageTiming: 51,
    });
  });

  it("summarizes mastery and retries while keeping original averages authoritative", () => {
    const first = trial(1, result(40, null, 60, "wrong-pitch"));
    const second = trial(2, result(80, 70, 100, "wrong-pitch"));
    const firstRetried = appendMelodyContinuousTrialRetry([first, second], first.id, result(100, 100, 0));
    const withFailedSecondRetry = appendMelodyContinuousTrialRetry(
      firstRetried, second.id, result(10, 10, 10, "wrong-pitch"),
    );

    expect(summarizeMelodyContinuousPractice(withFailedSecondRetry)).toEqual({
      trialsCompleted: 2,
      initiallyPitchPerfectTrials: 0,
      needsReviewTrials: 1,
      currentlyMasteredTrials: 1,
      trialsMasteredThroughRepair: 1,
      totalReviewRetries: 2,
      allTrialsMastered: false,
      averagePitch: 60,
      averageMovement: 70,
      averageTiming: 80,
    });
  });

  it("projects needs-review trials in original diagnostic order", () => {
    const weakThird = trial(3, result(80, 80, 80, "wrong-pitch"));
    const masteredFirst = trial(1, result(100, 20, 20));
    const weakSecond = trial(2, result(90, 90, 90, "wrong-pitch"));
    const projection = getMelodyContinuousTrialsNeedingReview([weakThird, masteredFirst, weakSecond]);
    expect(projection.map(({ id }) => id)).toEqual([weakSecond.id, weakThird.id]);
    expect(Object.isFrozen(projection)).toBe(true);
  });

  it("finds the next weak trial forward, wraps once, and never returns itself", () => {
    const weakTwo = trial(2, result(80, 80, 80, "wrong-pitch"));
    const weakFive = trial(5, result(80, 80, 80, "wrong-pitch"));
    const weakSeven = trial(7, result(80, 80, 80, "wrong-pitch"));
    const trials = [weakSeven, weakTwo, weakFive];
    expect(getNextMelodyContinuousTrialNeedingReviewId(trials, weakFive.id)).toBe(weakSeven.id);
    expect(getNextMelodyContinuousTrialNeedingReviewId(trials, weakSeven.id)).toBe(weakTwo.id);
    expect(getNextMelodyContinuousTrialNeedingReviewId([weakFive], weakFive.id)).toBeNull();
    expect(getNextMelodyContinuousTrialNeedingReviewId([trial(1, result(100, 100, 100))], null)).toBeNull();
    expect(() => getNextMelodyContinuousTrialNeedingReviewId(trials, "unknown")).toThrow(/unknown diagnostic trial "unknown"/);
  });

  it("returns a zero-safe summary before any trial is completed", () => {
    expect(summarizeMelodyContinuousPractice([])).toEqual({
      trialsCompleted: 0,
      initiallyPitchPerfectTrials: 0,
      needsReviewTrials: 0,
      currentlyMasteredTrials: 0,
      trialsMasteredThroughRepair: 0,
      totalReviewRetries: 0,
      allTrialsMastered: false,
      averageMovement: null,
      averagePitch: null,
      averageTiming: null,
    });
  });
});
