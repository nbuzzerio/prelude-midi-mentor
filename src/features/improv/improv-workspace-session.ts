import type { MidiInputInfo, MidiInputConnectionChange, RawMidiMessage } from "@/lib/midi/midi-transport";
import type { ImprovArchiveLibrary, ImprovCollection } from "./improv-library";
import { decodeImprovMessage } from "./improv-performance";
import { createImprovTakeRecorder } from "./improv-take-recorder";
import { createImprovTakePersistence, type ImprovSaveState } from "./improv-take-persistence";
import type { ImprovCaptureContext, ImprovInterruptionReason, ImprovObservation } from "./improv-take";

/** Coordinates one attempt; React never owns the raw journal or committed watermark. */
export function createImprovWorkspaceSession(options: Readonly<{
  library: ImprovArchiveLibrary; createId: () => string; observe: () => ImprovObservation;
}>) {
  let capture: ReturnType<typeof createImprovTakePersistence> | null = null;
  let recorder: ReturnType<typeof createImprovTakeRecorder> | null = null;
  let collectionId: string | null = null;
  let selectedInputId: string | null = null;
  const held = new Map<string, number>(); let heldVersion = 0;
  const idle: ImprovSaveState = Object.freeze({ storageStatus: "idle", captureStatus: "idle", takeId: null, number: null,
    committedEventWatermark: 0, pendingEventCount: 0, pendingAccountedBytes: 0, pendingConnections: 0, failure: null, captureFailure: null });
  const state = () => capture?.state() ?? idle;
  const needsGuard = () => state().captureStatus === "recording" || !["idle", "saved"].includes(state().storageStatus);
  const clearHeld = () => { if (held.size) { held.clear(); heldVersion++; } };
  return Object.freeze({
    state, needsGuard, collectionId: () => collectionId, heldVersion: () => heldVersion,
    resetCompleted() {
      if (needsGuard()) return false;
      capture = null; recorder = null; collectionId = null;
      return true;
    },
    selectInput(id: string | null) { if (id !== selectedInputId) { selectedInputId = id; clearHeld(); } },
    heldPitches: () => [...new Set([...held.keys()].map((key) => Number(key.split(":")[1])))].sort((a, b) => a - b),
    start(collection: ImprovCollection, input: MidiInputInfo, context: ImprovCaptureContext) {
      if (needsGuard()) throw new Error("Stop and save or retry the current take first.");
      if (!input.id || input.id !== selectedInputId) throw new Error("Select a connected physical MIDI input first.");
      collectionId = collection.collectionId;
      recorder = createImprovTakeRecorder({ createId: options.createId });
      capture = createImprovTakePersistence({ recorder, library: options.library, collectionId, writerToken: options.createId(),
        observe: options.observe, createOperationId: options.createId });
      clearHeld();
      const result = capture.start(input, { atMs: options.observe().atMs, context });
      if (!result.ok) throw new Error("The take could not start. Check the MIDI source and clock.");
      return state();
    },
    append(message: RawMidiMessage, context: ImprovCaptureContext) {
      if (message.input.id !== selectedInputId) return;
      if (!capture || state().captureStatus !== "recording") { clearHeld(); return; }
      const result = capture.append(message, context);
      if (state().captureStatus !== "recording") { clearHeld(); return; }
      if (!result.ok) return;
      const decoded = decodeImprovMessage(message);
      if (decoded.kind !== "channel") return;
      const [, pitch, velocity] = decoded.bytes; const key = `${decoded.channel}:${pitch}`;
      const attack = decoded.command === 0x90 && velocity > 0;
      const release = decoded.command === 0x80 || (decoded.command === 0x90 && velocity === 0);
      if (attack) { held.set(key, (held.get(key) ?? 0) + 1); heldVersion++; }
      else if (release && held.has(key)) { const count = held.get(key)! - 1; if (count) held.set(key, count); else held.delete(key); heldVersion++; }
    },
    connection(change: MidiInputConnectionChange, context: ImprovCaptureContext) {
      if (change.input.id !== selectedInputId) return;
      capture?.observeConnection(change, context); clearHeld();
    },
    stop: async () => { clearHeld(); return capture ? capture.stop(options.observe()) : idle; },
    retry: async () => capture ? capture.retry() : idle,
    interrupt: async (reason: ImprovInterruptionReason) => { clearHeld(); return capture ? capture.interrupt(reason, options.observe()) : idle; },
    metadata: () => recorder?.metadata() ?? null,
    // Explicit access only, never used in a per-message/render loop.
    pendingSnapshot: () => capture?.pendingSnapshot() ?? null,
    dispose: async () => { clearHeld(); return capture ? capture.dispose() : idle; },
  });
}

export type ImprovWorkspaceSession = ReturnType<typeof createImprovWorkspaceSession>;
