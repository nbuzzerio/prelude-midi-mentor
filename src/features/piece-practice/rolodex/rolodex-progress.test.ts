import { selectLessonRepertoire } from "../../practice-session/practice-lesson-repertoire";
import { describe, expect, it } from "vitest";
import { createEntry, editEntry, parseEntry } from "./rolodex-model";
import { testScore } from "../continuous/continuous-test-fixtures";
import { appendProgress, progressState, retentionDue, validateProgress, validateSummary } from "./rolodex-progress";
import type { RolodexRunSummary } from "./rolodex-progress-types";
import type { RolodexEntry } from "./rolodex-types";
import { attributeProgramCalendarStart } from "../../practice-session/practice-program-calendar";
import { comparableHistory } from "./rolodex-history";
import { parseBackup, prepareImport } from "./rolodex-backup";

function base() { return { ...createEntry(testScore(), "piano"), id: "passage" }; }
function run(id: number, determination: RolodexRunSummary["determination"] = "clean", day = 20): RolodexRunSummary {
  const startedAt = `2026-10-${day}T12:${String(id % 60).padStart(2, "0")}:00.000Z`;
  return { version: 1, cycle: null, attemptId: `run-${id}`, passageId: "passage", prescriptionRevision: 1, target: "a".repeat(64), instrument: "piano", mode: "continuous",
    inputSource: "physical-midi", inputId: "piano", bpm: 60, policy: base().policy, startedAt, endedAt: startedAt.replace(":00.000Z", ":10.000Z"), acknowledgedAt: startedAt.replace(":00.000Z", ":11.000Z"),
    calendar: attributeProgramCalendarStart({ year: 2026, month: 10, day, utcStartedAtMs: Date.parse(startedAt), timeZone: "UTC", utcOffsetMinutes: 0 }), endLocalDate: `2026-10-${day}`,
    outcome: determination === "inconclusive" ? "interrupted" : "completed", expected: 2, matched: determination === "non-clean" ? 1 : 2,
    onTime: determination === "non-clean" ? 1 : 2, wrong: 0, missing: determination === "non-clean" ? 1 : 0, extras: 0, early: 0, late: 0, uncertain: 0, unobserved: 0, unreliableAttacks: 0,
    determination, reasons: [], acceptance: { version: 1, generation: "accepted", enabled: true, acceptedAt: "2026-10-19T00:00:00.000Z", inputId: "piano", policy: base().policy }, restored: false };
}
const add = (e: RolodexEntry, s: RolodexRunSummary): RolodexEntry => ({ ...e, progress: appendProgress(e, s) });
const three = () => [run(1), run(2), run(3)].reduce(add, base());
describe("bounded, acknowledged Rolodex progression", () => {
  it("requires three distinct native performances and a later local day", () => {
    let e = add(base(), run(1)); expect(progressState(e)).toMatchObject({ stage: "improving", clean: [run(1)] });
    e = add(e, run(1)); expect(progressState(e).clean).toHaveLength(1);
    e = add(add(e, run(2)), run(3)); expect(progressState(e).stage).toBe("retention");
    expect(retentionDue(e, "2026-10-20", "UTC")).toBe(false); expect(retentionDue(e, "2026-10-21", "UTC")).toBe(true);
    expect(retentionDue(e, "2026-10-21", "UTC", { ...run(1).acceptance!, enabled: false })).toBe(false);
    expect(retentionDue(e, "2026-10-21", "UTC", { ...run(1).acceptance!, generation: "changed-context" })).toBe(false);
    e = add(e, run(4)); expect(progressState(e).stage).toBe("retention");
    expect(progressState(add(e, run(5, "clean", 21))).stage).toBe("mastered");
  });
  it("a confidently failed retention returns to active practice; inconclusive does not", () => {
    expect(progressState(add(three(), run(4, "non-clean", 21)))).toMatchObject({ stage: "needs-practice", clean: [] });
    expect(progressState(add(three(), run(4, "inconclusive", 21))).stage).toBe("retention");
  });
  it("a non-clean completed run interrupts the sequence, even when delivered late", () => {
    const e = add(add(base(), run(1)), run(3));
    expect(progressState(add(e, run(2, "non-clean"))).clean.map(s => s.attemptId)).toEqual(["run-3"]);
    const retired = add(three(), run(5, "clean", 21));
    expect(progressState(add(retired, run(4, "non-clean"))).stage).toBe("improving");
  });
  it.each(["stopped", "interrupted", "failed"] as const)("%s evidence does not erase credit", outcome => {
    const e = add(add(base(), run(1)), { ...run(2, "inconclusive"), outcome });
    expect(progressState(e).clean).toHaveLength(1);
  });
  it("uncertain complete performances do not erase credit", () => {
    const s = { ...run(2), onTime: 1, uncertain: 1, determination: "inconclusive" as const };
    expect(progressState(add(add(base(), run(1)), s)).clean).toHaveLength(1);
  });
  it("no provisional result is retroactively promoted by a later accepted attempt", () => {
    let e = [1, 2, 3].reduce((e, id) => add(e, { ...run(id), acceptance: null }), base());
    expect(progressState(e).clean).toHaveLength(0);
    e = add(e, run(4)); expect(progressState(e).clean).toHaveLength(1);
  });
  it("different accepted device or acceptance generation begins a new context", () => {
    for (const s of [{ ...run(4), inputId: "other", acceptance: { ...run(4).acceptance!, inputId: "other" } }, { ...run(4), acceptance: { ...run(4).acceptance!, generation: "new" } }]) {
      expect(progressState(add(three(), s)).clean).toHaveLength(1);
    }
  });
  it("tempo, range and instrument permission changes never inherit qualification", () => {
    const e = three();
    for (const changes of [{ bpm: 80 }, { start: 1 }, { eligibleInstruments: ["piano", "violin"] as const }, { eligibleInstruments: ["violin"] as const, practiceInstrument: "violin" as const }]) {
      const edited = editEntry(e, changes); expect(progressState(edited).clean).toHaveLength(0); expect(edited.progress!.recent).toEqual(e.progress!.recent);
    }
    expect(progressState(editEntry(e, { nickname: "Keep music" })).clean).toHaveLength(3);
  });
  it("retains decisive summaries through more than 64 subsequent inconclusive runs", () => {
    let e = three();
    for (let id = 4; id < 80; id++) { const s = run(id, "inconclusive", id < 60 ? 21 : 22); e = add(e, s); }
    expect(e.progress!.recent).toHaveLength(32); expect(e.progress!.pinned).toHaveLength(3);
    expect(progressState(e).stage).toBe("retention");
    expect(add(e, run(1)).progress).toEqual(e.progress);
    expect(add(e, run(4, "inconclusive", 21)).progress).toEqual(e.progress);
  });
  it("a delayed conclusive contradiction invalidates pinned credit even after compaction", () => {
    let e = three();
    for (let id = 4; id < 50; id++) e = add(e, run(id, "inconclusive", 21));
    const late = { ...run(2, "non-clean"), attemptId: "zzz-between-2-and-3" };
    const updated = add(e, late);
    expect(progressState(updated).clean.map(s => s.attemptId)).toEqual(["run-3"]);
    expect(add(updated, late).progress).toEqual(updated.progress);
  });
  it("manual reactivation keeps history but starts a fresh cycle", () => {
    const e = add(three(), run(4, "clean", 21));
    const reset = { ...e, progress: { ...e.progress!, resetAt: "2026-10-21T23:00:00.000Z", cycle: "2026-10-21T23:00:00.000Z" } };
    expect(progressState(reset).stage).toBe("needs-practice"); expect(reset.progress.recent).toHaveLength(4);
    expect(progressState(add(reset, { ...run(5, "clean", 22), cycle: reset.progress.cycle })).clean).toHaveLength(1);
  });
  it("reactivation is an explicit cycle, not an assumption that the wall clock only moves forward", () => {
    const retired = add(three(), run(4, "clean", 21));
    const reset = { ...retired, progress: { ...retired.progress!, resetAt: "2026-10-19T23:00:00.000Z", cycle: "2026-10-19T23:00:00.000Z" } };
    expect(progressState(reset).clean).toHaveLength(0);
    expect(progressState(add(reset, { ...run(5), cycle: reset.progress.cycle })).clean).toHaveLength(1);
  });
  it("holds midnight-crossing completion until a day after completion", () => {
    const s = { ...run(3), endedAt: "2026-10-21T00:00:10.000Z", endLocalDate: "2026-10-21" };
    const e = [run(1), run(2), s].reduce(add, base());
    expect(progressState(add(e, run(4, "clean", 21))).stage).toBe("retention");
    expect(progressState(add(e, run(5, "clean", 22))).stage).toBe("mastered");
  });
  it("changing timezone does not manufacture a retention day", () => {
    const s = run(4, "clean", 21);
    const changed = { ...s, calendar: { ...s.calendar!, timeZone: "America/New_York" } };
    expect(progressState(add(three(), changed)).stage).toBe("retention");
    expect(retentionDue(three(), "2026-10-21", "America/New_York")).toBe(false);
  });
  it("DST offsets do not impose an arbitrary 24-hour waiting period", () => {
    const make = (id: number, day: number, offset: number) => {
      const s = run(id), startedAt = `2026-11-0${day}T12:00:00.000Z`;
      return { ...s, startedAt, endedAt: startedAt, endLocalDate: `2026-11-0${day}`,
        calendar: attributeProgramCalendarStart({ year: 2026, month: 11, day, utcStartedAtMs: Date.parse(startedAt), timeZone: "America/New_York", utcOffsetMinutes: offset }) };
    };
    const e = [make(1, 1, -240), make(2, 1, -240), make(3, 1, -240)].reduce(add, base());
    expect(progressState(add(e, make(4, 2, -300))).stage).toBe("mastered");
  });
  it("rejects invalid counts, unsupported progress and corrupt acceptance", () => {
    expect(() => validateSummary({ ...run(1), matched: 9 })).toThrow();
    expect(() => validateProgress({ ...three().progress!, version: 99 } as never)).toThrow();
    expect(() => validateSummary({ ...run(1), acceptance: { ...run(1).acceptance!, inputId: "wrong" } })).toThrow();
  });
  it("reads schema-1 records without creating measured credit", () => {
    const e = base(); const legacy = { ...e, schemaVersion: 1, status: "improving" }; delete legacy.progress;
    const normalized = parseEntry(legacy); expect(normalized.schemaVersion).toBe(2); expect(normalized.status).toBe("improving"); expect(progressState(normalized).clean).toHaveLength(0);
    expect(legacy.schemaVersion).toBe(1);
  });
  it("backs up historical retirement without importing acceptance or awarding new runs", () => {
    const e = add(three(), run(4, "clean", 21));
    const restored = parseBackup(JSON.stringify({ format: "prelude-practice-rolodex", version: 2, entries: [e] }))[0]!;
    expect(restored.lastPractice).toBeNull(); expect(progressState(restored)).toMatchObject({ stage: "mastered", restored: true });
    expect(restored.progress!.recent.every(s => s.restored)).toBe(true);
    expect(progressState(add(restored, run(5, "clean", 22))).clean).toHaveLength(1);
    const remapped = prepareImport([restored], [editEntry(e, { bpm: 80 })], true).entries[0]!;
    expect(progressState(remapped).clean).toHaveLength(0); expect(remapped.progress!.recent.every(s => s.restored)).toBe(true);
  });
  it("selects due retention before priority and omits all-mastered/paused pools", () => {
    const due = three(), alternative = { ...base(), id: "alternative", priority: true };
    const prefs = { enabled: true, instruments: ["piano"] as const, message: "" };
    // Use the captured local zone so this also runs outside UTC.
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const local = { ...due, progress: { ...due.progress!, recent: due.progress!.recent.map(s => ({ ...s, calendar: { ...s.calendar!, timeZone: zone } })), pinned: due.progress!.pinned.map(s => ({ ...s, calendar: { ...s.calendar!, timeZone: zone } })) } };
    expect(selectLessonRepertoire([alternative, local], prefs, new Date(2026, 9, 22).getTime())?.id).toBe(due.id);
    const retired = add(three(), run(4, "clean", 21));
    expect(selectLessonRepertoire([retired, { ...alternative, status: "paused" }], prefs)).toBeNull();
  });
  it("compares actual counts while excluding different-device fine timing", () => {
    expect(comparableHistory(base())).toEqual(["Not enough comparable practice history yet."]);
    let e = add(add(base(), run(1, "non-clean")), run(2));
    expect(comparableHistory(e)[0]).toContain("correct pitches 1 → 2"); expect(comparableHistory(e)[1]).toContain("on-time pitches 1 → 2");
    e = add(e, { ...run(3), inputId: "other", acceptance: null }); expect(comparableHistory(e)[1]).toContain("unavailable");
  });
});
