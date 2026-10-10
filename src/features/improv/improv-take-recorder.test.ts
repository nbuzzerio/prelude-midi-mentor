import { describe, expect, it, vi } from "vitest";
import type { MidiInputConnectionChange, RawMidiMessage } from "@/lib/midi/midi-transport";
import { inspectImprovEventTiming, type ImprovCaptureContext, type ImprovObservation, type ImprovTake } from "./improv-take";
import { createImprovTakeRecorder, DEFAULT_IMPROV_TAKE_LIMITS, improvMessageAccountedBytes } from "./improv-take-recorder";

const input = { id: "piano-1", name: "Room piano" };
const context: ImprovCaptureContext = { ownerId: "owner-1", clockId: "document-1", timeOriginMs: 1_000_000 };
const observed = (atMs: number, captureContext = context): ImprovObservation => ({ atMs, context: captureContext });
function message(sequence = 1, values: readonly number[] | null = [0x90, 60, 90], overrides: Partial<RawMidiMessage> = {}): RawMidiMessage {
  return { provenance: "browser-midi-message", sequence, input: { ...input }, bytes: values,
    dataStatus: values === null ? "unavailable" : "available", sourceTimeStampMs: 110, receivedAtMs: 120, ...overrides };
}
function connection(state: MidiInputConnectionChange["state"], overrides: Partial<MidiInputConnectionChange> = {}): MidiInputConnectionChange {
  return { provenance: "input-availability", input: { ...input }, state, receivedAtMs: 200, ...overrides };
}
function recorder(limits?: Parameters<typeof createImprovTakeRecorder>[0]["limits"]) {
  return createImprovTakeRecorder({ createId: () => "take-1", limits });
}
function started(limits?: Parameters<typeof recorder>[0]) {
  const capture = recorder(limits); expect(capture.start(input, observed(100)).ok).toBe(true); return capture;
}
function snapshot(capture: ReturnType<typeof recorder>): ImprovTake {
  const take = capture.snapshot(); if (!take) throw Error("No started take"); return take;
}
function assertFrozen(value: unknown) {
  if (value === null || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  Object.values(value).forEach(assertFrozen);
}

describe("Improv take lifecycle", () => {
  it("starts only at an explicit valid boundary and retains an empty completed take", () => {
    const capture = recorder(); expect(capture.metadata()).toBeNull(); expect(capture.snapshot()).toBeNull();
    expect(capture.append(message(), context)).toEqual({ ok: false, reason: "not-recording" });
    expect(capture.stop(observed(90))).toEqual({ ok: false, reason: "not-recording" });
    expect(capture.interrupt("consumer-lost", observed(90))).toEqual({ ok: false, reason: "not-recording" });
    expect(capture.start(input, observed(100))).toEqual({ ok: true, takeId: "take-1", status: "recording", eventWatermark: 0 });
    expect(capture.stop(observed(2_000))).toEqual({ ok: true, takeId: "take-1", status: "completed", eventWatermark: 0 });
    const take = snapshot(capture);
    expect(take.events).toEqual([]); expect(take.metadata.start.observation.atMs).toBe(100);
    expect(take.metadata.terminal?.boundary.observation.atMs).toBe(2_000);
  });

  it("keeps leading/trailing silence and pauses without moving the origin to the first note", () => {
    const capture = started(); capture.append(message(1, [0x90, 60, 80], { receivedAtMs: 1_000, sourceTimeStampMs: 950 }), context);
    capture.append(message(2, [0x80, 60, 10], { receivedAtMs: 10_000, sourceTimeStampMs: 9_950 }), context);
    capture.stop(observed(20_000)); const take = snapshot(capture);
    expect(take.metadata.start.observation.atMs).toBe(100); expect(take.metadata.terminal?.boundary.observation.atMs).toBe(20_000);
    expect(take.events.map(({ raw }) => raw.receivedAtMs)).toEqual([1_000, 10_000]);
    expect(take.events.map((event) => inspectImprovEventTiming(event, take.metadata).receipt)).toEqual(["within-boundaries", "within-boundaries"]);
  });

  it("finalizes once; double Stop and later interruption cannot change the first terminal boundary", () => {
    const capture = started(); capture.append(message(), context); capture.stop(observed(200)); const first = snapshot(capture);
    capture.stop(observed(999)); capture.interrupt("background", observed(1_000));
    expect(capture.append(message(2), context)).toEqual({ ok: false, reason: "not-recording" });
    expect(snapshot(capture)).toEqual(first);
  });

  it.each(["background", "freeze", "pagehide", "consumer-lost", "capture-unavailable"] as const)("preserves the prefix on %s and never resumes implicitly", (reason) => {
    const capture = started(); capture.append(message(), context); capture.interrupt(reason, observed(200));
    const take = snapshot(capture); expect(take.metadata.status).toBe("interrupted"); expect(take.metadata.terminal?.reason).toBe(reason);
    expect(take.events).toHaveLength(1); expect(capture.append(message(2), context).ok).toBe(false);
    expect(capture.start(input, observed(300))).toEqual({ ok: false, reason: "already-started" });
    capture.stop(observed(400)); expect(snapshot(capture)).toEqual(take);
  });

  it("gives a new explicit capture a new identity while the original controller keeps its journal", () => {
    let nextId = 0; const options = { createId: () => `take-${++nextId}` };
    const first = createImprovTakeRecorder(options); first.start(input, observed(100)); first.interrupt("background", observed(200));
    const original = first.snapshot(); const next = createImprovTakeRecorder(options);
    expect(next.metadata()).toBeNull(); next.start(input, observed(300));
    expect(next.metadata()?.takeId).toBe("take-2"); expect(first.snapshot()).toEqual(original);
    expect(next.metadata()?.eventWatermark).toBe(0);
  });

  it("rejects Start while already recording without consuming another identity", () => {
    const createId = vi.fn(() => "take-1"); const capture = createImprovTakeRecorder({ createId });
    capture.start(input, observed(100)); expect(capture.start(input, observed(150))).toEqual({ ok: false, reason: "already-started" });
    expect(createId).toHaveBeenCalledTimes(1);
  });

  it.each([null, "", "   "])("requires a usable selected input identity: %s", (id) => {
    const capture = recorder(); expect(capture.start({ id, name: "Piano" }, observed(100))).toEqual({ ok: false, reason: "invalid-start" });
    expect(capture.snapshot()).toBeNull();
  });

  it.each([Number.NaN, Infinity, -Infinity, -1])("rejects invalid explicit Start timing %s", (atMs) => {
    const capture = recorder(); expect(capture.start(input, observed(atMs)).ok).toBe(false); expect(capture.snapshot()).toBeNull();
  });

  it.each([{ ...context, ownerId: "" }, { ...context, clockId: " " }, { ...context, timeOriginMs: Number.NaN }])("rejects invalid clock/owner context %j", (invalid) => {
    expect(recorder().start(input, observed(100, invalid))).toEqual({ ok: false, reason: "invalid-start" });
  });

  it("keeps initial held keys/controllers unknown and never fabricates attacks or stop releases", () => {
    const capture = started();
    expect(capture.metadata()?.initialState).toEqual({ heldKeys: "unknown", controllers: "unknown" });
    capture.append(message(1, [0xb2, 64, 127]), context); capture.append(message(2, [0x92, 60, 90]), context);
    capture.stop(observed(500));
    expect(snapshot(capture).events.map(({ raw }) => raw.bytes)).toEqual([[0xb2, 64, 127], [0x92, 60, 90]]);
    expect(capture.metadata()?.initialState).toEqual({ heldKeys: "unknown", controllers: "unknown" });
  });
});

describe("raw journal fidelity and timing uncertainty", () => {
  it("retains attacks, both release encodings, channels, velocities, chords, repeated and unmatched notes", () => {
    const capture = started(); const values = [[0x95, 60, 90], [0x95, 64, 71], [0x95, 60, 40],
      [0x85, 60, 33], [0x95, 64, 0], [0x82, 99, 40], [0x93, 70, 80]];
    values.forEach((bytes, i) => capture.append(message(i + 50, bytes), context)); capture.stop(observed(200));
    expect(snapshot(capture).events.map(({ raw }) => raw.bytes)).toEqual(values);
    expect(snapshot(capture).events.map(({ sequence }) => sequence)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(snapshot(capture).events.map(({ raw }) => raw.sequence)).toEqual([50, 51, 52, 53, 54, 55, 56]);
  });

  it("captures every CC64 value and repetitions without interpretation", () => {
    const capture = started(); const values = [...Array.from({ length: 128 }, (_, i) => i), 127, 127, 63, 64, 0, 0];
    values.forEach((value, index) => capture.append(message(index + 1, [0xbf, 64, value]), context));
    expect(snapshot(capture).events.map(({ raw }) => raw.bytes?.[2])).toEqual(values);
  });

  it("retains non-note/system messages, unknown encodings and incomplete or malformed payloads", () => {
    const capture = started(); const values = [[0xf8], [0xfe], [0xfa], [0xc1, 7], [0xe1, 3, 70], [0xb1, 1, 64],
      [0xf0, 1, 2, 3, 0xf7], [], [0x90], [0x90, 60, 255], [0x00, 5, 12]];
    values.forEach((bytes, index) => capture.append(message(index + 1, bytes), context));
    expect(snapshot(capture).events.map(({ raw }) => raw.bytes)).toEqual(values);
  });

  it.each(["unavailable", "unreadable"] as const)("keeps %s payload status as evidence", (dataStatus) => {
    const capture = started(); capture.append(message(1, null, { dataStatus }), context);
    expect(snapshot(capture).events[0].raw).toMatchObject({ bytes: null, dataStatus, provenance: "browser-midi-message" });
  });

  it("keeps equal/regressing source and receipt times in delivered order with explicit flags", () => {
    const capture = started(); const sources = [110, 110, 90]; const receipts = [120, 120, 115];
    sources.forEach((sourceTimeStampMs, index) => capture.append(message(index + 1, [0x90, 60 + index, 80],
      { sourceTimeStampMs, receivedAtMs: receipts[index] }), context));
    const events = snapshot(capture).events;
    expect(events.map(({ raw }) => raw.sourceTimeStampMs)).toEqual(sources);
    expect(events.map(({ raw }) => raw.receivedAtMs)).toEqual(receipts);
    expect(events.map(({ timing }) => timing.sourceTimestampRegressed)).toEqual([false, false, true]);
    expect(events.map(({ timing }) => timing.receiptTimestampRegressed)).toEqual([false, false, true]);
  });

  it.each([{ time: null, validity: "unavailable" }, { time: NaN, validity: "nonfinite" },
    { time: Infinity, validity: "nonfinite" }, { time: -Infinity, validity: "nonfinite" }, { time: -1, validity: "negative" }])("retains anomalous source time $time with $validity validity", ({ time, validity }) => {
    const capture = started(); capture.append(message(1, [0xf8], { sourceTimeStampMs: time }), context);
    const event = snapshot(capture).events[0]; expect(event.raw.sourceTimeStampMs).toBe(time); expect(event.timing.sourceValidity).toBe(validity);
  });

  it.each([NaN, Infinity, -Infinity, -1])("retains anomalous receipt time %s", (receivedAtMs) => {
    const capture = started(); expect(capture.append(message(1, [0xf8], { receivedAtMs }), context).ok).toBe(true);
    const event = snapshot(capture).events[0]; expect(event.raw.receivedAtMs).toBe(receivedAtMs);
    expect(event.timing.receiptValidity).toBe(receivedAtMs < 0 && Number.isFinite(receivedAtMs) ? "negative" : "nonfinite");
  });

  it("uses invocation boundaries while separately flagging pre-Start and post-Stop timestamps", () => {
    const capture = started(); capture.append(message(1, [0x90, 60, 80], { sourceTimeStampMs: 10, receivedAtMs: 20 }), context);
    capture.append(message(2, [0x80, 60, 0], { sourceTimeStampMs: 900, receivedAtMs: 800 }), context);
    capture.stop(observed(500)); const take = snapshot(capture);
    expect(take.events.map((event) => inspectImprovEventTiming(event, take.metadata))).toEqual([
      { source: "before-start", receipt: "before-start", sourceClockVerified: false },
      { source: "after-end", receipt: "after-end", sourceClockVerified: false },
    ]);
    expect(take.events.map(({ raw }) => raw.sourceTimeStampMs)).toEqual([10, 900]);
    expect(capture.append(message(3), context).ok).toBe(false);
  });

  it("keeps an epoch-like browser source timestamp without pretending its domain is verified", () => {
    const capture = started(); capture.append(message(1, [0xf8], { sourceTimeStampMs: 1_000_120 }), context); capture.stop(observed(500));
    const take = snapshot(capture); expect(take.metadata.sourceTimestampClock).toBe("browser-event-unverified");
    expect(inspectImprovEventTiming(take.events[0], take.metadata)).toMatchObject({ source: "after-end", sourceClockVerified: false });
  });

  it.each([NaN, Infinity, -1, 50])("ends on Stop even with anomalous boundary %s, without rewriting it", (atMs) => {
    const capture = started(); capture.append(message(), context); capture.stop(observed(atMs)); const take = snapshot(capture);
    expect(take.metadata.status).toBe("completed"); expect(take.metadata.terminal?.boundary.observation.atMs).toBe(atMs);
    expect(inspectImprovEventTiming(take.events[0], take.metadata).receipt).toBe("uncertain-end");
    if (Number.isFinite(atMs)) expect(take.metadata.terminal?.boundary.precedesStart).toBe(true);
  });

  it("allows an unknown time origin but requires the context to stay stable", () => {
    const unknown = { ...context, timeOriginMs: null }; const capture = recorder(); capture.start(input, observed(100, unknown));
    capture.append(message(), unknown); expect(capture.metadata()?.eventWatermark).toBe(1);
    expect(capture.metadata()?.start.observation.context.timeOriginMs).toBeNull();
  });

  it("reports transport gaps separately while preserving contiguous take-local order", () => {
    const capture = started(); capture.append(message(50), context); capture.append(message(55), context);
    expect(snapshot(capture).events.map(({ sequence, raw, timing }) => [sequence, raw.sequence, timing.transportSequenceGap]))
      .toEqual([[1, 50, null], [2, 55, 4]]);
  });

  it("deeply freezes snapshots and copies caller-owned buffers and metadata", () => {
    const mutableInput = { ...input }; const mutableContext = { ...context }; const values = [0x90, 60, 90];
    const raw = message(1, values); const capture = recorder(); capture.start(mutableInput, observed(100, mutableContext)); capture.append(raw, context);
    const old = snapshot(capture); values[1] = 99; mutableInput.name = "Changed"; mutableContext.clockId = "Changed";
    Reflect.set(raw.input, "name", "Changed"); Reflect.set(raw, "sourceTimeStampMs", 999);
    capture.append(message(2), context); capture.stop(observed(500));
    expect(old.events[0].raw.bytes).toEqual([0x90, 60, 90]); expect(old.events[0].raw.sourceTimeStampMs).toBe(110);
    expect(old.metadata.selectedInput).toEqual(input); expect(old.metadata.start.observation.context).toEqual(context);
    expect(old.metadata.eventWatermark).toBe(1); expect(old.events).toHaveLength(1); expect(old.metadata.status).toBe("recording");
    expect(old.events[0].raw.input.name).toBe(input.name); assertFrozen(old); assertFrozen(snapshot(capture));
    expect(Reflect.set(old.events[0].raw, "receivedAtMs", 0)).toBe(false);
  });
});

describe("selected input and continuity", () => {
  it("ignores other and unidentified sources without consuming local sequence or changing the take", () => {
    const capture = started(); const before = snapshot(capture);
    expect(capture.append(message(1, [0xf8], { input: { id: "other", name: "Other" } }), context)).toEqual({ ok: false, reason: "other-input" });
    expect(capture.append(message(2, [0xf8], { input: { id: null, name: null } }), context).ok).toBe(false);
    expect(capture.observeConnection(connection("disconnected", { input: { id: "other", name: "Other" } }), context).ok).toBe(false);
    expect(snapshot(capture)).toEqual(before); capture.append(message(3), context); expect(capture.metadata()?.eventWatermark).toBe(1);
  });

  it("retains source-specific loss separately, interrupts and never fabricates release or pedal-up", () => {
    const capture = started(); capture.append(message(1, [0x90, 60, 80]), context); capture.append(message(2, [0xb0, 64, 127]), context);
    const disconnected = connection("disconnected"); capture.observeConnection(disconnected, context); const take = snapshot(capture);
    expect(take.metadata.status).toBe("interrupted"); expect(take.metadata.terminal?.reason).toBe("device-disconnected");
    expect(take.connections).toEqual([{ sequence: 1, afterEventSequence: 2, raw: disconnected }]);
    expect(take.events.map(({ raw }) => raw.bytes)).toEqual([[0x90, 60, 80], [0xb0, 64, 127]]);
    Reflect.set(disconnected.input, "name", "Changed"); expect(capture.readConnections()[0].raw.input.name).toBe(input.name); assertFrozen(capture.readConnections());
  });

  it("cannot substitute another device or resume after reconnect; a missed loss is still a boundary", () => {
    const capture = started(); capture.observeConnection(connection("disconnected"), context); const ended = snapshot(capture);
    expect(capture.observeConnection(connection("connected"), context).ok).toBe(false);
    expect(capture.append(message(1, [0xf8], { input: { id: "other", name: "Other" } }), context).ok).toBe(false);
    expect(capture.append(message(), context).ok).toBe(false); expect(snapshot(capture)).toEqual(ended);
    const next = started(); next.observeConnection(connection("connected"), context);
    expect(next.metadata()?.terminal?.reason).toBe("source-reconnected"); expect(next.metadata()?.connectionCount).toBe(1);
  });

  it.each([{ ...context, ownerId: "replacement" }, { ...context, clockId: "other-document" }, { ...context, timeOriginMs: 2_000_000 }])("interrupts context mismatch instead of mixing it into the journal: %j", (different) => {
    const capture = started(); capture.append(message(), context);
    expect(capture.append(message(2), different)).toEqual({ ok: false, reason: "continuity-mismatch" });
    const take = snapshot(capture); expect(take.events).toHaveLength(1); expect(take.metadata.terminal?.refusedTransportSequence).toBe(2);
    expect(take.metadata.terminal?.boundary.contextMatchesStart).toBe(false); expect(take.metadata.terminal?.boundary.observation.context).toEqual(different);
  });

  it("interrupts mismatched connection/Stop context and preserves uncertainty on explicit owner loss", () => {
    const different = { ...context, ownerId: "new" }; const first = started(); const second = started(); const third = started();
    expect(first.observeConnection(connection("disconnected"), different).ok).toBe(false);
    expect(first.metadata()?.terminal?.reason).toBe("continuity-mismatch"); expect(first.readConnections()).toEqual([]);
    expect(second.stop(observed(200, different)).ok).toBe(false); expect(second.metadata()?.status).toBe("interrupted");
    third.interrupt("consumer-lost", observed(200, different)); expect(third.metadata()?.terminal?.reason).toBe("consumer-lost");
    expect(third.metadata()?.terminal?.boundary.contextMatchesStart).toBe(false);
  });

  it.each([1, 0, -1, NaN, 1.5])("detects invalid/non-advancing transport sequence %s and keeps the prefix", (sequence) => {
    const capture = started(); capture.append(message(1), context);
    expect(capture.append(message(sequence), context)).toEqual({ ok: false, reason: "transport-order-mismatch" });
    expect(capture.metadata()?.terminal?.refusedTransportSequence).toBe(sequence); expect(snapshot(capture).events).toHaveLength(1);
  });
});

describe("bounded retention and Phase 3 cursor", () => {
  it("publishes provisional limits without claiming measured heap size", () => {
    expect(DEFAULT_IMPROV_TAKE_LIMITS).toEqual({ maxEvents: 100_000, maxAccountedBytes: 64 * 1024 * 1024 });
    expect(improvMessageAccountedBytes(message())).toBe(512 + 24 + 2 * (input.id.length + input.name.length));
  });

  it("accepts the exact event boundary then interrupts; no eviction or extra append", () => {
    const capture = started({ maxEvents: 3 }); capture.append(message(1), context); capture.append(message(2), context);
    expect(capture.metadata()?.status).toBe("recording");
    expect(capture.append(message(3), context)).toMatchObject({ ok: true, status: "interrupted", eventWatermark: 3 });
    expect(capture.metadata()?.terminal?.reason).toBe("event-limit"); expect(capture.metadata()?.terminal?.refusedTransportSequence).toBeNull();
    expect(capture.append(message(4), context).ok).toBe(false); expect(snapshot(capture).events.map(({ sequence }) => sequence)).toEqual([1, 2, 3]);
  });

  it("accepts the exact accounted-byte boundary and interrupts with the event retained", () => {
    const baseline = started().metadata()!.accountedBytes; const charge = improvMessageAccountedBytes(message());
    const capture = started({ maxAccountedBytes: baseline + charge }); capture.append(message(), context);
    expect(capture.metadata()).toMatchObject({ status: "interrupted", eventWatermark: 1, accountedBytes: baseline + charge });
    expect(capture.metadata()?.terminal?.reason).toBe("byte-limit"); expect(snapshot(capture).events).toHaveLength(1);
  });

  it("refuses an over-budget event explicitly, retaining the complete captured prefix", () => {
    const baseline = started().metadata()!.accountedBytes; const charge = improvMessageAccountedBytes(message());
    const capture = started({ maxAccountedBytes: baseline + 2 * charge - 1 }); capture.append(message(1), context); const prefix = snapshot(capture);
    expect(capture.append(message(2), context)).toEqual({ ok: false, reason: "byte-limit" });
    expect(snapshot(capture).events).toEqual(prefix.events); expect(capture.metadata()?.accountedBytes).toBe(prefix.metadata.accountedBytes);
    expect(capture.metadata()?.terminal?.refusedTransportSequence).toBe(2); expect(capture.readEvents(0, 10)).toEqual(prefix.events);
  });

  it("rejects oversized initial metadata and does not create a partial started take", () => {
    const capture = recorder({ maxAccountedBytes: 1 }); expect(capture.start(input, observed(100))).toEqual({ ok: false, reason: "byte-limit" });
    expect(capture.snapshot()).toBeNull();
  });

  it("preserves an empty started take when metadata exactly fills the budget", () => {
    const baseline = started().metadata()!.accountedBytes;
    const capture = recorder({ maxAccountedBytes: baseline });
    expect(capture.start(input, observed(100))).toMatchObject({ ok: true, status: "interrupted", eventWatermark: 0 });
    expect(capture.metadata()?.terminal?.reason).toBe("byte-limit");
    expect(snapshot(capture).events).toEqual([]);
    expect(capture.append(message(), context).ok).toBe(false);
    expect(capture.start(input, observed(200)).ok).toBe(false);
  });

  it("bounds a source-loss observation with the same byte policy", () => {
    const baseline = started().metadata()!.accountedBytes; const capture = started({ maxAccountedBytes: baseline + 1 });
    expect(capture.observeConnection(connection("disconnected"), context)).toEqual({ ok: false, reason: "byte-limit" });
    expect(capture.metadata()?.status).toBe("interrupted"); expect(capture.metadata()?.eventWatermark).toBe(0);
    expect(capture.readConnections()).toEqual([]);
  });

  it.each([{ maxEvents: 0 }, { maxEvents: 1.5 }, { maxAccountedBytes: NaN }, { maxAccountedBytes: -1 }])("rejects invalid limit configuration %j", (limits) => {
    expect(() => recorder(limits)).toThrow("positive safe integers");
  });

  it("reads frozen contiguous deltas after an inclusive watermark without changing older snapshots", () => {
    const capture = started(); capture.append(message(100), context); capture.append(message(105), context);
    const checkpoint = capture.metadata()!; const firstBatch = capture.readEvents(0, checkpoint.eventWatermark);
    capture.append(message(109), context); const secondBatch = capture.readEvents(checkpoint.eventWatermark, 10);
    expect(firstBatch.map(({ sequence }) => sequence)).toEqual([1, 2]); expect(secondBatch.map(({ sequence }) => sequence)).toEqual([3]);
    expect([...firstBatch, ...secondBatch]).toEqual(snapshot(capture).events); expect(checkpoint.eventWatermark).toBe(2);
    expect(capture.metadata()?.eventWatermark).toBe(3); expect(capture.readEvents(3, 10)).toEqual([]);
    expect(capture.readEvents(0, 1)).toEqual([firstBatch[0]]); assertFrozen(firstBatch); assertFrozen(secondBatch);
  });

  it.each([[-1, 10], [1, 10], [0, 0], [0, NaN], [0.5, 10]])("rejects an invalid delta cursor %s / %s", (cursor, limit) => {
    expect(() => recorder().readEvents(cursor, limit)).toThrow("Invalid Improv event cursor or limit");
  });
});
