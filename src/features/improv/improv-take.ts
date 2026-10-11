import type { MidiInputConnectionChange, MidiInputInfo, RawMidiMessage } from "@/lib/midi/midi-transport";

/** Caller-assigned document/owner identities, not device-derived measurements. */
export type ImprovCaptureContext = Readonly<{
  ownerId: string;
  clockId: string;
  timeOriginMs: number | null;
}>;
export type ImprovObservation = Readonly<{ atMs: number; context: ImprovCaptureContext }>;
export type ImprovTimestampValidity = "valid" | "unavailable" | "nonfinite" | "negative";
export type ImprovInterruptionReason = "device-disconnected" | "source-reconnected" | "consumer-lost"
  | "background" | "freeze" | "pagehide" | "capture-unavailable" | "continuity-mismatch"
  | "transport-order-mismatch" | "event-limit" | "byte-limit" | "coordination-failed" | "control-limit";
export type ImprovTakeLimits = Readonly<{ maxEvents: number; maxAccountedBytes: number }>;
export type ImprovTakeEvent = Readonly<{
  sequence: number;
  raw: RawMidiMessage;
  timing: Readonly<{
    sourceValidity: ImprovTimestampValidity;
    receiptValidity: ImprovTimestampValidity;
    sourceTimestampRegressed: boolean;
    receiptTimestampRegressed: boolean;
    /** Unobserved owner deliveries, potentially from other inputs; not proof of lost take events. */
    transportSequenceGap: number | null;
  }>;
}>;
export type ImprovTakeConnection = Readonly<{ sequence: number; afterEventSequence: number; raw: MidiInputConnectionChange }>;
/** User/native observations, never fabricated MIDI. Resume-ack is durable authorization;
 * resume is the subsequent effective cutover, committed before its event prefix. */
export type ImprovTakeControl = Readonly<{
  sequence: number; afterEventSequence: number;
  kind: "pause" | "pause-ack" | "resume-request" | "resume-ack" | "resume";
  boundary: ImprovTakeBoundary;
  audio: "off" | "recording" | "paused" | "failed";
}>;
export const IMPROV_MAX_CONTROLS = 2560; // 512 pauses, five observations each.
export function improvControlAccountedBytes(control: ImprovTakeControl): number {
  return 512 + 2 * (control.boundary.observation.context.ownerId.length + control.boundary.observation.context.clockId.length);
}
export type ImprovTakeBoundary = Readonly<{
  observation: ImprovObservation;
  validity: ImprovTimestampValidity;
  contextMatchesStart: boolean;
  precedesStart: boolean;
}>;
export type ImprovTakeTerminal = Readonly<{
  reason: "user-stop" | ImprovInterruptionReason;
  boundary: ImprovTakeBoundary;
  /** A delivery refused at a continuity/limit boundary; not counted as a retained event. */
  refusedTransportSequence: number | null;
}>;
export type ImprovTakeMetadata = Readonly<{
  schemaVersion: 1 | 2;
  controlCount?: number;
  takeId: string;
  selectedInput: MidiInputInfo & Readonly<{ id: string }>;
  status: "recording" | "completed" | "interrupted";
  start: ImprovTakeBoundary;
  terminal: ImprovTakeTerminal | null;
  initialState: Readonly<{ heldKeys: "unknown"; controllers: "unknown" }>;
  sourceTimestampClock: "browser-event-unverified";
  limits: ImprovTakeLimits;
  eventCount: number;
  /** Inclusive take-local retained watermark; zero means no messages. Not a durable-save acknowledgment. */
  eventWatermark: number;
  lastTransportSequence: number | null;
  connectionCount: number;
  accountedBytes: number;
}>;
export type ImprovTake = Readonly<{
  metadata: ImprovTakeMetadata;
  events: readonly ImprovTakeEvent[];
  connections: readonly ImprovTakeConnection[];
  controls?: readonly ImprovTakeControl[];
}>;

export function improvTimestampValidity(value: number | null): ImprovTimestampValidity {
  if (value === null) return "unavailable";
  if (!Number.isFinite(value)) return "nonfinite";
  return value < 0 ? "negative" : "valid";
}

/** Separate inspection only. Source-clock comparison remains unverified; nothing is clamped. */
export function inspectImprovEventTiming(event: ImprovTakeEvent, take: ImprovTakeMetadata) {
  const relation = (time: number | null) => {
    if (time === null || !Number.isFinite(time)) return "unavailable" as const;
    if (time < take.start.observation.atMs) return "before-start" as const;
    const end = take.terminal?.boundary;
    if (!end) return "open-end" as const;
    if (!end.contextMatchesStart || end.validity !== "valid" || end.observation.atMs < take.start.observation.atMs) return "uncertain-end" as const;
    return time > end.observation.atMs ? "after-end" as const : "within-boundaries" as const;
  };
  return Object.freeze({ source: relation(event.raw.sourceTimeStampMs), receipt: relation(event.raw.receivedAtMs),
    sourceClockVerified: false as const });
}
