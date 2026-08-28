import { describe, expect, it } from "vitest";
import type { PiecePracticePiece } from "./piece-practice-types";
import { createPiecePracticeDisplayScore } from "./piece-practice-display-score";
import { projectStaffBuilderMeasure } from "@/features/staff-builder/notation/staff-builder-notation";

const piece: PiecePracticePiece = {
  sourceScoreId: "score", sourceScoreUpdatedAt: "2026-08-10T12:00:00.000Z", title: "Display", tempoBpm: 88,
  measures: [{ measureIndex: 0, sourceMeasureId: "m1", absoluteStartTick: 0, capacityTicks: 1920, keySignatureId: "c-major", timeSignature: "4/4", restEventIds: [], targets: [], sourceEvents: [{
    sourceEventId: "from", kind: "notes", staff: "treble", startTick: 1440, absoluteStartTick: 1440, duration: "quarter", durationTicks: 480, arpeggiation: "up",
    pitches: [{ sourcePitchId: "from-p", midiNumber: 60, letter: "C", accidental: "natural", octave: 4, incomingTieIds: [], outgoingTieIds: ["tie"], requiresAttack: true }, { sourcePitchId: "from-e", midiNumber: 64, letter: "E", accidental: "natural", octave: 4, incomingTieIds: [], outgoingTieIds: [], requiresAttack: true }],
  }] }, { measureIndex: 1, sourceMeasureId: "m2", absoluteStartTick: 1920, capacityTicks: 1440, keySignatureId: "g-major", timeSignature: "3/4", restEventIds: [], targets: [], sourceEvents: [{
    sourceEventId: "to", kind: "notes", staff: "treble", startTick: 0, absoluteStartTick: 1920, duration: "quarter", durationTicks: 480,
    pitches: [{ sourcePitchId: "to-p", midiNumber: 60, letter: "C", accidental: "natural", octave: 4, incomingTieIds: ["tie"], outgoingTieIds: [], requiresAttack: false }],
  }] }],
};

describe("Piece Practice display score", () => {
  it("reconstructs read-only notation context, source IDs, and ties", () => {
    expect(createPiecePracticeDisplayScore(piece)).toMatchObject({
      id: "score", title: "Display", tempoBpm: 88, initialKeySignatureId: "c-major", initialTimeSignature: "4/4",
      measures: [{ id: "m1", events: [{ id: "from", arpeggiation: "up" }] }, { id: "m2", keySignatureChange: "g-major", timeSignatureChange: "3/4", events: [{ id: "to" }] }],
      ties: [{ id: "tie", fromEventId: "from", fromPitchId: "from-p", toEventId: "to", toPitchId: "to-p" }],
    });
  });

  it("does not mutate or retain a mutable reference to the practice projection", () => {
    const before = structuredClone(piece);
    const display = createPiecePracticeDisplayScore(piece);
    expect(piece).toEqual(before);
    expect(display.measures[0]?.events).not.toBe(piece.measures[0]?.sourceEvents);
  });

  it("preserves authored rolled notation and its accessible meaning", () => {
    const display = createPiecePracticeDisplayScore(piece);
    expect(projectStaffBuilderMeasure(display, 0).summary.treble).toContain("arpeggiated chord C4, E4, rolled upward");
  });
});
