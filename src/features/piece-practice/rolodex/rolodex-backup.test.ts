import { describe, expect, it } from "vitest";
import { createEntry, editEntry } from "./rolodex-model";
import { exportBackup, parseBackup, prepareImport } from "./rolodex-backup";
import { testScore } from "../continuous/continuous-test-fixtures";

const encode = (entries: readonly unknown[]) => JSON.stringify({ format: "prelude-practice-rolodex", version: 1, entries });
describe("versioned Rolodex backup", () => {
  it("round trips canonical frozen music, identity, instruments and manual settings", () => {
    const entry = editEntry(createEntry(testScore(), "violin"), { priority: true, status: "paused", nickname: "Two bars" });
    expect(parseBackup(encode([entry]))).toEqual([entry]);
    expect(exportBackup([entry])).toMatchObject({ extension: "json", format: "Practice Rolodex backup" });
  });
  it.each(["{}", "null", "{", '{"format":"prelude-practice-rolodex","version":99,"entries":[]}'])("rejects malformed/incompatible backup %s", raw => {
    expect(() => parseBackup(raw)).toThrow();
  });
  it("rejects any invalid entry and duplicated identities", () => {
    const e = createEntry(testScore(), "piano");
    expect(() => parseBackup(encode([e, { ...e, id: "broken", bpm: 0 }]))).toThrow();
    expect(() => parseBackup(encode([e, e]))).toThrow(/duplicate/);
  });
  it("previews identical passages as explicit skips", () => {
    const e = createEntry(testScore(), "piano");
    expect(prepareImport([e], [e], false)).toEqual({ entries: [], skipped: 1 });
  });
  it("requires explicit remapping of conflicting identities", () => {
    const e = createEntry(testScore(), "piano"), imported = editEntry(e, { bpm: 80 });
    expect(() => prepareImport([imported], [e], false)).toThrow(/Import Conflicts as New/);
    const planned = prepareImport([imported], [e], true);
    expect(planned.entries[0]!.id).not.toBe(e.id);
    expect(planned.entries[0]!.score).toEqual(e.score);
    expect(planned.entries[0]!.bpm).toBe(80);
  });
  it("does not import a summary as native performance acknowledgement", () => {
    const e = createEntry(testScore(), "piano");
    const summary = { attemptId: "a", prescriptionRevision: 1, endedAt: e.createdAt, outcome: "completed", instrument: "piano", inputSource: "physical-midi", inputId: "device" };
    expect(parseBackup(encode([{ ...e, lastPractice: summary }]))[0]!.lastPractice).toBeNull();
  });
});
