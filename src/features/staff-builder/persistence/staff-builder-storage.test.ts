import { describe, expect, it, vi } from "vitest";
import { createStaffBuilderScore } from "../staff-builder-score";
import { readStaffBuilderDraft, readStaffBuilderIntroductionDismissed, readStaffBuilderLibrary, removeStaffBuilderValue, STAFF_BUILDER_STORAGE_KEYS, writeStaffBuilderValue, type StaffBuilderStorage } from "./staff-builder-storage";

class MemoryStorage implements StaffBuilderStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("Staff Builder guarded storage", () => {
  it("returns valid empty states for missing keys", () => {
    const storage = new MemoryStorage();
    expect(readStaffBuilderLibrary(storage)).toEqual({ ok: true, value: { schemaVersion: 2, pieces: [] } });
    expect(readStaffBuilderDraft(storage)).toEqual({ ok: true, value: null });
    expect(readStaffBuilderIntroductionDismissed(storage)).toEqual({ ok: true, value: false });
  });

  it("writes, reads, and removes versioned values", () => {
    const storage = new MemoryStorage();
    const score = createStaffBuilderScore({ title: "Piece", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", factories: { createId: vi.fn().mockReturnValueOnce("score").mockReturnValueOnce("measure"), now: () => "2026-08-06T12:00:00.000Z" } });
    const library = { schemaVersion: 2, pieces: [score] } as const;
    expect(writeStaffBuilderValue(storage, "library", library).ok).toBe(true);
    expect(readStaffBuilderLibrary(storage)).toEqual({ ok: true, value: library });
    expect(removeStaffBuilderValue(storage, "library").ok).toBe(true);
    expect(readStaffBuilderLibrary(storage)).toEqual({ ok: true, value: { schemaVersion: 2, pieces: [] } });
  });

  it("reports corrupt JSON and unsupported schemas without overwriting them", () => {
    const storage = new MemoryStorage();
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.library, "not json");
    expect(readStaffBuilderLibrary(storage)).toMatchObject({ ok: false, reason: "corrupt" });
    expect(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.library)).toBe("not json");
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.library, JSON.stringify({ schemaVersion: 3, pieces: [] }));
    expect(readStaffBuilderLibrary(storage)).toMatchObject({ ok: false, reason: "unsupported" });
    expect(JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.library) ?? "{}").schemaVersion).toBe(3);
  });

  it("reads legacy V1 library and draft records as canonical V2 without changing storage keys", () => {
    const storage = new MemoryStorage();
    const current = createStaffBuilderScore({ title: "Legacy", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", factories: { createId: vi.fn().mockReturnValueOnce("score").mockReturnValueOnce("measure"), now: () => "2026-08-06T12:00:00.000Z" } });
    const { annotations: _annotations, ...withoutAnnotations } = current;
    void _annotations;
    const legacy = { ...withoutAnnotations, schemaVersion: 1 };
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.library, JSON.stringify({ schemaVersion: 1, pieces: [legacy] }));
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.draft, JSON.stringify({ schemaVersion: 1, savedPieceId: legacy.id, updatedAt: legacy.updatedAt, score: legacy, editorPass: "capture" }));
    expect(readStaffBuilderLibrary(storage)).toMatchObject({ ok: true, value: { schemaVersion: 2, pieces: [{ schemaVersion: 2, annotations: [] }] } });
    expect(readStaffBuilderDraft(storage)).toMatchObject({ ok: true, value: { schemaVersion: 2, score: { schemaVersion: 2, annotations: [] } } });
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
