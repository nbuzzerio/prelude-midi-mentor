import { beforeEach, describe, expect, it } from "vitest";
import { FakeImprovIndexedDb } from "../../improv/persistence/improv-indexeddb-fake";
import { testAttempt, testSkip, testWallTime, testOwnership } from "../practice-program-test-fixtures";
import { IndexedDbPracticeAttempts, PRACTICE_ATTEMPT_DATABASE as DB } from "./practice-attempt-indexeddb";
import { PracticeAttemptOwnership } from "./practice-attempt-ownership";
let fake: FakeImprovIndexedDb, store: IndexedDbPracticeAttempts;
beforeEach(() => { fake = new FakeImprovIndexedDb(); store = new IndexedDbPracticeAttempts(fake.factory); });
describe("durable weekly attempt checkpoints", () => {
  it("acknowledges start before terminal writes and reloads both exactly", async () => {
    const start = testAttempt(), terminal = { ...start, writeVersion: 1, closed: true, outcome: "completed" as const, prescribedUnits: 1, endedAt: start.updatedAt };
    await expect(store.save(terminal, 0)).rejects.toMatchObject({ reason: "conflict" }); await store.save(start, null); await store.save(terminal, 0);
    store.close(); expect(await new IndexedDbPracticeAttempts(fake.factory).list(start.programId)).toEqual([terminal]); expect(fake.openedNames.every(name => name === DB)).toBe(true);
  });
  it("makes retrying identical writes a no-op and fences duplicate/stale completion", async () => {
    const start = testAttempt(); await store.save(start, null); await store.save(start, null);
    const stopped = { ...start, writeVersion: 1, closed: true, outcome: "stopped-early" as const, endedAt: start.updatedAt };
    await store.save(stopped, 0); expect(await store.save(stopped, 0)).toEqual(stopped);
    await expect(store.save({ ...stopped, writeVersion: 2 }, 1)).rejects.toMatchObject({ reason: "conflict" });
  });
  it("serializes concurrent versions and never overwrites identity/configuration", async () => {
    const start = testAttempt(); await store.save(start, null); const next = { ...start, writeVersion: 1, activeDurationMs: 500, prescribedDurationMs: 500 };
    const result = await Promise.allSettled([store.save(next, 0), new IndexedDbPracticeAttempts(fake.factory).save({ ...next, activeDurationMs: 600, prescribedDurationMs: 600 }, 0)]);
    expect(result.filter(item => item.status === "fulfilled")).toHaveLength(1);
    await expect(store.save({ ...next, writeVersion: 2, programRevision: 2 }, 1)).rejects.toMatchObject({ reason: "conflict" });
    await expect(store.save({ ...next, writeVersion: 2, ownerId: "other" }, 1)).rejects.toMatchObject({ reason: "conflict" });
  });
  it("stores explicit skips without an attempt and rejects duplicated occurrence starts", async () => {
    const skip = testSkip(), start = testAttempt(); await store.save(skip, null); await store.save(start, null);
    await expect(store.save({ ...start, recordId: "other", attemptId: "other" }, null)).rejects.toMatchObject({ reason: "storage" });
    expect(await store.list(start.programId)).toHaveLength(2);
  });
  it.each(["QuotaExceededError", "AbortError"])("retains last durable checkpoint after %s and permits retry", async name => {
    const start = testAttempt(); await store.save(start, null); const next = { ...start, writeVersion: 1, activeDurationMs: 500, prescribedDurationMs: 500 };
    fake.commitError = name; await expect(store.save(next, 0)).rejects.toMatchObject({ reason: "storage" }); expect(await store.list(start.programId)).toEqual([start]); await store.save(next, 0);
  });
  it("rejects corrupt/future rows without clearing or changing them", async () => {
    const start = testAttempt(); await store.save(start, null); const future = { ...start, schemaVersion: 2 }; fake.set("records", start.recordId, future, DB);
    await expect(store.list(start.programId)).rejects.toMatchObject({ reason: "corrupt" }); await expect(store.save({ ...start, writeVersion: 1 }, 0)).rejects.toMatchObject({ reason: "corrupt" }); expect(fake.get("records", start.recordId, DB)).toEqual(future);
  });
  it("waits for transaction completion and isolates caller objects", async () => {
    const start = testAttempt(), hold = fake.holdNextCommit(); let acknowledged = false; const pending = store.save(start, null).then(() => { acknowledged = true; });
    for (let i = 0; i < 100 && !hold.ready(); i++) await new Promise<void>(resolve => queueMicrotask(resolve)); expect(hold.ready()).toBe(true); expect(acknowledged).toBe(false);
    (start.exercise as { label: string }).label = "Changed caller"; hold.release(); await pending; expect((await store.list(start.programId))[0]?.exercise.label).not.toBe("Changed caller");
  });
  it("recovers abandoned starts as interrupted, retaining the last durable progress", async () => {
    const start = { ...testAttempt(), prescribedDurationMs: 1000, activeDurationMs: 1000 }; await store.save(start, null);
    const rows = await testOwnership().recover(store, start.programId, testWallTime + 2000);
    expect(rows[0]).toMatchObject({ kind: "attempt", outcome: "interrupted", closed: true, activeDurationMs: 1000, writeVersion: 1 });
  });
  it("does not interrupt another tab's live attempt and retains completed boundary outcome on recovery", async () => {
    const start = testAttempt(), ownership = testOwnership(), release = await ownership.acquire(start.attemptId); await store.save(start, null);
    expect((await ownership.recover(store, start.programId, testWallTime + 2000))[0]).toMatchObject({ closed: false });
    await store.save({ ...start, writeVersion: 1, outcome: "completed", prescribedUnits: 1 }, 0); release!();
    expect((await ownership.recover(store, start.programId, testWallTime + 3000))[0]).toMatchObject({ outcome: "completed", closed: true });
  });
  it("uses a conservative lease fallback where Web Locks are unavailable", async () => {
    const start = testAttempt(), ownership = new PracticeAttemptOwnership(null); await store.save(start, null);
    expect((await ownership.recover(store, start.programId, testWallTime + 1000))[0]).toMatchObject({ closed: false });
    expect((await ownership.recover(store, start.programId, testWallTime + 31000))[0]).toMatchObject({ outcome: "interrupted" });
  });
  it("keeps attempts bounded without silently deleting old rows", async () => {
    const start = testAttempt(); await store.list(start.programId);
    for (let i = 0; i < 10000; i++) fake.set("records", `old-${i}`, { ...start, recordId: `old-${i}`, attemptId: `old-${i}`, occurrenceId: `old-${i}` }, DB);
    await expect(store.save(start, null)).rejects.toMatchObject({ reason: "limit" }); expect(fake.databases.get(DB)!.tables.get("records")!.size).toBe(10000);
  });
  it("reports blocked/newer/closed database errors without touching definitions", async () => {
    fake.blocked = true; await expect(store.list("program")).rejects.toMatchObject({ reason: "storage" }); fake.blocked = false; fake.openError = "VersionError"; await expect(store.list("program")).rejects.toMatchObject({ reason: "storage" }); fake.openError = null; store.close(); await expect(store.list("program")).rejects.toMatchObject({ reason: "closed" });
  });
  it("retains immutable prescribed boundary metrics when Bonus updates observed totals", async () => {
    const start = testAttempt(); await store.save(start, null);
    const metric = { schemaVersion: 1 as const, engine: "flashcards" as const, completedUnits: 1, incorrectResponses: 0, firstTryUnits: 1, averageResponseDurationMs: 400, completedRepertoire: null, sources: ["midi"] as const, pitchPercent: null, timingPercent: null, movementPercent: null };
    const boundary = { ...start, writeVersion: 1, outcome: "completed" as const, prescribedUnits: 1, targetMetrics: metric, metrics: metric }; await store.save(boundary, 0);
    const bonus = { ...boundary, writeVersion: 2, bonusUnits: 1, metrics: { ...metric, completedUnits: 2, firstTryUnits: 2, averageResponseDurationMs: 500 } }; await store.save(bonus, 1);
    await expect(store.save({ ...bonus, writeVersion: 3, targetMetrics: { ...metric, averageResponseDurationMs: 500 } }, 2)).rejects.toMatchObject({ reason: "conflict" }); expect((await store.list(start.programId))[0]).toMatchObject({ targetMetrics: metric, bonusUnits: 1 });
  });
});
