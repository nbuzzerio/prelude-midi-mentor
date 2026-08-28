import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { MusicKeyId } from "@/lib/music/keys";
import type { StaffBuilderTimeSignature } from "./staff-builder-time";
import type { StaffBuilderScore, StaffBuilderScoreV3 } from "./staff-builder-types";
import {
  appendStaffBuilderMeasure,
  createStaffBuilderScore,
  getStaffBuilderEventsInScoreOrder,
  insertStaffBuilderMeasure,
  insertStaffBuilderRest,
  insertStaffBuilderNotes,
  insertUnresolvedStaffBuilderNotes,
  removeStaffBuilderEvent,
  renameStaffBuilderScore,
  resolveStaffBuilderMeasureContext,
  setStaffBuilderMeasureKeySignature,
  setStaffBuilderMeasureTimeSignature,
  updateStaffBuilderTempo,
  type StaffBuilderFactories,
} from "./staff-builder-score";
import { validateStaffBuilderScore } from "./staff-builder-validation";

function factories(): StaffBuilderFactories {
  let id = 0;
  let time = 0;
  return { createId: () => `id-${++id}`, now: () => `2026-01-01T00:00:0${time++}.000Z` };
}

function score(factory = factories()) {
  return createStaffBuilderScore({ title: "Prelude", tempoBpm: 120, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", factories: factory });
}

describe("Staff Builder score", () => {
  it.each([[0, ["new", "m1", "m2", "m3"]], [1, ["m1", "new", "m2", "m3"]], [2, ["m1", "m2", "new", "m3"]], [3, ["m1", "m2", "m3", "new"]]] as const)("inserts one empty measure at boundary %i", (insertionIndex, expectedIds) => {
    const original = { ...score(), measures: ["m1", "m2", "m3"].map((id) => ({ id, events: [] })) };
    const result = insertStaffBuilderMeasure(original, insertionIndex, { createId: () => "new", now: () => "updated" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.score.measures.map(({ id }) => id)).toEqual(expectedIds);
    expect(result.score.measures[insertionIndex]).toEqual({ id: "new", events: [] });
    expect(result.score.updatedAt).toBe("updated");
    original.measures.forEach((measure) => expect(result.score.measures).toContain(measure));
  });

  it("rejects invalid insertion indexes without allocating or mutating", () => {
    const original = score();
    const createId = vi.fn(() => "new");
    for (const index of [-1, 0.5, original.measures.length + 1]) {
      expect(insertStaffBuilderMeasure(original, index, { createId, now: () => "updated" })).toEqual({ ok: false, score: original, error: "invalid-index" });
    }
    expect(createId).not.toHaveBeenCalled();
  });

  it("preserves authored identities, content, and downstream context overrides", () => {
    const event = { id: "event", kind: "notes" as const, staff: "treble" as const, startTick: 0, rhythm: { status: "final" as const, duration: "quarter" as const }, pitches: [{ id: "pitch", midiNumber: 60, letter: "C" as const, accidental: "natural" as const, octave: 4 }] };
    const downstream = { id: "m3", keySignatureChange: "g-major" as const, timeSignatureChange: "3/4" as const, events: [event] };
    const original = { ...score(), measures: [{ id: "m1", events: [] }, { id: "m2", events: [] }, downstream] };
    const before = JSON.stringify(original);
    const result = insertStaffBuilderMeasure(original, 2, { createId: () => "new", now: () => "updated" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.score.measures[3]).toBe(downstream);
    expect(result.score.measures[3]?.events[0]).toBe(event);
    expect(resolveStaffBuilderMeasureContext(result.score, 2)).toMatchObject({ keySignatureId: "c-major", timeSignature: "4/4" });
    expect(resolveStaffBuilderMeasureContext(result.score, 3)).toMatchObject({ keySignatureId: "g-major", timeSignature: "3/4" });
    expect(JSON.stringify(original)).toBe(before);
  });

  it("rejects only the exact boundary crossed by a tie and preserves ties elsewhere", () => {
    const note = (id: string, pitchId: string) => ({ id, kind: "notes" as const, staff: "treble" as const, startTick: 0, rhythm: { status: "final" as const, duration: "quarter" as const }, pitches: [{ id: pitchId, midiNumber: 60, letter: "C" as const, accidental: "natural" as const, octave: 4 }] });
    const from = note("from", "from-pitch");
    const to = note("to", "to-pitch");
    const original = { ...score(), measures: [{ id: "m1", events: [from] }, { id: "m2", events: [to] }, { id: "m3", events: [] }], ties: [{ id: "tie", fromEventId: "from", fromPitchId: "from-pitch", toEventId: "to", toPitchId: "to-pitch" }] };
    expect(insertStaffBuilderMeasure(original, 1)).toEqual({ ok: false, score: original, error: "tie-crosses-boundary" });
    for (const index of [0, 2, 3]) {
      const result = insertStaffBuilderMeasure(original, index, { createId: () => `new-${index}`, now: () => "updated" });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.score.ties).toBe(original.ties);
    }
  });

  it("keeps an existing valid tie valid when inserting at an unrelated boundary", () => {
    const note = (id: string, pitchId: string) => ({ id, kind: "notes" as const, staff: "treble" as const, startTick: 0, rhythm: { status: "final" as const, duration: "whole" as const }, pitches: [{ id: pitchId, midiNumber: 60, letter: "C" as const, accidental: "natural" as const, octave: 4 }] });
    const original = { ...score(), measures: [
      { id: "m1", events: [{ id: "b1", kind: "rest" as const, staff: "bass" as const, startTick: 0, rhythm: { status: "final" as const, duration: "whole" as const } }, { id: "t1", kind: "rest" as const, staff: "treble" as const, startTick: 0, rhythm: { status: "final" as const, duration: "whole" as const } }] },
      { id: "m2", events: [{ id: "b2", kind: "rest" as const, staff: "bass" as const, startTick: 0, rhythm: { status: "final" as const, duration: "whole" as const } }, note("from", "p1")] },
      { id: "m3", events: [{ id: "b3", kind: "rest" as const, staff: "bass" as const, startTick: 0, rhythm: { status: "final" as const, duration: "whole" as const } }, note("to", "p2")] },
    ], ties: [{ id: "tie", fromEventId: "from", fromPitchId: "p1", toEventId: "to", toPitchId: "p2" }] };
    expect(validateStaffBuilderScore(original)).toEqual([]);
    const result = insertStaffBuilderMeasure(original, 1, { createId: () => "new", now: () => "updated" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const authored = { ...result.score, measures: result.score.measures.map((measure) => measure.id !== "new" ? measure : { ...measure, events: [
      { id: "new-t", kind: "rest" as const, staff: "treble" as const, startTick: 0, rhythm: { status: "final" as const, duration: "whole" as const } },
      { id: "new-b", kind: "rest" as const, staff: "bass" as const, startTick: 0, rhythm: { status: "final" as const, duration: "whole" as const } },
    ] }) };
    expect(authored.ties).toBe(original.ties);
    expect(validateStaffBuilderScore(authored)).toEqual([]);
  });
  it("creates versioned metadata and an empty first measure with stable injected values", () => {
    const current = score();
    expectTypeOf(current).toEqualTypeOf<StaffBuilderScore>();
    expectTypeOf<StaffBuilderScore>().toEqualTypeOf<StaffBuilderScoreV3>();
    expect(current).toEqual({
      schemaVersion: 3, annotations: [], id: "id-1", title: "Prelude", createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z", tempoBpm: 120, initialKeySignatureId: "c-major",
      initialTimeSignature: "4/4", measures: [{ id: "id-2", events: [] }], ties: [],
    });
  });

  it("immutably renames, updates tempo, and appends a measure", () => {
    const factory = factories();
    const original = score(factory);
    const renamed = renameStaffBuilderScore(original, "New", factory);
    const changedTempo = updateStaffBuilderTempo(renamed, 90, factory);
    const appended = appendStaffBuilderMeasure(changedTempo, factory);
    expect(original.title).toBe("Prelude");
    expect(renamed.title).toBe("New");
    expect(changedTempo.tempoBpm).toBe(90);
    expect(appended.measures).toHaveLength(2);
    expect(appended.measures[1]?.id).toBe("id-3");
  });

  it("resolves persistent key and time changes and restores inheritance after removal", () => {
    const factory = factories();
    let current = appendStaffBuilderMeasure(appendStaffBuilderMeasure(score(factory), factory), factory);
    current = setStaffBuilderMeasureKeySignature(current, 1, "g-major", factory);
    current = setStaffBuilderMeasureTimeSignature(current, 1, "6/8", factory);
    expect(resolveStaffBuilderMeasureContext(current, 2)).toEqual({ keySignatureId: "g-major", timeSignature: "6/8", capacityTicks: 1440 });
    current = setStaffBuilderMeasureKeySignature(current, 1, null, factory);
    current = setStaffBuilderMeasureTimeSignature(current, 1, null, factory);
    expect(resolveStaffBuilderMeasureContext(current, 2)).toEqual({ keySignatureId: "c-major", timeSignature: "4/4", capacityTicks: 1920 });
  });

  it("inserts unresolved Pass 1 notes without a duration and preserves staff independence", () => {
    const factory = factories();
    let current = insertUnresolvedStaffBuilderNotes(score(factory), { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [67, 60, 64, 60], factories: factory });
    current = insertUnresolvedStaffBuilderNotes(current, { measureIndex: 0, staff: "bass", startTick: 0, midiNumbers: [60], factories: factory });
    expect(current.measures[0]?.events).toHaveLength(2);
    const treble = current.measures[0]?.events.find(({ staff }) => staff === "treble");
    expect(treble).toMatchObject({ kind: "notes", rhythm: { status: "unresolved" } });
    expect(treble && treble.kind === "notes" ? treble.pitches.map(({ midiNumber }) => midiNumber) : []).toEqual([60, 64, 67]);
    expect(treble?.rhythm).not.toHaveProperty("durationTicks");
  });

  it("shares note insertion while preserving explicit final and unresolved rhythm", () => {
    const factory = factories();
    let current = insertStaffBuilderNotes(score(factory), { measureIndex: 0, staff: "treble", startTick: 1800, midiNumbers: [60], rhythm: { status: "final", duration: "quarter" }, factories: factory });
    current = insertUnresolvedStaffBuilderNotes(current, { measureIndex: 0, staff: "bass", startTick: 0, midiNumbers: [48], factories: factory });
    expect(current.measures[0]?.events.find(({ staff }) => staff === "treble")?.rhythm).toEqual({ status: "final", duration: "quarter" });
    expect(current.measures[0]?.events.find(({ staff }) => staff === "bass")?.rhythm).toEqual({ status: "unresolved" });
  });

  it("replaces one same-staff location as a unit without merging", () => {
    const factory = factories();
    let current = insertUnresolvedStaffBuilderNotes(score(factory), { measureIndex: 0, staff: "treble", startTick: 240, midiNumbers: [60, 64], factories: factory });
    const oldId = current.measures[0]?.events[0]?.id;
    current = insertUnresolvedStaffBuilderNotes(current, { measureIndex: 0, staff: "treble", startTick: 240, midiNumbers: [67], factories: factory });
    expect(current.measures[0]?.events).toHaveLength(1);
    expect(current.measures[0]?.events[0]?.id).not.toBe(oldId);
  });

  it("inserts final rests, orders events deterministically, and deletes by ID", () => {
    const factory = factories();
    let current = appendStaffBuilderMeasure(score(factory), factory);
    current = insertStaffBuilderRest(current, { measureIndex: 1, staff: "bass", startTick: 0, duration: "dotted-quarter", factories: factory });
    current = insertUnresolvedStaffBuilderNotes(current, { measureIndex: 0, staff: "bass", startTick: 480, midiNumbers: [48], factories: factory });
    current = insertUnresolvedStaffBuilderNotes(current, { measureIndex: 0, staff: "treble", startTick: 480, midiNumbers: [60], factories: factory });
    const ordered = getStaffBuilderEventsInScoreOrder(current);
    expect(ordered.map(({ staff }) => staff)).toEqual(["treble", "bass", "bass"]);
    expect(ordered[2]?.rhythm).toEqual({ status: "final", duration: "dotted-quarter" });
    current = removeStaffBuilderEvent(current, 0, ordered[0]?.id ?? "", factory);
    expect(current.measures[0]?.events).toHaveLength(1);
  });

  it("preserves existing pitches when a key or time context changes", () => {
    const factory = factories();
    let current = insertUnresolvedStaffBuilderNotes(score(factory), { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [66], factories: factory });
    const pitches = current.measures[0]?.events[0];
    current = setStaffBuilderMeasureKeySignature(current, 0, "f-major", factory);
    current = setStaffBuilderMeasureTimeSignature(current, 0, "3/4", factory);
    expect(current.measures[0]?.events[0]).toEqual(pitches);
  });

  it("capture replacement never carries authored arpeggiation onto the new event", () => {
    const factory = factories();
    let current = insertUnresolvedStaffBuilderNotes(score(factory), { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60, 64, 67], factories: factory });
    const chord = current.measures[0]!.events[0]!;
    if (chord.kind !== "notes") throw new Error("Expected captured chord.");
    current = { ...current, measures: [{ ...current.measures[0]!, events: [{ ...chord, arpeggiation: "up" as const }] }] };
    const replacement = insertUnresolvedStaffBuilderNotes(current, { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60], factories: factory });
    expect(replacement.measures[0]?.events[0]).not.toHaveProperty("arpeggiation");
    const expanded = insertUnresolvedStaffBuilderNotes(replacement, { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60, 64], factories: factory });
    expect(expanded.measures[0]?.events[0]).not.toHaveProperty("arpeggiation");
  });

  it("rejects invalid tempo, keys, signatures, pitches, and start ticks", () => {
    const factory = factories();
    expect(() => updateStaffBuilderTempo(score(factory), 0, factory)).toThrow(/Tempo/);
    expect(() => createStaffBuilderScore({ title: "x", tempoBpm: 120, initialKeySignatureId: "x" as MusicKeyId, initialTimeSignature: "4/4", factories: factory })).toThrow(/Unknown music key/);
    expect(() => createStaffBuilderScore({ title: "x", tempoBpm: 120, initialKeySignatureId: "c-major", initialTimeSignature: "5/4" as StaffBuilderTimeSignature, factories: factory })).toThrow(/Unsupported/);
    expect(() => insertUnresolvedStaffBuilderNotes(score(factory), { measureIndex: 0, staff: "treble", startTick: 1920, midiNumbers: [60], factories: factory })).toThrow(/Start tick/);
    expect(() => insertUnresolvedStaffBuilderNotes(score(factory), { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [128], factories: factory })).toThrow(/Unsupported MIDI/);
  });
});
