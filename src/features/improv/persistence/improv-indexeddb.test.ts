import { describe, expect, it } from "vitest";
import { createImprovTakeRecorder } from "../improv-take-recorder";
import type { RawMidiMessage } from "@/lib/midi/midi-transport";
import { IMPROV_LIBRARY_LIMITS as L, type ImprovCheckpoint, type ImprovStoredTake } from "../improv-library";
import { IndexedDbImprovLibrary, IMPROV_DB_NAME } from "./improv-indexeddb";
import { FakeImprovIndexedDb } from "./improv-indexeddb-fake";

const input = { id: "piano", name: "Room piano" };
const context = { ownerId: "owner", clockId: "document", timeOriginMs: 1_000_000 };
const observation = (atMs: number) => ({ atMs, context });
const message = (sequence: number, bytes: number[] | null = [0x90, 60, 99], sourceTimeStampMs: number | null = 110): RawMidiMessage => ({
  provenance: "browser-midi-message", sequence, input, bytes, dataStatus: bytes === null ? "unreadable" : "available", sourceTimeStampMs, receivedAtMs: 120,
});
function recorder(id = "take-1") { const rec = createImprovTakeRecorder({ createId: () => id }); rec.start(input, observation(100)); return rec; }
async function fixture() {
  const fake = new FakeImprovIndexedDb(); let wall = 1000;
  const open = () => new IndexedDbImprovLibrary({ factory: fake.factory, now: () => wall });
  const lib = open(); await lib.createCollection("piece", "Disney book", "first-take-sight-reading");
  const rec = recorder(); const take = await lib.allocateTake("piece", rec.metadata()!, "writer");
  return { fake, lib, rec, take, open, setWall: (value: number) => { wall = value; } };
}
let operation = 0;
function checkpoint(rec: ReturnType<typeof recorder>, take: ImprovStoredTake, overrides: Partial<ImprovCheckpoint> = {}): ImprovCheckpoint {
  return { takeId: take.takeId, writerToken: take.writerToken, expectedRevision: take.revision, operationId: `operation-${++operation}`,
    capture: rec.metadata()!, events: rec.readEvents(take.committedEventWatermark, 256), connections: rec.readConnections(),
    finalize: rec.metadata()?.status !== "recording", captureFailure: null, ...overrides };
}

