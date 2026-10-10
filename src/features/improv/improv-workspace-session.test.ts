import { afterEach, describe, expect, it } from "vitest";
import { createImprovWorkspaceSession } from "./improv-workspace-session";
import { IndexedDbImprovLibrary } from "./persistence/improv-indexeddb";
import { FakeImprovIndexedDb } from "./persistence/improv-indexeddb-fake";
import { fixtureContext as context, fixtureInput as input } from "./improv-test-fixture";
import type { RawMidiMessage } from "@/lib/midi/midi-transport";

const sessions: ReturnType<typeof createImprovWorkspaceSession>[] = [];
afterEach(async () => { await Promise.all(sessions.splice(0).map((session) => session.dispose())); });
async function fixture() {
  const fake = new FakeImprovIndexedDb();
  const library = new IndexedDbImprovLibrary({ factory: fake.factory }); let id = 0; let time = 100;
  const collection = await library.createCollection("book", "Physical book", "first-take-sight-reading");
  const session = createImprovWorkspaceSession({ library, createId: () => `id-${++id}`, observe: () => ({ atMs: time, context }) });
  sessions.push(session); session.selectInput(input.id);
  const raw = (sequence: number, bytes = [0x90, 60, 90]): RawMidiMessage => ({ provenance: "browser-midi-message", input,
    sequence, bytes, dataStatus: "available", sourceTimeStampMs: time, receivedAtMs: time });
  return { fake, library, collection, session, raw, setTime: (value: number) => { time = value; } };
}

