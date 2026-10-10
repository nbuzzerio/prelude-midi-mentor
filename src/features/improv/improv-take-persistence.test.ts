import { describe, expect, it } from "vitest";
import type { RawMidiMessage } from "@/lib/midi/midi-transport";
import { createImprovTakeRecorder } from "./improv-take-recorder";
import { createImprovTakePersistence, type ImprovCheckpointScheduler } from "./improv-take-persistence";
import { ImprovLibraryError, IMPROV_LIBRARY_LIMITS as L, type ImprovLibrary } from "./improv-library";
import { IndexedDbImprovLibrary } from "./persistence/improv-indexeddb";
import { FakeImprovIndexedDb } from "./persistence/improv-indexeddb-fake";

const input = { id: "piano", name: "Room piano" };
const context = { ownerId: "owner", clockId: "document", timeOriginMs: 1_000_000 };
const observation = (atMs = 100) => ({ atMs, context });
const message = (sequence: number, bytes = [0x90, 60, 99]): RawMidiMessage => ({ provenance: "browser-midi-message",
  sequence, input, bytes, dataStatus: "available", sourceTimeStampMs: 110, receivedAtMs: 120 });
async function fixture(config: { unsavedEvents?: number; unsavedBytes?: number; wrap?: (lib: ImprovLibrary) => ImprovLibrary } = {}) {
  const fake = new FakeImprovIndexedDb(); let wall = 1000; let observed = 500; let op = 0;
  const callbacks = new Set<() => void>();
  const clock: ImprovCheckpointScheduler = { every(ms, callback) { expect(ms).toBe(L.checkpointMs); callbacks.add(callback); return () => callbacks.delete(callback); } };
  const lib = new IndexedDbImprovLibrary({ factory: fake.factory, now: () => wall });
  await lib.createCollection("piece", "Disney book", "first-take-sight-reading");
  const rec = createImprovTakeRecorder({ createId: () => "take-1" });
  const adapter = createImprovTakePersistence({ recorder: rec, library: config.wrap?.(lib) ?? lib, collectionId: "piece", writerToken: "writer",
    observe: () => observation(observed), now: () => wall, scheduler: clock, createOperationId: () => `op-${++op}`,
    unsavedEvents: config.unsavedEvents, unsavedBytes: config.unsavedBytes });
  const ready = async () => { adapter.start(input, observation()); await adapter.flush(); };
  return { fake, lib, rec, adapter, ready, callbacks, tick: () => [...callbacks].forEach((callback) => callback()),
    setWall: (value: number) => { wall = value; }, setObserved: (value: number) => { observed = value; } };
}
function intercept(lib: ImprovLibrary, methods: Partial<ImprovLibrary>): ImprovLibrary {
  return new Proxy(lib, { get(target, key) {
    if (Object.hasOwn(methods, key)) return Reflect.get(methods, key);
    const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
  } });
}

