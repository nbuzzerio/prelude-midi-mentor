import { describe, expect, it } from "vitest";
import { version } from "../../../package.json";
import { acknowledgeAppUpdates, readAppUpdateAcknowledgment } from "./app-update-storage";
import { APP_UPDATES, assertAppUpdateCatalog, parseAppUpdateAcknowledgment, unseenAppUpdates, type AppUpdate } from "./app-updates";

const updates: readonly AppUpdate[] = [1, 2, 3, 4].map((sequence) => ({ id: `update-${sequence}`, sequence, title: `Update ${sequence}`, date: "2026-10-05", changes: ["A product change"] }));

describe("curated product updates", () => {
  it("validates the published catalog and limits the first record to the new update feature", () => {
    expect(() => assertAppUpdateCatalog(APP_UPDATES)).not.toThrow();
    expect(APP_UPDATES).toHaveLength(18);
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
    expect(APP_UPDATES[7]).toMatchObject({ sequence: 8, version: "2.9.8" });
    expect(APP_UPDATES[7].changes.join(" ")).toContain("provisional Standard 12-hole Alto C");
    expect(APP_UPDATES[7].changes.join(" ")).toContain("cannot identify your actual covered holes");
    expect(APP_UPDATES[8]).toMatchObject({ sequence: 9, version: "2.9.13" });
    expect(APP_UPDATES[8].changes.join(" ")).toContain("Room audio is still deferred");
    expect(APP_UPDATES[9]).toMatchObject({ sequence: 10, version: "2.9.14" });
    expect(APP_UPDATES[10]).toMatchObject({ sequence: 11, version: "2.9.15", date: "2026-10-11" });
    expect(APP_UPDATES[11]).toMatchObject({ sequence: 12, version: "2.9.16", date: "2026-10-11" });
    expect(APP_UPDATES[12]).toMatchObject({ sequence: 13, version: "2.9.17", date: "2026-10-11" });
    expect(APP_UPDATES[13]).toMatchObject({ sequence: 14, version: "2.9.19", date: "2026-10-11" });
    expect(APP_UPDATES[14]).toMatchObject({ sequence: 15, version: "2.9.20", date: "2026-10-12" });
    expect(APP_UPDATES[15]).toMatchObject({ sequence: 16, version: "2.9.21", date: "2026-10-13" });
    expect(APP_UPDATES[15].changes.join(" ")).toContain("sequences stop at 999");
    expect(APP_UPDATES[15].changes.join(" ")).toContain("PDF suggestions always use 001");
    expect(APP_UPDATES[15].changes.join(" ")).toContain("existing ±10-cent default");
    expect(APP_UPDATES[15].changes.join(" ")).toContain("Piece Practice grading and ocarina behavior are unchanged");
    expect(APP_UPDATES[15].changes.join(" ")).toContain("moving replay playhead");
    expect(APP_UPDATES.filter(update => update.version === version)).toHaveLength(1);
    expect(APP_UPDATES[14].changes.join(" ")).toContain("may erase its contents before Prelude writes");
    expect(APP_UPDATES[14].changes.join(" ")).toContain("no automatic destination or suffix counter");
    expect(APP_UPDATES[13].changes.join(" ")).toContain("000 is reserved");
    expect(APP_UPDATES[13].changes.join(" ")).toContain("Print / Save as PDF");
    expect(APP_UPDATES[12].changes.join(" ")).toMatch(/Pause.*Resume.*same take/);
    expect(APP_UPDATES[12].changes.join(" ")).toContain("independent microphone failure");
    expect(APP_UPDATES[11].changes.join(" ")).toContain("not automatically transcribed or rhythmically validated sheet music");
    expect(APP_UPDATES[10].changes.join(" ")).toMatch(/Study View.*Lock Editing/);
    expect(APP_UPDATES[9].changes.join(" ")).toContain("not permanently stored or included in MIDI/JSON backups");
  });
  it("announces the five 2.9.22 improvements with the physical acceptance boundary", () => {
    const release = APP_UPDATES[16]!;
    expect(release).toMatchObject({ id: "2026-10-20-repertoire-practice-loop", sequence: 17,
      version: "2.9.22", title: "What's New in Prelude v2.9.22", date: "2026-10-20" });
    expect(release.changes).toHaveLength(5);
    expect(release.changes[0]).toMatch(/Continuous-Tempo.*physical MIDI piano.*pitch and onset timing separately/);
    expect(release.changes[1]).toMatch(/Practice Rolodex.*exact saved music, measure range and practice tempo/);
    expect(release.changes[2]).toMatch(/Today's Piano Lesson.*after your regular fundamentals.*unchanged when repertoire is disabled/);
    expect(release.changes[3]).toMatch(/three clean pitch-and-onset performances.*later day/);
    expect(release.changes[3]).toContain("Automatic qualification is off by default");
    expect(release.changes[3]).toContain("explicit owner acceptance with a real MIDI piano");
    expect(release.changes[3]).toContain("Earlier provisional results never qualify retroactively");
    expect(release.changes[3]).toContain("physical timing acceptance remains pending");
    expect(release.changes[4]).toMatch(/MIDI connected.*keyboard hides by default.*Optional performance-audio recording.*exports still available/);
    expect(release.changes.join(" ")).not.toMatch(/calibrated|certified|fingering|hand independence|general musical mastery|acoustic violin|acoustic ocarina/i);
  });
  it("offers 2.9.22 after dismissed 2.9.21 and persists acknowledgement for later visits", () => {
    const previous = APP_UPDATES[15]!;
    let saved = JSON.stringify({ id: previous.id, sequence: previous.sequence });
    const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
    const displayed = unseenAppUpdates(APP_UPDATES.slice(0, 17), readAppUpdateAcknowledgment(storage));
    expect(displayed).toEqual([APP_UPDATES[16]]);
    expect(acknowledgeAppUpdates(storage, displayed)).toBe(true);
    expect(unseenAppUpdates(APP_UPDATES.slice(0, 17), readAppUpdateAcknowledgment(storage))).toEqual([]);
    expect(unseenAppUpdates(APP_UPDATES.slice(0, 16), readAppUpdateAcknowledgment(storage))).toEqual([]);
  });
  it("announces the owner-approved 2.9.23 reading, continuation, session and report improvements", () => {
    expect(version).toBe("2.9.23");
    const release = APP_UPDATES.at(-1)!;
    expect(release).toMatchObject({ id: "2026-10-22-melody-reading-continuation", sequence: 18,
      version, title: `What's New in Prelude v${version}`, date: "2026-10-22" });
    expect(release.changes).toHaveLength(4);
    expect(release.changes[0]).toMatch(/both measures before you start.*cursor aligned with the engraved music/);
    expect(release.changes[1]).toMatch(/Continuous Practice.*sustain pedal or Try Another.*without another Ready click.*synchronized visual 3–2–1/);
    expect(release.changes[2]).toMatch(/optional Piano Rolodex.*manually assembled V2.*select or clear the entire exercise pool.*stable layouts.*focus/);
    expect(release.changes[3]).toContain("distinguish reaching a target from closing the attempt");
    expect(release.changes.join(" ")).not.toMatch(/gapless|uninterrupted|certified/i);
  });
  it("offers only 2.9.23 after acknowledged 2.9.22 and protects its marker from an older cached build", () => {
    const previous = APP_UPDATES[16]!;
    let saved = JSON.stringify({ id: previous.id, sequence: previous.sequence });
    const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
    const displayed = unseenAppUpdates(APP_UPDATES, readAppUpdateAcknowledgment(storage));
    expect(displayed).toEqual([APP_UPDATES[17]]);
    expect(acknowledgeAppUpdates(storage, displayed)).toBe(true);
    expect(unseenAppUpdates(APP_UPDATES, readAppUpdateAcknowledgment(storage))).toEqual([]);
    expect(unseenAppUpdates(APP_UPDATES.slice(0, 17), readAppUpdateAcknowledgment(storage))).toEqual([]);
    expect(acknowledgeAppUpdates(storage, [previous])).toBe(true);
    expect(readAppUpdateAcknowledgment(storage)).toEqual({ id: APP_UPDATES[17]!.id, sequence: 18 });
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
