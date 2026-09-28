import { describe, expect, it } from "vitest";
import { DEFAULT_STAFF_BUILDER_CLEFS } from "./staff-builder-clefs";
import { createStaffBuilderScore, deleteStaffBuilderMeasure, insertStaffBuilderMeasure, resolveStaffBuilderMeasureContext, setStaffBuilderMeasureClef } from "./staff-builder-score";
import type { StaffBuilderScore } from "./staff-builder-types";
import { validateStaffBuilderScore } from "./staff-builder-validation";
import { parseStaffBuilderScore } from "./persistence/staff-builder-schema";
import { normalizeImportedStaffBuilderPiece, parseStaffBuilderPieceFileText, serializeStaffBuilderPiece } from "./persistence/staff-builder-piece-file";
import { readStaffBuilderDraft, readStaffBuilderLibrary, writeStaffBuilderValue } from "./persistence/staff-builder-storage";
import { duplicateStaffBuilderScore } from "./staff-builder-duplication";
import { projectStaffBuilderPieceForPractice } from "@/features/piece-practice/piece-practice-projection";
import { createPiecePracticeDisplayScore } from "@/features/piece-practice/piece-practice-display-score";
import { createPiecePracticeSession, submitPiecePracticeAttempt } from "@/features/piece-practice/piece-practice-session";

const factories = { createId: (() => { let id = 0; return () => `new-${++id}`; })(), now: () => "2026-09-28T12:00:00.000Z" };