describe("Improv workspace coordination", () => {
  it("clears held notes immediately on Stop and ignores subsequent messages", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context); f.session.append(f.raw(1), context);
    expect(f.session.heldPitches()).toEqual([60]); const stopping = f.session.stop();
    expect(f.session.heldPitches()).toEqual([]); f.session.append(f.raw(2, [0x90, 64, 80]), context);
    expect(f.session.heldPitches()).toEqual([]); expect(f.session.metadata()?.eventWatermark).toBe(1); await stopping;
  });
  it("clears feedback at the backlog limit, refuses later notes and permits a fresh take", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context); await f.session.retry();
    f.fake.commitError = "QuotaExceededError";
    for (let i = 1; i <= 2048; i++) f.session.append(f.raw(i), context);
    expect(f.session.state().captureStatus).toBe("interrupted"); expect(f.session.heldPitches()).toEqual([]);
    f.session.append(f.raw(2049, [0x90, 64, 80]), context);
    expect(f.session.heldPitches()).toEqual([]); expect(f.session.metadata()?.eventWatermark).toBe(2048);
    await f.session.retry(); await f.session.retry(); const oldId = f.session.state().takeId;
    f.session.start(f.collection, input, context); f.session.append(f.raw(2050, [0x90, 67, 90]), context);
    expect(f.session.heldPitches()).toEqual([67]); await f.session.stop();
    expect(f.session.state().takeId).not.toBe(oldId); expect(f.session.metadata()?.eventWatermark).toBe(1);
  });
  it("allocates only on Start, preserves empty Take 1 and creates a fresh Take 2", async () => {
    const f = await fixture(); expect(await f.library.listTakes("book")).toEqual([]);
    expect(f.session.state().storageStatus).toBe("idle");
    f.session.start(f.collection, input, context); expect(f.session.needsGuard()).toBe(true);
    expect((await f.session.stop()).number).toBe(1); const first = f.session.state().takeId;
    expect(f.session.needsGuard()).toBe(false);
    f.session.start(f.collection, input, context); expect((await f.session.stop()).number).toBe(2);
    expect(f.session.state().takeId).not.toBe(first);
    expect((await f.library.listCollections())[0].firstTakeId).toBe(first);
  });
  it("records only selected raw evidence, without normalizing releases, pedal or system bytes", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context);
    f.session.append({ ...f.raw(1), input: { id: "other", name: "Other" } }, context);
    const bytes = [[0x92, 60, 99], [0xb2, 64, 37], [0xb2, 64, 37], [0x92, 60, 0], [0xf8]];
    bytes.forEach((value, i) => f.session.append(f.raw(i + 2, value), context));
    await f.session.stop(); const loaded = await f.library.loadTake(f.session.state().takeId!);
    expect(loaded.chunks.flatMap((chunk) => chunk.events.map((event) => event.raw.bytes))).toEqual(bytes);
    expect(loaded.record.committedEventWatermark).toBe(5);
  });
  it("rejects unselected starts and replacement attempts while pending", async () => {
    const f = await fixture(); expect(() => f.session.start(f.collection, { ...input, id: "other" }, context)).toThrow(/Select/);
    f.session.start(f.collection, input, context); expect(() => f.session.start(f.collection, input, context)).toThrow(/save/);
    await f.session.stop();
  });
  it("projects selected held notes separately with channel-specific repeated attacks", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context);
    f.session.append(f.raw(1), context); f.session.append(f.raw(2), context);
    f.session.append(f.raw(3, [0x91, 60, 20]), context); f.session.append(f.raw(4, [0x80, 60, 40]), context);
    expect(f.session.heldPitches()).toEqual([60]); f.session.append(f.raw(5, [0x90, 60, 0]), context);
    expect(f.session.heldPitches()).toEqual([60]); f.session.append(f.raw(6, [0x81, 60, 0]), context);
    expect(f.session.heldPitches()).toEqual([]); await f.session.stop();
    expect(f.session.metadata()?.eventWatermark).toBe(6);
  });
  it.each(["background", "freeze", "pagehide", "consumer-lost"] as const)("preserves %s interruption without resume or invented releases", async (reason) => {
    const f = await fixture(); f.session.start(f.collection, input, context); f.session.append(f.raw(1), context);
    f.setTime(500); await f.session.interrupt(reason); f.session.append(f.raw(2), context);
    expect(f.session.heldPitches()).toEqual([]);
    const take = await f.library.loadTake(f.session.state().takeId!);
    expect(take.record.status).toBe("interrupted"); expect(take.record.capture.terminal?.reason).toBe(reason);
    expect(take.chunks.flatMap((c) => c.events)).toHaveLength(1); expect(f.session.metadata()?.eventWatermark).toBe(1);
  });
  it("retains selected-source loss and never substitutes a connected device", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context); f.session.append(f.raw(1), context);
    f.session.connection({ provenance: "input-availability", input, state: "disconnected", receivedAtMs: 300 }, context);
    await f.session.stop(); const loaded = await f.library.loadTake(f.session.state().takeId!);
    f.session.append(f.raw(2), context); expect(f.session.metadata()?.eventWatermark).toBe(1);
    expect(loaded.record.status).toBe("interrupted"); expect(loaded.record.connections).toHaveLength(1);
    expect(f.session.heldPitches()).toEqual([]);
  });
  it("keeps pending evidence guarded until terminal commit acknowledgment", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context); await f.session.retry();
    const hold = f.fake.holdNextCommit(); const stopping = f.session.stop();
    for (let i = 0; i < 50 && !hold.ready(); i++) await Promise.resolve();
    expect(hold.ready()).toBe(true); expect(f.session.needsGuard()).toBe(true);
    expect(f.session.state().storageStatus).toBe("saving"); hold.release(); await stopping;
    expect(f.session.needsGuard()).toBe(false);
  });
  it("retains failed terminal evidence and retries without creating another attempt", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context); await f.session.retry();
    f.session.append(f.raw(1), context); f.fake.commitError = "QuotaExceededError"; await f.session.stop();
    expect(f.session.state().storageStatus).toBe("failed"); expect(f.session.needsGuard()).toBe(true);
    expect(f.session.pendingSnapshot()?.events).toHaveLength(1); await f.session.retry();
    expect(f.session.state()).toMatchObject({ storageStatus: "saved", number: 1, committedEventWatermark: 1 });
    expect(await f.library.listTakes("book")).toHaveLength(1);
  });
  it("clears only an acknowledged capture when changing collection context", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context);
    expect(f.session.resetCompleted()).toBe(false); await f.session.stop(); const id = f.session.state().takeId!;
    expect(f.session.resetCompleted()).toBe(true); expect(f.session.metadata()).toBeNull();
    expect(f.session.state()).toMatchObject({ storageStatus: "idle", number: null, takeId: null });
    expect((await f.library.loadTake(id)).record.number).toBe(1);
  });
});
