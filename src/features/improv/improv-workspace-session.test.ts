import { afterEach, describe, expect, it, vi } from "vitest";
import { createImprovWorkspaceSession } from "./improv-workspace-session";
import { IndexedDbImprovLibrary } from "./persistence/improv-indexeddb";
import { FakeImprovIndexedDb } from "./persistence/improv-indexeddb-fake";
import { fixtureContext as context, fixtureInput as input } from "./improv-test-fixture";
import type { RawMidiMessage } from "@/lib/midi/midi-transport";
import { projectImprovTiming } from "./improv-performance";
import { createImprovTakeRecorder } from "./improv-take-recorder";

const sessions: ReturnType<typeof createImprovWorkspaceSession>[] = [];
afterEach(async () => { await Promise.all(sessions.splice(0).map((session) => session.dispose())); vi.restoreAllMocks(); vi.useRealTimers(); });
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
  it("retains paused high-frequency evidence until the unchanged unsaved-message limit", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context); f.setTime(500); await f.session.pause();
    for (let i = 1; i <= 2048; i++) f.session.append(f.raw(i, [0xf8]), context);
    expect(f.session.phase()).toBe("interrupted"); expect(f.session.metadata()?.eventCount).toBe(2048);
    expect(f.session.timeline()!.view(99999, 0).retainedNotes).toBe(0); await f.session.retry();
    const take = await f.library.loadTake(f.session.state().takeId!); expect(take.record.controls).toHaveLength(2); expect(take.record.captureFailure?.reason).toBe("unsaved-backlog-limit");
  });
  it("terminates conservatively if resume authorization saving fails after native resume", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context); f.setTime(500); await f.session.pause();
    const original = f.library.checkpoint.bind(f.library); vi.spyOn(f.library, "checkpoint").mockImplementation(value => {
      if (value.controls?.at(-1)?.kind === "resume-ack") f.fake.commitError = "QuotaExceededError";
      return original(value);
    });
    const audio = { active: () => true, status: () => "recording" as const, pause: async () => {}, resume: vi.fn(async () => {}), stop: vi.fn() };
    f.setTime(5000); await f.session.resume(() => {}, audio);
    expect(f.session.phase()).toBe("interrupted"); expect(audio.stop).toHaveBeenCalledOnce();
    expect(f.session.metadata()?.terminal?.reason).toBe("coordination-failed"); expect(f.session.timeline()!.view(9000, 0).atMs).toBe(400);
    vi.mocked(f.library.checkpoint).mockImplementation(original); await f.session.retry();
    const take = await f.library.loadTake(f.session.state().takeId!); expect(take.record.controls).toHaveLength(4); expect(take.record.controls!.some(c => c.kind === "resume")).toBe(false);
  });
  it("preserves a correctly classified durable prefix if saving the effective cutover fails", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context); f.setTime(500); await f.session.pause();
    const original = f.library.checkpoint.bind(f.library); vi.spyOn(f.library, "checkpoint").mockImplementation(value => {
      if (value.controls?.at(-1)?.kind === "resume") f.fake.commitError = "QuotaExceededError";
      return original(value);
    });
    f.setTime(5000); await f.session.resume(() => {}); expect(f.session.phase()).toBe("interrupted");
    const prefix = await f.library.loadTake(f.session.state().takeId!); expect(prefix.record.committedControlWatermark).toBe(4);
    expect(projectImprovTiming(prefix)).toMatchObject({ durationMs: 400, knownEnd: false });
    vi.mocked(f.library.checkpoint).mockImplementation(original); await f.session.retry(); expect((await f.library.loadTake(prefix.record.takeId)).record.controls).toHaveLength(5);
  });
  it("pauses the same numbered take, retains raw context and resumes musical time", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context); f.setTime(200); f.session.append(f.raw(1), context);
    f.setTime(500); await f.session.pause(); const id = f.session.state().takeId;
    expect(f.session.phase()).toBe("paused"); expect(f.session.state().committedControlWatermark).toBe(2);
    f.setTime(10_000); f.session.append(f.raw(2, [0x90, 70, 80]), context);
    expect(f.session.timeline()!.view(10_000, 0)).toMatchObject({ atMs: 400, paused: true, retainedNotes: 1 });
    expect(f.session.heldPitches()).toEqual([60, 70]); await f.session.resume(() => {});
    expect(f.session.phase()).toBe("recording"); expect(f.session.state().takeId).toBe(id); expect(f.session.state().number).toBe(1);
    f.setTime(10_100); f.session.append(f.raw(3, [0x90, 64, 80]), context); f.setTime(10_200); await f.session.stop();
    const loaded = await f.library.loadTake(id!); expect(projectImprovTiming(loaded).durationMs).toBe(600);
    expect(loaded.chunks.flatMap(c => c.events)).toHaveLength(3); expect(loaded.record.controls?.map(c => c.kind)).toEqual(["pause", "pause-ack", "resume-request", "resume-ack", "resume"]);
  });
  it("does not open the musical gate while resume authorization is awaiting commit", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context); f.setTime(500); await f.session.pause();
    let release: (() => void) | undefined;
    const original = f.library.checkpoint.bind(f.library);
    vi.spyOn(f.library, "checkpoint").mockImplementation(value => {
      if (value.controls?.at(-1)?.kind === "resume-ack") f.fake.commitHold = commit => { release = commit; };
      return original(value);
    });
    f.setTime(10_000); const resuming = f.session.resume(() => {});
    await vi.waitFor(() => expect(release).toBeDefined());
    expect(f.session.state().committedControlWatermark).toBe(3); expect(f.session.phase()).toBe("resuming");
    f.setTime(20_000); f.session.append(f.raw(1, [0x90, 72, 90]), context);
    expect(f.session.timeline()!.view(20_000, 0)).toMatchObject({ paused: true, atMs: 400, retainedNotes: 0 });
    release!(); await resuming; expect(f.session.timeline()!.view(20_000, 0).atMs).toBe(400);
    f.setTime(20_100); f.session.append(f.raw(2, [0x90, 60, 90]), context); f.setTime(20_200); await f.session.stop();
    const loaded = await f.library.loadTake(f.session.state().takeId!);
    expect(projectImprovTiming(loaded).events.map(e => [e.atMs, e.represented])).toEqual([[400, false], [500, true]]);
    expect(loaded.record.controls?.at(-1)?.afterEventSequence).toBe(1);
  });
  it("keeps failed Pause frozen, blocks Resume and permits explicit save retry", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context); await f.session.retry();
    f.fake.commitError = "QuotaExceededError"; f.setTime(500); await f.session.pause();
    expect(f.session.phase()).toBe("paused"); expect(f.session.state().failure).toBe("quota");
    const original = f.library.checkpoint.bind(f.library); vi.spyOn(f.library, "checkpoint").mockRejectedValue(new Error("Still failed"));
    await f.session.resume(() => {}); expect(f.session.phase()).toBe("paused"); expect(f.session.timeline()!.view(9999, 0).atMs).toBe(400);
    vi.mocked(f.library.checkpoint).mockImplementation(original); await f.session.retry(); f.setTime(10_000); await f.session.resume(() => {});
    expect(f.session.phase()).toBe("recording"); await f.session.stop();
  });
  it("retries a failed resume intent without adding duplicate controls or a new take", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context); f.setTime(500); await f.session.pause();
    f.fake.commitError = "QuotaExceededError"; f.setTime(10_000); await f.session.resume(() => {});
    expect(f.session.phase()).toBe("paused"); expect(f.session.metadata()?.controlCount).toBe(3);
    await f.session.retry(); f.setTime(20_000); await f.session.resume(() => {}); await f.session.stop();
    const loaded = await f.library.loadTake(f.session.state().takeId!); expect(loaded.record.controls).toHaveLength(5); expect(loaded.record.number).toBe(1);
  });
  it("Stop during an open pause closes musical time without inventing Resume", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context); f.setTime(500); await f.session.pause();
    f.setTime(100_000); await f.session.stop(); const loaded = await f.library.loadTake(f.session.state().takeId!);
    expect(projectImprovTiming(loaded)).toMatchObject({ durationMs: 400, elapsedDurationMs: 99_900, knownEnd: true, pauseCount: 1 });
    expect(loaded.record.controls).toHaveLength(2); expect(loaded.record.capture.terminal?.reason).toBe("user-stop");
  });
  it("serializes rapid duplicate Pause and Resume clicks", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context); f.setTime(500);
    await Promise.all([f.session.pause(), f.session.pause(), f.session.pause()]);
    f.setTime(5000); await Promise.all([f.session.resume(() => {}), f.session.resume(() => {}), f.session.resume(() => {})]);
    expect(f.session.metadata()?.controlCount).toBe(5); await f.session.stop(); expect(f.session.state().number).toBe(1);
  });
  it("stops during Pausing and fences its late callback from a new take", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context); f.setTime(500);
    let acknowledge!: () => void;
    const audio = { active: () => true, status: () => "recording" as const, pause: () => new Promise<void>(resolve => { acknowledge = resolve; }), resume: async () => {}, stop: vi.fn() };
    const pausing = f.session.pause(audio); await f.session.stop();
    const old = await f.library.loadTake(f.session.state().takeId!); expect(old.record.controls?.map(c => c.kind)).toEqual(["pause"]);
    f.setTime(1000); f.session.start(f.collection, input, context); acknowledge(); await pausing;
    expect(f.session.phase()).toBe("recording"); expect(f.session.metadata()?.controlCount).toBe(0); await f.session.stop();
  });
  it("Stop during native Resuming keeps the pause open and ignores late acknowledgment", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context); f.setTime(500); await f.session.pause();
    let acknowledge!: () => void;
    const audio = { active: () => true, status: () => "paused" as const, pause: async () => {}, resume: vi.fn(() => new Promise<void>(resolve => { acknowledge = resolve; })), stop: vi.fn() };
    f.setTime(5000); const resuming = f.session.resume(() => {}, audio); await vi.waitFor(() => expect(audio.resume).toHaveBeenCalledOnce());
    await f.session.stop(); acknowledge(); await resuming;
    const loaded = await f.library.loadTake(f.session.state().takeId!); expect(loaded.record.controls?.map(c => c.kind)).toEqual(["pause", "pause-ack", "resume-request"]);
    expect(projectImprovTiming(loaded).durationMs).toBe(400);
  });
  it.each(["pause", "resume"] as const)("terminates a failed coordinated %s and retains legitimate prefixes", async kind => {
    const f = await fixture(); f.session.start(f.collection, input, context); f.session.append(f.raw(1), context); f.setTime(500);
    const audio = { active: () => true, status: () => "recording" as const, pause: async () => { if (kind === "pause") throw new Error("Native failure"); }, resume: async () => { throw new Error("Native failure"); }, stop: vi.fn() };
    await f.session.pause(audio); if (kind === "resume") { f.setTime(5000); await f.session.resume(() => {}, audio); }
    expect(f.session.phase()).toBe("interrupted"); expect(f.session.metadata()?.terminal?.reason).toBe("coordination-failed");
    expect(audio.stop).toHaveBeenCalledOnce(); expect((await f.library.loadTake(f.session.state().takeId!)).chunks[0].events).toHaveLength(1);
  });
  it("continues MIDI-only Pause/Resume after an independent microphone failure", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context);
    const audio = { active: () => false, status: () => "failed" as const, pause: vi.fn(async () => {}), resume: vi.fn(async () => {}), stop: vi.fn() };
    f.setTime(500); await f.session.pause(audio); f.setTime(5000); await f.session.resume(() => {}, audio);
    expect(f.session.phase()).toBe("recording"); expect(audio.pause).not.toHaveBeenCalled(); expect(audio.resume).not.toHaveBeenCalled();
    expect(f.session.metadata()?.terminal).toBeNull(); await f.session.stop();
  });
  it.each(["background", "freeze", "pagehide", "consumer-lost"] as const)("%s during Paused is terminal and cannot Resume", async reason => {
    const f = await fixture(); f.session.start(f.collection, input, context); f.setTime(500); await f.session.pause();
    await f.session.interrupt(reason); await f.session.resume(() => {});
    expect(f.session.metadata()?.terminal?.reason).toBe(reason); expect(f.session.phase()).toBe("interrupted");
    expect(f.session.metadata()?.controlCount).toBe(2);
  });
  it("revalidates safety after storage waits before enabling musical performance", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context); f.setTime(500); await f.session.pause();
    const validate = vi.fn(() => { throw new Error("Selected input unavailable"); });
    await f.session.resume(validate); expect(f.session.phase()).toBe("interrupted"); expect(f.session.metadata()?.controlCount).toBe(2);
  });
  it("keeps silence checkpoints and lease renewal alive during a long pause", async () => {
    vi.useFakeTimers(); const f = await fixture(); f.session.start(f.collection, input, context); f.setTime(500); await f.session.pause();
    await vi.advanceTimersByTimeAsync(40_000);
    const loaded = await f.library.loadTake(f.session.state().takeId!); expect(loaded.record.status).toBe("recording");
    expect(loaded.record.lease!.expiresAtMs).toBeGreaterThan(Date.now()); expect(f.session.phase()).toBe("paused"); await f.session.stop();
  });
  it("recovers a crashed paused prefix as incomplete without Resume or synthetic Stop", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context); f.setTime(500); await f.session.pause();
    const takeId = f.session.state().takeId!; const before = await f.library.loadTake(takeId);
    vi.spyOn(Date, "now").mockReturnValue(before.record.lease!.expiresAtMs + 1); await f.library.recoverTake(takeId);
    const recovered = await f.library.loadTake(takeId); expect(recovered.record.status).toBe("incomplete"); expect(recovered.record.capture.terminal).toBeNull();
    expect(recovered.record.controls).toEqual(before.record.controls); expect(projectImprovTiming(recovered)).toMatchObject({ durationMs: 400, knownEnd: false });
    await f.session.resume(() => {}); expect(f.session.phase()).toBe("interrupted");
  });
  it("charges and bounds pause observations without consuming raw message counts", () => {
    const rec = createImprovTakeRecorder({ createId: () => "bounded", pauseSupport: true }); rec.start(input, { atMs: 100, context });
    const kinds = ["pause", "pause-ack", "resume-request", "resume-ack", "resume"] as const;
    for (let i = 0; i < 2560; i++) expect(rec.control(kinds[i % 5], { atMs: 101 + i, context }, "off").ok).toBe(true);
    expect(rec.metadata()?.eventCount).toBe(0); expect(rec.metadata()?.accountedBytes).toBeGreaterThan(1024);
    expect(rec.control("pause", { atMs: 3000, context }, "off").ok).toBe(false); expect(rec.metadata()?.terminal?.reason).toBe("control-limit");
  });
  it("projects only accepted events, keeps final limit attack, and ignores terminal deliveries", async () => {
    const f = await fixture(); expect(f.session.timeline()).toBeNull(); f.session.append(f.raw(1), context);
    f.session.start(f.collection, input, context); await f.session.retry();
    f.session.append({ ...f.raw(1), input: { id: "other", name: "Other" } }, context);
    for (let i = 2; i <= 2049; i++) f.session.append(f.raw(i), context);
    expect(f.session.state().captureStatus).toBe("interrupted");
    const model = f.session.timeline()!; expect(model.view(100, 0)).toMatchObject({ retainedNotes: 2048, recording: false, crowded: true });
    f.session.append(f.raw(2050), context); expect(model.view(100, 0).retainedNotes).toBe(2048);
    await f.session.retry(); await f.session.retry();
  });
  it("preserves frozen Take 1 while a fresh take gets a separate display model", async () => {
    const f = await fixture(); f.session.start(f.collection, input, context); f.session.append(f.raw(1), context);
    f.setTime(500); await f.session.stop(); const firstId = f.session.state().takeId!; const first = f.session.timeline()!;
    f.setTime(1000); f.session.start(f.collection, input, context); f.session.append(f.raw(2, [0x90, 67, 90]), context);
    expect(f.session.timeline()).not.toBe(first); expect(first.view(9999, 0).notes[0].pitch).toBe(60);
    expect(f.session.timeline()!.view(1000, 0).notes[0].pitch).toBe(67);
    await f.session.stop(); expect((await f.library.loadTake(firstId)).chunks[0].events[0].raw.bytes?.[1]).toBe(60);
    f.session.resetCompleted(); expect(f.session.timeline()).toBeNull();
  });
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
