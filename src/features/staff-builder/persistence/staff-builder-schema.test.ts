import { describe, expect, it } from "vitest";
import { appendStaffBuilderMeasure, createStaffBuilderScore, insertStaffBuilderRest, insertUnresolvedStaffBuilderNotes, setStaffBuilderMeasureKeySignature, setStaffBuilderMeasureTimeSignature } from "../staff-builder-score";
import { parseStaffBuilderDraft, parseStaffBuilderLibrary, parseStaffBuilderScore } from "./staff-builder-schema";

function validScore() {
  let id = 0;
  const factories = { createId: () => `id-${++id}`, now: () => "2026-08-06T12:00:00.000Z" };
  let score = createStaffBuilderScore({ title: "Study", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", factories });
  score = insertUnresolvedStaffBuilderNotes(score, { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60], factories });
  score = insertStaffBuilderRest(score, { measureIndex: 0, staff: "bass", startTick: 0, duration: "quarter", factories });
  score = appendStaffBuilderMeasure(score, factories);
  score = setStaffBuilderMeasureKeySignature(score, 1, "g-major", factories);
  score = setStaffBuilderMeasureTimeSignature(score, 1, "6/8", factories);
  const note = score.measures[0]?.events.find(({ kind }) => kind === "notes");
  const pitch = note?.kind === "notes" ? note.pitches[0] : undefined;
  return { ...score, ties: pitch && note ? [{ id: "tie-1", fromEventId: note.id, fromPitchId: pitch.id, toEventId: note.id, toPitchId: pitch.id }] : [] };
}

describe("Staff Builder schema", () => {
  it("parses valid scores, libraries, and drafts without mutating input", () => {
    const score = validScore();
    const library = { schemaVersion: 1, pieces: [score] };
    const draft = { schemaVersion: 1, savedPieceId: score.id, updatedAt: "2026-08-06T13:00:00.000Z", score, editorPass: "capture" };
    const before = JSON.stringify({ library, draft });
    expect(parseStaffBuilderScore(score).ok).toBe(true);
    expect(parseStaffBuilderLibrary(library).ok).toBe(true);
    expect(parseStaffBuilderDraft(draft).ok).toBe(true);
    expect(JSON.stringify({ library, draft })).toBe(before);
  });

  it.each([
    ["missing fields", {}],
    ["empty IDs", { ...validScore(), id: "" }],
    ["invalid timestamps", { ...validScore(), updatedAt: "yesterday" }],
    ["invalid tempo", { ...validScore(), tempoBpm: 241 }],
    ["unsupported key", { ...validScore(), initialKeySignatureId: "x-major" }],
    ["unsupported signature", { ...validScore(), initialTimeSignature: "5/4" }],
  ])("rejects %s", (_label, value) => {
    expect(parseStaffBuilderScore(value).ok).toBe(false);
  });

  it("rejects invalid MIDI pitches and malformed event/rhythm discriminants", () => {
    const score = validScore();
    const measure = score.measures[0] as { events: readonly Record<string, unknown>[] };
    const note = measure.events.find(({ kind }) => kind === "notes") as Record<string, unknown>;
    const badPitch = { ...score, measures: [{ ...measure, events: [{ ...note, pitches: [{ ...((note.pitches as Record<string, unknown>[])[0]), midiNumber: 128 }] }] }, ...score.measures.slice(1)] };
    const badKind = { ...score, measures: [{ ...measure, events: [{ ...note, kind: "chord" }] }, ...score.measures.slice(1)] };
    const badRhythm = { ...score, measures: [{ ...measure, events: [{ ...note, rhythm: { status: "pending" } }] }, ...score.measures.slice(1)] };
    expect(parseStaffBuilderScore(badPitch).ok).toBe(false);
    expect(parseStaffBuilderScore(badKind).ok).toBe(false);
    expect(parseStaffBuilderScore(badRhythm).ok).toBe(false);
  });

  it("preserves structurally invalid event positions for correction", () => {
    const score = validScore();
    const firstMeasure = score.measures[0];
    expect(firstMeasure).toBeDefined();
    const invalid = {
      ...score,
      initialTimeSignature: "2/4",
      measures: [{ ...firstMeasure, events: firstMeasure?.events.map((event) => ({ ...event, startTick: 960 })) }, ...score.measures.slice(1)],
    };
    expect(parseStaffBuilderScore(invalid)).toMatchObject({ ok: true });
  });

  it("distinguishes unsupported schema versions", () => {
    expect(parseStaffBuilderLibrary({ schemaVersion: 2, pieces: [] })).toMatchObject({ ok: false, reason: "unsupported" });
    expect(parseStaffBuilderDraft({ schemaVersion: 2 })).toMatchObject({ ok: false, reason: "unsupported" });
  });

  it("hard-rejects duplicate measure, event, and tie IDs", () => {
    const score = validScore();
    expect(parseStaffBuilderScore({ ...score, measures: [...score.measures, score.measures[0]] })).toMatchObject({ ok: false, reason: "corrupt" });
    const duplicatedEvent = { ...score, measures: score.measures.map((measure, index) => index === 1 ? { ...measure, events: [score.measures[0]!.events[0]!] } : measure) };
    expect(parseStaffBuilderScore(duplicatedEvent)).toMatchObject({ ok: false, reason: "corrupt" });
    expect(parseStaffBuilderScore({ ...score, ties: [...score.ties, score.ties[0]] })).toMatchObject({ ok: false, reason: "corrupt" });
  });

  it("accepts optional validated capture state while preserving older drafts", () => {
    const score = validScore();
    const base = { schemaVersion: 1, savedPieceId: score.id, updatedAt: "2026-08-06T13:00:00.000Z", score, editorPass: "capture" };
    const older = parseStaffBuilderDraft(base);
    expect(older.ok && older.value.captureState).toBeUndefined();
    expect(parseStaffBuilderDraft({ ...base, captureState: { cursor: { measureIndex: 1, offsetTicks: 120 }, stepDuration: "sixteenth", activeStaff: "bass" } })).toMatchObject({
      ok: true,
      value: { captureState: { cursor: { measureIndex: 1, offsetTicks: 120 }, stepDuration: "sixteenth", inputMode: "bass" } },
    });
    expect(parseStaffBuilderDraft({ ...base, captureState: { cursor: { measureIndex: 0, offsetTicks: 0 }, stepDuration: "quarter", inputMode: "grand" } })).toMatchObject({
      ok: true,
      value: { captureState: { inputMode: "grand" } },
    });
  });

  it.each([0, 120, 240, 360, 1800])("accepts sixteenth-grid capture position %i", (offsetTicks) => {
    const score = validScore();
    const draft = {
      schemaVersion: 1,
      savedPieceId: score.id,
      updatedAt: "2026-08-06T13:00:00.000Z",
      score,
      editorPass: "capture",
      captureState: { cursor: { measureIndex: 0, offsetTicks }, stepDuration: "quarter", inputMode: "grand" },
    };
    expect(parseStaffBuilderDraft(draft)).toMatchObject({ ok: true, value: { captureState: { cursor: { offsetTicks } } } });
  });

  it.each([37, 121, 239])("rejects off-grid integer capture position %i as corrupt", (offsetTicks) => {
    const score = validScore();
    const draft = {
      schemaVersion: 1,
      savedPieceId: score.id,
      updatedAt: "2026-08-06T13:00:00.000Z",
      score,
      editorPass: "capture",
      captureState: { cursor: { measureIndex: 0, offsetTicks }, stepDuration: "quarter", inputMode: "grand" },
    };
    expect(parseStaffBuilderDraft(draft)).toMatchObject({ ok: false, reason: "corrupt" });
  });

  it.each([
    { cursor: { measureIndex: 2, offsetTicks: 0 }, stepDuration: "quarter", inputMode: "grand" },
    { cursor: { measureIndex: 0, offsetTicks: 0 }, stepDuration: "half", inputMode: "grand" },
    { cursor: { measureIndex: 0, offsetTicks: 0 }, stepDuration: "quarter", inputMode: "alto" },
  ])("rejects invalid capture state %#", (captureState) => {
    const score = validScore();
    expect(parseStaffBuilderDraft({ schemaVersion: 1, savedPieceId: score.id, updatedAt: "2026-08-06T13:00:00.000Z", score, editorPass: "capture", captureState })).toMatchObject({ ok: false, reason: "corrupt" });
  });

  it("repairs a capture cursor invalidated by a time-signature change", () => {
    const score = validScore();
    const parsed = parseStaffBuilderDraft({ schemaVersion: 1, savedPieceId: score.id, updatedAt: "2026-08-06T13:00:00.000Z", score, editorPass: "capture", captureState: { cursor: { measureIndex: 1, offsetTicks: 1440 }, stepDuration: "quarter", inputMode: "grand" } });
    expect(parsed).toMatchObject({ ok: true, value: { captureState: { cursor: { measureIndex: 1, offsetTicks: 0 } } } });
  });

  it("accepts optional rhythm selection and preserves compatibility without it", () => {
    const score = validScore();
    const base = { schemaVersion: 1, savedPieceId: score.id, updatedAt: "2026-08-06T13:00:00.000Z", score, editorPass: "rhythm" };
    const older = parseStaffBuilderDraft(base);
    expect(older.ok && older.value.rhythmState).toBeUndefined();
    const eventId = score.measures[0]?.events[0]?.id;
    expect(parseStaffBuilderDraft({ ...base, rhythmState: { measureIndex: 0, selectedEventId: eventId } })).toMatchObject({ ok: true, value: { editorPass: "rhythm", rhythmState: { measureIndex: 0, selectedEventId: eventId } } });
    expect(parseStaffBuilderDraft({ ...base, rhythmState: { measureIndex: 0, selectedEventId: null } })).toMatchObject({ ok: true });
  });

  it.each([{ measureIndex: -1, selectedEventId: null }])("rejects malformed rhythm selection %#", (rhythmState) => {
    const score = validScore();
    expect(parseStaffBuilderDraft({ schemaVersion: 1, savedPieceId: score.id, updatedAt: "2026-08-06T13:00:00.000Z", score, editorPass: "rhythm", rhythmState })).toMatchObject({ ok: false, reason: "corrupt" });
  });

  it.each([{ measureIndex: 9, selectedEventId: null }, { measureIndex: 0, selectedEventId: "missing" }])("repairs stale rhythm selection %#", (rhythmState) => {
    const score = validScore();
    expect(parseStaffBuilderDraft({ schemaVersion: 1, savedPieceId: score.id, updatedAt: "2026-08-06T13:00:00.000Z", score, editorPass: "rhythm", rhythmState })).toMatchObject({ ok: true, value: { rhythmState: { selectedEventId: null } } });
  });
});
