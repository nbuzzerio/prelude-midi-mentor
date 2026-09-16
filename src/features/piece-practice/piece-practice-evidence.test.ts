import { describe, expect, it } from "vitest";
import { derivePiecePracticeMeasureDiagnostics, getPiecePracticeHesitationThresholdMs, PIECE_PRACTICE_HESITATION_EXPECTED_WINDOW_CAP_MS, PIECE_PRACTICE_HESITATION_MINIMUM_MS, PIECE_PRACTICE_HESITATION_MULTIPLIER } from "./piece-practice-evidence";

describe("Piece Practice diagnostic evidence", () => {
  it("uses named forgiving hesitation constants with a floor and capped musical window", () => {
    expect(PIECE_PRACTICE_HESITATION_MINIMUM_MS).toBe(2_500);
    expect(PIECE_PRACTICE_HESITATION_MULTIPLIER).toBe(3);
    expect(PIECE_PRACTICE_HESITATION_EXPECTED_WINDOW_CAP_MS).toBe(2_000);
    expect(getPiecePracticeHesitationThresholdMs(100)).toBe(2_500);
    expect(getPiecePracticeHesitationThresholdMs(1_000)).toBe(3_000);
    expect(getPiecePracticeHesitationThresholdMs(10_000)).toBe(6_000);
  });

  it("derives problem status from mistakes, hesitation, or skips without conflating them", () => {
    const measureTimings = [0, 1, 2, 3].map((measureIndex) => ({ measureIndex, sourceMeasureId: `m${measureIndex}`, activeDurationMs: 1_000 }));
    const mistake = { sequence: 0, measureIndex: 0, sourceMeasureId: "m0", targetId: "t", checkId: "c", occurredAtActiveMs: 1, kind: "normal-attempt" as const, expectedPitches: [], receivedMidiNumbers: [], missingMidiNumbers: [], extraMidiNumbers: [], unexpectedHeldMidiNumbers: [] };
    const timing = { sequence: 0, measureIndex: 1, sourceMeasureId: "m1", targetId: "t", sourceEventIds: [], expectedPitches: [], activatedAtActiveMs: 0, completedAtActiveMs: 3_000, responseDurationMs: 3_000, expectedWindowMs: 500, hesitationThresholdMs: 2_500, isHesitation: true, outcome: "completed" as const };
    const skip = { sequence: 0, measureIndex: 2, sourceMeasureId: "m2", targetId: "t", occurredAtActiveMs: 1 };
    const results = derivePiecePracticeMeasureDiagnostics({ measureTimings, mistakeEvidence: [mistake], targetTimings: [timing], skipEvidence: [skip] });
    expect(results.map(({ mistakeCount, hesitationCount, skippedTargetCount, isProblem }) => ({ mistakeCount, hesitationCount, skippedTargetCount, isProblem }))).toEqual([
      { mistakeCount: 1, hesitationCount: 0, skippedTargetCount: 0, isProblem: true },
      { mistakeCount: 0, hesitationCount: 1, skippedTargetCount: 0, isProblem: true },
      { mistakeCount: 0, hesitationCount: 0, skippedTargetCount: 1, isProblem: true },
      { mistakeCount: 0, hesitationCount: 0, skippedTargetCount: 0, isProblem: false },
    ]);
  });
});