describe("Improv allocation, first-take identity and explicit deletion", () => {
  it("allocates empty Take 1 only after Start, then subsequent numbered takes", async () => {
    const fake = new FakeImprovIndexedDb(); const lib = new IndexedDbImprovLibrary({ factory: fake.factory, now: () => 1000 });
    await lib.createCollection("piece", "Book", "first-take-sight-reading");
    expect((await lib.listCollections())[0]).toMatchObject({ firstTakeId: null, nextTakeNumber: 1 });
    const first = recorder(); const one = await lib.allocateTake("piece", first.metadata()!, "one"); first.stop(observation(500));
    await lib.checkpoint(checkpoint(first, one));
    const second = recorder("take-2"); second.interrupt("background", observation(200));
    const two = await lib.allocateTake("piece", second.metadata()!, "two"); await lib.checkpoint(checkpoint(second, two));
    expect((await lib.listTakes("piece")).map((t) => t.number)).toEqual([1, 2]);
    expect((await lib.listCollections())[0]).toMatchObject({ firstTakeId: "take-1", nextTakeNumber: 3 });
    expect((await lib.loadTake("take-1")).record.status).toBe("completed");
    expect((await lib.loadTake("take-2")).record.status).toBe("interrupted");
  });
  it("preserves an interrupted empty first capture", async () => {
    const f = await fixture(); f.rec.interrupt("consumer-lost", observation(100));
    const saved = await f.lib.checkpoint(checkpoint(f.rec, f.take));
    expect(saved).toMatchObject({ number: 1, status: "interrupted", committedEventWatermark: 0, chunkCount: 0 });
  });
  it("serializes cross-tab allocation and does not reuse a retried Start", async () => {
    const f = await fixture(); const other = f.open();
    const a = recorder("a"); const b = recorder("b");
    const allocated = await Promise.all([f.lib.allocateTake("piece", a.metadata()!, "a"), other.allocateTake("piece", b.metadata()!, "b")]);
    expect(allocated.map((t) => t.number)).toEqual([2, 3]);
    expect((await other.allocateTake("piece", a.metadata()!, "a")).number).toBe(2);
    expect((await f.lib.listCollections())[0].nextTakeNumber).toBe(4);
    await expect(other.allocateTake("piece", a.metadata()!, "different")).rejects.toMatchObject({ reason: "collision" });
  });
  it("renames collection metadata without touching recorded evidence", async () => {
    const f = await fixture(); f.rec.append(message(1), context); f.rec.stop(observation(300));
    await f.lib.checkpoint(checkpoint(f.rec, f.take)); const before = await f.lib.loadTake("take-1");
    const collection = (await f.lib.listCollections())[0];
    await f.lib.renameCollection("piece", "New title", collection.revision);
    expect(await f.lib.loadTake("take-1")).toEqual(before);
    await expect(f.lib.renameCollection("piece", "Old tab", collection.revision)).rejects.toMatchObject({ reason: "stale" });
  });
  it("deletes evidence with confirmation, preserves original-first identity and never reuses IDs/numbers", async () => {
    const f = await fixture(); f.rec.append(message(1), context); f.rec.stop(observation(200));
    const saved = await f.lib.checkpoint(checkpoint(f.rec, f.take));
    await expect(f.lib.deleteTake(saved.takeId, { takeId: "wrong", revision: saved.revision, confirmed: true })).rejects.toMatchObject({ reason: "confirmation-required" });
    await expect(f.lib.deleteTake(saved.takeId, { takeId: saved.takeId, revision: 1, confirmed: true })).rejects.toMatchObject({ reason: "stale" });
    await f.lib.deleteTake(saved.takeId, { takeId: saved.takeId, revision: saved.revision, confirmed: true });
    await expect(f.lib.loadTake(saved.takeId)).rejects.toMatchObject({ reason: "not-found" });
    expect(f.fake.get("eventChunks", [saved.takeId, 0])).toBeUndefined();
    const next = recorder("take-2"); expect((await f.lib.allocateTake("piece", next.metadata()!, "next")).number).toBe(2);
    expect((await f.lib.listCollections())[0].firstTakeId).toBe("take-1");
    expect((await f.lib.listTakes("piece"))[0].kind).toBe("deleted-take");
    await expect(f.lib.allocateTake("piece", recorder().metadata()!, "writer")).rejects.toMatchObject({ reason: "not-found" });
  });
  it("protects active takes and collections even from the old tab's delete confirmation", async () => {
    const f = await fixture(); const collection = (await f.lib.listCollections())[0];
    await expect(f.open().deleteTake("take-1", { takeId: "take-1", revision: 1, confirmed: true })).rejects.toMatchObject({ reason: "owned" });
    await expect(f.lib.deleteCollection("piece", { collectionId: "piece", revision: collection.revision, confirmed: true })).rejects.toMatchObject({ reason: "owned" });
  });
  it("atomically deletes a collection's evidence but preserves identity tombstones", async () => {
    const f = await fixture(); f.rec.append(message(1), context); f.rec.stop(observation(200));
    await f.lib.checkpoint(checkpoint(f.rec, f.take)); const collection = (await f.lib.listCollections())[0];
    f.fake.requestError = { store: "takes", method: "put", name: "AbortError" };
    await expect(f.lib.deleteCollection("piece", { collectionId: "piece", revision: collection.revision, confirmed: true })).rejects.toMatchObject({ reason: "write-failed" });
    expect(await f.lib.listCollections()).toHaveLength(1); expect((await f.lib.loadTake("take-1")).chunks).toHaveLength(1);
    await f.lib.deleteCollection("piece", { collectionId: "piece", revision: collection.revision, confirmed: true });
    expect(await f.lib.listCollections()).toEqual([]); expect(f.fake.get("eventChunks", ["take-1", 0])).toBeUndefined();
    await expect(f.lib.createCollection("piece", "Recreated", "free-improvisation")).rejects.toMatchObject({ reason: "collision" });
  });
  it("returns bounded pages of collections and numbered takes", async () => {
    const f = await fixture(); await f.lib.createCollection("z", "Jam", "free-improvisation");
    expect((await f.lib.listCollections("piece", 1)).map((c) => c.collectionId)).toEqual(["z"]);
    for (const id of ["z-take", "a-take"]) await f.lib.allocateTake("piece", recorder(id).metadata()!, id);
    expect((await f.lib.listTakes("piece", 1, 1)).map((t) => t.number)).toEqual([2]);
    await expect(f.lib.listTakes("piece", 0, 101)).rejects.toMatchObject({ reason: "limit" });
  });
  it("refuses exhausted numbering without eviction or reuse", async () => {
    const f = await fixture(); const collection = (await f.lib.listCollections())[0];
    f.fake.set("collections", "piece", { ...collection, nextTakeNumber: L.takesPerCollection + 1 });
    await expect(f.lib.allocateTake("piece", recorder("new").metadata()!, "new")).rejects.toMatchObject({ reason: "limit" });
    expect((await f.lib.loadTake("take-1")).record.number).toBe(1);
  });
});

