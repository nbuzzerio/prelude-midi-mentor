import type { MidiInputConnectionChange, MidiInputInfo, RawMidiMessage } from "@/lib/midi/midi-transport";
import { improvControlAccountedBytes, type ImprovTakeControl, type ImprovCaptureContext, type ImprovInterruptionReason, type ImprovObservation } from "./improv-take";
import { improvMessageAccountedBytes, type ImprovRecorderResult, type ImprovTakeRecorder } from "./improv-take-recorder";
import { IMPROV_LIBRARY_LIMITS as L, ImprovLibraryError, libraryError, sameEvidence, sameCaptureContext, type ImprovCaptureFailure,
  type ImprovCheckpoint, type ImprovLibrary, type ImprovLibraryFailure, type ImprovStoredTake } from "./improv-library";

export type ImprovSaveState = Readonly<{
  storageStatus: "idle" | "pending" | "saving" | "checkpointed" | "saved" | "failed";
  captureStatus: "idle" | "recording" | "completed" | "interrupted";
  takeId: string | null; number: number | null;
  committedEventWatermark: number; pendingEventCount: number; pendingAccountedBytes: number;
  committedControlWatermark?: number; pendingControlCount?: number;
  pendingConnections: number; failure: ImprovLibraryFailure | null; captureFailure: ImprovCaptureFailure | null;
}>;
export type ImprovCheckpointScheduler = Readonly<{ every: (ms: number, callback: () => void) => () => void }>;
const scheduler: ImprovCheckpointScheduler = {
  every(ms, callback) { const timer = setInterval(callback, ms); return () => clearInterval(timer); },
};

