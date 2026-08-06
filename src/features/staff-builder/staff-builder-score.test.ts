import { describe, expect, it } from "vitest";
import type { MusicKeyId } from "@/lib/music/keys";
import type { StaffBuilderTimeSignature } from "./staff-builder-time";
import {
  appendStaffBuilderMeasure,
  createStaffBuilderScore,
  getStaffBuilderEventsInScoreOrder,
  insertStaffBuilderRest,
  insertUnresolvedStaffBuilderNotes,
  removeStaffBuilderEvent,
  renameStaffBuilderScore,
  resolveStaffBuilderMeasureContext,
  setStaffBuilderMeasureKeySignature,
  setStaffBuilderMeasureTimeSignature,
  updateStaffBuilderTempo,
  type StaffBuilderFactories,
} from "./staff-builder-score";

function factories(): StaffBuilderFactories {
  let id = 0;
  let time = 0;
  return { createId: () => `id-${++id}`, now: () => `2026-01-01T00:00:0${time++}.000Z` };
}

function score(factory = factories()) {
  return createStaffBuilderScore({ title: "Prelude", tempoBpm: 120, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", factories: factory });
}

describe("Staff Builder score", () => {
  it("creates versioned metadata and an empty first measure with stable injected values", () => {
    expect(score()).toEqual({
      schemaVersion: 1, id: "id-1", title: "Prelude", createdAt: "2026-01-01T00:00:00.000Z",
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

  it("rejects invalid tempo, keys, signatures, pitches, and start ticks", () => {
    const factory = factories();
    expect(() => updateStaffBuilderTempo(score(factory), 0, factory)).toThrow(/Tempo/);
    expect(() => createStaffBuilderScore({ title: "x", tempoBpm: 120, initialKeySignatureId: "x" as MusicKeyId, initialTimeSignature: "4/4", factories: factory })).toThrow(/Unknown music key/);
    expect(() => createStaffBuilderScore({ title: "x", tempoBpm: 120, initialKeySignatureId: "c-major", initialTimeSignature: "5/4" as StaffBuilderTimeSignature, factories: factory })).toThrow(/Unsupported/);
    expect(() => insertUnresolvedStaffBuilderNotes(score(factory), { measureIndex: 0, staff: "treble", startTick: 1920, midiNumbers: [60], factories: factory })).toThrow(/Start tick/);
    expect(() => insertUnresolvedStaffBuilderNotes(score(factory), { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [128], factories: factory })).toThrow(/Unsupported MIDI/);
  });
});
