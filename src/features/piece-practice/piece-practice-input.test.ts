import { describe, expect, it } from "vitest";
import type { PiecePracticePiece, PiecePracticeTarget } from "./piece-practice-types";
import { classifyPiecePracticePitch, getPiecePracticeAllowedHeldMidiNumbers, getPiecePracticeIncomingTiedMidiNumbers, getPiecePracticeTransitionHeldMidiNumbers, PIECE_PRACTICE_RELEASE_OVERLAP_GRACE_MS, STAFF_FOCUS_GUARD_SEMITONES } from "./piece-practice-input";

const target: PiecePracticeTarget = {
  id: "m1:attack:0", measureIndex: 0, sourceMeasureId: "m1", startTick: 0, absoluteStartTick: 0,
  checks: [{ id: "m1:attack:0:normal", kind: "normal", sourceEventIds: ["chord"], expectedMidiNumbers: [64, 67], attackedPitches: [] }],
  sourceEventIds: ["chord"], expectedMidiNumbers: [64, 67], attackedPitches: [],
};
const piece: PiecePracticePiece = {
  sourceScoreId: "score", sourceScoreUpdatedAt: "now", title: "Tied chord", tempoBpm: 96,
  measures: [{
    measureIndex: 0, sourceMeasureId: "m1", absoluteStartTick: 0, capacityTicks: 1920,
    keySignatureId: "c-major", timeSignature: "4/4", clefs: { treble: "treble", bass: "bass" }, restEventIds: [], targets: [target],
    sourceEvents: [{
      sourceEventId: "chord", kind: "notes", staff: "treble", startTick: 0, absoluteStartTick: 0,
      duration: "quarter", durationTicks: 480, pitches: [
        { sourcePitchId: "c", midiNumber: 60, letter: "C", accidental: "natural", octave: 4, incomingTieIds: ["tie"], outgoingTieIds: [], requiresAttack: false },
        { sourcePitchId: "e", midiNumber: 64, letter: "E", accidental: "natural", octave: 4, incomingTieIds: [], outgoingTieIds: [], requiresAttack: true },
      ],
    }],
  }],
};

describe("Piece Practice input allowances", () => {
  it("uses inclusive three-semitone boundaries in either semantic Staff Focus", () => {
    expect(STAFF_FOCUS_GUARD_SEMITONES).toBe(3);
    const upper = { ...piece, assessmentFocus: "upper" as const };
    const lower = { ...piece, assessmentFocus: "lower" as const };
    expect(classifyPiecePracticePitch(upper, target, 61)).toBe("relevant");
    expect(classifyPiecePracticePitch(upper, target, 60)).toBe("optional");
    expect(classifyPiecePracticePitch(lower, target, 70)).toBe("relevant");
    expect(classifyPiecePracticePitch(lower, target, 71)).toBe("optional");
    expect(classifyPiecePracticePitch(upper, target, 64)).toBe("required");
    expect(classifyPiecePracticePitch(piece, target, 1)).toBe("relevant");
  });

  it("prefers required pitches, then exact unassessed sounding spans at the current tick", () => {
    const at480 = { ...target, absoluteStartTick: 480 };
    const span = (midiNumber: number, attackTick: number, endTick: number, staff: "bass" | "treble" = "bass") => ({
      originEventId: "other", originPitchId: String(midiNumber), staff, midiNumber, attackTick, endTick, endpointKeys: ["other:p"],
    });
    const focused = { ...piece, assessmentFocus: "upper" as const,
      measures: [{ ...piece.measures[0]!, clefs: { treble: "bass" as const, bass: "treble" as const } }],
      soundingSpans: [span(63, 0, 960), span(65, 960, 1440), span(64, 0, 960)] };
    expect(classifyPiecePracticePitch(focused, at480, 63)).toBe("optional"); // Nearby, but authored on the unassessed staff.
    expect(classifyPiecePracticePitch(focused, at480, 65)).toBe("relevant"); // Authored later is not active yet.
    expect(classifyPiecePracticePitch(focused, at480, 64)).toBe("required"); // Same MIDI pitch on both staves.
    expect(classifyPiecePracticePitch(focused, { ...at480, absoluteStartTick: 960 }, 63)).toBe("relevant"); // Span end is exclusive.
  });
  it.each([{ atMs: 1249, allowed: [81] }, { atMs: 1250, allowed: [81] }, { atMs: 1251, allowed: [] }])("bounds predecessor allowance at logical time $atMs", ({ atMs, allowed }) => {
    expect(PIECE_PRACTICE_RELEASE_OVERLAP_GRACE_MS).toBe(250);
    const transition = { targetId: target.id, predecessorPitches: [], eligibleHeldMidiNumbers: [81], firstAttackAtMs: 1000 };
    expect(getPiecePracticeTransitionHeldMidiNumbers(transition, target.id, atMs)).toEqual(allowed);
    expect(getPiecePracticeTransitionHeldMidiNumbers(transition, "other-target", atMs)).toEqual([]);
    expect(getPiecePracticeTransitionHeldMidiNumbers({ ...transition, firstAttackAtMs: null }, target.id, atMs)).toEqual([]);
  });
  it("derives incoming tied pitches at the current attack onset", () => {
    expect(getPiecePracticeIncomingTiedMidiNumbers(piece, target)).toEqual([60]);
  });

  it("does not include untied pitches or tied pitches at another onset", () => {
    expect(getPiecePracticeIncomingTiedMidiNumbers(piece, { ...target, startTick: 480 })).toEqual([]);
  });

  it("returns the sounding MIDI pitches active at the target onset plus explicit parallel allowances", () => {
    const targetAt480 = { ...target, absoluteStartTick: 480 };
    expect(getPiecePracticeAllowedHeldMidiNumbers({ piece: { ...piece, soundingSpans: [{ originEventId: "origin", originPitchId: "p", staff: "treble", midiNumber: 60, attackTick: 0, endTick: 960, endpointKeys: ["origin:p"] }] }, target: targetAt480, additionalAllowedMidiNumbers: [67, 60] })).toEqual([60, 67]);
  });
});
