import { describe, expect, it } from "vitest";
import type { PiecePracticePiece } from "./piece-practice-types";
import { createPiecePracticeDisplayScore } from "./piece-practice-display-score";
import { projectStaffBuilderMeasure } from "@/features/staff-builder/notation/staff-builder-notation";
import { getStaffBuilderVerticalGeometry } from "@/features/staff-builder/notation/staff-builder-vertical-geometry";

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

  it("preserves boundary-tie directions without changing projected practice targets", () => {
    const middleEvent = piece.measures[1]!.sourceEvents[0]!;
    if (middleEvent.kind !== "notes") throw new Error("Expected note source event.");
    const chained: PiecePracticePiece = {
      ...piece,
      measures: [
        piece.measures[0]!,
        { ...piece.measures[1]!, sourceEvents: [{ ...middleEvent, pitches: [
          { ...middleEvent.pitches[0]!, letter: "B", accidental: "sharp", octave: 3, outgoingTieIds: ["tie-out"] },
          { sourcePitchId: "middle-e", midiNumber: 64, letter: "E", accidental: "natural", octave: 4, incomingTieIds: [], outgoingTieIds: [], requiresAttack: true },
        ] }] },
        { ...piece.measures[1]!, measureIndex: 2, sourceMeasureId: "m3", absoluteStartTick: 3360, sourceEvents: [{ ...middleEvent, sourceEventId: "last", absoluteStartTick: 3360, pitches: [
          { ...middleEvent.pitches[0]!, sourcePitchId: "last-p", incomingTieIds: ["tie-out"], outgoingTieIds: [] },
        ] }] },
      ],
    };
    const targetsBefore = structuredClone(chained.measures.map(({ targets }) => targets));
    const display = createPiecePracticeDisplayScore(chained);
    expect(projectStaffBuilderMeasure(display, 1).boundaryTies).toEqual([
      { tieId: "tie", eventId: "to", pitchIndex: 0, direction: "incoming", description: "Tie continues from the adjacent measure." },
      { tieId: "tie-out", eventId: "to", pitchIndex: 0, direction: "outgoing", description: "Tie continues to the adjacent measure." },
    ]);
    const visibleEvent = projectStaffBuilderMeasure(display, 1).staves.treble.find((event) => event.kind === "notes");
    expect(visibleEvent?.kind === "notes" ? visibleEvent.pitches[0] : undefined).toMatchObject({ midiNumber: 60, letter: "B", accidental: "sharp", octave: 3 });
    expect(chained.measures.map(({ targets }) => targets)).toEqual(targetsBefore);
  });

  it("restores structurally equal but fully detached lyric annotations for the shared single-measure renderer", () => {
    const annotated: PiecePracticePiece = { ...piece, annotations: [{ id: "lyric", kind: "lyric-cue", anchor: { kind: "event", eventId: "from" }, text: "Bells" }] };
    const before = structuredClone(annotated);
    const display = createPiecePracticeDisplayScore(annotated);
    expect(display.annotations).toEqual(annotated.annotations);
    expect(display.annotations).not.toBe(annotated.annotations);
    expect(display.annotations[0]).not.toBe(annotated.annotations?.[0]);
    expect(display.annotations[0]?.anchor).not.toBe(annotated.annotations?.[0]?.anchor);

    const unsafeDisplayAnnotations = display.annotations as unknown as Array<{ text: string; anchor: { kind: "event"; eventId: string } }>;
    const unsafeLyric = unsafeDisplayAnnotations[0]!;
    unsafeLyric.text = "Changed";
    unsafeLyric.anchor.eventId = "changed-event";
    unsafeDisplayAnnotations.splice(0, 1);
    expect(annotated).toEqual(before);
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

  it("preserves extreme written pitches for the shared range-aware score renderer", () => {
    const sourceEvent = piece.measures[0]?.sourceEvents[0];
    if (!sourceEvent || sourceEvent.kind !== "notes") throw new Error("Expected note source event.");
    const extreme: PiecePracticePiece = {
      ...piece,
      measures: [{ ...piece.measures[0]!, sourceEvents: [{ ...sourceEvent, pitches: [{ ...sourceEvent.pitches[0]!, midiNumber: 127, letter: "G", octave: 9 }] }] }],
    };
    const display = createPiecePracticeDisplayScore(extreme);
    const event = display.measures[0]?.events[0];
    expect(event?.kind).toBe("notes");
    const pitchSources = event?.kind === "notes" ? [{ staff: event.staff, pitches: event.pitches }] : [];
    expect(getStaffBuilderVerticalGeometry({ pitchSources, baseHeight: 300, trebleStaveY: 55, bassStaveY: 155 }).topReservation).toBeGreaterThan(0);
  });
});
