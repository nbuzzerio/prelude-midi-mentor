import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEntry, editEntry } from "./rolodex-model";
import { checkLimits, planImport, planSave, rolodexStore, savePhysicalAcceptance, reactivateRolodex, ROLODEX_DB } from "./rolodex-store";
import { FakeImprovIndexedDb } from "../../improv/persistence/improv-indexeddb-fake";
import { playablePassage } from "./rolodex-model";
import { summarizeAcknowledged } from "./rolodex-qualification";
import { assessContinuous } from "../continuous/continuous-assessment";
import { attack, TEST_INPUT } from "../continuous/continuous-test-fixtures";
import { programCalendarNow } from "../../practice-session/practice-program-attempt";
import { attributeProgramCalendarStart } from "../../practice-session/practice-program-calendar";
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
    expect(() => planImport([], [a, { ...b, schemaVersion: 99 } as unknown as typeof b])).toThrow();
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

describe("Rolodex progress transaction acknowledgements", () => {
  let fake: FakeImprovIndexedDb;
  beforeEach(() => { fake = new FakeImprovIndexedDb(); vi.stubGlobal("indexedDB", fake.factory); });
  afterEach(() => vi.unstubAllGlobals());
  async function fixture(id = "native-1", calendar = programCalendarNow(Date.parse("2026-10-20T12:00:00.000Z"))) {
    const entry = createEntry(testScore(), "piano"), passage = playablePassage(entry);
    const startedAt = "2026-10-20T12:00:00.000Z", endedAt = "2026-10-20T12:01:00.000Z";
    const attacks = [attack(1, 60, 0), attack(2, 62, passage.measureMs)];
    const gate = { version: 1 as const, generation: "explicit-owner", enabled: true, acceptedAt: "2026-10-19T12:00:00.000Z", inputId: "piano", policy: entry.policy };
    await rolodexStore.save(entry, null); await savePhysicalAcceptance(gate, null);
    const summary = await summarizeAcknowledged(entry, { version: 1, id, revision: 2, passage, input: TEST_INPUT, status: "completed", startedAt, endedAt,
      performanceStartedAt: startedAt, observedThroughMs: passage.durationMs + passage.tailMs, attacks, assessment: assessContinuous(passage, attacks), reason: null, terminalSaveAttempts: 1 },
    calendar, calendar.localDate, gate, endedAt);
    return { entry, summary, gate, practice: { attemptId: id, prescriptionRevision: 1, endedAt, outcome: "completed" as const, instrument: "piano" as const, inputSource: "physical-midi" as const, inputId: "piano", summary } };
  }
  it("does not write an acceptance setting merely by reading", async () => {
    expect((await rolodexStore.list()).acceptance).toBeNull();
    expect(fake.get("settings", "physical-acceptance", ROLODEX_DB)).toBeUndefined();
  });
  it("waits for transaction completion, then deduplicates the same native result", async () => {
    const f = await fixture(), hold = fake.holdNextCommit(); let acknowledged = false;
    const writing = rolodexStore.acknowledge(f.entry.id, f.practice).then(() => { acknowledged = true; });
    await vi.waitFor(() => expect(hold.ready()).toBe(true)); expect(acknowledged).toBe(false);
    expect((fake.get("passages", f.entry.id, ROLODEX_DB) as typeof f.entry).progress!.recent).toHaveLength(0);
    hold.release(); await writing;
    await rolodexStore.acknowledge(f.entry.id, f.practice);
    expect((await rolodexStore.list()).entries[0]!.progress!.recent).toHaveLength(1);
  });
  it("quota failure preserves previous evidence and Retry uses the same identity", async () => {
    const f = await fixture(); fake.commitError = "QuotaExceededError";
    await expect(rolodexStore.acknowledge(f.entry.id, f.practice)).rejects.toThrow();
    expect((await rolodexStore.list()).entries[0]!.progress!.recent).toHaveLength(0);
    await rolodexStore.acknowledge(f.entry.id, f.practice);
    expect((await rolodexStore.list()).entries[0]!.progress!.recent.map(s => s.attemptId)).toEqual([f.practice.attemptId]);
  });
  it("concurrent metadata and distinct performances are preserved without stale overwrite", async () => {
    const f = await fixture(); await rolodexStore.save(editEntry(f.entry, { nickname: "Owner change" }), f.entry.revision);
    await Promise.all([rolodexStore.acknowledge(f.entry.id, f.practice), rolodexStore.acknowledge(f.entry.id, { ...f.practice, attemptId: "replay", summary: { ...f.summary, attemptId: "replay" } })]);
    const saved = (await rolodexStore.list()).entries[0]!;
    expect(saved.nickname).toBe("Owner change"); expect(saved.progress!.recent).toHaveLength(2);
    await expect(rolodexStore.save(editEntry(f.entry, { nickname: "Stale" }), f.entry.revision)).rejects.toThrow(/another tab/);
  });
  it("a concurrent acceptance change cannot promote an already captured result", async () => {
    const f = await fixture(); await savePhysicalAcceptance({ ...f.gate, enabled: false, generation: "disabled" }, f.gate.generation);
    await rolodexStore.acknowledge(f.entry.id, f.practice);
    expect((await rolodexStore.list()).entries[0]!.progress!.recent[0]!.acceptance).toBeNull();
    await expect(savePhysicalAcceptance({ ...f.gate, generation: "stale" }, f.gate.generation)).rejects.toThrow(/another tab/);
  });
  it("rejects a reused passage identity with different frozen music", async () => {
    const f = await fixture();
    const replacement = { ...createEntry({ ...f.entry.score, title: "Different snapshot" }, "piano"), id: f.entry.id };
    fake.set("passages", f.entry.id, replacement, ROLODEX_DB);
    await expect(rolodexStore.acknowledge(f.entry.id, f.practice)).rejects.toThrow(/musical target differs/);
    expect((await rolodexStore.list()).entries[0]!.progress!.recent).toHaveLength(0);
  });
  it("failed reactivation leaves the original progress intact and retries idempotently", async () => {
    // UTC hosts produce -0 when programCalendarNow negates getTimezoneOffset().
    // The existing JSON record boundary canonicalizes it to 0. Reactivation must
    // preserve the acknowledged record, not the pre-validation input object.
    const calendar = attributeProgramCalendarStart({ year: 2026, month: 10, day: 20,
      utcStartedAtMs: Date.parse("2026-10-20T12:00:00.000Z"), timeZone: "UTC", utcOffsetMinutes: -0 });
    const f = await fixture("native-1", calendar); await rolodexStore.acknowledge(f.entry.id, f.practice);
    const previous = (await rolodexStore.list()).entries[0]!, at = "2026-10-21T12:00:00.000Z";
    expect(f.summary.calendar!.utcOffsetMinutes).toBe(-0);
    expect(previous.progress!.recent).toEqual([{ ...f.summary, calendar: { ...calendar, utcOffsetMinutes: 0 } }]);
    fake.commitError = "QuotaExceededError"; await expect(reactivateRolodex(previous.id, previous.revision, at)).rejects.toThrow();
    expect((await rolodexStore.list()).entries[0]).toEqual(previous);
    await reactivateRolodex(previous.id, previous.revision, at); await reactivateRolodex(previous.id, previous.revision, at);
    expect((await rolodexStore.list()).entries[0]!.progress).toMatchObject({ resetAt: at, recent: previous.progress!.recent });
    expect(f.summary.calendar!.utcOffsetMinutes).toBe(-0);
  });
  it("corrupt settings and progress remain preserved and block overwriting writes", async () => {
    const f = await fixture(); fake.set("settings", "physical-acceptance", { id: "physical-acceptance", acceptance: { version: 99 } }, ROLODEX_DB);
    await expect(rolodexStore.list()).rejects.toThrow(/acceptance/);
    expect(fake.get("settings", "physical-acceptance", ROLODEX_DB)).toEqual({ id: "physical-acceptance", acceptance: { version: 99 } });
    fake.set("settings", "physical-acceptance", { id: "physical-acceptance", acceptance: f.gate }, ROLODEX_DB);
    fake.set("passages", f.entry.id, { ...f.entry, progress: { version: 99 } }, ROLODEX_DB);
    expect((await rolodexStore.list()).unavailableCount).toBe(1);
    await expect(rolodexStore.acknowledge(f.entry.id, f.practice)).rejects.toThrow(/progress/);
  });
});
