import { describe, expect, it, vi } from "vitest";
import { createStaffBuilderScore } from "../staff-builder-score";
import { readStaffBuilderDraft, readStaffBuilderIntroductionDismissed, readStaffBuilderLibrary, readStaffBuilderSustainPedalLocksInput, removeStaffBuilderValue, STAFF_BUILDER_STORAGE_KEYS, writeStaffBuilderValue, type StaffBuilderStorage } from "./staff-builder-storage";

class MemoryStorage implements StaffBuilderStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("Staff Builder guarded storage", () => {
  it("returns valid empty states for missing keys", () => {
    const storage = new MemoryStorage();
    expect(readStaffBuilderLibrary(storage)).toEqual({ ok: true, value: { schemaVersion: 4, pieces: [], practiceMetadataByPieceId: {} } });
    expect(readStaffBuilderDraft(storage)).toEqual({ ok: true, value: null });
    expect(readStaffBuilderIntroductionDismissed(storage)).toEqual({ ok: true, value: false });
    expect(readStaffBuilderSustainPedalLocksInput(storage)).toEqual({ ok: true, value: false });
  });

  it("round-trips the browser-local sustain-pedal Lock In preference", () => {
    const storage = new MemoryStorage();
    expect(writeStaffBuilderValue(storage, "sustainPedalLocksInput", true)).toMatchObject({ ok: true });
    expect(readStaffBuilderSustainPedalLocksInput(storage)).toEqual({ ok: true, value: true });
    expect(writeStaffBuilderValue(storage, "sustainPedalLocksInput", false)).toMatchObject({ ok: true });
    expect(readStaffBuilderSustainPedalLocksInput(storage)).toEqual({ ok: true, value: false });
  });

  it("handles malformed and unavailable sustain-pedal preferences without overwriting them", () => {
    const storage = new MemoryStorage();
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.sustainPedalLocksInput, "invalid");
    expect(readStaffBuilderSustainPedalLocksInput(storage)).toMatchObject({ ok: false, reason: "corrupt" });
    expect(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.sustainPedalLocksInput)).toBe("invalid");
    expect(readStaffBuilderSustainPedalLocksInput({ getItem: () => { throw new Error(); }, setItem: vi.fn(), removeItem: vi.fn() })).toMatchObject({ ok: false, reason: "unavailable" });
  });

  it("writes, reads, and removes versioned values", () => {
    const storage = new MemoryStorage();
    const score = createStaffBuilderScore({ title: "Piece", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", factories: { createId: vi.fn().mockReturnValueOnce("score").mockReturnValueOnce("measure"), now: () => "2026-08-06T12:00:00.000Z" } });
    const library = { schemaVersion: 4, pieces: [score], practiceMetadataByPieceId: { [score.id]: { lastPracticedAt: "2026-08-07T12:00:00.000Z" } } } as const;
    expect(writeStaffBuilderValue(storage, "library", library).ok).toBe(true);
    expect(readStaffBuilderLibrary(storage)).toEqual({ ok: true, value: library });
    expect(removeStaffBuilderValue(storage, "library").ok).toBe(true);
    expect(readStaffBuilderLibrary(storage)).toEqual({ ok: true, value: { schemaVersion: 4, pieces: [], practiceMetadataByPieceId: {} } });
  });

  it("round-trips lyric cues through library and draft storage", () => {
    const storage = new MemoryStorage();
    const empty = createStaffBuilderScore({ title: "Lyrics", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", factories: { createId: vi.fn().mockReturnValueOnce("score").mockReturnValueOnce("measure"), now: () => "2026-08-06T12:00:00.000Z" } });
    const score = { ...empty, measures: [{ ...empty.measures[0]!, events: [{ id: "event", kind: "notes" as const, staff: "treble" as const, startTick: 0, rhythm: { status: "final" as const, duration: "whole" as const }, pitches: [{ id: "pitch", midiNumber: 60, letter: "C" as const, accidental: "natural" as const, octave: 4 }] }] }], annotations: [{ id: "lyric", kind: "lyric-cue" as const, anchor: { kind: "event" as const, eventId: "event" }, text: "Bells" }] };
    expect(writeStaffBuilderValue(storage, "library", { schemaVersion: 3, pieces: [score] }).ok).toBe(true);
    expect(writeStaffBuilderValue(storage, "draft", { schemaVersion: 3, savedPieceId: score.id, updatedAt: score.updatedAt, score, editorPass: "rhythm", captureState: { cursor: { measureIndex: 0, offsetTicks: 0 }, inputMode: "grand", stepDuration: "quarter" }, rhythmState: { measureIndex: 0, selectedEventId: "event" } }).ok).toBe(true);
    expect(readStaffBuilderLibrary(storage)).toMatchObject({ ok: true, value: { pieces: [{ annotations: [{ kind: "lyric-cue", text: "Bells" }] }] } });
    expect(readStaffBuilderDraft(storage)).toMatchObject({ ok: true, value: { score: { annotations: [{ kind: "lyric-cue", text: "Bells" }] } } });
  });

  it("reports corrupt JSON and unsupported schemas without overwriting them", () => {
    const storage = new MemoryStorage();
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.library, "not json");
    expect(readStaffBuilderLibrary(storage)).toMatchObject({ ok: false, reason: "corrupt" });
    expect(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.library)).toBe("not json");
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.library, JSON.stringify({ schemaVersion: 5, pieces: [] }));
    expect(readStaffBuilderLibrary(storage)).toMatchObject({ ok: false, reason: "unsupported" });
    expect(JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.library) ?? "{}").schemaVersion).toBe(5);
  });

  it("reads legacy V1 library records as V4 with no fabricated practice history", () => {
    const storage = new MemoryStorage();
    const current = createStaffBuilderScore({ title: "Legacy", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", factories: { createId: vi.fn().mockReturnValueOnce("score").mockReturnValueOnce("measure"), now: () => "2026-08-06T12:00:00.000Z" } });
    const { annotations: _annotations, ...withoutAnnotations } = current;
    void _annotations;
    const legacy = { ...withoutAnnotations, schemaVersion: 1 };
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.library, JSON.stringify({ schemaVersion: 1, pieces: [legacy] }));
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.draft, JSON.stringify({ schemaVersion: 1, savedPieceId: legacy.id, updatedAt: legacy.updatedAt, score: legacy, editorPass: "capture" }));
    expect(readStaffBuilderLibrary(storage)).toMatchObject({ ok: true, value: { schemaVersion: 4, pieces: [{ schemaVersion: 3, annotations: [] }], practiceMetadataByPieceId: {} } });
    expect(readStaffBuilderDraft(storage)).toMatchObject({ ok: true, value: { schemaVersion: 3, score: { schemaVersion: 3, annotations: [] } } });
  });

  it("catches get, set, remove, and serialization failures", () => {
    const throwing: StaffBuilderStorage = { getItem: () => { throw new Error(); }, setItem: () => { throw new Error(); }, removeItem: () => { throw new Error(); } };
    expect(readStaffBuilderLibrary(throwing)).toMatchObject({ ok: false, reason: "unavailable" });
    expect(writeStaffBuilderValue(throwing, "library", {})).toMatchObject({ ok: false, reason: "write-failed" });
    expect(removeStaffBuilderValue(throwing, "library")).toMatchObject({ ok: false, reason: "write-failed" });
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(writeStaffBuilderValue(new MemoryStorage(), "library", circular)).toMatchObject({ ok: false, reason: "write-failed" });
  });
});
