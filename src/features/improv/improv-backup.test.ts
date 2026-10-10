import { describe, expect, it } from "vitest";
import { encodeImprovBackup, parseImprovBackup, improvBackupBlob, IMPROV_BACKUP_MAX_BYTES } from "./improv-backup";
import { performanceFixture, fixtureContext, fixtureInput, fixtureObservation } from "./improv-test-fixture";
import { createImprovTakeRecorder } from "./improv-take-recorder";
import { IndexedDbImprovLibrary } from "./persistence/improv-indexeddb";
import { FakeImprovIndexedDb } from "./persistence/improv-indexeddb-fake";
import type { ImprovCollectionEvidence, ImprovLoadedTake } from "./improv-library";

const ids = () => { let n = 0; return () => `import-${++n}`; };
const changed = (evidence: ImprovCollectionEvidence, mutate: (copy: ImprovCollectionEvidence) => void) => {
  const copy = structuredClone(evidence); mutate(copy);
  return JSON.stringify({ format: "prelude-improv-backup", version: 1, evidenceKind: "original-midi-delivery", evidence: copy });
};

describe("versioned JSON original-evidence backup", () => {
  it("round-trips every CC64 value, channels, encodings, raw payloads and exceptional numbers", async () => {
    const { evidence } = await performanceFixture([
      ...Array.from({ length: 128 }, (_, value) => ({ bytes: [0xb7, 64, value] })),
      { bytes: [0x92, 62, 0], sourceTimeStampMs: NaN, receivedAtMs: Infinity },
      { bytes: [0x82, 62, 42], sourceTimeStampMs: -Infinity, receivedAtMs: -0 },
      { bytes: [0xf0, 0x7d, 1, 0xf7], sourceTimeStampMs: null, receivedAtMs: NaN },
      { bytes: null, dataStatus: "unavailable" }, { bytes: [NaN, Infinity, -Infinity, -0] },
    ], { mode: "interrupted", end: Infinity });
    const json = encodeImprovBackup(evidence); const restored = parseImprovBackup(json);
    expect(restored).toEqual(evidence);
    expect(json).toContain('"$preludeNumber":"NaN"'); expect(json).toContain('"$preludeNumber":"-0"');
    expect(Object.is((restored.takes[0] as ImprovLoadedTake).record.capture.start.observation.context.timeOriginMs, -0)).toBe(true);
    expect(Object.isFrozen(restored.takes)).toBe(true); expect(improvBackupBlob(evidence).type).toBe("application/json");
  });
  it.each(["completed", "interrupted", "recording", "incomplete"] as const)("preserves %s boundaries and stored versus observed status", async (mode) => {
    const { evidence } = await performanceFixture([], { mode }); expect(parseImprovBackup(encodeImprovBackup(evidence))).toEqual(evidence);
  });
  it("includes ordered chunks and source-specific connection observations", async () => {
    const f = await performanceFixture(Array.from({ length: 257 }, (_, i) => ({ bytes: [0xb0, 64, i % 128] })), { mode: "recording" });
    f.rec.observeConnection({ provenance: "input-availability", input: fixtureInput, state: "disconnected", receivedAtMs: NaN }, fixtureContext);
    const before = f.loaded.record;
    await f.lib.checkpoint({ takeId: before.takeId, writerToken: before.writerToken, expectedRevision: before.revision, operationId: "connection",
      capture: f.rec.metadata()!, events: [], connections: f.rec.readConnections(), captureFailure: null, finalize: true });
    const evidence = await f.lib.exportCollection("book"); expect(parseImprovBackup(encodeImprovBackup(evidence))).toEqual(evidence);
    expect((evidence.takes[0] as ImprovLoadedTake).chunks.map((c) => c.index)).toEqual([0, 1]);
  });
  it("exports an empty collection without creating Take 1", async () => {
    const fake = new FakeImprovIndexedDb(); const lib = new IndexedDbImprovLibrary({ factory: fake.factory, now: () => 1000 });
    await lib.createCollection("empty", "Ideas", "free-improvisation");
    const copy = await lib.importCollection(parseImprovBackup(encodeImprovBackup(await lib.exportCollection("empty"))), ids());
    expect(copy).toMatchObject({ firstTakeId: null, nextTakeNumber: 1 });
  });
  it.each(["not-json", "null", "{}", '{"format":"prelude-improv-backup","version":1,"evidenceKind":"original-midi-delivery","evidence":null}'])("rejects malformed envelope %s", (json) => {
    expect(() => parseImprovBackup(json)).toThrow();
  });
  it("rejects unsupported format versions", async () => {
    const { evidence } = await performanceFixture();
    const root = JSON.parse(encodeImprovBackup(evidence)); root.version = 2;
    expect(() => parseImprovBackup(JSON.stringify(root))).toThrow(expect.objectContaining({ reason: "unsupported" }));
  });
  it("rejects oversized files before parsing", () => {
    expect(() => parseImprovBackup(" ".repeat(IMPROV_BACKUP_MAX_BYTES + 1))).toThrow(expect.objectContaining({ reason: "limit" }));
  });
  it.each(["unknown", "__proto__"])("rejects unknown exceptional number tag %s", async (tag) => {
    const { evidence } = await performanceFixture();
    const json = encodeImprovBackup(evidence).replace('"$preludeNumber":"-0"', `"$preludeNumber":"${tag}"`);
    expect(() => parseImprovBackup(json)).toThrow();
  });
  it.each([
    (e: ImprovCollectionEvidence) => { Reflect.set((e.takes[0] as ImprovLoadedTake).chunks[0].events[0], "sequence", 2); },
    (e: ImprovCollectionEvidence) => { Reflect.set((e.takes[0] as ImprovLoadedTake).chunks[0], "index", 1); },
    (e: ImprovCollectionEvidence) => { Reflect.set((e.takes[0] as ImprovLoadedTake).chunks[0].events[0].raw.input, "id", "other"); },
    (e: ImprovCollectionEvidence) => { Reflect.set((e.takes[0] as ImprovLoadedTake).chunks[0].events[0].timing, "receiptValidity", "nonfinite"); },
    (e: ImprovCollectionEvidence) => { Reflect.set((e.takes[0] as ImprovLoadedTake).record, "committedAccountedBytes", 1); },
    (e: ImprovCollectionEvidence) => { Reflect.set(e.collection, "firstTakeId", "wrong"); },
    (e: ImprovCollectionEvidence) => { Reflect.set(e, "takes", [...e.takes, e.takes[0]]); },
  ])("rejects corrupt sequence, source, timing, accounting and history (%#)", async (mutate) => {
    const { evidence } = await performanceFixture([{}]);
    expect(() => parseImprovBackup(changed(evidence, mutate))).toThrow();
  });
});