describe("Improv journal persistence ownership and acknowledgments", () => {
  it("does not allocate a canceled idle capture or start a global timer", async () => {
    const f = await fixture(); expect(f.callbacks.size).toBe(0); expect(f.adapter.state().storageStatus).toBe("idle");
    await f.adapter.dispose(); expect(await f.lib.listTakes("piece")).toEqual([]);
    expect(f.adapter.start(input, observation()).ok).toBe(false);
  });
  it("persists an empty first capture and acknowledges terminal state only after commit", async () => {
    const f = await fixture(); await f.ready(); expect(f.callbacks.size).toBe(1);
    expect(f.adapter.state()).toMatchObject({ storageStatus: "checkpointed", number: 1, committedEventWatermark: 0 });
    const hold = f.fake.holdNextCommit(); const stopped = f.adapter.stop(observation(1000));
    for (let i = 0; i < 20 && !hold.ready(); i++) await Promise.resolve();
    expect(hold.ready()).toBe(true); expect(f.adapter.state().storageStatus).toBe("saving");
    expect(f.callbacks.size).toBe(0); hold.release();
    expect(await stopped).toMatchObject({ storageStatus: "saved", number: 1, committedEventWatermark: 0 });
    expect((await f.lib.loadTake("take-1")).record.status).toBe("completed");
  });
  it("writes periodic silence checkpoints and renews liveness without musical events", async () => {
    const f = await fixture(); await f.ready(); const before = (await f.lib.loadTake("take-1")).record;
    f.setWall(3000); f.tick(); await f.adapter.flush(); const after = (await f.lib.loadTake("take-1")).record;
    expect(after.revision).toBeGreaterThan(before.revision); expect(after.checkpointAtMs).toBe(3000);
    expect(after.lease?.expiresAtMs).toBe(33_000); expect(after.committedEventWatermark).toBe(0);
    await f.adapter.stop(observation(2000));
  });
  it("drains bounded chunks and keeps the live journal watermark distinct from the durable watermark", async () => {
    const f = await fixture(); await f.ready();
    for (let i = 1; i <= 600; i++) f.adapter.append(message(i), context);
    expect(f.adapter.state()).toMatchObject({ storageStatus: "pending", pendingEventCount: 600, committedEventWatermark: 0 });
    await f.adapter.stop(observation(2000)); const loaded = await f.lib.loadTake("take-1");
    expect(loaded.chunks.map((c) => c.events.length)).toEqual([256, 256, 88]);
    expect(loaded.chunks.flatMap((c) => c.events)).toEqual(f.rec.snapshot()?.events);
    expect(f.adapter.state()).toMatchObject({ storageStatus: "saved", pendingEventCount: 0, committedEventWatermark: 600 });
  });
  it("preserves all CC64 values and repeated/system/non-note events without interpretation", async () => {
    const f = await fixture(); await f.ready();
    for (let value = 0; value <= 127; value++) f.adapter.append(message(value + 1, [0xbf, 64, value]), context);
    f.adapter.append(message(129, [0xbf, 64, 127]), context); f.adapter.append(message(130, [0xf8]), context);
    f.adapter.append(message(131, []), context); await f.adapter.stop(observation(1000));
    expect((await f.lib.loadTake("take-1")).chunks.flatMap((c) => c.events)).toEqual(f.rec.snapshot()?.events);
  });
  it("preserves a large individual delivered message in its own bounded chunk", async () => {
    const f = await fixture(); await f.ready();
    const bytes = [0xf0, ...Array(131_010).fill(1), 0xf7];
    f.adapter.append(message(1, bytes), context); f.adapter.append(message(2), context);
    await f.adapter.stop(observation(400)); const loaded = await f.lib.loadTake("take-1");
    expect(loaded.chunks.map((c) => c.events.length)).toEqual([1, 1]);
    expect(loaded.chunks[0].events[0].raw.bytes).toEqual(bytes);
    expect(loaded.record.committedEventWatermark).toBe(2);
  });
  it("ignores other inputs and flushes selected-device loss without invented releases", async () => {
    const f = await fixture(); await f.ready();
    f.adapter.append({ ...message(1), input: { id: "other", name: null } }, context);
    f.adapter.append(message(2, [0x90, 60, 90]), context); f.adapter.append(message(3, [0xb0, 64, 127]), context);
    f.adapter.observeConnection({ provenance: "input-availability", input, state: "disconnected", receivedAtMs: 300 }, context);
    await f.adapter.flush(); const loaded = await f.lib.loadTake("take-1");
    expect(loaded.record).toMatchObject({ status: "interrupted", committedEventWatermark: 2 });
    expect(loaded.record.connections).toEqual(f.rec.readConnections());
    expect(loaded.chunks.flatMap((c) => c.events).map((e) => e.raw.bytes)).toEqual([[0x90, 60, 90], [0xb0, 64, 127]]);
  });
  it.each(["background", "freeze", "pagehide", "consumer-lost"] as const)("flushes explicit %s without silently resuming", async (reason) => {
    const f = await fixture(); await f.ready(); f.adapter.append(message(1), context);
    expect((await f.adapter.interrupt(reason, observation(300))).storageStatus).toBe("saved");
    expect(f.adapter.append(message(2), context).ok).toBe(false);
    expect(f.adapter.start(input, observation(500)).ok).toBe(false);
    expect((await f.lib.loadTake("take-1")).record.capture.terminal?.reason).toBe(reason);
  });
  it("handles Stop during an in-flight live checkpoint, then flushes the terminal observation", async () => {
    const f = await fixture(); await f.ready(); f.adapter.append(message(1), context);
    const hold = f.fake.holdNextCommit(); const saving = f.adapter.flush();
    for (let i = 0; i < 20 && !hold.ready(); i++) await Promise.resolve();
    expect(hold.ready()).toBe(true); const stopping = f.adapter.stop(observation(400));
    expect(f.adapter.state().storageStatus).toBe("saving"); hold.release(); await saving;
    expect((await stopping).storageStatus).toBe("saved");
    expect((await f.lib.loadTake("take-1")).record.capture.terminal?.boundary.observation.atMs).toBe(400);
  });
  it("disposes while a write is pending and excludes late callbacks without losing the prefix", async () => {
    const f = await fixture(); await f.ready(); f.adapter.append(message(1), context);
    const hold = f.fake.holdNextCommit(); const pending = f.adapter.flush();
    for (let i = 0; i < 20 && !hold.ready(); i++) await Promise.resolve();
    const disposed = f.adapter.dispose(); expect(f.adapter.append(message(2), context).ok).toBe(false);
    expect(f.adapter.observeConnection({ provenance: "input-availability", input, state: "connected", receivedAtMs: 900 }, context).ok).toBe(false);
    expect(f.callbacks.size).toBe(0); hold.release(); await pending;
    expect((await disposed).storageStatus).toBe("saved");
    expect((await f.lib.loadTake("take-1")).record).toMatchObject({ status: "interrupted", committedEventWatermark: 1 });
  });
});

