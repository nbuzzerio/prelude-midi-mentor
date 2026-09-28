import { formatMidiDiagnosticData, formatMidiDiagnosticRawBytes, type MidiDiagnosticDecodedMessage } from "./midi-diagnostic-message";

export const MIDI_DIAGNOSTIC_CAPTURE_LIMIT = 1_000;

export type MidiDiagnosticInputIdentity = Readonly<{ id: string; name: string }>;
export type MidiDiagnosticCapturedEvent = Readonly<{
  sequence: number;
  continuitySegment: string;
  eventTimeStampMs: number;
  relativeTimeMs: number;
  source: MidiDiagnosticInputIdentity;
  rawBytes: readonly number[];
  messageLength: number;
  decoded: MidiDiagnosticDecodedMessage;
}>;

export type MidiDiagnosticCapture = Readonly<{
  continuityEpoch: number;
  continuityByInputId: Readonly<Record<string, number>>;
  continuityBreakCount: number;
  backgroundCounts: Readonly<{ timingClock: number; activeSensing: number }>;
  observedInputs: readonly MidiDiagnosticInputIdentity[];
  droppedCount: number;
  events: readonly MidiDiagnosticCapturedEvent[];
  nextSequence: number;
  originTimeStampMs: number | null;
  totalCaptured: number;
}>;

export const EMPTY_MIDI_DIAGNOSTIC_CAPTURE: MidiDiagnosticCapture = Object.freeze({ continuityEpoch: 0, continuityByInputId: Object.freeze({}), continuityBreakCount: 0, backgroundCounts: Object.freeze({ timingClock: 0, activeSensing: 0 }), observedInputs: Object.freeze([]), droppedCount: 0, events: Object.freeze([]), nextSequence: 1, originTimeStampMs: null, totalCaptured: 0 });

function inputSegment(capture: MidiDiagnosticCapture, inputId: string): number {
  return Object.hasOwn(capture.continuityByInputId, inputId) ? capture.continuityByInputId[inputId]! : 0;
}

/** Capture context only: no fabricated MIDI event. A source boundary leaves other inputs independent. */
export function advanceMidiDiagnosticContinuity(capture: MidiDiagnosticCapture, inputId?: string): MidiDiagnosticCapture {
  return Object.freeze({ ...capture,
    continuityBreakCount: capture.continuityBreakCount + 1,
    ...(inputId === undefined
      ? { continuityEpoch: capture.continuityEpoch + 1 }
      : { continuityByInputId: Object.freeze({ ...capture.continuityByInputId, [inputId]: inputSegment(capture, inputId) + 1 }) }),
  });
}

/** Only ordinary valid F8/FE messages are background; unexpected variants remain evidence rows. */
export function getMidiDiagnosticBackgroundKind(event: Pick<MidiDiagnosticCapturedEvent, "rawBytes" | "decoded">): "timingClock" | "activeSensing" | null {
  if (event.decoded.kind !== "system" || event.decoded.lengthCondition !== "expected" || event.rawBytes.length !== 1) return null;
  return event.rawBytes[0] === 0xf8 ? "timingClock" : event.rawBytes[0] === 0xfe ? "activeSensing" : null;
}

export function appendMidiDiagnosticEvent(capture: MidiDiagnosticCapture, input: Omit<MidiDiagnosticCapturedEvent, "sequence" | "relativeTimeMs" | "continuitySegment">): MidiDiagnosticCapture {
  const inputHasFiniteTimeStamp = Number.isFinite(input.eventTimeStampMs);
  const originTimeStampMs = Number.isFinite(capture.originTimeStampMs)
    ? capture.originTimeStampMs
    : inputHasFiniteTimeStamp ? input.eventTimeStampMs : null;
  const relativeTimeMs = inputHasFiniteTimeStamp && originTimeStampMs !== null
    ? input.eventTimeStampMs - originTimeStampMs
    : Number.NaN;
  const event = Object.freeze({ ...input, sequence: capture.nextSequence, relativeTimeMs, continuitySegment: `${capture.continuityEpoch}:${inputSegment(capture, input.source.id)}` });
  const background = getMidiDiagnosticBackgroundKind(event);
  const appended = [...capture.events, event];
  const overflow = Math.max(0, appended.length - MIDI_DIAGNOSTIC_CAPTURE_LIMIT);
  return Object.freeze({
    ...capture,
    backgroundCounts: background ? Object.freeze({ ...capture.backgroundCounts, [background]: capture.backgroundCounts[background] + 1 }) : capture.backgroundCounts,
    observedInputs: capture.observedInputs.some(({ id }) => id === input.source.id) ? capture.observedInputs : Object.freeze([...capture.observedInputs, input.source]),
    events: Object.freeze(overflow ? appended.slice(overflow) : appended),
    nextSequence: capture.nextSequence + 1,
    originTimeStampMs,
    totalCaptured: capture.totalCaptured + 1,
    droppedCount: capture.droppedCount + overflow,
  });
}

const sanitize = (value: string) => value.replaceAll("\\", "\\\\").replaceAll("\t", "\\t").replaceAll("\r", "\\r").replaceAll("\n", "\\n");
const time = (value: number) => Number.isFinite(value) ? value.toFixed(3) : "unavailable";

export function formatMidiDiagnosticCapture(input: Readonly<{ capture: MidiDiagnosticCapture; inputs: readonly MidiDiagnosticInputIdentity[]; version: string }>): string {
  const lines = [
    "Prelude MIDI Diagnostic Capture",
    `Prelude version: ${input.version}`,
    `Retained events: ${input.capture.events.length}`,
    `Total captured events: ${input.capture.totalCaptured}`,
    `Older events dropped: ${input.capture.droppedCount}`,
    "Inputs:",
    ...(input.inputs.length ? input.inputs.map(({ id, name }) => `- id=${sanitize(id)}\tname=${sanitize(name)}`) : ["- none"]),
    "",
    "sequence\trelative_ms\tevent_timestamp_ms\tsource_id\tsource_name\tmessage_length\ttype\tchannel\tdata\traw_hex",
    ...input.capture.events.map((event) => [
      event.sequence,
      time(event.relativeTimeMs),
      time(event.eventTimeStampMs),
      sanitize(event.source.id),
      sanitize(event.source.name),
      event.messageLength,
      event.decoded.type,
      event.decoded.channel ?? "—",
      formatMidiDiagnosticData(event.decoded),
      formatMidiDiagnosticRawBytes(event.rawBytes),
    ].join("\t")),
  ];
  return lines.join("\n");
}
