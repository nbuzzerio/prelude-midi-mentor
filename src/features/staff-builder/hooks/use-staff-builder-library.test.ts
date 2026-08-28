import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createStaffBuilderScore, insertUnresolvedStaffBuilderNotes } from "../staff-builder-score";
import { DEFAULT_STAFF_BUILDER_CAPTURE_STATE } from "../staff-builder-capture";
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
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.library, JSON.stringify({ schemaVersion: 3, pieces: [saved] }));
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.lastPieceId, saved.id);
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.draft, JSON.stringify({ schemaVersion: 3, savedPieceId: options.savedPieceId === undefined ? saved.id : options.savedPieceId, updatedAt: options.draftUpdatedAt, score: draftScore, editorPass: "capture" }));
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

  it("imports a schema-valid incomplete piece without opening it or creating a draft", () => {
    const storage = new MemoryStorage();
    const { result } = renderHook(() => useStaffBuilderLibrary(storage));
    const imported = createStaffBuilderScore({ title: "Incomplete", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", factories: { createId: () => "imported-id", now: () => "2026-08-11T12:00:00.000Z" } });
    let outcome: ReturnType<typeof result.current.importPiece> | undefined;
    act(() => { outcome = result.current.importPiece(imported); });
    expect(outcome).toEqual({ score: imported, persisted: true });
    expect(result.current.library.pieces).toEqual([imported]);
    expect(result.current.activeScore).toBeNull();
    expect(result.current.activeSavedPieceId).toBeNull();
    expect(storage.values.has(STAFF_BUILDER_STORAGE_KEYS.draft)).toBe(false);
    expect(JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.library) ?? "null").pieces).toEqual([imported]);
  });

  it("duplicates a library piece and opens the independent copy with fresh editor state", () => {
    const storage = new MemoryStorage();
    const original = createStaffBuilderScore({
      title: "Source",
      tempoBpm: 100,
      initialKeySignatureId: "c-major",
      initialTimeSignature: "4/4",
      factories: { createId: () => "source-id", now: () => "2026-08-01T12:00:00.000Z" },
    });
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.library, JSON.stringify({ schemaVersion: 3, pieces: [original] }));
    const { result } = renderHook(() => useStaffBuilderLibrary(storage));
    let nextId = 0;

    act(() => result.current.duplicatePiece("source-id", "full", {
      createId: () => `duplicate-${++nextId}`,
      now: () => "2026-08-27T12:00:00.000Z",
    }));

    expect(result.current.library.pieces).toHaveLength(2);
    expect(result.current.library.pieces[0]).toEqual(original);
    expect(result.current.activeScore?.title).toBe("Source — Copy");
    expect(result.current.activeSavedPieceId).toBe(result.current.activeScore?.id);
    expect(result.current.activeCaptureState).toEqual(DEFAULT_STAFF_BUILDER_CAPTURE_STATE);
    expect(result.current.activeEditorPass).toBe("capture");
    expect(result.current.activeRhythmState).toEqual({ measureIndex: 0, selectedEventId: null });
    const persistedLibrary = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.library) ?? "null");
    const persistedDraft = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft) ?? "null");
    expect(persistedLibrary.pieces).toHaveLength(2);
    expect(persistedDraft.savedPieceId).toBe(result.current.activeScore?.id);
    expect(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.lastPieceId)).toBe(result.current.activeScore?.id);
  });

  it("copies a colliding imported project without overwriting it and preserves duplicate titles", () => {
    const storage = new MemoryStorage();
    const { result } = renderHook(() => useStaffBuilderLibrary(storage));
    act(() => result.current.createPiece({ title: "Same Title", keyId: "c-major", timeSignature: "4/4", tempoBpm: 100 }));
    const existing = result.current.library.pieces[0]!;
    act(() => result.current.closePiece());
    let outcome: ReturnType<typeof result.current.importPiece> | undefined;
    act(() => { outcome = result.current.importPiece(existing, { createId: () => "copy-id", now: () => "2026-08-11T15:00:00.000Z" }); });
    expect(result.current.library.pieces).toHaveLength(2);
    expect(result.current.library.pieces[0]).toBe(existing);
    expect(outcome?.score).toEqual({ ...existing, id: "copy-id", updatedAt: "2026-08-11T15:00:00.000Z" });
    expect(result.current.library.pieces.map(({ title }) => title)).toEqual(["Same Title", "Same Title"]);
    expect(result.current.activeScore).toBeNull();
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

  it("persists score and capture state together with a recoverably newer timestamp", () => {
    const storage = new MemoryStorage();
    const { result } = renderHook(() => useStaffBuilderLibrary(storage));
    act(() => result.current.createPiece({ title: "Capture", keyId: "c-major", timeSignature: "4/4", tempoBpm: 100 }));
    const score = result.current.activeScore;
    expect(score).not.toBeNull();
    const captureState = { cursor: { measureIndex: 0, offsetTicks: 480 }, stepDuration: "eighth" as const, inputMode: "bass" as const };
    act(() => result.current.updateActiveDraft(score!, { editorPass: "capture", captureState, rhythmState: { measureIndex: 0, selectedEventId: null } }));
    const draft = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft) ?? "null");
    expect(draft.captureState).toEqual(captureState);
    expect(Date.parse(draft.updatedAt)).toBeGreaterThan(Date.parse(score!.updatedAt));
    expect(result.current.activeCaptureState).toEqual(captureState);
  });

  it("keeps an invalid project snapshot in the library so multiple incomplete pieces can be reopened", () => {
    const storage = new MemoryStorage();
    const first = renderHook(() => useStaffBuilderLibrary(storage));
    act(() => first.result.current.createPiece({ title: "Incomplete", keyId: "c-major", timeSignature: "4/4", tempoBpm: 100 }));
    const edited = insertUnresolvedStaffBuilderNotes(first.result.current.activeScore!, { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60] });
    act(() => first.result.current.updateActiveDraft(edited, { editorPass: "capture", captureState: first.result.current.activeCaptureState, rhythmState: { measureIndex: 0, selectedEventId: null } }));
    expect(first.result.current.library.pieces[0]?.measures[0]?.events[0]).toMatchObject({ rhythm: { status: "unresolved" } });
    first.unmount();
    const restored = renderHook(() => useStaffBuilderLibrary(storage));
    expect(restored.result.current.recoveryDraft).toBeNull();
    expect(restored.result.current.activeScore?.measures[0]?.events[0]).toMatchObject({ rhythm: { status: "unresolved" } });
  });

  it("restores persisted capture state and defaults older drafts", () => {
    const storage = new MemoryStorage();
    seedDraft(storage, { draftUpdatedAt: "2026-08-06T13:00:00.000Z" });
    const draft = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft) ?? "null");
    draft.captureState = { cursor: { measureIndex: 0, offsetTicks: 240 }, stepDuration: "sixteenth", activeStaff: "bass" };
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.draft, JSON.stringify(draft));
    const current = renderHook(() => useStaffBuilderLibrary(storage));
    act(() => current.result.current.restoreDraft());
    expect(current.result.current.activeCaptureState).toEqual({ cursor: { measureIndex: 0, offsetTicks: 240 }, stepDuration: "sixteenth", inputMode: "bass" });
    current.unmount();

    const olderStorage = new MemoryStorage();
    seedDraft(olderStorage, { draftUpdatedAt: "2026-08-06T13:00:00.000Z" });
    const older = renderHook(() => useStaffBuilderLibrary(olderStorage));
    act(() => older.result.current.restoreDraft());
    expect(older.result.current.activeCaptureState).toMatchObject({ cursor: { measureIndex: 0, offsetTicks: 0 }, stepDuration: "quarter", inputMode: "grand" });
  });

  it("persists and restores the active rhythm pass and selected event", () => {
    const storage = new MemoryStorage();
    const first = renderHook(() => useStaffBuilderLibrary(storage));
    act(() => first.result.current.createPiece({ title: "Rhythm", keyId: "c-major", timeSignature: "4/4", tempoBpm: 100 }));
    const editedScore = insertUnresolvedStaffBuilderNotes(first.result.current.activeScore!, {
      measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60],
    });
    const eventId = editedScore.measures[0]!.events[0]!.id;
    act(() => first.result.current.updateActiveDraft(editedScore, {
      editorPass: "rhythm",
      captureState: first.result.current.activeCaptureState,
      rhythmState: { measureIndex: 0, selectedEventId: eventId },
    }));
    const persisted = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft) ?? "null");
    expect(persisted).toMatchObject({ editorPass: "rhythm", rhythmState: { measureIndex: 0, selectedEventId: eventId } });
    first.unmount();

    const restored = renderHook(() => useStaffBuilderLibrary(storage));
    expect(restored.result.current.recoveryDraft).toBeNull();
    expect(restored.result.current.activeEditorPass).toBe("rhythm");
    expect(restored.result.current.activeRhythmState).toEqual({ measureIndex: 0, selectedEventId: eventId });
  });

  it("keeps editor changes in memory and reports a failed draft autosave", () => {
    const storage = new MemoryStorage();
    const { result } = renderHook(() => useStaffBuilderLibrary(storage));
    act(() => result.current.createPiece({ title: "Capture", keyId: "c-major", timeSignature: "4/4", tempoBpm: 100 }));
    storage.failWrites = true;
    const captureState = { cursor: { measureIndex: 0, offsetTicks: 480 }, stepDuration: "quarter" as const, inputMode: "grand" as const };
    act(() => result.current.updateActiveDraft(result.current.activeScore!, { editorPass: "capture", captureState, rhythmState: { measureIndex: 0, selectedEventId: null } }));
    expect(result.current.activeCaptureState.cursor.offsetTicks).toBe(480);
    expect(result.current.issues.some(({ area }) => area === "draft")).toBe(true);
  });

  it("rejects invalid final saves and synchronizes a valid library snapshot and draft", () => {
    const storage = new MemoryStorage();
    const { result } = renderHook(() => useStaffBuilderLibrary(storage));
    act(() => result.current.createPiece({ title: "Reference", keyId: "c-major", timeSignature: "4/4", tempoBpm: 100 }));
    const original = result.current.activeScore!;
    const editorState = { editorPass: "rhythm" as const, captureState: result.current.activeCaptureState, rhythmState: { measureIndex: 0, selectedEventId: null } };
    let invalidResult: ReturnType<typeof result.current.validateAndSave> | undefined;
    act(() => { invalidResult = result.current.validateAndSave(original, editorState); });
    expect(invalidResult).toMatchObject({ ok: false, reason: "invalid" });
    const fullRest = (id: string, staff: "treble" | "bass") => ({ id, kind: "rest" as const, staff, startTick: 0, rhythm: { status: "final" as const, duration: "whole" as const } });
    const valid = { ...original, updatedAt: "2026-08-06T14:00:00.000Z", measures: [{ ...original.measures[0]!, events: [fullRest("t", "treble"), fullRest("b", "bass")] }] };
    let saved: ReturnType<typeof result.current.validateAndSave> | undefined;
    act(() => { saved = result.current.validateAndSave(valid, editorState); });
    expect(saved).toMatchObject({ ok: true });
    expect(result.current.library.pieces.find(({ id }) => id === original.id)?.measures[0]?.events).toHaveLength(2);
    const draft = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft) ?? "null");
    expect(draft.updatedAt).toBe(valid.updatedAt);
    expect(draft.savedPieceId).toBe(original.id);
  });
});
