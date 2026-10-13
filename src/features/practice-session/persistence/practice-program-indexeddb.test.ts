import { beforeEach, describe, expect, it } from "vitest";
import { FakeImprovIndexedDb } from "../../improv/persistence/improv-indexeddb-fake";
import { WEEKLY_PROGRAM_EXAMPLE } from "../import/practice-program-specification";
import { validatePracticeProgram } from "../practice-program-validation";
import type { PracticeProgramRevision } from "../practice-program-types";
import { IndexedDbPracticePrograms, PRACTICE_PROGRAM_DATABASE as DB } from "./practice-program-indexeddb";

function candidate(revision = 1, title: string = WEEKLY_PROGRAM_EXAMPLE.title, programId: string = WEEKLY_PROGRAM_EXAMPLE.programId): PracticeProgramRevision {
  const parsed = validatePracticeProgram({ ...WEEKLY_PROGRAM_EXAMPLE, revision, title, programId });
  if (!parsed.ok) throw Error(JSON.stringify(parsed.issues)); return parsed.value;
}
let fake: FakeImprovIndexedDb, store: IndexedDbPracticePrograms;
beforeEach(() => { fake = new FakeImprovIndexedDb(); store = new IndexedDbPracticePrograms(fake.factory); });
describe("weekly program immutable IndexedDB definitions", () => {
  it("reviews without saving and explicitly saves/reloads in a separate database", async () => {
    const value = candidate(); expect(await store.review(value)).toMatchObject({ kind: "new", currentRevision: null }); expect(await store.list()).toEqual([]);
    await store.save(value, null); store.close(); store = new IndexedDbPracticePrograms(fake.factory);
    expect(await store.list()).toEqual([value]); expect(fake.openedNames.every(name => name === DB)).toBe(true);
  });
  it("makes identical imports no-ops independent of key order or stale preview", async () => {
    const value = candidate(); await store.save(value, null); fake.commitError = "QuotaExceededError";
    expect(await store.review(value)).toMatchObject({ kind: "identical" }); fake.commitError = null;
    expect(await store.save(value, 999)).toMatchObject({ kind: "identical" }); expect(await store.revisions(value.programId)).toEqual([value]);
  });
  it("rejects same revision/different content without overwriting", async () => {
    const value = candidate(); await store.save(value, null);
    await expect(store.review(candidate(1, "Changed"))).rejects.toMatchObject({ reason: "conflict" });
    await expect(store.save(candidate(1, "Changed"), 1)).rejects.toMatchObject({ reason: "conflict" });
    expect(await store.list()).toEqual([value]);
  });
  it("requires explicit confirmation before advancing the head and retains all snapshots", async () => {
    const first = candidate(), next = candidate(2, "Revision two"); await store.save(first, null);
    expect(await store.review(next)).toMatchObject({ kind: "newer", currentRevision: 1 });
    await expect(store.save(next, 1)).rejects.toMatchObject({ reason: "confirmation-required" });
    await store.save(next, 1, true); expect(await store.list()).toEqual([next]); expect(await store.revisions(first.programId)).toEqual([first, next]);
    expect(await store.save(first, 1, true)).toMatchObject({ kind: "identical", currentRevision: 2 }); expect(await store.list()).toEqual([next]);
  });
  it("rejects missing older revisions rather than moving backward", async () => {
    await store.save(candidate(3), null); await expect(store.save(candidate(2), 3, true)).rejects.toMatchObject({ reason: "stale" });
  });
  it("serializes concurrent new imports and rejects stale conflicting writers", async () => {
    const other = new IndexedDbPracticePrograms(fake.factory);
    const results = await Promise.allSettled([store.save(candidate(), null), other.save(candidate(2), null, true)]);
    expect(results[0].status).toBe("fulfilled"); expect(results[1]).toMatchObject({ status: "rejected", reason: { reason: "stale" } });
    expect(await store.list()).toEqual([candidate()]);
  });
  it("rechecks revision changes between preview and save", async () => {
    await store.save(candidate(), null); const reviewed = await store.review(candidate(3));
    await new IndexedDbPracticePrograms(fake.factory).save(candidate(2), 1, true);
    await expect(store.save(reviewed.candidate, reviewed.currentRevision, true)).rejects.toMatchObject({ reason: "stale" });
    expect((await store.list())[0]?.revision).toBe(2);
  });
  it.each(["QuotaExceededError", "AbortError"])("rolls back revision and head on %s and allows retry", async name => {
    await store.save(candidate(), null); fake.commitError = name;
    await expect(store.save(candidate(2), 1, true)).rejects.toMatchObject({ reason: name === "QuotaExceededError" ? "quota" : "write-failed" });
    expect(await store.list()).toEqual([candidate()]); expect(await store.revisions(candidate().programId)).toEqual([candidate()]);
    await store.save(candidate(2), 1, true); expect((await store.list())[0]?.revision).toBe(2);
  });
  it("waits for transaction completion and isolates caller mutations", async () => {
    const value = candidate(), hold = fake.holdNextCommit(); const pending = store.save(value, null);
    let settled = false; void pending.then(() => { settled = true; });
    for (let i = 0; i < 100 && !hold.ready(); i++) await new Promise<void>(resolve => queueMicrotask(resolve));
    expect(hold.ready()).toBe(true); expect(settled).toBe(false);
    (value.program as { title: string }).title = "Mutated caller"; hold.release(); await pending;
    expect((await store.list())[0]?.program.title).toBe(WEEKLY_PROGRAM_EXAMPLE.title);
  });
  it("rolls back after the head request fails, including the earlier revision add", async () => {
    fake.requestError = { store: "programs", method: "put", name: "QuotaExceededError" };
    await expect(store.save(candidate(), null)).rejects.toMatchObject({ reason: "quota" }); expect(await store.list()).toEqual([]);
    expect(await store.revisions(candidate().programId)).toEqual([]);
  });
  it.each(["corrupt", "unsupported"])("does not overwrite %s saved rows", async reason => {
    await store.save(candidate(), null); const row = { ...candidate(), schemaVersion: reason === "unsupported" ? 2 : 0 };
    fake.set("revisions", [candidate().programId, 1], row, DB);
    await expect(store.list()).rejects.toMatchObject({ reason }); await expect(store.save(candidate(2), 1, true)).rejects.toMatchObject({ reason });
    expect(fake.get("revisions", [candidate().programId, 1], DB)).toEqual(row);
  });
  it("rejects corrupt native configurations and inconsistent heads", async () => {
    await store.save(candidate(), null); const row = candidate(); (row.nativeExercises[0]!.target as { count: number }).count = 1;
    fake.set("revisions", [row.programId, 1], row, DB); await expect(store.list()).rejects.toMatchObject({ reason: "corrupt" });
    fake.set("revisions", [row.programId, 1], candidate(), DB); fake.set("programs", row.programId, { schemaVersion: 1, programId: row.programId, revision: 2 }, DB);
    await expect(store.review(candidate(3))).rejects.toMatchObject({ reason: "corrupt" });
  });
  it("retains historically resolved native defaults without regenerating them", async () => {
    const value = candidate(); const first = value.nativeExercises[0]!; if (first.engine !== "flashcards") throw Error("fixture");
    (first.config as { replayCorrectVirtualChords: boolean }).replayCorrectVirtualChords = !first.config.replayCorrectVirtualChords;
    // A valid historical setting not exposed by interchange must survive unchanged.
    await store.save(value, null); expect(await store.list()).toEqual([value]);
    expect(await store.review(candidate())).toMatchObject({ kind: "identical", candidate: value });
  });
  it("rejects unavailable, blocked and newer databases without clearing anything", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "indexedDB"); Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: undefined });
    try { await expect(new IndexedDbPracticePrograms().list()).rejects.toMatchObject({ reason: "unavailable" }); }
    finally { if (descriptor) Object.defineProperty(globalThis, "indexedDB", descriptor); else Reflect.deleteProperty(globalThis, "indexedDB"); }
    fake.blocked = true; await expect(store.list()).rejects.toMatchObject({ reason: "blocked" }); fake.blocked = false;
    fake.openError = "VersionError"; await expect(store.list()).rejects.toMatchObject({ reason: "unsupported" }); fake.openError = null;
    expect(await store.list()).toEqual([]);
  });
  it("enforces storage limits without clearing existing programs", async () => {
    await store.list();
    for (let i = 0; i < 100; i++) { const row = candidate(1, "Program", `program-${i}`); fake.set("programs", row.programId, { schemaVersion: 1, programId: row.programId, revision: 1 }, DB); fake.set("revisions", [row.programId, 1], row, DB); }
    await expect(store.save(candidate(), null)).rejects.toMatchObject({ reason: "limit" }); expect(await store.list()).toHaveLength(100);
  });
  it("bounds revision history while still allowing existing-revision no-ops", async () => {
    await store.list(); const programId = candidate().programId;
    for (let i = 1; i <= 100; i++) fake.set("revisions", [programId, i], candidate(i), DB);
    fake.set("programs", programId, { schemaVersion: 1, programId, revision: 100 }, DB);
    await expect(store.save(candidate(101), 100, true)).rejects.toMatchObject({ reason: "limit" });
    expect(await store.save(candidate(1), 100)).toMatchObject({ kind: "identical", currentRevision: 100 }); expect(await store.revisions(programId)).toHaveLength(100);
  });
  it("rejects future current-head records and malformed database structure without repairs", async () => {
    await store.save(candidate(), null); const programId = candidate().programId, row = { schemaVersion: 2, programId, revision: 1 };
    fake.set("programs", programId, row, DB); await expect(store.list()).rejects.toMatchObject({ reason: "unsupported" }); expect(fake.get("programs", programId, DB)).toEqual(row);
    fake.databases.get(DB)!.schemas.get("revisions")!.indexes.delete("programId");
    await expect(new IndexedDbPracticePrograms(fake.factory).list()).rejects.toMatchObject({ reason: "corrupt" });
  });
  it("rejects use after close and invalid candidate identities", async () => {
    store.close(); await expect(store.list()).rejects.toMatchObject({ reason: "closed" });
    await expect(store.revisions("bad id")).rejects.toMatchObject({ reason: "corrupt" });
    await expect(store.save({ ...candidate(), programId: "mismatch" }, null)).rejects.toMatchObject({ reason: "corrupt" });
  });
});
