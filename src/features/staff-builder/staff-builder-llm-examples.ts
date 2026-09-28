import { STAFF_BUILDER_SCORE_SCHEMA_VERSION } from "./staff-builder-contract";
import type { StaffBuilderScore } from "./staff-builder-types";

export const STAFF_BUILDER_AUTHORING_EXAMPLE = {
  schemaVersion: STAFF_BUILDER_SCORE_SCHEMA_VERSION,
  id: "study", title: "Small notation study",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  tempoBpm: 96, initialKeySignatureId: "c-major", initialTimeSignature: "4/4",
  measures: [
    { id: "m1", events: [
      { id: "chord", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "half" }, pitches: [
        { id: "c", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 },
        { id: "e", midiNumber: 64, letter: "E", accidental: "natural", octave: 4 },
      ] },
      { id: "held", kind: "notes", staff: "treble", startTick: 960, rhythm: { status: "final", duration: "half" }, pitches: [{ id: "c", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 }] },
      { id: "lower-rest", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "whole" } },
    ] },
    { id: "m2", keySignatureChange: "d-minor", timeSignatureChange: "3/4", clefChanges: { bass: "treble", treble: "treble" }, events: [
      { id: "continuation", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "quarter" }, pitches: [{ id: "c", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 }] },
      { id: "upper-rest", kind: "rest", staff: "treble", startTick: 480, rhythm: { status: "final", duration: "half" } },
      { id: "roll", kind: "notes", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "dotted-half" }, arpeggiation: "up", pitches: [
        { id: "d", midiNumber: 74, letter: "D", accidental: "natural", octave: 5 },
        { id: "f", midiNumber: 77, letter: "F", accidental: "natural", octave: 5 },
      ] },
    ] },
    { id: "m3", events: [
      { id: "end-upper", kind: "rest", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "dotted-half" } },
      { id: "end-lower", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "dotted-half" } },
    ] },
  ],
  ties: [{ id: "tie", fromEventId: "held", fromPitchId: "c", toEventId: "continuation", toPitchId: "c" }],
  annotations: [
    { id: "study-note", kind: "study-note", anchor: { kind: "measure", measureId: "m2" }, text: "Lower staff changes display clef; pitches stay fixed." },
    { id: "event-note", kind: "study-note", anchor: { kind: "event", eventId: "roll" }, text: "Roll upward." },
    { id: "lyric", kind: "lyric-cue", anchor: { kind: "event", eventId: "chord" }, text: "Sing" },
    { id: "mark", kind: "practice-mark", anchor: { kind: "event", eventId: "held" }, category: "other", text: "Hold across the barline." },
    { id: "bookmark", kind: "bookmark", anchor: { kind: "measure", measureId: "m3" }, category: "revisit" },
  ],
} as const satisfies StaffBuilderScore;

/** Importable unfinished notation, deliberately not practice-ready. */
export const STAFF_BUILDER_UNRESOLVED_EXAMPLE = {
  ...STAFF_BUILDER_AUTHORING_EXAMPLE, id: "unfinished", title: "Unfinished rhythm",
  measures: [{ id: "draft-measure", events: [
    { id: "draft-note", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "unresolved" }, pitches: [{ id: "pitch", midiNumber: 61, letter: "C", accidental: "sharp", octave: 4 }] },
    { id: "draft-rest", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "whole" } },
  ] }], ties: [], annotations: [],
} as const satisfies StaffBuilderScore;
