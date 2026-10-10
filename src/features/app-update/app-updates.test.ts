import { describe, expect, it } from "vitest";
import { APP_UPDATES, assertAppUpdateCatalog, parseAppUpdateAcknowledgment, unseenAppUpdates, type AppUpdate } from "./app-updates";

const updates: readonly AppUpdate[] = [1, 2, 3, 4].map((sequence) => ({ id: `update-${sequence}`, sequence, title: `Update ${sequence}`, date: "2026-10-05", changes: ["A product change"] }));

describe("curated product updates", () => {
  it("validates the published catalog and limits the first record to the new update feature", () => {
    expect(() => assertAppUpdateCatalog(APP_UPDATES)).not.toThrow();
    expect(APP_UPDATES).toHaveLength(7);
    expect(APP_UPDATES[0]).toMatchObject({ sequence: 1, version: "2.8.8" });
    expect(APP_UPDATES[0]?.changes.join(" ")).not.toMatch(/tuner|tie|since your last update/i);
    expect(APP_UPDATES[1]).toMatchObject({ sequence: 2, version: "2.9.0", date: "2026-10-06", title: "Practice with violin and ocarina" });
    expect(APP_UPDATES[1].changes.join(" ")).toContain("Provisional");
    expect(APP_UPDATES[2]).toMatchObject({ sequence: 3, version: "2.9.1", date: "2026-10-07" });
    expect(APP_UPDATES[2].changes.join(" ")).toContain("No audio is recorded or uploaded");
    expect(APP_UPDATES[3]).toMatchObject({ sequence: 4, version: "2.9.4", date: "2026-10-09" });
    expect(APP_UPDATES[3].changes.join(" ")).toContain("never automatically uploaded");
    expect(APP_UPDATES[4]).toMatchObject({ sequence: 5, version: "2.9.5", date: "2026-10-09" });
    expect(APP_UPDATES[4].changes.join(" ")).toContain("MIDI continues to handle note grading");
    expect(APP_UPDATES[5]).toMatchObject({ sequence: 6, version: "2.9.6", date: "2026-10-09" });
    expect(APP_UPDATES[5].changes.join(" ")).toContain("cannot identify your actual string or finger");
    expect(APP_UPDATES[6]).toMatchObject({ sequence: 7, version: "2.9.7" });
    expect(APP_UPDATES[6].changes.join(" ")).toContain("saved evidence are unchanged");
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
