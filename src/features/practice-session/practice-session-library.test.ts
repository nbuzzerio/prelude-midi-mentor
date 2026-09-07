import { describe, expect, it, vi } from "vitest";
import { DEFAULT_FLASHCARD_CONFIG } from "@/features/flashcards/flashcard-config";
import {
  addPracticeExercise,
  addPracticeSessionPreset,
  createPracticeSessionPreset,
  deletePracticeSessionPreset,
  duplicatePracticeExercise,
  duplicatePracticeSessionPreset,
  loadPracticeSessionLibrary,
  movePracticeExercise,
  PRACTICE_SESSION_LIBRARY_STORAGE_KEY,
  removePracticeExercise,
  renamePracticeSessionPreset,
  savePracticeSessionLibrary,
  setLastUsedPracticeSessionPreset,
  updatePracticeExercise,
  updatePracticeSessionPreset,
  type PracticeSessionStorage,
} from "./practice-session-library";
import type { FlashcardPracticeExercise, PracticeSessionLibrary, PracticeSessionPreset } from "./practice-session-types";

class MemoryStorage implements PracticeSessionStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const exercise = (id: string, label = id): FlashcardPracticeExercise => ({ id, label, engine: "flashcards", config: DEFAULT_FLASHCARD_CONFIG, target: { kind: "correct-answers", count: 10 } });
const preset = (id = "p1", exercises = [exercise("e1"), exercise("e2")]): PracticeSessionPreset => ({ schemaVersion: 1, id, name: "Daily", exercises });
const library = (presets = [preset()], lastUsedPresetId: string | null = null): PracticeSessionLibrary => ({ schemaVersion: 1, presets, lastUsedPresetId });

function value<T>(result: { ok: true; value: T } | { ok: false }): T {
  if (!result.ok) throw new Error("operation failed");
  return result.value;
}

