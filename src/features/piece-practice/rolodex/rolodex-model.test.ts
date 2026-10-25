import { describe, expect, it } from "vitest";
import { createEntry, editEntry, musicKey, parseEntry, playablePassage, playability, prescriptionKey, sourceStatus } from "./rolodex-model";
import { testScore } from "../continuous/continuous-test-fixtures";

describe("immutable Rolodex prescriptions", () => {
  it("retains its independent four-bar boundary for create/edit/import despite longer standalone A1 ranges", () => {
    const score = testScore("4/4", 16);
    const four = createEntry(score, "piano", 8, 11, 60);
    expect(playablePassage(four)).toMatchObject({ start: 8, end: 11 });
    expect(() => createEntry(score, "piano", 0, 15, 60)).toThrow(/range/);
    expect(() => editEntry(four, { end: 15 })).toThrow(/range/);
    expect(() => parseEntry({ ...four, end: 15 })).toThrow(/range/);
    expect(four.score.measures).toHaveLength(16);
  });
  it("captures full source, original identities and inclusive measure numbers", () => {
    const source = testScore("4/4", 6), entry = createEntry(source, "piano", 3, 4, 72);
    expect(entry.score).toEqual(source); expect(entry.score).not.toBe(source);
    expect(entry.measureIds).toEqual(["m3", "m4"]); expect(entry.measureNumbers).toEqual([4, 5]);
    expect(Object.isFrozen(entry.score.measures)).toBe(true);
    expect(playablePassage(entry)).toMatchObject({ start: 3, end: 4, bpm: 72, policy: entry.policy });
  });
  it("remains playable after source rename, edit and deletion", () => {
    const source = testScore(), entry = createEntry(source, "piano");
    const renamed = { ...source, title: "Renamed", tempoBpm: 120 };
    expect(sourceStatus(entry, [renamed])).toContain("has changed");
    expect(sourceStatus(entry, [])).toContain("unavailable");
    expect(playablePassage(entry).score).toEqual(source);
    expect(sourceStatus(entry, [source])).toBe("");
  });
  it.each(["piano", "violin", "ocarina"] as const)("uses only declared %s context for eligibility", instrument => {
    const entry = createEntry(testScore(), instrument);
    expect(entry.sourceInstrument).toBe(instrument);
    expect(entry.eligibleInstruments).toEqual([instrument]); expect(entry.practiceInstrument).toBe(instrument);
  });
  it("does not infer source instrument from title, clef or notes", () => {
    const entry = createEntry({ ...testScore(), title: "Violin in treble clef" });
    expect(entry.sourceInstrument).toBe("unknown");
    expect(entry.eligibleInstruments).toEqual(["piano"]); // Editable UI default requires explicit confirmation.
  });
  it.each(["violin", "ocarina"] as const)("does not execute %s as piano", instrument => {
    const entry = createEntry(testScore(), instrument);
    expect(() => playablePassage(entry)).toThrow(/Piano/);
    const eligible = editEntry(entry, { eligibleInstruments: [instrument, "piano"] });
    expect(() => playablePassage(eligible)).toThrow(/Piano/);
    const optedIn = editEntry(eligible, { practiceInstrument: "piano" });
    expect(playablePassage(optedIn).score).toEqual(entry.score);
    expect(optedIn.sourceInstrument).toBe(instrument);
  });
  it("retains valid music that the selected A1 profile cannot execute", () => {
    const entry = createEntry(testScore("2/4"), "piano");
    expect(parseEntry(entry)).toEqual(entry);
    expect(playability(entry)).toContain("3/4, 4/4 and 6/8");
  });
  it.each(["3/4", "4/4", "6/8"] as const)("reuses A1 timing and policy for %s", meter => {
    const entry = createEntry(testScore(meter), "piano");
    expect(playablePassage(entry).meter).toBe(meter);
    expect(playablePassage(entry).policy).toEqual(entry.policy);
  });
  it("keeps stable identity and prescription revision for metadata edits", () => {
    const entry = createEntry(testScore(), "piano"), edited = editEntry(entry, { nickname: "Transition", priority: true, status: "improving" });
    expect(edited.id).toBe(entry.id); expect(edited.revision).toBe(2);
    expect(edited.prescriptionRevision).toBe(1); expect(edited.score).toEqual(entry.score);
  });
  it("versions changed range/settings without reinterpreting earlier practice", () => {
    const entry = createEntry(testScore("4/4", 4), "piano");
    const edited = editEntry(entry, { start: 1, end: 2, bpm: 80 });
    expect(edited.prescriptionRevision).toBe(2); expect(edited.measureIds).toEqual(["m1", "m2"]);
    expect(edited.id).toBe(entry.id); expect(entry.start).toBe(0);
  });
  it("duplicate identity ignores nickname and source title/date", () => {
    const a = createEntry(testScore(), "piano"), b = createEntry({ ...testScore(), title: "Other name" }, "piano");
    expect(prescriptionKey(a)).toBe(prescriptionKey(b));
    expect(prescriptionKey(editEntry(a, { nickname: "Tricky" }))).toBe(prescriptionKey(a));
  });
  it("musical identity preserves pitch spelling and timing", () => {
    const a = testScore(), b = { ...a, initialKeySignatureId: "g-major" as const };
    expect(musicKey(a)).not.toBe(musicKey(b));
  });
  it.each([
    { schemaVersion: 99 }, { start: -1 }, { end: 4 }, { bpm: 39 }, { bpm: 121 },
    { eligibleInstruments: [] }, { eligibleInstruments: ["piano", "piano"] }, { practiceInstrument: "violin" },
    { sourceInstrument: "treble" }, { measureIds: ["wrong"] }, { measureNumbers: [59, 60] }, { mode: "microphone" },
    { policy: { version: 2 } }, { lastPractice: { outcome: "completed" } },
  ])("rejects invalid/unavailable data %j", changes => {
    expect(() => parseEntry({ ...createEntry(testScore(), "piano"), ...changes })).toThrow();
  });
});
