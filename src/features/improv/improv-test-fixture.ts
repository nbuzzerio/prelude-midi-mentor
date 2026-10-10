import type { RawMidiMessage } from "@/lib/midi/midi-transport";
import { createImprovTakeRecorder } from "./improv-take-recorder";
import { IndexedDbImprovLibrary } from "./persistence/improv-indexeddb";
import { FakeImprovIndexedDb } from "./persistence/improv-indexeddb-fake";

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
