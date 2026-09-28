import { describe, expect, it } from "vitest";
import { MUSIC_KEYS } from "@/lib/music/keys";
import * as C from "./staff-builder-contract";
import { STAFF_BUILDER_CLEFS } from "./staff-builder-clefs";
import { STAFF_BUILDER_DURATIONS, STAFF_BUILDER_TIME_SIGNATURES, durationToTicks, getMeasureCapacityTicks } from "./staff-builder-time";
import { STAFF_BUILDER_AUTHORING_EXAMPLE as example, STAFF_BUILDER_UNRESOLVED_EXAMPLE as unfinished } from "./staff-builder-llm-examples";
import { createStaffBuilderLlmSpecification } from "./staff-builder-llm-specification";
import { parseStaffBuilderPieceFileText, serializeStaffBuilderPiece } from "./persistence/staff-builder-piece-file";
import { validateStaffBuilderScore } from "./staff-builder-validation";
import { resolveStaffBuilderMeasureContext } from "./staff-builder-score";
import type { StaffBuilderAnnotation, StaffBuilderEvent, StaffBuilderScore } from "./staff-builder-types";

const parse = (value: unknown) => parseStaffBuilderPieceFileText(JSON.stringify(value));
function cloned(): StaffBuilderScore { return JSON.parse(JSON.stringify(example)); }
function enumLine(prefix: string): string[] {
  const line = createStaffBuilderLlmSpecification().split("\n").find((line) => line.startsWith(prefix))!;
  return [...line.matchAll(/"([^"]+)"/g)].map((match) => match[1]!);
}

