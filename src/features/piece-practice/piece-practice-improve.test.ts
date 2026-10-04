import { describe, expect, it } from "vitest";
import { comparePiecePracticeImprove, selectPiecePracticeImprove } from "./piece-practice-improve";
import type { PiecePracticeSessionState } from "./piece-practice-session";

function completed(overrides: Partial<PiecePracticeSessionState> = {}): PiecePracticeSessionState {
  return {
    assessmentFocus: "both", startMeasureIndex: 0, endMeasureIndex: 5, currentMeasureIndex: 5,
    currentTargetIndex: null, completedTargetCount: 6, skippedTargetCount: 0,
    currentMeasureCompletedTargetCount: 1, completedMeasureCount: 6, completedMeasureIndexes: [0, 1, 2, 3, 4, 5],
    mistakeEvidence: [], skipEvidence: [], restartEvidence: [], targetTimings: [],
    measureTimings: [0, 1, 2, 3, 4, 5].map((measureIndex) => ({ measureIndex, sourceMeasureId: `m${measureIndex}`, activeDurationMs: 1000 })),
    activeElapsedMs: 6000, activeSinceMs: 0, clockPaused: true, completedAtActiveMs: 6000,
    currentMeasureEnteredAtActiveMs: 5000, currentTargetActivatedAtActiveMs: null,
    firstTargetTimingPending: false, currentCheckProgress: [], boundaryReattackPending: false,
    status: "piece-complete", startedAtMs: 0, ...overrides,
  };
}

const location = (measureIndex: number, sequence = 0) => ({ sequence, measureIndex, sourceMeasureId: `m${measureIndex}`, targetId: `t${measureIndex}`, checkId: `c${measureIndex}`, occurredAtActiveMs: 10 });
const mistake = (measureIndex: number, sequence = 0) => ({ ...location(measureIndex, sequence), kind: "normal-attempt" as const, expectedPitches: [], receivedMidiNumbers: [61], missingMidiNumbers: [60], extraMidiNumbers: [61], unexpectedHeldMidiNumbers: [] });
const hesitation = (measureIndex: number, sequence = 0) => ({
  ...location(measureIndex, sequence), sourceEventIds: [], expectedPitches: [], timingBasis: "target-activation" as const,
  activatedAtActiveMs: 0, completedAtActiveMs: 4000, responseDurationMs: 4000, expectedWindowMs: 500,
  hesitationThresholdMs: 2500, isHesitation: true, outcome: "completed" as const,
});

