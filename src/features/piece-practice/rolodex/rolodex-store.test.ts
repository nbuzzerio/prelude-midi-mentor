import { describe, expect, it } from "vitest";
import { createEntry, editEntry } from "./rolodex-model";
import { checkLimits, planImport, planSave, rolodexStore } from "./rolodex-store";
import { testScore } from "../continuous/continuous-test-fixtures";

describe("Rolodex transaction plans", () => {
  it("creates a detached record without mutating previous entries", () => {
    const entry = createEntry(testScore(), "piano"), records: unknown[] = [];
    expect(planSave(records, entry, null)).toMatchObject({ entry, write: true, duplicate: false });
    expect(records).toEqual([]);
  });
  it("retry of an already acknowledged same record does not write or duplicate", () => {
    const entry = createEntry(testScore(), "piano");
    expect(planSave([entry], entry, null)).toMatchObject({ write: false, duplicate: false });
  });
  it("offers the existing duplicate and permits distinct overlapping ranges", () => {
    const source = testScore("4/4", 4), a = createEntry(source, "piano", 0, 1), b = createEntry(source, "piano", 0, 1);
    expect(planSave([a], b, null)).toMatchObject({ entry: a, write: false, duplicate: true });
    expect(planSave([a], createEntry(source, "piano", 1, 2), null).write).toBe(true);
  });
  it("enforces optimistic revisions and immutable source on edits", () => {
    const a = createEntry(testScore(), "piano"), b = editEntry(a, { nickname: "New" });
    expect(planSave([a], b, 1).write).toBe(true);
    expect(() => planSave([b], editEntry(a, { nickname: "Stale" }), 1)).toThrow(/another tab/);
    const changed = { ...b, score: { ...b.score, title: "Replacement" }, sourceTitle: "Replacement" };
    expect(() => planSave([a], changed, 1)).toThrow(/frozen music/);
  });
  it("preserves corrupt/unsupported records by refusing a write plan", () => {
    const bad = { id: "future", schemaVersion: 99 };
    const records = [bad]; expect(() => planSave(records, createEntry(testScore(), "piano"), null)).toThrow(/Unsupported/);
    expect(records).toEqual([bad]);
  });
  it("validates an entire import before returning any additions", () => {
    const a = createEntry(testScore(), "piano"), b = createEntry(testScore(), "violin");
    expect(planImport([], [a, b])).toEqual([a, b]);
    expect(() => planImport([], [a, { ...b, schemaVersion: 2 } as unknown as typeof b])).toThrow();
  });
  it("rejects identity and content collisions without partial import", () => {
    const a = createEntry(testScore(), "piano");
    expect(() => planImport([a], [editEntry(a, { bpm: 80 })])).toThrow(/Identity collision/);
    expect(() => planImport([a], [createEntry(testScore(), "piano")])).toThrow(/matching passage/);
  });
  it("enforces explicit retention ceiling without silently deleting passages", () => {
    const entry = createEntry(testScore(), "piano");
    expect(() => checkLimits(Array.from({ length: 257 }, () => entry))).toThrow(/Nothing was deleted/);
  });
  it("reports unavailable IndexedDB without a success acknowledgement", async () => {
    await expect(rolodexStore.save(createEntry(testScore(), "piano"), null)).rejects.toThrow(/unavailable/);
  });
});