describe("Staff Builder portable AI authoring contract", () => {
  it("is deterministic, current, and leaves canonical definitions/examples untouched", () => {
    const before = JSON.stringify({ C, example, unfinished, MUSIC_KEYS });
    const first = createStaffBuilderLlmSpecification();
    expect(first).toBe(createStaffBuilderLlmSpecification());
    expect(first).toContain(`Canonical score schemaVersion: ${C.STAFF_BUILDER_SCORE_SCHEMA_VERSION}`);
    expect(C.STAFF_BUILDER_SCORE_SCHEMA_VERSION).toBe(4);
    expect(JSON.stringify({ C, example, unfinished, MUSIC_KEYS })).toBe(before);
  });

  it("publishes exact closed enums with no fabricated supported values", () => {
    expect(enumLine("Event kinds:")).toEqual(Object.values(C.STAFF_BUILDER_EVENT_KINDS));
    expect(enumLine("Rhythm statuses:")).toEqual(Object.values(C.STAFF_BUILDER_RHYTHM_KINDS));
    expect(enumLine("Kinds:")).toEqual([...Object.values(C.STAFF_BUILDER_ANNOTATION_KINDS), ...Object.values(C.STAFF_BUILDER_ANCHOR_KINDS)]);
    expect(enumLine("Optional notes arpeggiation values:")).toEqual([...C.STAFF_BUILDER_ARPEGGIATIONS]);
    expect(enumLine("clefChanges is")).toEqual([...C.STAFF_BUILDER_STAFFS, ...STAFF_BUILDER_CLEFS]);
    expect(enumLine("Keys for")).toEqual(MUSIC_KEYS.map(({ id }) => id));
    expect(enumLine("Meters for")).toEqual([...STAFF_BUILDER_TIME_SIGNATURES]);
    expect(enumLine("Supported duration values")).toEqual([...STAFF_BUILDER_DURATIONS]);
    expect(enumLine("practice-mark:")).toEqual([...C.STAFF_BUILDER_PRACTICE_MARK_CATEGORIES]);
    expect(enumLine("bookmark:")).toEqual([...C.STAFF_BUILDER_BOOKMARK_CATEGORIES]);
    const guide = createStaffBuilderLlmSpecification();
    for (const duration of STAFF_BUILDER_DURATIONS) expect(guide).toContain(`${JSON.stringify(duration)}=${durationToTicks(duration)}`);
    for (const meter of STAFF_BUILDER_TIME_SIGNATURES) expect(guide).toContain(`${JSON.stringify(meter)}=${getMeasureCapacityTicks(meter)}`);
    for (const value of [...C.STAFF_BUILDER_PITCH_LETTERS, ...C.STAFF_BUILDER_ACCIDENTALS]) expect(guide).toContain(JSON.stringify(value));
    // Compile-time exhaustiveness: future union members need a published collection entry.
    const events: Record<StaffBuilderEvent["kind"], true> = { notes: true, rest: true };
    const annotations: Record<StaffBuilderAnnotation["kind"], true> = { "study-note": true, "lyric-cue": true, "practice-mark": true, bookmark: true };
    expect(Object.keys(events)).toEqual(Object.values(C.STAFF_BUILDER_EVENT_KINDS));
    expect(Object.keys(annotations)).toEqual(Object.values(C.STAFF_BUILDER_ANNOTATION_KINDS));
  });

  it("parses every embedded JSON example through the actual piece importer", () => {
    const blocks = [...createStaffBuilderLlmSpecification().matchAll(/```json\n([\s\S]*?)\n```/g)];
    expect(blocks).toHaveLength(2);
    for (const block of blocks) expect(parseStaffBuilderPieceFileText(block[1]!)).toMatchObject({ ok: true });
    const ready = parseStaffBuilderPieceFileText(blocks[0]![1]!);
    if (!ready.ok) throw new Error(ready.message);
    expect(validateStaffBuilderScore(ready.score)).toEqual([]);
    const draft = parseStaffBuilderPieceFileText(blocks[1]![1]!);
    if (!draft.ok) throw new Error(draft.message);
    expect(validateStaffBuilderScore(draft.score).map(({ code }) => code)).toContain("unresolved-rhythm");
  });

  it("accepts a separately authored complete document using documented fields", () => {
    const score: StaffBuilderScore = {
      schemaVersion: C.STAFF_BUILDER_SCORE_SCHEMA_VERSION, id: "independent", title: "Bass display",
      createdAt: "2026-02-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z",
      tempoBpm: 120, initialKeySignatureId: "f-major", initialTimeSignature: "2/4", ties: [], annotations: [],
      measures: [{ id: "bar", clefChanges: { treble: "bass", bass: "bass" }, events: [
        { id: "note", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "half" }, pitches: [{ id: "bb", midiNumber: 58, letter: "B", accidental: "flat", octave: 3 }] },
        { id: "rest", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "half" } },
      ] }],
    };
    expect(parse(score)).toEqual({ ok: true, score });
    expect(validateStaffBuilderScore(score)).toEqual([]);
  });

  it("round-trips redundant clefs and inherited context without altering pitches", () => {
    const result = parseStaffBuilderPieceFileText(serializeStaffBuilderPiece(example));
    expect(result).toEqual({ ok: true, score: example });
    if (!result.ok) throw new Error(result.message);
    expect(resolveStaffBuilderMeasureContext(result.score, 2).clefs).toEqual({ treble: "treble", bass: "treble" });
    expect(result.score.measures.map(({ events }) => events)).toEqual(example.measures.map(({ events }) => events));
    expect(result.score.measures[1]!.clefChanges).toEqual({ bass: "treble", treble: "treble" });
  });

  it("shares parser capabilities for keys, meters, durations, clefs, and pitch spelling", () => {
    for (const { id } of MUSIC_KEYS) expect(parse({ ...example, initialKeySignatureId: id })).toMatchObject({ ok: true });
    for (const meter of STAFF_BUILDER_TIME_SIGNATURES) expect(parse({ ...example, initialTimeSignature: meter })).toMatchObject({ ok: true });
    for (const duration of STAFF_BUILDER_DURATIONS) expect(parse({ ...example, measures: [{ id: "m", events: [{ ...example.measures[0].events[0], rhythm: { status: "final", duration } }] }], ties: [], annotations: [] })).toMatchObject({ ok: true });
    for (const staff of C.STAFF_BUILDER_STAFFS) for (const clef of STAFF_BUILDER_CLEFS) expect(parse({ ...example, measures: [{ id: "m", events: [], clefChanges: { [staff]: clef } }], ties: [], annotations: [] })).toMatchObject({ ok: true });
    for (const letter of C.STAFF_BUILDER_PITCH_LETTERS) for (const accidental of C.STAFF_BUILDER_ACCIDENTALS) {
      const score = cloned();
      const note = score.measures[0]!.events[0]!;
      if (note.kind !== "notes") throw new Error("Expected notes");
      expect(parse({ ...score, measures: [{ id: "m", events: [{ ...note, pitches: [{ ...note.pitches[0], letter, accidental }] }] }], ties: [], annotations: [] })).toMatchObject({ ok: true });
    }
  });

  it("accepts every annotation category and applicable anchor kind", () => {
    for (const anchor of [{ kind: "event", eventId: "chord" }, { kind: "measure", measureId: "m1" }] as const) {
      for (const category of C.STAFF_BUILDER_PRACTICE_MARK_CATEGORIES) expect(parse({ ...example, annotations: [{ id: "a", kind: "practice-mark", anchor, category, text: "Study" }] })).toMatchObject({ ok: true });
      for (const category of C.STAFF_BUILDER_BOOKMARK_CATEGORIES) expect(parse({ ...example, annotations: [{ id: "a", kind: "bookmark", anchor, category }] })).toMatchObject({ ok: true });
      expect(parse({ ...example, annotations: [{ id: "a", kind: "study-note", anchor, text: " Study " }] })).toMatchObject({ ok: true });
    }
    expect(parse(example)).toMatchObject({ ok: true });
  });

  it("preserves permissive structural import versus subsequent musical validation", () => {
    const score = { ...example, ties: [{ ...example.ties[0], toEventId: "missing" }] };
    const imported = parse(score);
    expect(imported).toMatchObject({ ok: true });
    if (!imported.ok) throw new Error(imported.message);
    expect(validateStaffBuilderScore(imported.score).map(({ code }) => code)).toContain("tie-endpoint-missing");
    const offGrid = { ...unfinished, measures: [{ ...unfinished.measures[0], events: [{ ...unfinished.measures[0].events[0], startTick: 1 }] }] };
    expect(parse(offGrid)).toMatchObject({ ok: true });
    const inconsistent = { ...unfinished, measures: [{ id: "m", events: [{ ...unfinished.measures[0].events[0], pitches: [{ id: "p", midiNumber: 60, letter: "A", accidental: "sharp", octave: -50 }] }] }] };
    expect(parse(inconsistent)).toMatchObject({ ok: true });
    expect(createStaffBuilderLlmSpecification()).toContain("Import acceptance != practice readiness");
    for (const rule of Object.values(C.STAFF_BUILDER_IMPORT_RULES)) expect(createStaffBuilderLlmSpecification()).toContain(rule);
  });

  it("canonicalizes unknown fields while rejecting unknown clefChanges keys", () => {
    expect(parse({ ...example, unexpected: "discard", lastPracticedAt: example.updatedAt })).toEqual({ ok: true, score: example });
    expect(parse({ ...example, measures: [{ id: "m", events: [], clefChanges: {} }], ties: [], annotations: [] })).toEqual({ ok: true, score: { ...example, measures: [{ id: "m", events: [] }], ties: [], annotations: [] } });
    expect(parse({ ...example, measures: [{ id: "m", events: [], clefChanges: { alto: "treble" } }] })).toMatchObject({ ok: false });
  });

  it("rejects fabricated capabilities, malformed IDs/timestamps, and required omissions", () => {
    for (const schemaVersion of [0, 5, "4"]) expect(parse({ ...example, schemaVersion })).toMatchObject({ ok: false, reason: "unsupported-version" });
    for (const patch of [{ id: " " }, { createdAt: "2026-01-01" }, { tempoBpm: 39 }, { tempoBpm: 241 }, { initialKeySignatureId: "unsupported" }, { initialTimeSignature: "5/4" }, { measures: [] }, { annotations: undefined }, { ties: undefined }]) expect(parse({ ...example, ...patch })).toMatchObject({ ok: false });
    for (const patch of [{ kind: "chord" }, { kind: "note" }, { arpeggiation: "down" }, { rhythm: { status: "final", duration: "thirty-second" } }]) expect(parse({ ...example, measures: [{ id: "m", events: [{ ...example.measures[0].events[0], ...patch }] }], annotations: [], ties: [] })).toMatchObject({ ok: false });
    for (const clef of ["alto", "tenor", "percussion"]) expect(parse({ ...example, measures: [{ id: "m", events: [], clefChanges: { bass: clef } }], annotations: [], ties: [] })).toMatchObject({ ok: false });
    expect(parse({ ...example, annotations: [{ id: "a", kind: "fingering", anchor: { kind: "measure", measureId: "m1" } }] })).toMatchObject({ ok: false });
  });

  it("retains lyric-cue semantic staff and text/anchor constraints", () => {
    const cue = { id: "a", kind: "lyric-cue", anchor: { kind: "event", eventId: "roll" }, text: "Sing" };
    expect(parse({ ...example, annotations: [cue] })).toMatchObject({ ok: false });
    for (const text of ["", " space ", "x".repeat(61)]) expect(parse({ ...example, annotations: [{ ...cue, anchor: { kind: "event", eventId: "chord" }, text }] })).toMatchObject({ ok: false });
    expect(parse({ ...example, annotations: [{ ...cue, anchor: { kind: "measure", measureId: "m1" } }] })).toMatchObject({ ok: false });
    expect(parse({ ...example, annotations: [example.annotations[2], { ...example.annotations[2], id: "duplicate-cue" }] })).toMatchObject({ ok: false });
    expect(parse({ ...example, annotations: [{ id: "a", kind: "practice-mark", anchor: { kind: "event", eventId: "chord" }, category: "other" }] })).toMatchObject({ ok: false });
  });

  it("documents the actual same-position conflict rule without forbidding note/rest combinations", () => {
    const score = { ...example, measures: example.measures.map((measure, index) => index === 0 ? { ...measure, events: [...measure.events, { id: "extra-rest", kind: "rest" as const, staff: "treble" as const, startTick: 0, rhythm: { status: "final" as const, duration: "whole" as const } }] } : measure) };
    expect(parse(score)).toMatchObject({ ok: true });
    expect(validateStaffBuilderScore(score)).toEqual([]);
    expect(createStaffBuilderLlmSpecification()).toContain("A notes event and a rest at the same startTick are not flagged as a same-position conflict");
  });

  it("preserves scoped uniqueness, missing-anchor rejection, and rest/arpeggiation restrictions", () => {
    expect(parse(example)).toMatchObject({ ok: true }); // repeated pitch ID c in separate events is valid
    expect(parse({ ...example, measures: [example.measures[0], example.measures[0]] })).toMatchObject({ ok: false });
    expect(parse({ ...example, ties: [example.ties[0], example.ties[0]] })).toMatchObject({ ok: false });
    expect(parse({ ...example, annotations: [example.annotations[0], example.annotations[0]] })).toMatchObject({ ok: false });
    expect(parse({ ...example, annotations: [{ ...example.annotations[0], anchor: { kind: "measure", measureId: "missing" } }] })).toMatchObject({ ok: false });
    const single = example.measures[0].events[1];
    for (const event of [
      { ...single, arpeggiation: "up" },
      { ...example.measures[0].events[2], arpeggiation: "up" },
      { ...example.measures[0].events[2], rhythm: { status: "unresolved" } },
      { ...single, pitches: [single.pitches[0], single.pitches[0]] },
      { ...single, pitches: [single.pitches[0], { ...single.pitches[0], id: "other" }] },
    ]) expect(parse({ ...example, measures: [{ id: "m", events: [event] }], annotations: [], ties: [] })).toMatchObject({ ok: false });
  });
});
