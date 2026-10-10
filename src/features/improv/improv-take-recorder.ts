import type { MidiInputConnectionChange, MidiInputInfo, RawMidiMessage } from "@/lib/midi/midi-transport";
import { improvTimestampValidity, type ImprovCaptureContext, type ImprovInterruptionReason, type ImprovObservation,
  type ImprovTake, type ImprovTakeBoundary, type ImprovTakeConnection, type ImprovTakeEvent,
  type ImprovTakeLimits, type ImprovTakeMetadata, type ImprovTakeTerminal } from "./improv-take";

export const DEFAULT_IMPROV_TAKE_LIMITS: ImprovTakeLimits = Object.freeze({
  maxEvents: 100_000, maxAccountedBytes: 64 * 1024 * 1024,
});
export type ImprovRecorderResult = Readonly<{ ok: true; takeId: string; status: ImprovTakeMetadata["status"]; eventWatermark: number }>
  | Readonly<{ ok: false; reason: "not-recording" | "already-started" | "invalid-start" | "other-input" | ImprovInterruptionReason }>;

export type ImprovTakeRecorder = Readonly<{
  start: (input: MidiInputInfo, observation: ImprovObservation) => ImprovRecorderResult;
  append: (message: RawMidiMessage, context: ImprovCaptureContext) => ImprovRecorderResult;
  observeConnection: (change: MidiInputConnectionChange, context: ImprovCaptureContext) => ImprovRecorderResult;
  stop: (observation: ImprovObservation) => ImprovRecorderResult;
  interrupt: (reason: ImprovInterruptionReason, observation: ImprovObservation) => ImprovRecorderResult;
  metadata: () => ImprovTakeMetadata | null;
  readConnections: () => readonly ImprovTakeConnection[];
  snapshot: () => ImprovTake | null;
  readEvents: (afterSequence: number, limit: number) => readonly ImprovTakeEvent[];
}>;

function validContext(context: ImprovCaptureContext): boolean {
  return context.ownerId.trim().length > 0 && context.clockId.trim().length > 0
    && (context.timeOriginMs === null || (Number.isFinite(context.timeOriginMs) && context.timeOriginMs >= 0));
}
function sameContext(left: ImprovCaptureContext, right: ImprovCaptureContext): boolean {
  return left.ownerId === right.ownerId && left.clockId === right.clockId && left.timeOriginMs === right.timeOriginMs;
}
function copyObservation(value: ImprovObservation): ImprovObservation {
  return Object.freeze({ atMs: value.atMs, context: Object.freeze({ ...value.context }) });
}
function inputBytes(input: MidiInputInfo): number { return 2 * ((input.id?.length ?? 0) + (input.name?.length ?? 0)); }
/** Conservative deterministic accounting, not a measurement/guarantee of browser heap usage. */
export function improvMessageAccountedBytes(message: RawMidiMessage): number {
  return 512 + 8 * (message.bytes?.length ?? 0) + inputBytes(message.input);
}
function copyMessage(message: RawMidiMessage): RawMidiMessage {
  return Object.freeze({ ...message, input: Object.freeze({ ...message.input }),
    bytes: message.bytes === null ? null : Object.freeze([...message.bytes]) });
}