/** Explicit feature-local owner. Nothing is mounted/registered until the future workspace calls Start. */
export function createImprovTakePersistence(options: Readonly<{
  recorder: ImprovTakeRecorder; library: ImprovLibrary; collectionId: string; writerToken: string;
  observe: () => ImprovObservation; now?: () => number; createOperationId?: () => string;
  scheduler?: ImprovCheckpointScheduler; unsavedEvents?: number; unsavedBytes?: number;
}>) {
  const { recorder, library } = options;
  const eventLimit = options.unsavedEvents ?? L.unsavedEvents;
  const byteLimit = options.unsavedBytes ?? L.unsavedBytes;
  if (![eventLimit, byteLimit].every((v) => Number.isSafeInteger(v) && v > 0)
    || eventLimit > L.eventsPerTake || byteLimit > L.bytesPerTake) throw new Error("Invalid unsaved Improv backlog limits.");
  let record: ImprovStoredTake | null = null;
  let pendingWrite: ImprovCheckpoint | null = null;
  let failure: ImprovLibraryError | null = null;
  let captureFailure: ImprovCaptureFailure | null = null;
  let inFlight: Promise<ImprovSaveState> | null = null;
  let requested = false;
  let disposed = false;
  let cancelTimer: (() => void) | null = null;
  const now = options.now ?? Date.now;
  const stopTimer = () => { cancelTimer?.(); cancelTimer = null; };
  const state = (): ImprovSaveState => {
    const metadata = recorder.metadata();
    const watermark = record?.committedEventWatermark ?? 0;
    const pendingEvents = (metadata?.eventWatermark ?? 0) - watermark;
    const pendingBytes = Math.max(0, (metadata?.accountedBytes ?? 0) - (record?.committedAccountedBytes ?? 0));
    const pendingConnections = (metadata?.connectionCount ?? 0) - (record?.connections.length ?? 0);
    const controlWatermark = record?.committedControlWatermark ?? 0;
    const pendingControls = (metadata?.controlCount ?? 0) - controlWatermark;
    const saved = record !== null && metadata?.status !== "recording" && record.status === metadata?.status
      && pendingEvents === 0 && pendingConnections === 0 && pendingControls === 0 && sameEvidence(metadata, record.capture);
    return Object.freeze({ storageStatus: metadata === null ? "idle" : failure ? "failed" : inFlight ? "saving"
      : saved ? "saved" : !record || pendingEvents || pendingConnections || pendingControls || metadata.status !== "recording" ? "pending" : "checkpointed",
      captureStatus: metadata?.status ?? "idle",
      takeId: metadata?.takeId ?? null, number: record?.number ?? null, committedEventWatermark: watermark,
      pendingEventCount: pendingEvents, pendingAccountedBytes: pendingBytes, pendingConnections,
      ...(metadata?.schemaVersion === 2 ? { committedControlWatermark: controlWatermark, pendingControlCount: pendingControls } : {}),
      failure: failure?.reason ?? null, captureFailure });
  };
  const interrupt = (reason: ImprovInterruptionReason, observation: ImprovObservation) => {
    const result = recorder.interrupt(reason, observation); stopTimer(); return result;
  };
  const limitReached = (refusedTransportSequence: number | null, observation: ImprovObservation) => {
    captureFailure = Object.freeze({ reason: "unsaved-backlog-limit", refusedTransportSequence });
    interrupt("capture-unavailable", observation);
  };
  const expire = () => {
    if (record?.lease && now() >= record.lease.expiresAtMs && recorder.metadata()?.status === "recording") {
      interrupt("consumer-lost", options.observe());
      return true;
    }
    return false;
  };
  const batch = (): ImprovCheckpoint => {
    const capture = recorder.metadata()!;
    const events = recorder.readEvents(record!.committedEventWatermark,
      Math.max(1, Math.min(L.chunkEvents, capture.eventWatermark - record!.committedEventWatermark)));
    let size = 0; let count = 0;
    for (const event of events) {
      const charge = improvMessageAccountedBytes(event.raw);
      if (count && size + charge > L.chunkBytes) break;
      size += charge; count += 1;
    }
    const selectedEvents = Object.freeze(events.slice(0, count));
    const watermark = record!.committedEventWatermark + count;
    const connections = Object.freeze(recorder.readConnections().filter((c) => c.afterEventSequence <= watermark));
    const controls = Object.freeze(recorder.readControls().filter(c => c.afterEventSequence <= watermark));
    return Object.freeze({ takeId: capture.takeId, writerToken: options.writerToken,
      expectedRevision: record!.revision, operationId: (options.createOperationId ?? (() => crypto.randomUUID()))(),
      capture, events: selectedEvents, connections, ...(capture.schemaVersion === 2 ? { controls } : {}),
      finalize: capture.status !== "recording" && watermark === capture.eventWatermark && controls.length === (capture.controlCount ?? 0),
      captureFailure });
  };
  const savePass = async () => {
    const metadata = recorder.metadata();
    if (!metadata) return;
    if (!record) record = await library.allocateTake(options.collectionId, metadata, options.writerToken);
    expire();
    // Reach this watermark; later batches may also include newer immutable observations.
    const target = recorder.metadata()!.eventWatermark;
    const controlTarget = recorder.metadata()!.controlCount ?? 0;
    do {
      const current = recorder.metadata()!;
      if (record.status !== "recording" && sameEvidence(record.capture, current)) break;
      pendingWrite ??= batch();
      try { record = await library.checkpoint(pendingWrite); pendingWrite = null; }
      catch (error) {
        if (error instanceof ImprovLibraryError && error.reason === "lease-expired") {
          // The rejected transaction made no writes. Terminal retry is safe only while its token still owns the record.
          interrupt("consumer-lost", options.observe()); pendingWrite = null; requested = true;
          return;
        }
        throw error;
      }
    } while (record.committedEventWatermark < target || (record.committedControlWatermark ?? 0) < controlTarget);
  };
  const drain = async () => {
    while (requested) {
      requested = false;
      try { await savePass(); failure = null; }
      catch (error) {
        failure = libraryError(error);
        if (["owned", "stale", "clock-regressed", "limit"].includes(failure.reason)) interrupt("consumer-lost", options.observe());
        requested = false;
      }
    }
  };
  const flush = (): Promise<ImprovSaveState> => {
    requested = true;
    if (inFlight) return inFlight;
    inFlight = drain().then(() => { inFlight = null; return state(); });
    return inFlight;
  };
  const beginTimer = () => {
    if (cancelTimer || disposed || recorder.metadata()?.status !== "recording") return;
    cancelTimer = (options.scheduler ?? scheduler).every(L.checkpointMs, () => {
      if (disposed) return;
      expire();
      if (!failure) void flush(); // Explicit Retry follows failed writes; no automatic quota/deletion loop.
    });
  };

  return Object.freeze({
    checkSafety() { if (disposed) return false; expire(); return recorder.metadata()?.status === "recording"; },
    control(kind: ImprovTakeControl["kind"], observation: ImprovObservation, audio: ImprovTakeControl["audio"]) {
      if (disposed || expire() || recorder.metadata()?.status !== "recording") return false;
      const probe: ImprovTakeControl = { sequence: 0, afterEventSequence: 0, kind, boundary: recorder.metadata()!.start, audio };
      if (state().pendingAccountedBytes + improvControlAccountedBytes(probe) > byteLimit) { limitReached(null, observation); return false; }
      const result = recorder.control(kind, observation, audio);
      if (result.ok && state().pendingAccountedBytes >= byteLimit) limitReached(null, observation);
      return result.ok;
    },
    start(input: MidiInputInfo, observation: ImprovObservation): ImprovRecorderResult {
      if (disposed) return Object.freeze({ ok: false, reason: "not-recording" });
      const result = recorder.start(input, observation);
      if (result.ok) {
        beginTimer();
        if (state().pendingAccountedBytes >= byteLimit) limitReached(null, observation);
        void flush();
      }
      return result.ok ? Object.freeze({ ...result, status: recorder.metadata()!.status }) : result;
    },
    append(message: RawMidiMessage, context: ImprovCaptureContext): ImprovRecorderResult {
      if (disposed) return Object.freeze({ ok: false, reason: "not-recording" });
      if (expire() && !failure) void flush();
      const metadata = recorder.metadata();
      if (metadata?.status !== "recording") return recorder.append(message, context);
      const pending = state();
      if (metadata?.status === "recording" && metadata.selectedInput.id === message.input.id
        && sameCaptureContext(metadata.start.observation.context, context)
        && (pending.pendingEventCount >= eventLimit || pending.pendingAccountedBytes + improvMessageAccountedBytes(message) > byteLimit)) {
        limitReached(message.sequence, { atMs: message.receivedAtMs, context });
        if (!failure) void flush();
        return Object.freeze({ ok: false, reason: "byte-limit" });
      }
      const result = recorder.append(message, context);
      if (result.ok && (state().pendingEventCount >= eventLimit || state().pendingAccountedBytes >= byteLimit)) {
        limitReached(null, { atMs: message.receivedAtMs, context });
      }
      if (recorder.metadata()?.status !== "recording") { stopTimer(); if (!failure) void flush(); }
      return result.ok ? Object.freeze({ ...result, status: recorder.metadata()!.status }) : result;
    },
    observeConnection(change: MidiInputConnectionChange, context: ImprovCaptureContext): ImprovRecorderResult {
      if (disposed) return Object.freeze({ ok: false, reason: "not-recording" });
      if (expire() && !failure) void flush();
      if (recorder.metadata()?.status !== "recording") return recorder.observeConnection(change, context);
      const result = recorder.observeConnection(change, context);
      if (recorder.metadata()?.status !== "recording") { stopTimer(); if (!failure) void flush(); }
      return result;
    },
    async stop(observation: ImprovObservation): Promise<ImprovSaveState> { recorder.stop(observation); stopTimer(); return flush(); },
    async interrupt(reason: ImprovInterruptionReason, observation: ImprovObservation): Promise<ImprovSaveState> {
      interrupt(reason, observation); return flush();
    },
    async dispose(): Promise<ImprovSaveState> {
      disposed = true; if (recorder.metadata()?.status === "recording") interrupt("consumer-lost", options.observe());
      stopTimer(); return flush();
    },
    flush, retry: flush, state, pendingSnapshot: () => recorder.snapshot(),
  });
}