function musicalScore(): StaffBuilderScore {
  return {
    ...createStaffBuilderScore({ title: "Clef study", tempoBpm: 90, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", factories }),
    measures: Array.from({ length: 5 }, (_, i) => ({ id: `m${i}`, events: [
      { id: `upper-${i}`, staff: "treble" as const, kind: "notes" as const, startTick: 0, rhythm: { status: "final" as const, duration: "whole" as const }, pitches: [
        { id: `c-${i}`, midiNumber: 60, letter: "C" as const, accidental: "natural" as const, octave: 4 },
      ] },
      { id: `lower-${i}`, staff: "bass" as const, kind: "notes" as const, startTick: 0, rhythm: { status: "final" as const, duration: "half" as const }, arpeggiation: "up" as const, pitches: [
        { id: `lc-${i}`, midiNumber: 60, letter: "C" as const, accidental: "natural" as const, octave: 4 },
        { id: `le-${i}`, midiNumber: 64, letter: "E" as const, accidental: "natural" as const, octave: 4 },
      ] },
      { id: `rest-${i}`, staff: "bass" as const, kind: "rest" as const, startTick: 960, rhythm: { status: "final" as const, duration: "half" as const } },
    ] })),
    ties: [{ id: "tie", fromEventId: "upper-0", fromPitchId: "c-0", toEventId: "upper-1", toPitchId: "c-1" }],
    annotations: [
      { id: "study", kind: "study-note", anchor: { kind: "measure", measureId: "m1" }, text: "Same pitch, different notation" },
      { id: "lyric", kind: "lyric-cue", anchor: { kind: "event", eventId: "upper-1" }, text: "Bells" },
    ],
  };
}

describe("measure-boundary display clefs", () => {
  it.each([1, 2, 3])("migrates historical v%s without inventing clef changes", (schemaVersion) => {
    const source = musicalScore();
    const legacy = { ...source, schemaVersion, ...(schemaVersion === 1 ? { annotations: undefined } : {}) };
    const parsed = parseStaffBuilderScore(legacy);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.message);
    expect(parsed.value.schemaVersion).toBe(4);
    parsed.value.measures.forEach((measure, index) => {
      expect(measure.clefChanges).toBeUndefined();
      expect(resolveStaffBuilderMeasureContext(parsed.value, index).clefs).toEqual(DEFAULT_STAFF_BUILDER_CLEFS);
    });
    expect(parsed.value.annotations).toEqual(schemaVersion === 1 ? [] : source.annotations);
    expect(parsed.value.measures[0]!.events[1]).toMatchObject(schemaVersion < 3 ? { kind: "notes" } : { arpeggiation: "up" });
    if (schemaVersion < 3) expect(parsed.value.measures[0]!.events[1]).not.toHaveProperty("arpeggiation");
  });

  it("carries each staff independently, removes overrides, and retains explicit redundant selections", () => {
    let score = musicalScore();
    score = setStaffBuilderMeasureClef(score, 1, "bass", "treble", factories);
    score = setStaffBuilderMeasureClef(score, 2, "treble", "bass", factories);
    score = setStaffBuilderMeasureClef(score, 3, "bass", "bass", factories);
    score = setStaffBuilderMeasureClef(score, 4, "treble", "treble", factories);
    expect(score.measures.map((_, i) => resolveStaffBuilderMeasureContext(score, i).clefs)).toEqual([
      { treble: "treble", bass: "bass" }, { treble: "treble", bass: "treble" },
      { treble: "bass", bass: "treble" }, { treble: "bass", bass: "bass" }, { treble: "treble", bass: "bass" },
    ]);
    score = setStaffBuilderMeasureClef(score, 2, "bass", "treble", factories);
    expect(JSON.parse(serializeStaffBuilderPiece(score)).measures[2].clefChanges).toEqual({ treble: "bass", bass: "treble" });
    score = setStaffBuilderMeasureClef(score, 2, "treble", null, factories);
    expect(score.measures[2]!.clefChanges).toEqual({ bass: "treble" });
    expect(resolveStaffBuilderMeasureContext(score, 3).clefs).toEqual({ treble: "treble", bass: "bass" });
    score = setStaffBuilderMeasureClef(score, 2, "bass", null, factories);
    expect(score.measures[2]).not.toHaveProperty("clefChanges");
  });

  it.each([
    ["treble", "bass"], ["treble", "treble"], ["bass", "bass"], ["bass", "treble"],
  ] as const)("round trips %s/%s through files, library, draft, collision normalization, and duplication", (treble, bass) => {
    let source = setStaffBuilderMeasureClef(musicalScore(), 1, "treble", treble, factories);
    source = setStaffBuilderMeasureClef(source, 1, "bass", bass, factories);
    expect(parseStaffBuilderPieceFileText(serializeStaffBuilderPiece(source))).toEqual({ ok: true, score: source });
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    expect(writeStaffBuilderValue(storage, "library", { schemaVersion: 4, pieces: [source], practiceMetadataByPieceId: {} }).ok).toBe(true);
    expect(readStaffBuilderLibrary(storage)).toMatchObject({ ok: true, value: { pieces: [source] } });
    expect(writeStaffBuilderValue(storage, "draft", { schemaVersion: 3, score: source, savedPieceId: source.id, updatedAt: source.updatedAt, editorPass: "capture" }).ok).toBe(true);
    expect(readStaffBuilderDraft(storage)).toMatchObject({ ok: true, value: { score: source } });
    expect(normalizeImportedStaffBuilderPiece(source, new Set([source.id]), factories).measures).toEqual(source.measures);
    for (const mode of ["full", "treble", "bass"] as const) {
      const copy = duplicateStaffBuilderScore(source, mode, factories);
      expect(copy.measures.map(({ clefChanges }) => clefChanges)).toEqual(source.measures.map(({ clefChanges }) => clefChanges));
      expect(resolveStaffBuilderMeasureContext(copy, 4).clefs).toEqual({ treble, bass });
    }
  });

  it.each([null, [], { bass: "alto" }, { upper: "treble" }, { bass: null }])("rejects malformed or unsupported change maps: %j", (clefChanges) => {
    const source = musicalScore();
    expect(parseStaffBuilderScore({ ...source, measures: source.measures.map((measure, i) => i === 0 ? { ...measure, clefChanges } : measure) })).toMatchObject({ ok: false, reason: "corrupt" });
  });

  it("normalizes empty maps, preserves explicit defaults, and rejects newer score versions", () => {
    const source = musicalScore();
    expect(parseStaffBuilderScore({ ...source, measures: source.measures.map((measure, i) => i === 0 ? { ...measure, clefChanges: {} } : measure) })).toEqual({ ok: true, value: source });
    expect(parseStaffBuilderScore({ ...source, schemaVersion: 5 })).toMatchObject({ ok: false, reason: "unsupported" });
    const explicit = setStaffBuilderMeasureClef(source, 0, "treble", "treble", factories);
    expect(parseStaffBuilderPieceFileText(serializeStaffBuilderPiece(explicit))).toEqual({ ok: true, score: explicit });
  });

  it("preserves Middle C, chords, rolls, rests, ties, anchors, and timing across edits and switching back", () => {
    const source = musicalScore();
    const before = structuredClone(source);
    let changed = setStaffBuilderMeasureClef(source, 1, "bass", "treble", factories);
    changed = setStaffBuilderMeasureClef(changed, 1, "treble", "bass", factories);
    expect(changed.measures[1]!.events).toBe(source.measures[1]!.events);
    expect(changed.ties).toBe(source.ties);
    expect(changed.annotations).toBe(source.annotations);
    expect(changed.measures.map(({ events }) => events)).toEqual(source.measures.map(({ events }) => events));
    expect(validateStaffBuilderScore(changed)).toEqual([]);
    changed = setStaffBuilderMeasureClef(changed, 1, "bass", null, factories);
    changed = setStaffBuilderMeasureClef(changed, 1, "treble", null, factories);
    expect(changed).toEqual(source);
    expect(source).toEqual(before);
  });

  it("inherits through inserted measures and removes context authored on deleted measures", () => {
    const source = setStaffBuilderMeasureClef(musicalScore(), 1, "bass", "treble", factories);
    const inserted = insertStaffBuilderMeasure(source, 3, factories);
    if (!inserted.ok) throw new Error(inserted.error);
    expect(resolveStaffBuilderMeasureContext(inserted.score, 3).clefs.bass).toBe("treble");
    const deleted = deleteStaffBuilderMeasure(inserted.score, 1, factories);
    if (!deleted.ok) throw new Error(deleted.error);
    expect(resolveStaffBuilderMeasureContext(deleted.score, 3).clefs.bass).toBe("bass");
  });

  it("propagates effective clefs to Piece Practice display while preserving targets, grading, diagnostics, and evidence", () => {
    const source = musicalScore();
    const changed = setStaffBuilderMeasureClef(setStaffBuilderMeasureClef(source, 0, "treble", "bass", factories), 1, "bass", "treble", factories);
    const original = projectStaffBuilderPieceForPractice(source);
    const altered = projectStaffBuilderPieceForPractice(changed);
    if (!original.ok || !altered.ok) throw new Error("Expected valid musical fixtures");
    expect(altered.piece.measures.map(({ clefs: _clefs, ...musical }) => { void _clefs; return musical; })).toEqual(original.piece.measures.map(({ clefs: _clefs, ...musical }) => { void _clefs; return musical; }));
    expect(altered.piece.soundingSpans).toEqual(original.piece.soundingSpans);
    const display = createPiecePracticeDisplayScore(altered.piece);
    display.measures.forEach((_, i) => expect(resolveStaffBuilderMeasureContext(display, i).clefs).toEqual(resolveStaffBuilderMeasureContext(changed, i).clefs));
    const attempts = (piece: typeof original.piece) => {
      const initial = createPiecePracticeSession(piece, { startMeasureIndex: 0, startedAtMs: 0 });
      if (!initial.ok) throw new Error(initial.reason);
      const targetId = piece.measures[0]!.targets[0]!.id;
      const failed = submitPiecePracticeAttempt(piece, initial.state, { targetId, attempt: { attackMidiNumbers: [61] }, atMs: 100 });
      if (!failed.accepted) throw new Error(failed.reason);
      const correct = submitPiecePracticeAttempt(piece, failed.state, { targetId, attempt: { attackMidiNumbers: [60] }, atMs: 200 });
      if (!correct.accepted) throw new Error(correct.reason);
      return correct;
    };
    const originalState = attempts(original.piece);
    const alteredState = attempts(altered.piece);
    expect(alteredState).toEqual(originalState);
  });
});