/** One controller owns one take. New takes require new controllers and explicit Start. */
export function createImprovTakeRecorder(options: Readonly<{ createId: () => string; limits?: Partial<ImprovTakeLimits> }>): ImprovTakeRecorder {
  const limits = Object.freeze({ ...DEFAULT_IMPROV_TAKE_LIMITS, ...options.limits });
  if (Object.values(limits).some((value) => !Number.isSafeInteger(value) || value < 1)) throw new Error("Improv take limits must be positive safe integers.");
  let metadata: ImprovTakeMetadata | null = null;
  const events: ImprovTakeEvent[] = [];
  const connections: ImprovTakeConnection[] = [];
  let lastFiniteSource: number | null = null;
  let lastFiniteReceipt: number | null = null;
  const success = (): ImprovRecorderResult => Object.freeze({ ok: true, takeId: metadata!.takeId, status: metadata!.status, eventWatermark: events.length });
  const failure = (reason: Extract<ImprovRecorderResult, { ok: false }>["reason"]): ImprovRecorderResult => Object.freeze({ ok: false, reason });
  const boundary = (observation: ImprovObservation): ImprovTakeBoundary => Object.freeze({
    observation: copyObservation(observation), validity: improvTimestampValidity(observation.atMs),
    contextMatchesStart: metadata === null || sameContext(metadata.start.observation.context, observation.context),
    precedesStart: metadata !== null && Number.isFinite(observation.atMs) && observation.atMs < metadata.start.observation.atMs,
  });
  const finish = (status: "completed" | "interrupted", reason: ImprovTakeTerminal["reason"],
    observation: ImprovObservation, refusedTransportSequence: number | null = null) => {
    metadata = Object.freeze({ ...metadata!, status,
      terminal: Object.freeze({ reason, boundary: boundary(observation), refusedTransportSequence }) });
  };
  const rejectAndInterrupt = (reason: ImprovInterruptionReason, observation: ImprovObservation,
    refusedTransportSequence: number | null = null) => {
    finish("interrupted", reason, observation, refusedTransportSequence);
    return failure(reason);
  };
  const recording = () => metadata?.status === "recording";

  return Object.freeze({
    start(input: MidiInputInfo, observation: ImprovObservation): ImprovRecorderResult {
      if (metadata) return failure("already-started");
      if (!input.id?.trim() || !validContext(observation.context) || improvTimestampValidity(observation.atMs) !== "valid") return failure("invalid-start");
      const takeId = options.createId();
      if (!takeId.trim()) return failure("invalid-start");
      const accountedBytes = 1_024 + inputBytes(input) + 2 * (takeId.length + observation.context.ownerId.length + observation.context.clockId.length);
      if (accountedBytes > limits.maxAccountedBytes) return failure("byte-limit");
      metadata = Object.freeze({ schemaVersion: 1, takeId, selectedInput: Object.freeze({ ...input, id: input.id }),
        status: "recording", start: boundary(observation), terminal: null,
        initialState: Object.freeze({ heldKeys: "unknown", controllers: "unknown" }),
        sourceTimestampClock: "browser-event-unverified", limits, eventCount: 0, eventWatermark: 0,
        lastTransportSequence: null, connectionCount: 0, accountedBytes });
      if (accountedBytes === limits.maxAccountedBytes) finish("interrupted", "byte-limit", observation);
      return success();
    },
    append(message: RawMidiMessage, context: ImprovCaptureContext): ImprovRecorderResult {
      if (!recording()) return failure("not-recording");
      if (message.input.id !== metadata!.selectedInput.id) return failure("other-input");
      const observation = { atMs: message.receivedAtMs, context };
      if (!sameContext(metadata!.start.observation.context, context)) return rejectAndInterrupt("continuity-mismatch", observation, message.sequence);
      if (!Number.isSafeInteger(message.sequence) || message.sequence < 1
        || (metadata!.lastTransportSequence !== null && message.sequence <= metadata!.lastTransportSequence)) {
        return rejectAndInterrupt("transport-order-mismatch", observation, message.sequence);
      }
      const accountedBytes = metadata!.accountedBytes + improvMessageAccountedBytes(message);
      if (accountedBytes > limits.maxAccountedBytes) return rejectAndInterrupt("byte-limit", observation, message.sequence);
      const raw = copyMessage(message);
      const source = raw.sourceTimeStampMs;
      const receipt = raw.receivedAtMs;
      events.push(Object.freeze({ sequence: events.length + 1, raw, timing: Object.freeze({
        sourceValidity: improvTimestampValidity(source), receiptValidity: improvTimestampValidity(receipt),
        sourceTimestampRegressed: source !== null && Number.isFinite(source) && lastFiniteSource !== null && source < lastFiniteSource,
        receiptTimestampRegressed: Number.isFinite(receipt) && lastFiniteReceipt !== null && receipt < lastFiniteReceipt,
        transportSequenceGap: metadata!.lastTransportSequence === null ? null : raw.sequence - metadata!.lastTransportSequence - 1,
      }) }));
      if (source !== null && Number.isFinite(source)) lastFiniteSource = source;
      if (Number.isFinite(receipt)) lastFiniteReceipt = receipt;
      metadata = Object.freeze({ ...metadata!, eventCount: events.length, eventWatermark: events.length,
        lastTransportSequence: raw.sequence, accountedBytes });
      if (events.length === limits.maxEvents) finish("interrupted", "event-limit", observation);
      else if (accountedBytes === limits.maxAccountedBytes) finish("interrupted", "byte-limit", observation);
      return success();
    },
    observeConnection(change: MidiInputConnectionChange, context: ImprovCaptureContext): ImprovRecorderResult {
      if (!recording()) return failure("not-recording");
      if (change.input.id !== metadata!.selectedInput.id) return failure("other-input");
      const observation = { atMs: change.receivedAtMs, context };
      if (!sameContext(metadata!.start.observation.context, context)) return rejectAndInterrupt("continuity-mismatch", observation);
      const accountedBytes = metadata!.accountedBytes + 512 + inputBytes(change.input);
      if (accountedBytes > limits.maxAccountedBytes) return rejectAndInterrupt("byte-limit", observation);
      const raw = Object.freeze({ ...change, input: Object.freeze({ ...change.input }) });
      connections.push(Object.freeze({ sequence: connections.length + 1, afterEventSequence: events.length, raw }));
      metadata = Object.freeze({ ...metadata!, connectionCount: connections.length, accountedBytes });
      finish("interrupted", change.state === "disconnected" ? "device-disconnected" : "source-reconnected", observation);
      return success();
    },
    stop(observation: ImprovObservation): ImprovRecorderResult {
      if (!metadata) return failure("not-recording");
      if (!recording()) return success(); // First terminal boundary wins, including after interruption.
      if (!sameContext(metadata.start.observation.context, observation.context)) return rejectAndInterrupt("continuity-mismatch", observation);
      finish("completed", "user-stop", observation);
      return success();
    },
    interrupt(reason: ImprovInterruptionReason, observation: ImprovObservation): ImprovRecorderResult {
      if (!metadata) return failure("not-recording");
      if (!recording()) return success();
      finish("interrupted", reason, observation);
      return success();
    },
    metadata(): ImprovTakeMetadata | null { return metadata; },
    readConnections(): readonly ImprovTakeConnection[] { return Object.freeze([...connections]); },
    snapshot(): ImprovTake | null {
      return metadata === null ? null : Object.freeze({ metadata, events: Object.freeze([...events]), connections: Object.freeze([...connections]) });
    },
    /** Inclusive watermark cursor: read messages strictly after it, without copying earlier history. */
    readEvents(afterSequence: number, limit: number): readonly ImprovTakeEvent[] {
      if (!Number.isSafeInteger(afterSequence) || afterSequence < 0 || afterSequence > events.length
        || !Number.isSafeInteger(limit) || limit < 1) throw new Error("Invalid Improv event cursor or limit.");
      return Object.freeze(events.slice(afterSequence, afterSequence + limit));
    },
  });
}
