import { describe, expect, it } from "vitest";
import { APP_UPDATES, assertAppUpdateCatalog, parseAppUpdateAcknowledgment, unseenAppUpdates, type AppUpdate } from "./app-updates";

const updates: readonly AppUpdate[] = [1, 2, 3, 4].map((sequence) => ({ id: `update-${sequence}`, sequence, title: `Update ${sequence}`, date: "2026-10-05", changes: ["A product change"] }));

describe("curated product updates", () => {
  it("validates the published catalog and limits the first record to the new update feature", () => {
    expect(() => assertAppUpdateCatalog(APP_UPDATES)).not.toThrow();
    expect(APP_UPDATES).toHaveLength(1);
    expect(APP_UPDATES[0]).toMatchObject({ sequence: 1, version: "2.8.8" });
    expect(APP_UPDATES[0]?.changes.join(" ")).not.toMatch(/tuner|tie|since your last update/i);
  });
  it("collects multiple missed known updates newest first without changing the catalog", () => {
    expect(unseenAppUpdates(updates, { id: "update-2", sequence: 2 }).map((update) => update.id)).toEqual(["update-4", "update-3"]);
    expect(updates.map((update) => update.sequence)).toEqual([1, 2, 3, 4]);
  });
  it("returns nothing when the latest update was acknowledged", () => {
    expect(unseenAppUpdates(updates, { id: "update-4", sequence: 4 })).toEqual([]);
  });
  it.each([null, { id: "pruned", sequence: 2 }, { id: "update-2", sequence: 1 }])("shows only newest for missing/unknown/mismatched state: %s", (seen) => {
    expect(unseenAppUpdates(updates, seen)).toEqual([updates[3]]);
  });
  it("suppresses old notes when a newer build already wrote a valid marker", () => {
    expect(unseenAppUpdates(updates, { id: "future", sequence: 8 })).toEqual([]);
    expect(unseenAppUpdates([], null)).toEqual([]);
  });
  it.each([{}, [], { id: "", sequence: 1 }, { id: "x", sequence: -1 }, { id: "x", sequence: 1.5 }, { id: "x", sequence: "2" }])("rejects malformed acknowledgment %s", (value) => {
    expect(parseAppUpdateAcknowledgment(value)).toBeNull();
  });
  it.each([
    [updates[1]!, updates[0]!],
    [updates[0]!, { ...updates[1]!, id: updates[0]!.id }],
    [updates[0]!, { ...updates[1]!, sequence: 1 }],
    [{ ...updates[0]!, changes: [] }],
  ])("rejects invalid or non-increasing catalogs", (...catalog) => {
    expect(() => assertAppUpdateCatalog(catalog)).toThrow();
  });
});
