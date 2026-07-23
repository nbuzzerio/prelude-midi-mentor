import { describe, expect, it } from "vitest";

import type { PracticeStats } from "@/types/practice";

import {
  applyCorrectAttempt,
  applyIncorrectAttempt,
  INITIAL_PRACTICE_STATS,
} from "./session-stats";

function createPracticeStats(
  overrides: Partial<PracticeStats> = {},
): PracticeStats {
  return {
    ...INITIAL_PRACTICE_STATS,
    ...overrides,
  };
}

describe("INITIAL_PRACTICE_STATS", () => {
  it("starts every statistic at zero", () => {
    expect(INITIAL_PRACTICE_STATS).toEqual({
      correct: 0,
      incorrect: 0,
      streak: 0,
      totalResponseTimeMs: 0,
    });
  });
});

describe("applyCorrectAttempt", () => {
  it("increments the correct count and streak", () => {
    const currentStats = createPracticeStats({
      correct: 2,
      streak: 2,
    });

    const updatedStats = applyCorrectAttempt(currentStats, 750);

    expect(updatedStats.correct).toBe(3);
    expect(updatedStats.streak).toBe(3);
  });

  it("adds the response time to the accumulated total", () => {
    const currentStats = createPracticeStats({
      totalResponseTimeMs: 1_250,
    });

    const updatedStats = applyCorrectAttempt(currentStats, 750);

    expect(updatedStats.totalResponseTimeMs).toBe(2_000);
  });

  it("preserves the incorrect count", () => {
    const currentStats = createPracticeStats({
      incorrect: 4,
    });

    const updatedStats = applyCorrectAttempt(currentStats, 750);

    expect(updatedStats.incorrect).toBe(4);
  });

  it("does not mutate the current statistics", () => {
    const currentStats = createPracticeStats({
      correct: 2,
      incorrect: 1,
      streak: 2,
      totalResponseTimeMs: 1_250,
    });

    const originalStats = { ...currentStats };

    const updatedStats = applyCorrectAttempt(currentStats, 750);

    expect(currentStats).toEqual(originalStats);
    expect(updatedStats).not.toBe(currentStats);
  });
});

describe("applyIncorrectAttempt", () => {
  it("increments the incorrect count", () => {
    const currentStats = createPracticeStats({
      incorrect: 2,
    });

    const updatedStats = applyIncorrectAttempt(currentStats);

    expect(updatedStats.incorrect).toBe(3);
  });

  it("resets the streak to zero", () => {
    const currentStats = createPracticeStats({
      streak: 5,
    });

    const updatedStats = applyIncorrectAttempt(currentStats);

    expect(updatedStats.streak).toBe(0);
  });

  it("preserves the correct count and accumulated response time", () => {
    const currentStats = createPracticeStats({
      correct: 4,
      totalResponseTimeMs: 3_500,
    });

    const updatedStats = applyIncorrectAttempt(currentStats);

    expect(updatedStats.correct).toBe(4);
    expect(updatedStats.totalResponseTimeMs).toBe(3_500);
  });

  it("does not mutate the current statistics", () => {
    const currentStats = createPracticeStats({
      correct: 4,
      incorrect: 2,
      streak: 5,
      totalResponseTimeMs: 3_500,
    });

    const originalStats = { ...currentStats };

    const updatedStats = applyIncorrectAttempt(currentStats);

    expect(currentStats).toEqual(originalStats);
    expect(updatedStats).not.toBe(currentStats);
  });
});
