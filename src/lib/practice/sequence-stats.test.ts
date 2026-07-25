import { describe, expect, it } from "vitest";

import type { SequenceStats } from "@/types/practice";

import {
  applyCompletedSequence,
  applyIncorrectSequenceAttempt,
  getAverageSequenceTimeMs,
  getSequenceAccuracy,
  INITIAL_SEQUENCE_STATS,
} from "./sequence-stats";

describe("INITIAL_SEQUENCE_STATS", () => {
  it("starts with an empty sequence session", () => {
    expect(INITIAL_SEQUENCE_STATS).toEqual({
      completed: 0,
      incorrectAttempts: 0,
      streak: 0,
      totalSequenceTimeMs: 0,
    });
  });
});

describe("applyCompletedSequence", () => {
  it("increments completed sequences and the current streak", () => {
    const currentStats: SequenceStats = {
      completed: 2,
      incorrectAttempts: 1,
      streak: 2,
      totalSequenceTimeMs: 3000,
    };

    expect(applyCompletedSequence(currentStats, 1200)).toEqual({
      completed: 3,
      incorrectAttempts: 1,
      streak: 3,
      totalSequenceTimeMs: 4200,
    });
  });

  it("does not mutate the existing statistics object", () => {
    const currentStats: SequenceStats = {
      completed: 1,
      incorrectAttempts: 0,
      streak: 1,
      totalSequenceTimeMs: 1000,
    };

    const nextStats = applyCompletedSequence(currentStats, 500);

    expect(nextStats).not.toBe(currentStats);

    expect(currentStats).toEqual({
      completed: 1,
      incorrectAttempts: 0,
      streak: 1,
      totalSequenceTimeMs: 1000,
    });
  });
});

describe("applyIncorrectSequenceAttempt", () => {
  it("increments incorrect attempts and resets the streak", () => {
    const currentStats: SequenceStats = {
      completed: 3,
      incorrectAttempts: 2,
      streak: 3,
      totalSequenceTimeMs: 5000,
    };

    expect(applyIncorrectSequenceAttempt(currentStats)).toEqual({
      completed: 3,
      incorrectAttempts: 3,
      streak: 0,
      totalSequenceTimeMs: 5000,
    });
  });

  it("does not mutate the existing statistics object", () => {
    const currentStats: SequenceStats = {
      completed: 1,
      incorrectAttempts: 1,
      streak: 1,
      totalSequenceTimeMs: 1000,
    };

    const nextStats = applyIncorrectSequenceAttempt(currentStats);

    expect(nextStats).not.toBe(currentStats);

    expect(currentStats).toEqual({
      completed: 1,
      incorrectAttempts: 1,
      streak: 1,
      totalSequenceTimeMs: 1000,
    });
  });
});

describe("getAverageSequenceTimeMs", () => {
  it("returns zero when no sequences have been completed", () => {
    expect(getAverageSequenceTimeMs(INITIAL_SEQUENCE_STATS)).toBe(0);
  });

  it("returns the rounded average completion time", () => {
    const stats: SequenceStats = {
      completed: 3,
      incorrectAttempts: 0,
      streak: 3,
      totalSequenceTimeMs: 4000,
    };

    expect(getAverageSequenceTimeMs(stats)).toBe(1333);
  });
});

describe("getSequenceAccuracy", () => {
  it("returns 100 when no attempts have been recorded", () => {
    expect(getSequenceAccuracy(INITIAL_SEQUENCE_STATS)).toBe(100);
  });

  it("calculates completed sequences as a percentage of all attempts", () => {
    const stats: SequenceStats = {
      completed: 3,
      incorrectAttempts: 1,
      streak: 2,
      totalSequenceTimeMs: 4000,
    };

    expect(getSequenceAccuracy(stats)).toBe(75);
  });

  it("rounds the accuracy to the nearest whole percentage", () => {
    const stats: SequenceStats = {
      completed: 2,
      incorrectAttempts: 1,
      streak: 0,
      totalSequenceTimeMs: 2000,
    };

    expect(getSequenceAccuracy(stats)).toBe(67);
  });

  it("returns zero when every attempt is incorrect", () => {
    const stats: SequenceStats = {
      completed: 0,
      incorrectAttempts: 4,
      streak: 0,
      totalSequenceTimeMs: 0,
    };

    expect(getSequenceAccuracy(stats)).toBe(0);
  });
});
