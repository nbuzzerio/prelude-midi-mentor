import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createStaffBuilderScore } from "../staff-builder-score";
import { STAFF_BUILDER_STORAGE_KEYS, type StaffBuilderStorage } from "../persistence/staff-builder-storage";
import { useStaffBuilderLibrary } from "./use-staff-builder-library";

class MemoryStorage implements StaffBuilderStorage {
  values = new Map<string, string>();
  failWrites = false;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failWrites) throw new Error(); this.values.set(key, value); }
  removeItem(key: string) { if (this.failWrites) throw new Error(); this.values.delete(key); }
}

afterEach(cleanup);

describe("useStaffBuilderLibrary", () => {
  function seedDraft(storage: MemoryStorage, options: Readonly<{
    draftUpdatedAt: string;
    savedUpdatedAt?: string;
    savedPieceId?: string | null;
  }>) {
    let id = 0;
    const saved = createStaffBuilderScore({ title: "Saved", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", factories: { createId: () => `id-${++id}`, now: () => options.savedUpdatedAt ?? "2026-08-06T12:00:00.000Z" } });
    const draftScore = { ...saved, title: "Draft", updatedAt: options.draftUpdatedAt };
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.library, JSON.stringify({ schemaVersion: 1, pieces: [saved] }));
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.lastPieceId, saved.id);
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.draft, JSON.stringify({ schemaVersion: 1, savedPieceId: options.savedPieceId === undefined ? saved.id : options.savedPieceId, updatedAt: options.draftUpdatedAt, score: draftScore, editorPass: "capture" }));
    return saved;
  }

  it("owns an empty library and create, rename, close, open, and delete operations", () => {
    const storage = new MemoryStorage();
    const { result } = renderHook(() => useStaffBuilderLibrary(storage));
    expect(result.current.library.pieces).toEqual([]);
    act(() => result.current.createPiece({ title: "First", keyId: "c-major", timeSignature: "4/4", tempoBpm: 100 }));
    const id = result.current.library.pieces[0]?.id ?? "";
    expect(result.current.activeSavedPieceId).toBe(id);
    expect(storage.values.has(STAFF_BUILDER_STORAGE_KEYS.draft)).toBe(true);
    act(() => result.current.renamePiece(id, "Renamed"));
    expect(result.current.activeScore?.title).toBe("Renamed");
    act(() => result.current.closePiece());
    expect(result.current.activeScore).toBeNull();
    act(() => result.current.openPiece(id));
    expect(result.current.activeScore?.title).toBe("Renamed");
    act(() => result.current.deletePiece(id));
    expect(result.current.library.pieces).toEqual([]);
  });

  it("offers recovery for a newer draft and loads the saved piece when recovery is declined", () => {
    const storage = new MemoryStorage();
    seedDraft(storage, { draftUpdatedAt: "2026-08-06T13:00:00.000Z" });
    const first = renderHook(() => useStaffBuilderLibrary(storage));
    expect(first.result.current.recoveryDraft?.score.title).toBe("Draft");
    act(() => first.result.current.declineDraft());
    expect(first.result.current.activeScore?.title).toBe("Saved");
    expect(storage.values.has(STAFF_BUILDER_STORAGE_KEYS.draft)).toBe(false);
    first.unmount();
    const second = renderHook(() => useStaffBuilderLibrary(storage));
    expect(second.result.current.activeScore?.title).toBe("Saved");
  });

  it.each([
    ["older", "2026-08-06T11:00:00.000Z"],
    ["equal-timestamp", "2026-08-06T12:00:00.000Z"],
  ])("loads the saved piece instead of an %s draft", (_label, draftUpdatedAt) => {
    const storage = new MemoryStorage();
    seedDraft(storage, { draftUpdatedAt });
    const { result } = renderHook(() => useStaffBuilderLibrary(storage));
    expect(result.current.recoveryDraft).toBeNull();
    expect(result.current.activeScore?.title).toBe("Saved");
  });

  it("offers recovery for an unsaved draft", () => {
    const storage = new MemoryStorage();
    seedDraft(storage, { draftUpdatedAt: "2026-08-06T11:00:00.000Z", savedPieceId: null });
    const { result } = renderHook(() => useStaffBuilderLibrary(storage));
    expect(result.current.recoveryDraft?.score.title).toBe("Draft");
    expect(result.current.activeScore).toBeNull();
  });

  it("offers recovery when a draft references a missing saved piece", () => {
    const storage = new MemoryStorage();
    seedDraft(storage, { draftUpdatedAt: "2026-08-06T11:00:00.000Z", savedPieceId: "missing-piece" });
    const { result } = renderHook(() => useStaffBuilderLibrary(storage));
    expect(result.current.recoveryDraft?.savedPieceId).toBe("missing-piece");
    expect(result.current.activeScore).toBeNull();
  });

  it("retains in-memory work and reports failed writes", () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;
    const { result } = renderHook(() => useStaffBuilderLibrary(storage));
    act(() => result.current.createPiece({ title: "Unsaved", keyId: "c-major", timeSignature: "4/4", tempoBpm: 100 }));
    expect(result.current.activeScore?.title).toBe("Unsaved");
    expect(result.current.issues.some(({ message }) => message.includes("could not be saved"))).toBe(true);
  });
});
