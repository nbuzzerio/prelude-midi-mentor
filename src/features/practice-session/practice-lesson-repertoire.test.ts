import { describe, expect, it } from "vitest";
import { createEntry, editEntry } from "../piece-practice/rolodex/rolodex-model";
import { testScore, TEST_INPUT, measure, note } from "../piece-practice/continuous/continuous-test-fixtures";
import { acknowledgeRepertoire, freezeLessonRepertoire, selectLessonRepertoire } from "./practice-lesson-repertoire";
import type { RolodexEntry } from "../piece-practice/rolodex/rolodex-types";
import type { ContinuousAttempt } from "../piece-practice/continuous/continuous-types";
const preferences = { enabled: true, instruments: ["piano"] as const, message: "" };
const entry = () => createEntry(testScore(), "piano", 0, 1, 77);
const practiced = (value: RolodexEntry, endedAt: string, prescriptionRevision = value.prescriptionRevision): RolodexEntry => ({ ...value, lastPractice: { attemptId: "saved-attempt", endedAt, prescriptionRevision, outcome: "completed", instrument: "piano", inputSource: "physical-midi", inputId: "piano" } });
describe("supplementary Piano selection", () => {
  it("selects none when disabled or Piano preferences are off", () => {
    expect(selectLessonRepertoire([entry()], { ...preferences, enabled: false })).toBeNull();
    expect(selectLessonRepertoire([entry()], { ...preferences, instruments: ["violin", "ocarina"] })).toBeNull();
    expect(selectLessonRepertoire([], preferences)).toBeNull();
  });
  it.each(["violin", "ocarina"] as const)("excludes %s until explicitly eligible AND configured for Piano", instrument => {
    const source = createEntry(testScore(), instrument);
    expect(selectLessonRepertoire([source], preferences)).toBeNull();
    const eligible = editEntry(source, { eligibleInstruments: [instrument, "piano"] });
    expect(selectLessonRepertoire([eligible], preferences)).toBeNull();
    const piano = editEntry(eligible, { practiceInstrument: "piano" });
    expect(selectLessonRepertoire([piano], preferences)).toEqual(piano);
    expect(piano.score).toEqual(source.score);
  });
  it.each(["paused", "archived"] as const)("excludes %s entries", status => {
    expect(selectLessonRepertoire([{ ...entry(), status }], preferences)).toBeNull();
  });
  it("rejects unsupported notation without rewriting it", () => {
    const unsupported = createEntry(testScore("2/4"), "piano");
    expect(selectLessonRepertoire([unsupported], preferences)).toBeNull();
    expect(unsupported.score.initialTimeSignature).toBe("2/4");
  });
  it("rejects an incoming tie while allowing the unchanged complete tied passage", () => {
    const score = { ...testScore(), measures: [measure("m0", [note("a", 0, 60, "whole")]), measure("m1", [note("b", 0, 60, "whole")])],
      ties: [{ id: "tie", fromEventId: "a", fromPitchId: "a-p", toEventId: "b", toPitchId: "b-p" }] };
    const incoming = createEntry(score, "piano", 1, 1);
    expect(selectLessonRepertoire([incoming], preferences)).toBeNull();
    const complete = createEntry(score, "piano", 0, 1);
    expect(selectLessonRepertoire([complete], preferences)?.score).toEqual(score);
  });
  it("orders oldest practice-day cohorts before priority to avoid starvation", () => {
    const a = { ...entry(), id: "a", createdAt: "2026-10-19T12:00:00.000Z" }, b = { ...entry(), id: "b" };
    const recent = practiced(a, "2026-10-20T13:00:00.000Z");
    expect(selectLessonRepertoire([recent, b], preferences)?.id).toBe("b");
    expect(selectLessonRepertoire([b, { ...recent, priority: true }], preferences)?.id).toBe("b");
    expect(selectLessonRepertoire([b, a], preferences)?.id).toBe("a");
    expect(selectLessonRepertoire([{ ...b, id: "z" }, b], preferences)?.id).toBe("b");
    expect(selectLessonRepertoire([recent, practiced(b, "2026-10-20T12:00:00.000Z")], preferences)?.id).toBe("b");
  });
  it("gives no recency credit to older prescription evidence", () => {
    const a = { ...entry(), id: "a", prescriptionRevision: 2, revision: 2 };
    const b = { ...entry(), id: "b" };
    expect(selectLessonRepertoire([practiced(b, "2026-10-20T12:00:00.000Z"), practiced(a, "2026-10-20T14:00:00.000Z", 1)], preferences)?.id).toBe("a");
  });
  it("freezes full prescription independently of subsequent edits or deletion", () => {
    const original = entry(), selected = freezeLessonRepertoire(original, "lesson-occurrence");
    const replacement = editEntry(original, { bpm: 90, start: 1, end: 1 });
    expect(selected.entry).toEqual(original); expect(selected.entry).not.toBe(original);
    expect(selected.passage).toMatchObject({ score: original.score, start: 0, end: 1, bpm: 77, policy: original.policy });
    expect(selectLessonRepertoire([replacement], preferences)?.bpm).toBe(90);
    expect(selectLessonRepertoire([], preferences)).toBeNull(); expect(selected.passage.score).toEqual(original.score);
  });
  it("deduplicates Retry while retaining independent Replay attempts", () => {
    const occurrence = freezeLessonRepertoire(entry());
    const attempt: ContinuousAttempt = { version: 1, id: "a1", revision: 2, passage: occurrence.passage, input: TEST_INPUT, status: "completed", startedAt: "2026-10-20T12:00:00.000Z", endedAt: "2026-10-20T12:01:00.000Z", performanceStartedAt: "2026-10-20T12:00:04.000Z", observedThroughMs: 10000, reason: null, attacks: [], assessment: null, terminalSaveAttempts: 1 };
    const first = acknowledgeRepertoire([], attempt);
    expect(acknowledgeRepertoire(first, { ...attempt, terminalSaveAttempts: 2 })).toHaveLength(1);
    expect(acknowledgeRepertoire(first, { ...attempt, id: "replay" })).toHaveLength(2);
    expect(acknowledgeRepertoire([], { ...attempt, status: "started", endedAt: null })).toEqual([]);
  });
});