describe("Improv failed-save backlog and recovery preparation", () => {
  it("retains failed initial allocation and retries Take 1 without deleting older data", async () => {
    const f = await fixture(); f.fake.commitError = "QuotaExceededError"; f.adapter.start(input, observation());
    expect((await f.adapter.flush()).failure).toBe("quota"); f.adapter.append(message(1), context);
    expect(f.adapter.pendingSnapshot()?.events).toHaveLength(1);
    await f.adapter.stop(observation(500));
    expect(f.adapter.state()).toMatchObject({ storageStatus: "saved", number: 1, committedEventWatermark: 1 });
    expect((await f.lib.listCollections())[0].nextTakeNumber).toBe(2);
  });
  it("retries a failed chunk without duplicate evidence", async () => {
    const f = await fixture(); await f.ready(); f.adapter.append(message(1), context);
    f.fake.commitError = "QuotaExceededError"; expect((await f.adapter.flush()).failure).toBe("quota");
    expect(f.adapter.state()).toMatchObject({ storageStatus: "failed", pendingEventCount: 1, committedEventWatermark: 0 });
    f.tick(); expect(f.adapter.state().storageStatus).toBe("failed");
    await f.adapter.retry(); await f.adapter.stop(observation(300));
    expect((await f.lib.loadTake("take-1")).chunks).toHaveLength(1);
  });
  it("reconciles a lost commit acknowledgment through the exact same operation ID", async () => {
    let lost = false;
    const f = await fixture({ wrap: (lib) => intercept(lib, { checkpoint: async (value) => {
      const saved = await lib.checkpoint(value);
      if (value.events.length && !lost) { lost = true; throw new Error("Lost acknowledgment"); }
      return saved;
    } }) });
    await f.ready(); f.adapter.append(message(1), context); expect((await f.adapter.flush()).storageStatus).toBe("failed");
    expect(f.adapter.state().committedEventWatermark).toBe(0); expect((await f.lib.loadTake("take-1")).record.committedEventWatermark).toBe(1);
    await f.adapter.retry(); await f.adapter.stop(observation(300));
    expect((await f.lib.loadTake("take-1")).chunks).toHaveLength(1);
  });
  it("reconciles a lost allocation acknowledgment without consuming Take 2", async () => {
    let lost = false;
    const f = await fixture({ wrap: (lib) => intercept(lib, { allocateTake: async (...args) => {
      const saved = await lib.allocateTake(...args); if (!lost) { lost = true; throw Error("Lost Start acknowledgment"); } return saved;
    } }) });
    f.adapter.start(input, observation()); await f.adapter.flush();
    expect(f.adapter.state().storageStatus).toBe("failed"); await f.adapter.stop(observation(300));
    expect(f.adapter.state().number).toBe(1); expect((await f.lib.listCollections())[0].nextTakeNumber).toBe(2);
  });
  it("stops at the exact unsaved-event limit and retains the prefix for explicit Retry", async () => {
    let unavailable = true;
    const f = await fixture({ unsavedEvents: 3, wrap: (lib) => intercept(lib, { allocateTake: async (...args) => {
      if (unavailable) throw new ImprovLibraryError("unavailable"); return lib.allocateTake(...args);
    } }) });
    f.adapter.start(input, observation()); await f.adapter.flush();
    for (let i = 1; i <= 3; i++) f.adapter.append(message(i), context);
    expect(f.adapter.state()).toMatchObject({ pendingEventCount: 3, captureFailure: { reason: "unsaved-backlog-limit", refusedTransportSequence: null } });
    expect(f.rec.metadata()?.status).toBe("interrupted"); expect(f.adapter.append(message(4), context).ok).toBe(false);
    unavailable = false; expect((await f.adapter.retry()).storageStatus).toBe("saved");
    expect((await f.lib.loadTake("take-1")).chunks.flatMap((c) => c.events)).toHaveLength(3);
  });
  it("refuses an over-budget delivery explicitly and never evicts earlier unsaved evidence", async () => {
    const f = await fixture({ unsavedBytes: 2000 }); await f.ready(); f.adapter.append(message(1), context);
    f.adapter.append(message(2, Array(300).fill(1)), context); await f.adapter.flush();
    expect(f.adapter.state().captureFailure).toEqual({ reason: "unsaved-backlog-limit", refusedTransportSequence: 2 });
    expect(f.rec.snapshot()?.events).toHaveLength(1); expect((await f.lib.loadTake("take-1")).record.status).toBe("interrupted");
  });
  it("ends capture on lease expiry and preserves a stopped suffix if no recovery has revoked it", async () => {
    const f = await fixture(); await f.ready(); f.adapter.append(message(1), context); f.setWall(40_000); f.setObserved(600); f.tick();
    await f.adapter.flush(); expect(f.rec.metadata()?.terminal?.reason).toBe("consumer-lost");
    expect(f.adapter.state().storageStatus).toBe("saved"); expect(f.callbacks.size).toBe(0);
  });
  it("rejects new delivery after expiry even when the periodic timer has not run", async () => {
    const f = await fixture(); await f.ready(); f.adapter.append(message(1), context);
    f.setWall(40_000); f.setObserved(700);
    expect(f.adapter.append(message(2), context).ok).toBe(false);
    await f.adapter.flush(); const loaded = await f.lib.loadTake("take-1");
    expect(loaded.chunks.flatMap((c) => c.events)).toHaveLength(1);
    expect(loaded.record.capture.terminal?.boundary.observation.atMs).toBe(700);
    expect(loaded.record.capture.terminal?.reason).toBe("consumer-lost");
    expect(f.callbacks.size).toBe(0);
  });
  it("cannot overwrite a recovered take; unsaved suffix remains available in memory", async () => {
    const f = await fixture(); await f.ready(); f.adapter.append(message(1), context); f.setWall(40_000);
    await f.lib.recoverTake("take-1"); expect((await f.adapter.flush()).failure).toBe("owned");
    expect(f.rec.metadata()?.status).toBe("interrupted"); expect(f.adapter.pendingSnapshot()?.events).toHaveLength(1);
    expect((await f.lib.loadTake("take-1")).record).toMatchObject({ status: "incomplete", committedEventWatermark: 0 });
  });
  it("rebuilds an uncommitted expired live write as an observed interrupted terminal retry", async () => {
    const f = await fixture(); await f.ready(); f.adapter.append(message(1), context);
    f.fake.commitError = "QuotaExceededError"; await f.adapter.flush();
    f.setWall(40_000); expect((await f.adapter.retry()).storageStatus).toBe("saved");
    const loaded = await f.lib.loadTake("take-1");
    expect(loaded.record.status).toBe("interrupted"); expect(loaded.record.capture.terminal?.reason).toBe("consumer-lost");
    expect(loaded.chunks.flatMap((c) => c.events)).toHaveLength(1);
  });
  it.each([0, NaN, -1, L.eventsPerTake + 1])("rejects invalid backlog configuration %s", (limit) => {
    const rec = createImprovTakeRecorder({ createId: () => "take-1" });
    expect(() => createImprovTakePersistence({ recorder: rec, library: {} as ImprovLibrary, collectionId: "piece",
      writerToken: "writer", observe: observation, unsavedEvents: limit })).toThrow("Invalid unsaved");
  });
});