describe("atomic collision-safe restore into a separate history", () => {
  it("allocates new IDs and preserves original evidence, numbers and source identities", async () => {
    const f = await performanceFixture([{ bytes: [0x93, 65, 90] }]); const original = f.loaded;
    const restored = await f.lib.importCollection(parseImprovBackup(encodeImprovBackup(f.evidence)), ids());
    const copied = await f.lib.loadTake(restored.firstTakeId!);
    expect(copied.record.takeId).not.toBe(original.record.takeId);
    expect(copied.record.capture).toEqual(original.record.capture); expect(copied.record.importedFrom).toEqual(original.record);
    expect(copied.chunks[0].events).toEqual(original.chunks[0].events); expect(restored.importedFrom).toEqual(f.evidence.collection);
    expect(await f.lib.loadTake(original.record.takeId)).toEqual(original);
  });
  it.each(["recording", "incomplete", "interrupted"] as const)("restores %s honestly and never resumes it", async (mode) => {
    const f = await performanceFixture([{}], { mode });
    const collection = await f.lib.importCollection(f.evidence, ids()); const loaded = await f.lib.loadTake(collection.firstTakeId!);
    expect(loaded.record.status).toBe(mode === "recording" ? "incomplete" : mode); expect(loaded.record.lease).toBeNull();
    expect(loaded.record.capture).toEqual(f.loaded.record.capture);
    await expect(f.lib.checkpoint({ takeId: loaded.record.takeId, writerToken: loaded.record.writerToken,
      expectedRevision: loaded.record.revision, operationId: "late", capture: loaded.record.capture, events: [], connections: [], finalize: true, captureFailure: null })).rejects.toMatchObject({ reason: "owned" });
  });
  it("preserves deleted Take 1 without promoting Take 2 or reusing a number", async () => {
    const f = await performanceFixture();
    await f.lib.deleteTake("take-1", { takeId: "take-1", revision: f.loaded.record.revision, confirmed: true });
    const rec = createImprovTakeRecorder({ createId: () => "take-2" }); rec.start(fixtureInput, fixtureObservation(100)); rec.stop(fixtureObservation(200));
    const allocated = await f.lib.allocateTake("book", rec.metadata()!, "second");
    await f.lib.checkpoint({ takeId: allocated.takeId, writerToken: allocated.writerToken, expectedRevision: allocated.revision,
      operationId: "second", capture: rec.metadata()!, events: [], connections: [], finalize: true, captureFailure: null });
    const restored = await f.lib.importCollection(await f.lib.exportCollection("book"), ids());
    const takes = await f.lib.listTakes(restored.collectionId);
    expect(takes.map((t) => [t.kind, t.number])).toEqual([["deleted-take", 1], ["take", 2]]); expect(restored.firstTakeId).toBe(takes[0].takeId);
    const third = createImprovTakeRecorder({ createId: () => "take-3" }); third.start(fixtureInput, fixtureObservation(100));
    expect((await f.lib.allocateTake(restored.collectionId, third.metadata()!, "third")).number).toBe(3);
  });
  it("rejects destination and generated identity collisions without changes", async () => {
    const f = await performanceFixture();
    await expect(f.lib.importCollection(f.evidence, () => "book")).rejects.toMatchObject({ reason: "collision" });
    const target = ["new", "take-1"];
    await expect(f.lib.importCollection(f.evidence, () => target.shift()!)).rejects.toMatchObject({ reason: "collision" });
    expect(await f.lib.listCollections()).toHaveLength(1);
  });
  it.each(["QuotaExceededError", "AbortError"])("rolls back every record after %s", async (error) => {
    const f = await performanceFixture([{}]); f.fake.commitError = error;
    await expect(f.lib.importCollection(f.evidence, ids())).rejects.toThrow();
    expect(await f.lib.listCollections()).toHaveLength(1);
    expect(await f.lib.listTakes("book")).toHaveLength(1);
    await expect(f.lib.loadTake("import-2")).rejects.toMatchObject({ reason: "not-found" });
  });
  it("rolls back collection and take additions when chunk addition fails", async () => {
    const f = await performanceFixture([{}]); f.fake.requestError = { store: "eventChunks", method: "add", name: "ConstraintError" };
    await expect(f.lib.importCollection(f.evidence, ids())).rejects.toThrow(); expect(await f.lib.listCollections()).toHaveLength(1);
  });
  it("reopened handles load restored evidence, and repeated backup/restore keeps flat original provenance", async () => {
    const f = await performanceFixture([{}]); const restored = await f.lib.importCollection(f.evidence, ids());
    const reopened = new IndexedDbImprovLibrary({ factory: f.fake.factory, now: () => 2000 });
    expect((await reopened.loadTake(restored.firstTakeId!)).record.capture).toEqual(f.loaded.record.capture);
    const json = encodeImprovBackup(await reopened.exportCollection(restored.collectionId));
    let n = 0; const twice = await reopened.importCollection(parseImprovBackup(json), () => `twice-${++n}`);
    const loaded = await reopened.loadTake(twice.firstTakeId!); expect(loaded.record.importedFrom).toEqual(f.loaded.record);
    expect(loaded.record.importedFrom).not.toHaveProperty("importedFrom");
  });
  it("preserves an observed Stop with an incompletely persisted prefix as incomplete on restore", async () => {
    const f = await performanceFixture([{ receivedAtMs: 200 }, { receivedAtMs: 400 }], { committedCount: 1 });
    expect(f.loaded.record).toMatchObject({ status: "recording", capture: { status: "completed" } });
    const collection = await f.lib.importCollection(f.evidence, ids()); const copy = await f.lib.loadTake(collection.firstTakeId!);
    expect(copy.record).toMatchObject({ status: "incomplete", committedEventWatermark: 1, capture: { status: "completed", eventWatermark: 2 } });
    expect(copy.record.capture.terminal).toEqual(f.loaded.record.capture.terminal);
  });
  it("refuses corrupt input before any restore writes occur", async () => {
    const f = await performanceFixture([{}]); const corrupt = structuredClone(f.evidence);
    Reflect.set((corrupt.takes[0] as ImprovLoadedTake).chunks[0].events[0], "sequence", 100);
    await expect(f.lib.importCollection(corrupt, ids())).rejects.toThrow(); expect(await f.lib.listCollections()).toHaveLength(1);
  });
  it("fences Start retries for imported destinations even with their non-writer token", async () => {
    const f = await performanceFixture(); const c = await f.lib.importCollection(f.evidence, ids()); const copy = await f.lib.loadTake(c.firstTakeId!);
    await expect(f.lib.allocateTake(c.collectionId, { ...copy.record.capture, takeId: copy.record.takeId }, copy.record.writerToken)).rejects.toMatchObject({ reason: "owned" });
  });
  it("confirmed collection deletion removes original import context as well as take evidence", async () => {
    const f = await performanceFixture([{}]); const c = await f.lib.importCollection(f.evidence, ids());
    await f.lib.deleteCollection(c.collectionId, { collectionId: c.collectionId, revision: c.revision, confirmed: true });
    expect(f.fake.get("collections", c.collectionId)).not.toHaveProperty("importedFrom");
    expect(f.fake.get("takes", c.firstTakeId!)).toMatchObject({ kind: "deleted-take" });
    await expect(f.lib.loadTake(c.firstTakeId!)).rejects.toMatchObject({ reason: "not-found" });
  });
});
