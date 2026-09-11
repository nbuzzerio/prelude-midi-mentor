import { describe, expect, it } from "vitest";
import type { PiecePracticePiece, PiecePracticeTarget } from "./piece-practice-types";
import { getPiecePracticeAllowedHeldMidiNumbers, getPiecePracticeIncomingTiedMidiNumbers } from "./piece-practice-input";

const target: PiecePracticeTarget = {
  id: "m1:attack:0", measureIndex: 0, sourceMeasureId: "m1", startTick: 0, absoluteStartTick: 0,
  checks: [{ id: "m1:attack:0:normal", kind: "normal", sourceEventIds: ["chord"], expectedMidiNumbers: [64, 67], attackedPitches: [] }],
  sourceEventIds: ["chord"], expectedMidiNumbers: [64, 67], attackedPitches: [],
};
const piece: PiecePracticePiece = {
  sourceScoreId: "score", sourceScoreUpdatedAt: "now", title: "Tied chord", tempoBpm: 96,
  measures: [{
    measureIndex: 0, sourceMeasureId: "m1", absoluteStartTick: 0, capacityTicks: 1920,
    keySignatureId: "c-major", timeSignature: "4/4", restEventIds: [], targets: [target],
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