describe("PROVISIONAL Piece Practice Improve recommendations", () => {
  it("ranks mistakes, skips and restarts ahead of hesitation-only evidence, with concrete counts", () => {
    const state = completed({ mistakeEvidence: [mistake(3)], skipEvidence: [location(2)], restartEvidence: [location(1)],
      targetTimings: Array.from({ length: 20 }, (_, i) => hesitation(0, i)) });
    const results = selectPiecePracticeImprove(state);
    expect(results.map(({ measureIndex }) => measureIndex)).toEqual([3, 2, 1, 0]);
    expect(results.map(({ mistakeCount, skippedTargetCount, restartCount, hesitationCount }) =>
      [mistakeCount, skippedTargetCount, restartCount, hesitationCount])).toEqual([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 20]]);
  });

  it("uses larger counts, subsequent signals, then score order as deterministic tie breakers", () => {
    const state = completed({ mistakeEvidence: [mistake(4), mistake(2, 1), mistake(1, 2), mistake(3, 3), mistake(3, 4)],
      skipEvidence: [location(4)], restartEvidence: [location(2)] });
    expect(selectPiecePracticeImprove(state).map(({ measureIndex }) => measureIndex)).toEqual([3, 4, 2, 1]);
    const tied = completed({ restartEvidence: [location(4), location(1, 1)], measureTimings: [...state.measureTimings].reverse() });
    expect(selectPiecePracticeImprove(tied).map(({ measureNumber }) => measureNumber)).toEqual([2, 5]);
  });

  it("does not treat raw elapsed time, MIDI observations or non-hesitant timings as difficulty", () => {
    const state = completed({ measureTimings: [{ measureIndex: 0, sourceMeasureId: "m0", activeDurationMs: 999999 }],
      targetTimings: [{ ...hesitation(0), isHesitation: false }],
      attackEvidence: [{ ...location(0), midiNumber: 60, attackVelocity: 10 }],
      releaseEvidence: [{ sequence: 0, occurredAtActiveMs: 100, midiNumber: 60, encoding: "note-off" }] });
    expect(selectPiecePracticeImprove(state)).toEqual([]);
  });

  it("returns no recommendations for incomplete or clean runs", () => {
    expect(selectPiecePracticeImprove(completed())).toEqual([]);
    expect(selectPiecePracticeImprove(completed({ status: "practicing", mistakeEvidence: [mistake(0)] }))).toEqual([]);
    expect(selectPiecePracticeImprove(completed({ status: "awaiting-explicit-measure-advance", restartEvidence: [location(0)] }))).toEqual([]);
  });

  it("only recommends completed measures inside the original practiced range", () => {
    const state = completed({ startMeasureIndex: 1, endMeasureIndex: 3, completedMeasureIndexes: [1, 3],
      mistakeEvidence: [0, 1, 2, 3, 4].map(mistake) });
    expect(selectPiecePracticeImprove(state).map(({ measureIndex }) => measureIndex)).toEqual([1, 3]);
  });

  it("counts native rolled failures once and does not invent retries or restart evidence", () => {
    const state = completed({ mistakeEvidence: [
      { ...location(0), kind: "rolled-unexpected-pitch", expectedPitches: [], receivedMidiNumber: 61, accumulatedMidiNumbers: [] },
      { ...location(0, 1), kind: "rolled-timeout", expectedPitches: [], missingMidiNumbers: [60, 64], accumulatedMidiNumbers: [], windowMs: 1500 },
    ] });
    expect(selectPiecePracticeImprove(state)[0]).toMatchObject({ mistakeCount: 2, restartCount: 0 });
  });

  it("preserves evidence and original diagnostics order across repeated selection", () => {
    const state = completed({ mistakeEvidence: [mistake(4), mistake(2, 1)] });
    const original = structuredClone(state);
    Object.freeze(state); Object.freeze(state.measureTimings); Object.freeze(state.mistakeEvidence);
    expect(selectPiecePracticeImprove(state)).toEqual(selectPiecePracticeImprove(state));
    expect(state).toEqual(original);
  });
});

describe("Improve native evidence comparison", () => {
  it("compares observed counts for the same completed measure without normalizing or declaring mastery", () => {
    const original = completed({ mistakeEvidence: [mistake(2), mistake(2, 1)], targetTimings: [hesitation(2)] });
    const focused = completed({ startMeasureIndex: 2, endMeasureIndex: 2, skipEvidence: [location(2)] });
    expect(comparePiecePracticeImprove(original, focused, 2)).toMatchObject({
      original: { mistakeCount: 2, hesitationCount: 1, skippedTargetCount: 0 },
      focused: { mistakeCount: 0, hesitationCount: 0, skippedTargetCount: 1 },
    });
  });

  it("rejects incomplete, different-focus, different-range and different-source-measure comparisons", () => {
    const original = completed();
    const focused = completed({ startMeasureIndex: 2, endMeasureIndex: 2 });
    expect(comparePiecePracticeImprove(original, { ...focused, status: "practicing" }, 2)).toBeNull();
    expect(comparePiecePracticeImprove(original, { ...focused, assessmentFocus: "upper" }, 2)).toBeNull();
    expect(comparePiecePracticeImprove(original, { ...focused, endMeasureIndex: 3 }, 2)).toBeNull();
    expect(comparePiecePracticeImprove(original, { ...focused, measureTimings: [{ measureIndex: 2, sourceMeasureId: "changed", activeDurationMs: 0 }] }, 2)).toBeNull();
    expect(comparePiecePracticeImprove({ ...original, completedMeasureIndexes: [] }, focused, 2)).toBeNull();
  });
});
