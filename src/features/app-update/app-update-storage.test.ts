import { describe, expect, it, vi } from "vitest";
import { acknowledgeAppUpdates, APP_UPDATE_STORAGE_KEY, readAppUpdateAcknowledgment } from "./app-update-storage";
import { unseenAppUpdates, type AppUpdate } from "./app-updates";

const displayed: readonly AppUpdate[] = [3, 2].map((sequence) => ({ id: `update-${sequence}`, sequence, date: "2026-10-05", title: "Update", changes: ["Change"] }));
const memory = (raw: string | null = null) => {
  let value = raw;
  return { getItem: vi.fn(() => value), setItem: vi.fn((_key: string, next: string) => { value = next; }) };
};

describe("app update acknowledgment storage", () => {
  it("writes the newest actually displayed update and reads it back", () => {
    const storage = memory();
    expect(readAppUpdateAcknowledgment(storage)).toBeNull();
    expect(acknowledgeAppUpdates(storage, displayed)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(APP_UPDATE_STORAGE_KEY, JSON.stringify({ id: "update-3", sequence: 3 }));
    expect(readAppUpdateAcknowledgment(storage)).toEqual({ id: "update-3", sequence: 3 });
  });
  it.each(["broken json", "null", "[]", '{"id":"x","sequence":0}', '{"id":"x"}'])("treats malformed storage as unknown: %s", (raw) => {
    expect(readAppUpdateAcknowledgment(memory(raw))).toBeNull();
  });
  it("re-reads a marker written by another tab and never moves it backward", () => {
    const storage = memory(JSON.stringify({ id: "update-1", sequence: 1 }));
    expect(readAppUpdateAcknowledgment(storage)?.sequence).toBe(1);
    storage.setItem(APP_UPDATE_STORAGE_KEY, JSON.stringify({ id: "future", sequence: 8 }));
    storage.setItem.mockClear();
    expect(acknowledgeAppUpdates(storage, displayed)).toBe(true);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(readAppUpdateAcknowledgment(storage)).toEqual({ id: "future", sequence: 8 });
  });
  it("does not rewrite an equal-sequence marker for the same record", () => {
    const storage = memory(JSON.stringify({ id: "update-3", sequence: 3 }));
    expect(acknowledgeAppUpdates(storage, displayed)).toBe(true);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("replaces an equal-sequence marker with a different ID so acknowledged notes do not reopen", () => {
    const storage = memory(JSON.stringify({ id: "old-or-pruned-id", sequence: 3 }));
    const catalog = [...displayed].reverse();
    const unseen = unseenAppUpdates(catalog, readAppUpdateAcknowledgment(storage));
    expect(unseen).toEqual([displayed[0]]);
    expect(acknowledgeAppUpdates(storage, unseen)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(APP_UPDATE_STORAGE_KEY, JSON.stringify({ id: "update-3", sequence: 3 }));
    expect(unseenAppUpdates(catalog, readAppUpdateAcknowledgment(storage))).toEqual([]);
  });
  it("advances a lower-sequence marker to the newest displayed record", () => {
    const storage = memory(JSON.stringify({ id: "update-2", sequence: 2 }));
    expect(acknowledgeAppUpdates(storage, displayed)).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(APP_UPDATE_STORAGE_KEY, JSON.stringify({ id: "update-3", sequence: 3 }));
    expect(readAppUpdateAcknowledgment(storage)).toEqual({ id: "update-3", sequence: 3 });
  });
  it("replaces malformed state on acknowledgment without treating it as history", () => {
    const storage = memory("invalid");
    expect(acknowledgeAppUpdates(storage, displayed)).toBe(true);
    expect(readAppUpdateAcknowledgment(storage)?.sequence).toBe(3);
  });
  it("handles unavailable reads and writes without throwing or pretending success", () => {
    const storage = { getItem: () => { throw new Error("Unavailable"); }, setItem: vi.fn() };
    expect(readAppUpdateAcknowledgment(storage)).toBeNull();
    expect(acknowledgeAppUpdates(storage, displayed)).toBe(false);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(acknowledgeAppUpdates({ getItem: () => null, setItem: () => { throw new Error("Quota"); } }, displayed)).toBe(false);
    expect(acknowledgeAppUpdates(null, displayed)).toBe(false);
    expect(acknowledgeAppUpdates(memory(), [])).toBe(false);
  });
});
