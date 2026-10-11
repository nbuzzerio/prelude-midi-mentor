import type { MidiInputInfo, MidiInputConnectionChange, RawMidiMessage } from "@/lib/midi/midi-transport";
import type { ImprovArchiveLibrary, ImprovCollection } from "./improv-library";
import { decodeImprovMessage } from "./improv-performance";
import { createImprovTakeRecorder } from "./improv-take-recorder";
import { createImprovTakePersistence, type ImprovSaveState } from "./improv-take-persistence";
import type { ImprovCaptureContext, ImprovInterruptionReason, ImprovObservation, ImprovTakeControl } from "./improv-take";
import { createImprovTimeline, type ImprovTimeline } from "./improv-timeline";
export type ImprovAudioTransition = Readonly<{
  active: () => boolean; status: () => ImprovTakeControl["audio"];
  pause: () => Promise<void>; resume: () => Promise<void>; stop: () => void;
  coordinationFailed?: (message: string) => void;
}>;
export type ImprovSessionPhase = "ready" | "recording" | "pausing" | "paused" | "resuming" | "stopping" | "saved" | "interrupted" | "failed";

/** Coordinates one attempt; React never owns the raw journal or committed watermark. */
export function createImprovWorkspaceSession(options: Readonly<{
  library: ImprovArchiveLibrary; createId: () => string; observe: () => ImprovObservation;
}>) {
  let capture: ReturnType<typeof createImprovTakePersistence> | null = null;
  let recorder: ReturnType<typeof createImprovTakeRecorder> | null = null;
  let collectionId: string | null = null;
  let selectedInputId: string | null = null;
  let timeline: ImprovTimeline | null = null;
  let localPhase: ImprovSessionPhase = "ready", generation = 0, transitionError = "";
  const held = new Map<string, number>(); let heldVersion = 0;
  const idle: ImprovSaveState = Object.freeze({ storageStatus: "idle", captureStatus: "idle", takeId: null, number: null,
    committedEventWatermark: 0, pendingEventCount: 0, pendingAccountedBytes: 0, pendingConnections: 0, failure: null, captureFailure: null });
  const state = () => capture?.state() ?? idle;
  const needsGuard = () => state().captureStatus === "recording" || !["idle", "saved"].includes(state().storageStatus);
  const clearHeld = () => { if (held.size) { held.clear(); heldVersion++; } };
  const phase = (): ImprovSessionPhase => {
    const save = state();
    if (save.captureStatus === "interrupted") return "interrupted";
    if (save.captureStatus === "completed") return save.storageStatus === "saved" ? "saved" : "stopping";
    return localPhase;
  };
  const control = (kind: ImprovTakeControl["kind"], audio?: ImprovAudioTransition) => {
    if (!capture?.control(kind, options.observe(), audio?.status() ?? "off")) throw new Error("Pause/Resume control could not be recorded safely.");
    const entry = recorder!.readControls().at(-1)!;
    timeline?.control(entry);
    if (state().captureStatus !== "recording") throw new Error("Capture reached a safety limit during Pause/Resume.");
  };
  const durable = async () => {
    const target = recorder!.metadata()!.controlCount!;
    if (!state().failure && (state().committedControlWatermark ?? 0) >= target) return;
    const saved = await capture!.flush();
    if (saved.failure || (saved.committedControlWatermark ?? 0) < target) throw new Error("Pause/Resume is waiting for a successful local save. Retry Save before resuming.");
  };
  const current = (token: number) => token === generation && state().captureStatus === "recording";
  const coordinationFailure = async (error: unknown, audio?: ImprovAudioTransition) => {
    transitionError = error instanceof Error ? error.message : "Pause/Resume coordination failed.";
    generation++; audio?.coordinationFailed?.(transitionError); audio?.stop(); clearHeld();
    if (capture) await capture.interrupt("coordination-failed", options.observe());
    timeline?.finishCapture(recorder!.metadata()!);
  };
  return Object.freeze({
    state, phase, transitionError: () => transitionError, needsGuard, collectionId: () => collectionId, heldVersion: () => heldVersion,
    timeline: () => { const metadata = recorder?.metadata(); if (metadata) timeline?.finishCapture(metadata); return timeline; },
    resetCompleted() {
      if (needsGuard()) return false;
      generation++; localPhase = "ready"; transitionError = "";
      capture = null; recorder = null; collectionId = null; timeline = null;
      return true;
    },
    selectInput(id: string | null) { if (id !== selectedInputId) { selectedInputId = id; clearHeld(); } },
    heldPitches: () => [...new Set([...held.keys()].map((key) => Number(key.split(":")[1])))].sort((a, b) => a - b),
    start(collection: ImprovCollection, input: MidiInputInfo, context: ImprovCaptureContext) {
      if (needsGuard()) throw new Error("Stop and save or retry the current take first.");
      if (!input.id || input.id !== selectedInputId) throw new Error("Select a connected physical MIDI input first.");
      collectionId = collection.collectionId;
      generation++; localPhase = "recording"; transitionError = "";
      recorder = createImprovTakeRecorder({ createId: options.createId, pauseSupport: true });
      capture = createImprovTakePersistence({ recorder, library: options.library, collectionId, writerToken: options.createId(),
        observe: options.observe, createOperationId: options.createId });
      clearHeld();
      const result = capture.start(input, { atMs: options.observe().atMs, context });
      if (!result.ok) { localPhase = "failed"; throw new Error("The take could not start. Check the MIDI source and clock."); }
      timeline = createImprovTimeline(recorder.metadata()!.start.observation.atMs);
      timeline.finishCapture(recorder.metadata()!);
      return state();
    },
    append(message: RawMidiMessage, context: ImprovCaptureContext) {
      if (message.input.id !== selectedInputId) return;
      if (!capture || state().captureStatus !== "recording") { clearHeld(); return; }
      const result = capture.append(message, context);
      if (result.ok) {
        const event = recorder!.readEvents(result.eventWatermark - 1, 1)[0];
        if (event) timeline?.append(event);
      }
      timeline?.finishCapture(recorder!.metadata()!);
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
    async pause(audio?: ImprovAudioTransition) {
      if (phase() !== "recording") return;
      const token = ++generation; localPhase = "pausing"; transitionError = "";
      try {
        control("pause", audio);
        if (audio?.active()) await audio.pause();
        if (!current(token)) return;
        control("pause-ack", audio); localPhase = "paused";
        try { await durable(); } catch (error) { if (current(token)) transitionError = (error as Error).message; }
      } catch (error) { if (current(token)) await coordinationFailure(error, audio); }
    },
    async resume(validate: () => void, audio?: ImprovAudioTransition) {
      if (phase() !== "paused") return;
      if (state().failure) { transitionError = "Retry Save before resuming this take."; return; }
      const token = ++generation; localPhase = "resuming"; transitionError = "";
      let nativeResumed = false, coordinationStarted = false;
      const revalidate = () => { validate(); if (!capture!.checkSafety()) throw new Error("Capture continuity expired; this take cannot Resume."); };
      try {
        await durable(); if (!current(token)) return; revalidate();
        if (recorder!.readControls().at(-1)!.kind === "pause-ack") control("resume-request", audio);
        await durable(); if (!current(token)) return; revalidate();
        const coordinated = audio?.active() ?? false;
        if (coordinated) { coordinationStarted = true; await audio!.resume(); nativeResumed = true; }
        if (!current(token)) return; revalidate();
        if (coordinated && !audio!.active()) throw new Error("Room audio failed during coordinated Resume.");
        control("resume-ack", audio);
        await durable(); if (!current(token)) return; revalidate();
        if (coordinated && !audio!.active()) throw new Error("Room audio failed during Resume acknowledgment.");
        // Only durable authorization opens the gate. The actual cutover is sampled now,
        // excluding storage wait. Its control is atomic with every subsequent event prefix.
        control("resume", audio); localPhase = "recording";
        await durable();
      } catch (error) {
        if (!current(token)) return;
        if (state().failure && !coordinationStarted && !nativeResumed && recorder!.readControls().at(-1)?.kind !== "resume-ack" && recorder!.readControls().at(-1)?.kind !== "resume") {
          localPhase = "paused"; transitionError = (error as Error).message;
        } else await coordinationFailure(error, audio);
      }
    },
    stop: async () => { generation++; localPhase = "stopping"; clearHeld(); return capture ? capture.stop(options.observe()) : idle; },
    retry: async () => capture ? capture.retry() : idle,
    interrupt: async (reason: ImprovInterruptionReason) => { generation++; clearHeld(); return capture ? capture.interrupt(reason, options.observe()) : idle; },
    metadata: () => recorder?.metadata() ?? null,
    // Explicit access only, never used in a per-message/render loop.
    pendingSnapshot: () => capture?.pendingSnapshot() ?? null,
    dispose: async () => { generation++; clearHeld(); return capture ? capture.dispose() : idle; },
  });
}

export type ImprovWorkspaceSession = ReturnType<typeof createImprovWorkspaceSession>;
