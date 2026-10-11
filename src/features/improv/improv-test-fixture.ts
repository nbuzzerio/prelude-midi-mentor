import type { RawMidiMessage } from "@/lib/midi/midi-transport";
import { createImprovTakeRecorder } from "./improv-take-recorder";
import { IndexedDbImprovLibrary } from "./persistence/improv-indexeddb";
import { FakeImprovIndexedDb } from "./persistence/improv-indexeddb-fake";
import type { ImprovTakeControl } from "./improv-take";

export const fixtureInput = { id: "piano", name: "Room piano" };
export const fixtureContext = { ownerId: "owner", clockId: "document", timeOriginMs: -0 };
export const fixtureObservation = (atMs: number) => ({ atMs, context: fixtureContext });
export async function performanceFixture(messages: readonly Partial<RawMidiMessage>[] = [], options: {
  end?: number; mode?: "completed" | "interrupted" | "recording" | "incomplete"; committedCount?: number;
} = {}) {
  const fake = new FakeImprovIndexedDb(); let now = 1000;
  const lib = new IndexedDbImprovLibrary({ factory: fake.factory, now: () => now });
  await lib.createCollection("book", "Disney book", "first-take-sight-reading");
  const rec = createImprovTakeRecorder({ createId: () => "take-1" }); rec.start(fixtureInput, fixtureObservation(100));
  let saved = await lib.allocateTake("book", rec.metadata()!, "writer");
  messages.forEach((message, index) => rec.append({ provenance: "browser-midi-message", sequence: index + 1, input: fixtureInput,
    bytes: [0x90, 60, 90], dataStatus: "available", sourceTimeStampMs: 110 + index * 10, receivedAtMs: 120 + index * 10, ...message }, fixtureContext));
  const mode = options.mode ?? "completed";
  if (mode === "completed") rec.stop(fixtureObservation(options.end ?? 500));
  if (mode === "interrupted") rec.interrupt("background", fixtureObservation(options.end ?? 500));
  const count = options.committedCount ?? messages.length;
  do {
    const events = count === saved.committedEventWatermark ? [] : rec.readEvents(saved.committedEventWatermark, Math.min(256, count - saved.committedEventWatermark));
    saved = await lib.checkpoint({ takeId: saved.takeId, writerToken: saved.writerToken, expectedRevision: saved.revision,
      operationId: `save-${saved.revision}`, capture: rec.metadata()!, events, connections: [],
      finalize: events.length + saved.committedEventWatermark === rec.metadata()!.eventWatermark && (mode === "completed" || mode === "interrupted"), captureFailure: null });
  } while (saved.committedEventWatermark < count);
  if (mode === "incomplete") { now = 40_000; await lib.recoverTake(saved.takeId); }
  return { fake, lib, rec, loaded: await lib.loadTake(saved.takeId), evidence: await lib.exportCollection("book") };
}

export type PauseFixtureStep = { atMs: number; bytes?: number[]; control?: ImprovTakeControl["kind"]; audio?: ImprovTakeControl["audio"]; receipt?: number; source?: number | null };
/** Persists the same ordered event/control prefixes used by production, including empty batches. */
export async function pausePerformanceFixture(steps: readonly PauseFixtureStep[] = [], end = 20_000) {
  const fake = new FakeImprovIndexedDb(); let now = 1000;
  const lib = new IndexedDbImprovLibrary({ factory: fake.factory, now: () => now });
  await lib.createCollection("book", "Paused book", "first-take-sight-reading");
  const rec = createImprovTakeRecorder({ createId: () => "take-1", pauseSupport: true }); rec.start(fixtureInput, fixtureObservation(100));
  let saved = await lib.allocateTake("book", rec.metadata()!, "writer"); let sequence = 0;
  for (const step of steps) {
    if (step.control) rec.control(step.control, fixtureObservation(step.atMs), step.audio ?? "off");
    else rec.append({ provenance: "browser-midi-message", input: fixtureInput, sequence: ++sequence,
      bytes: step.bytes ?? [0x90, 60, 90], dataStatus: "available", receivedAtMs: step.receipt ?? step.atMs,
      sourceTimeStampMs: step.source === undefined ? step.atMs : step.source }, fixtureContext);
  }
  rec.stop(fixtureObservation(end));
  do {
    const events = rec.readEvents(saved.committedEventWatermark, 256); const watermark = saved.committedEventWatermark + events.length;
    const controls = rec.readControls().filter(c => c.afterEventSequence <= watermark);
    saved = await lib.checkpoint({ takeId: saved.takeId, writerToken: saved.writerToken, expectedRevision: saved.revision,
      operationId: `save-${saved.revision}`, capture: rec.metadata()!, events, connections: [], controls,
      finalize: watermark === rec.metadata()!.eventWatermark && controls.length === rec.metadata()!.controlCount, captureFailure: null });
  } while (saved.status === "recording");
  return { fake, lib, rec, loaded: await lib.loadTake(saved.takeId), evidence: await lib.exportCollection("book"), setWall: (n: number) => { now = n; } };
}
export const pauseSteps = (pause: number, resume: number): PauseFixtureStep[] => [
  { atMs: pause, control: "pause" }, { atMs: pause, control: "pause-ack" },
  { atMs: resume, control: "resume-request" }, { atMs: resume, control: "resume-ack" }, { atMs: resume, control: "resume" },
];