describe("Practice Session domain operations", () => {
  it("creates, adds, and renames presets without changing identity", () => {
    const created = value(createPracticeSessionPreset("Morning", () => "new-preset"));
    const added = value(addPracticeSessionPreset(library([]), created));
    const renamed = value(renamePracticeSessionPreset(added, created.id, "Week 3"));
    expect(renamed.presets[0]).toMatchObject({ id: "new-preset", name: "Week 3", exercises: [] });
    expect(addPracticeSessionPreset(renamed, created)).toEqual({ ok: false, reason: "id-collision" });
    const replaced = value(updatePracticeSessionPreset(renamed, created.id, { ...created, name: "Replacement" }));
    expect(replaced.presets[0]).toMatchObject({ id: "new-preset", name: "Replacement" });
    expect(updatePracticeSessionPreset(renamed, created.id, { ...created, id: "changed" })).toEqual({ ok: false, reason: "invalid-value" });
  });

  it("adds, updates, removes, and moves entries immutably", () => {
    const original = library();
    const added = value(addPracticeExercise(original, "p1", exercise("e3"), 1));
    expect(added.presets[0]!.exercises.map(({ id }) => id)).toEqual(["e1", "e3", "e2"]);
    const updated = value(updatePracticeExercise(added, "p1", "e3", exercise("e3", "Custom")));
    expect(updated.presets[0]!.exercises[1]).toMatchObject({ id: "e3", label: "Custom" });
    const moved = value(movePracticeExercise(updated, "p1", "e3", 2));
    expect(moved.presets[0]!.exercises.map(({ id }) => id)).toEqual(["e1", "e2", "e3"]);
    const removed = value(removePracticeExercise(moved, "p1", "e2"));
    expect(removed.presets[0]!.exercises.map(({ id }) => id)).toEqual(["e1", "e3"]);
    expect(original.presets[0]!.exercises.map(({ id }) => id)).toEqual(["e1", "e2"]);
    expect(movePracticeExercise(original, "p1", "e1", 2)).toEqual({ ok: false, reason: "invalid-index" });
    expect(updatePracticeExercise(original, "p1", "e1", exercise("changed"))).toEqual({ ok: false, reason: "invalid-value" });
  });

  it("duplicates an exercise with a new ID and detached config", () => {
    const duplicated = value(duplicatePracticeExercise(library(), "p1", "e1", () => "copy"));
    expect(duplicated.presets[0]!.exercises.map(({ id }) => id)).toEqual(["e1", "copy", "e2"]);
    expect(duplicated.presets[0]!.exercises[1]!.config).not.toBe(duplicated.presets[0]!.exercises[0]!.config);
    expect(duplicatePracticeExercise(library(), "p1", "e1", () => "e2")).toEqual({ ok: false, reason: "id-collision" });
  });

  it("duplicates a preset with a new preset ID and all-new local exercise IDs", () => {
    const ids = vi.fn().mockReturnValueOnce("p2").mockReturnValueOnce("x1").mockReturnValueOnce("x2");
    const duplicated = value(duplicatePracticeSessionPreset(library(), "p1", ids));
    expect(duplicated.presets.map(({ id }) => id)).toEqual(["p1", "p2"]);
    expect(duplicated.presets[1]).toMatchObject({ name: "Daily — Copy", exercises: [{ id: "x1" }, { id: "x2" }] });
    expect(duplicated.presets[1]!.exercises[0]!.config).not.toBe(duplicated.presets[0]!.exercises[0]!.config);
    expect(duplicatePracticeSessionPreset(library(), "p1", () => "p1")).toEqual({ ok: false, reason: "id-collision" });
  });

  it("owns last-used behavior at the library boundary", () => {
    const selected = value(setLastUsedPracticeSessionPreset(library(), "p1"));
    expect(deletePracticeSessionPreset(selected, "p1")).toEqual({ ok: true, value: { schemaVersion: 1, presets: [], lastUsedPresetId: null } });
    expect(setLastUsedPracticeSessionPreset(library(), "missing")).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("Practice Session guarded storage", () => {
  it("returns a clean empty library without writing when storage is empty", () => {
    const storage = new MemoryStorage();
    const setItem = vi.spyOn(storage, "setItem");
    expect(loadPracticeSessionLibrary(storage)).toEqual({ ok: true, value: { schemaVersion: 1, presets: [], lastUsedPresetId: null } });
    expect(setItem).not.toHaveBeenCalled();
  });

  it("round trips JSON and preserves order", () => {
    const storage = new MemoryStorage();
    const input = library([preset("p1"), preset("p2", [exercise("other")])], "p2");
    expect(savePracticeSessionLibrary(storage, input)).toEqual({ ok: true });
    expect(loadPracticeSessionLibrary(storage)).toEqual({ ok: true, value: input });
  });

  it("normalizes stale last-used identity in memory without rewriting raw storage", () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify(library([preset()], "missing"));
    storage.values.set(PRACTICE_SESSION_LIBRARY_STORAGE_KEY, raw);
    expect(loadPracticeSessionLibrary(storage)).toMatchObject({ ok: true, value: { lastUsedPresetId: null, presets: [{ id: "p1" }] } });
    expect(storage.values.get(PRACTICE_SESSION_LIBRARY_STORAGE_KEY)).toBe(raw);
  });

  it("preserves corrupt and unsupported storage content", () => {
    const storage = new MemoryStorage();
    for (const raw of ["not-json", JSON.stringify({ schemaVersion: 2, presets: [], lastUsedPresetId: null })]) {
      storage.values.set(PRACTICE_SESSION_LIBRARY_STORAGE_KEY, raw);
      expect(loadPracticeSessionLibrary(storage)).toMatchObject({ ok: false });
      expect(storage.values.get(PRACTICE_SESSION_LIBRARY_STORAGE_KEY)).toBe(raw);
    }
  });

  it("reports unavailable reads, failed writes, and refuses invalid libraries", () => {
    const throwing: PracticeSessionStorage = { getItem: () => { throw new Error(); }, setItem: () => { throw new Error(); } };
    expect(loadPracticeSessionLibrary(throwing)).toMatchObject({ ok: false, reason: "unavailable" });
    expect(savePracticeSessionLibrary(throwing, library())).toMatchObject({ ok: false, reason: "write-failed" });
    expect(savePracticeSessionLibrary(new MemoryStorage(), { ...library(), presets: [preset(), preset()] })).toMatchObject({ ok: false, reason: "invalid" });
  });
});
