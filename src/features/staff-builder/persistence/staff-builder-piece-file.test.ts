import { describe, expect, it } from "vitest";
import type { StaffBuilderScore } from "../staff-builder-types";
import {
  getStaffBuilderPieceFilename,
  normalizeImportedStaffBuilderPiece,
  parseStaffBuilderPieceFileText,
  serializeStaffBuilderPiece,
} from "./staff-builder-piece-file";

function score(): StaffBuilderScore {
  return {
    schemaVersion: 2, annotations: [],
    id: "piece-id",
    title: "Polyphonic Étude",
    createdAt: "2026-08-11T12:00:00.000Z",
    updatedAt: "2026-08-11T13:00:00.000Z",
    tempoBpm: 84,
    initialKeySignatureId: "c-major",
    initialTimeSignature: "4/4",
    measures: [
      { id: "m1", events: [
        { id: "long", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "whole" }, pitches: [{ id: "long-c", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 }] },
        { id: "later-chord", kind: "notes", staff: "treble", startTick: 480, rhythm: { status: "final", duration: "quarter" }, pitches: [
          { id: "e4", midiNumber: 64, letter: "E", accidental: "natural", octave: 4 },
          { id: "g4", midiNumber: 67, letter: "G", accidental: "natural", octave: 4 },
        ] },
        { id: "bass-rest", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "whole" } },
      ] },
      { id: "m2", keySignatureChange: "g-major", timeSignatureChange: "6/8", events: [
        { id: "destination", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "dotted-half" }, pitches: [{ id: "destination-c", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 }] },
        { id: "bass-rest-2", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "dotted-half" } },
      ] },
    ],
    ties: [{ id: "tie", fromEventId: "long", fromPitchId: "long-c", toEventId: "destination", toPitchId: "destination-c" }],
  };
}

describe("Staff Builder piece files", () => {
  it("serializes one canonical authoritative score as deterministic human-readable JSON", () => {
    const source = { ...score(), editorPass: "rhythm", practiceProgress: { target: 3 } } as StaffBuilderScore;
    const serialized = serializeStaffBuilderPiece(source);
    expect(serialized).toBe(serializeStaffBuilderPiece(source));
    expect(serialized.endsWith("\n")).toBe(true);
    expect(serialized).toContain('\n  "schemaVersion": 2');
    expect(serialized).not.toContain("editorPass");
    expect(serialized).not.toContain("practiceProgress");
  });

  it("round trips ties, polyphony, chords, rests, spelling, durations, and measure overrides exactly", () => {
    const source = score();
    expect(parseStaffBuilderPieceFileText(serializeStaffBuilderPiece(source))).toEqual({ ok: true, score: source });
  });

  it.each([
    ["Hallelujah", "hallelujah.prelude.json"],
    ["  Café & Prelude!  ", "cafe-prelude.prelude.json"],
    ["🎹", "staff-builder-piece-piece-id.prelude.json"],
  ])("creates a safe filename for %s", (title, expected) => {
    expect(getStaffBuilderPieceFilename({ id: "piece-id", title })).toBe(expected);
  });

  it("caps long filename slugs", () => {
    const filename = getStaffBuilderPieceFilename({ id: "id", title: "A".repeat(120) });
    expect(filename).toHaveLength(80 + ".prelude.json".length);
  });

  it("rejects malformed JSON, malformed score data, and unsupported versions with learner-facing results", () => {
    expect(parseStaffBuilderPieceFileText("{" )).toMatchObject({ ok: false, reason: "invalid-json" });
    expect(parseStaffBuilderPieceFileText(JSON.stringify({ schemaVersion: 1 }))).toMatchObject({ ok: false, reason: "invalid-score" });
    expect(parseStaffBuilderPieceFileText(JSON.stringify({ schemaVersion: 3 }))).toMatchObject({ ok: false, reason: "unsupported-version" });
  });

  it("imports V1 as V2 and round trips every Phase 1 annotation kind and anchor", () => {
    const current = score();
    const { annotations: _annotations, ...withoutAnnotations } = current;
    void _annotations;
    const legacy = { ...withoutAnnotations, schemaVersion: 1 };
    expect(parseStaffBuilderPieceFileText(JSON.stringify(legacy))).toEqual({ ok: true, score: { ...legacy, schemaVersion: 2, annotations: [] } });
    const annotated = {
      ...current,
      annotations: [
        { id: "note", kind: "study-note" as const, anchor: { kind: "event" as const, eventId: "long" }, text: "Follow the inner voice." },
        { id: "mark", kind: "practice-mark" as const, anchor: { kind: "measure" as const, measureId: "m1" }, category: "hands-separate" as const },
        { id: "bookmark", kind: "bookmark" as const, anchor: { kind: "measure" as const, measureId: "m2" }, category: "revisit" as const },
      ],
    };
    expect(parseStaffBuilderPieceFileText(serializeStaffBuilderPiece(annotated))).toEqual({ ok: true, score: annotated });
  });

  it("preserves structurally incomplete scores because file parsing owns schema validity only", () => {
    const incomplete = { ...score(), measures: [{ id: "empty", events: [] }] };
    expect(parseStaffBuilderPieceFileText(serializeStaffBuilderPiece(incomplete))).toEqual({ ok: true, score: incomplete });
  });

  it("preserves the exact score and object identity when its project ID is unique", () => {
    const source = score();
    expect(normalizeImportedStaffBuilderPiece(source, new Set(["other"]))).toBe(source);
  });

  it("changes only top-level ID and updatedAt on collision while preserving title and internal tie identities", () => {
    const source = score();
    const ids = ["piece-id", "piece-id-2"];
    const imported = normalizeImportedStaffBuilderPiece(source, new Set(ids), {
      createId: (() => { const values = ["piece-id-2", "piece-id-3"]; return () => values.shift() ?? "piece-id-4"; })(),
      now: () => "2026-08-11T14:00:00.000Z",
    });
    expect(imported).toEqual({ ...source, id: "piece-id-3", updatedAt: "2026-08-11T14:00:00.000Z" });
    expect(imported.measures).toBe(source.measures);
    expect(imported.ties).toBe(source.ties);
    expect(imported.annotations).toBe(source.annotations);
  });

  it("keeps annotation IDs and internal anchors unchanged when only a colliding score ID is normalized", () => {
    const source = { ...score(), annotations: [
      { id: "event-note", kind: "study-note" as const, anchor: { kind: "event" as const, eventId: "long" }, text: "Listen." },
      { id: "measure-mark", kind: "bookmark" as const, anchor: { kind: "measure" as const, measureId: "m2" }, category: "interesting" as const },
    ] };
    const imported = normalizeImportedStaffBuilderPiece(source, new Set([source.id]), { createId: () => "copy", now: () => "2026-08-11T14:00:00.000Z" });
    expect(imported.annotations).toBe(source.annotations);
    expect(imported.annotations).toEqual(source.annotations);
  });

  it("does not mutate its source during serialization, parsing, or normalization", () => {
    const source = score();
    const before = structuredClone(source);
    parseStaffBuilderPieceFileText(serializeStaffBuilderPiece(source));
    normalizeImportedStaffBuilderPiece(source, new Set([source.id]), { createId: () => "copy", now: () => "2026-08-11T14:00:00.000Z" });
    expect(source).toEqual(before);
  });
});