describe("Improv chunks, durable acknowledgment, ownership and recovery", () => {
  it("preserves bytes, repeated CC64, encodings, channels, nonfinite and unavailable times across reopen", async () => {
    const f = await fixture();
    const times = [NaN, Infinity, -Infinity, null, 110, 110, 90];
    const values = [[0x95, 60, 99], [0x95, 60, 0], [0x85, 60, 45], [0xb5, 64, 63], [0xb5, 64, 63], [0xf8], []];
    times.forEach((time, i) => f.rec.append(message(i + 5, values[i], time), context));
    f.rec.append({ ...message(12, null), receivedAtMs: NaN }, context);
    f.rec.stop(observation(200)); await f.lib.checkpoint(checkpoint(f.rec, f.take)); f.lib.close();
    const loaded = await f.open().loadTake("take-1");
    expect(loaded.chunks[0].events).toEqual(f.rec.snapshot()?.events);
    expect(loaded.chunks[0].events.map((e) => e.raw.sourceTimeStampMs).slice(0, 7)).toEqual(times);
    expect(Object.isFrozen(loaded.chunks[0].events[0].raw.bytes)).toBe(true);
    expect(f.fake.openedNames.every((name) => name === IMPROV_DB_NAME)).toBe(true);
  });
  it("acknowledges only transaction completion and rolls back chunk plus watermark together", async () => {
    const f = await fixture(); f.rec.append(message(1), context); const write = checkpoint(f.rec, f.take);
    f.fake.requestError = { store: "takes", method: "put", name: "QuotaExceededError" };
    await expect(f.lib.checkpoint(write)).rejects.toMatchObject({ reason: "quota" });
    expect(f.fake.get("eventChunks", ["take-1", 0])).toBeUndefined();
    expect((await f.lib.loadTake("take-1")).record.committedEventWatermark).toBe(0);
    const hold = f.fake.holdNextCommit(); let acknowledged = false;
    const pending = f.lib.checkpoint(write).then((saved) => { acknowledged = true; return saved; });
    for (let i = 0; i < 20 && !hold.ready(); i++) await Promise.resolve();
    expect(hold.ready()).toBe(true); expect(acknowledged).toBe(false);
    hold.release(); expect((await pending).committedEventWatermark).toBe(1); expect(acknowledged).toBe(true);
  });
  it("supports exact retry without duplicate chunks and rejects operation-ID reuse with changed evidence", async () => {
    const f = await fixture(); f.rec.append(message(1), context); const value = checkpoint(f.rec, f.take);
    const saved = await f.lib.checkpoint(value); expect(await f.open().checkpoint(value)).toEqual(saved);
    expect((await f.lib.loadTake("take-1")).chunks).toHaveLength(1);
    const changed = structuredClone(value); Reflect.set(changed.events[0].raw, "bytes", [0x90, 99, 77]);
    await expect(f.lib.checkpoint(changed)).rejects.toMatchObject({ reason: "collision" });
  });
  it("copies a checkpoint before asynchronous access so caller mutation cannot alter evidence", async () => {
    const f = await fixture(); f.rec.append(message(1), context);
    const value = structuredClone(checkpoint(f.rec, f.take)); const saved = f.lib.checkpoint(value);
    Reflect.set(value.events[0].raw.bytes!, "1", 99);
    Reflect.set(value.capture.start.observation, "atMs", 1);
    await saved; const loaded = await f.lib.loadTake("take-1");
    expect(loaded.chunks[0].events[0].raw.bytes).toEqual([0x90, 60, 99]);
    expect(loaded.record.capture.start.observation.atMs).toBe(100);
  });
  it("fences competing writers and stale revisions without changing evidence", async () => {
    const f = await fixture(); f.rec.append(message(1), context); const value = checkpoint(f.rec, f.take);
    await expect(f.open().checkpoint({ ...value, writerToken: "intruder" })).rejects.toMatchObject({ reason: "owned" });
    const results = await Promise.allSettled([f.lib.checkpoint(value), f.open().checkpoint({ ...value, operationId: "other" })]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
    expect((results[1] as PromiseRejectedResult).reason.reason).toBe("stale");
    expect((await f.lib.loadTake("take-1")).chunks).toHaveLength(1);
  });
  it.each(["gap", "duplicate", "wrong-source", "wrong-watermark"])("rejects %s without writing a prefix", async (kind) => {
    const f = await fixture(); f.rec.append(message(1), context); const write = structuredClone(checkpoint(f.rec, f.take));
    if (kind === "gap") Reflect.set(write.events[0], "sequence", 2);
    if (kind === "duplicate") Reflect.set(write, "events", [write.events[0], write.events[0]]);
    if (kind === "wrong-source") Reflect.set(write.events[0].raw, "input", { id: "other", name: null });
    if (kind === "wrong-watermark") Reflect.set(write.capture, "eventWatermark", 2);
    await expect(f.lib.checkpoint(write)).rejects.toMatchObject({ reason: "corrupt" });
    expect((await f.lib.loadTake("take-1")).chunks).toEqual([]);
  });
  it("requires the whole terminal prefix and connection observations before completion", async () => {
    const f = await fixture(); f.rec.append(message(1), context); f.rec.append(message(2), context);
    f.rec.observeConnection({ provenance: "input-availability", input, state: "disconnected", receivedAtMs: 200 }, context);
    const write = checkpoint(f.rec, f.take);
    await expect(f.lib.checkpoint({ ...write, events: write.events.slice(0, 1) })).rejects.toMatchObject({ reason: "corrupt" });
    await expect(f.lib.checkpoint({ ...write, connections: [] })).rejects.toMatchObject({ reason: "corrupt" });
    const saved = await f.lib.checkpoint(write); expect(saved).toMatchObject({ status: "interrupted", committedEventWatermark: 2 });
    expect(saved.connections).toEqual(f.rec.readConnections());
  });
  it("commits silence checkpoints and renews only the selected writer's lease", async () => {
    const f = await fixture(); f.setWall(20_000); const saved = await f.lib.checkpoint(checkpoint(f.rec, f.take));
    expect(saved).toMatchObject({ committedEventWatermark: 0, chunkCount: 0, checkpointAtMs: 20_000, lease: { expiresAtMs: 50_000 } });
    await expect(f.open().recoverTake("take-1")).rejects.toMatchObject({ reason: "owned" });
  });
  it("recovers exactly the committed prefix, retaining missing-boundary uncertainty and fencing late writes", async () => {
    const f = await fixture(); f.rec.append(message(1), context); f.rec.append(message(2), context);
    const partial = await f.lib.checkpoint(checkpoint(f.rec, f.take, { events: f.rec.readEvents(0, 1), finalize: false }));
    f.lib.close(); f.setWall(31_000); const other = f.open(); const recovered = await other.recoverTake("take-1");
    expect(recovered).toMatchObject({ status: "incomplete", committedEventWatermark: 1, capture: { eventWatermark: 2, terminal: null },
      recovery: { reason: "lease-expired", inferredAtMs: 31_000 }, lease: null });
    expect((await other.loadTake("take-1")).chunks.flatMap((c) => c.events)).toEqual(f.rec.readEvents(0, 1));
    f.rec.stop(observation(300)); await expect(other.checkpoint(checkpoint(f.rec, partial))).rejects.toMatchObject({ reason: "owned" });
    expect(await other.recoverTake("take-1")).toEqual(recovered);
  });
  it("keeps an observed Stop boundary separate from incomplete recovery when terminal flush was partial", async () => {
    const f = await fixture(); f.rec.append(message(1), context); f.rec.append(message(2), context); f.rec.stop(observation(300));
    await f.lib.checkpoint(checkpoint(f.rec, f.take, { events: f.rec.readEvents(0, 1), finalize: false }));
    f.setWall(31_000); const recovered = await f.lib.recoverTake("take-1");
    expect(recovered.status).toBe("incomplete"); expect(recovered.capture.terminal).toEqual(f.rec.metadata()?.terminal);
    expect(recovered.capture.status).toBe("completed"); expect(recovered.committedEventWatermark).toBe(1);
  });
  it("rejects expired live writes but permits explicit stopped retry if recovery has not revoked ownership", async () => {
    const f = await fixture(); f.rec.append(message(1), context); f.setWall(31_000);
    await expect(f.lib.checkpoint(checkpoint(f.rec, f.take))).rejects.toMatchObject({ reason: "lease-expired" });
    f.rec.stop(observation(300)); expect((await f.lib.checkpoint(checkpoint(f.rec, f.take))).status).toBe("completed");
  });
  it("rejects a regressed liveness clock without changing the last checkpoint", async () => {
    const f = await fixture(); f.setWall(900);
    await expect(f.lib.checkpoint(checkpoint(f.rec, f.take))).rejects.toMatchObject({ reason: "clock-regressed" });
    expect((await f.lib.loadTake("take-1")).record.checkpointAtMs).toBe(1000);
  });
  it.each([Infinity, -Infinity, -1])("round-trips anomalous receipt timestamp %s through structured clone", async (receivedAtMs) => {
    const f = await fixture(); f.rec.append({ ...message(1), receivedAtMs }, context); f.rec.stop(observation(NaN));
    await f.lib.checkpoint(checkpoint(f.rec, f.take));
    const loaded = await f.open().loadTake("take-1");
    expect(loaded.chunks[0].events[0].raw.receivedAtMs).toBe(receivedAtMs);
    expect(loaded.record.capture.terminal?.boundary.observation.atMs).toBeNaN();
  });
  it("preserves unavailable payloads and verifies derived flags instead of interpreting bytes", async () => {
    const f = await fixture(); f.rec.append({ ...message(1, null, null), dataStatus: "unavailable" }, context);
    const value = checkpoint(f.rec, f.take); const bad = structuredClone(value);
    Reflect.set(bad.events[0].timing, "sourceValidity", "valid");
    await expect(f.lib.checkpoint(bad)).rejects.toMatchObject({ reason: "corrupt" });
    await f.lib.checkpoint(value);
    expect((await f.lib.loadTake("take-1")).chunks[0].events[0].raw).toMatchObject({ bytes: null, dataStatus: "unavailable", sourceTimeStampMs: null });
  });
  it("preserves an anomalous terminal clock context as observed continuity evidence", async () => {
    const f = await fixture(); f.rec.append(message(1), context);
    f.rec.stop({ atMs: 300, context: { ...context, timeOriginMs: NaN } });
    await f.lib.checkpoint(checkpoint(f.rec, f.take));
    const loaded = await f.lib.loadTake("take-1");
    expect(loaded.record.capture.terminal?.boundary.observation.context.timeOriginMs).toBeNaN();
    expect(loaded.record.capture.terminal?.boundary.contextMatchesStart).toBe(false);
    expect(loaded.record.status).toBe("interrupted");
  });
  it("refuses recovery of corrupt prefix evidence without inventing a terminal boundary", async () => {
    const f = await fixture(); f.rec.append(message(1), context); await f.lib.checkpoint(checkpoint(f.rec, f.take));
    f.fake.set("eventChunks", ["take-1", 0], { schemaVersion: 1, takeId: "take-1", index: 0, startSequence: 99, endSequence: 1, events: [] });
    f.setWall(31_000); await expect(f.lib.recoverTake("take-1")).rejects.toMatchObject({ reason: "corrupt" });
    expect(f.fake.get("takes", "take-1")).toMatchObject({ status: "recording", capture: { terminal: null } });
  });
  it("refuses incompatible index structure without recreating the database", async () => {
    const f = await fixture(); f.lib.close();
    f.fake.databases.get(IMPROV_DB_NAME)!.schemas.get("takes")!.indexes.delete("collectionNumber");
    await expect(f.open().listCollections()).rejects.toMatchObject({ reason: "unsupported" });
    expect(f.fake.get("takes", "take-1")).toBeDefined();
  });
  it("bounds collection allocation including tombstones, without deleting existing records", async () => {
    const f = await fixture(); const original = (await f.lib.listCollections())[0];
    for (let i = 1; i < L.collections; i++) {
      f.fake.set("collections", `collection-${i}`, { ...original, collectionId: `collection-${i}`, firstTakeId: null, nextTakeNumber: 1, deletedAtMs: 1000 });
    }
    await expect(f.lib.createCollection("over-limit", "New", "free-improvisation")).rejects.toMatchObject({ reason: "limit" });
    expect((await f.lib.loadTake("take-1")).record.number).toBe(1);
  });
  it.each(["corrupt", "unsupported", "missing-chunk", "bad-count", "bad-continuity"])("reports %s stored records without repairing or erasing evidence", async (kind) => {
    const f = await fixture(); f.rec.append(message(1), context); const saved = await f.lib.checkpoint(checkpoint(f.rec, f.take));
    if (kind === "corrupt") f.fake.set("takes", "take-1", { ...saved, number: -1 });
    if (kind === "unsupported") f.fake.set("takes", "take-1", { ...saved, schemaVersion: 3 });
    if (kind === "missing-chunk") f.fake.set("takes", "take-1", { ...saved, chunkCount: 2 });
    if (kind === "bad-count") f.fake.set("takes", "take-1", { ...saved, committedAccountedBytes: saved.committedAccountedBytes - 1 });
    if (kind === "bad-continuity") f.fake.set("eventChunks", ["take-1", 0], { ...(f.fake.get("eventChunks", ["take-1", 0]) as object), startSequence: 2 });
    await expect(f.lib.loadTake("take-1")).rejects.toMatchObject({ reason: kind === "unsupported" ? "unsupported" : "corrupt" });
    expect(f.fake.get("takes", "take-1")).toBeDefined();
  });
  it("reports blocked/unavailable/newer database versions and retries opening after failure", async () => {
    const fake = new FakeImprovIndexedDb(); fake.openError = "SecurityError";
    const lib = new IndexedDbImprovLibrary({ factory: fake.factory }); await expect(lib.listCollections()).rejects.toMatchObject({ reason: "unavailable" });
    expect(await lib.listCollections()).toEqual([]); lib.close();
    await expect(lib.listCollections()).rejects.toMatchObject({ reason: "closed" });
    fake.databases.get(IMPROV_DB_NAME)!.version = 2;
    await expect(new IndexedDbImprovLibrary({ factory: fake.factory }).listCollections()).rejects.toMatchObject({ reason: "unsupported" });
    fake.blocked = true; await expect(new IndexedDbImprovLibrary({ factory: fake.factory }).listCollections()).rejects.toMatchObject({ reason: "blocked" });
  });
});
