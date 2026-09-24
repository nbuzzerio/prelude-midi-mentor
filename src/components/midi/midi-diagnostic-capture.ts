import { formatMidiDiagnosticData, formatMidiDiagnosticRawBytes, type MidiDiagnosticDecodedMessage } from "./midi-diagnostic-message";

export const MIDI_DIAGNOSTIC_CAPTURE_LIMIT = 1_000;

export type MidiDiagnosticInputIdentity = Readonly<{ id: string; name: string }>;
export type MidiDiagnosticCapturedEvent = Readonly<{
  sequence: number;
  eventTimeStampMs: number;
  relativeTimeMs: number;
  source: MidiDiagnosticInputIdentity;
  rawBytes: readonly number[];
  messageLength: number;
  decoded: MidiDiagnosticDecodedMessage;
}>;

export type MidiDiagnosticCapture = Readonly<{
  droppedCount: number;
  events: readonly MidiDiagnosticCapturedEvent[];
  nextSequence: number;
  originTimeStampMs: number | null;
  totalCaptured: number;
}>;

export const EMPTY_MIDI_DIAGNOSTIC_CAPTURE: MidiDiagnosticCapture = Object.freeze({ droppedCount: 0, events: Object.freeze([]), nextSequence: 1, originTimeStampMs: null, totalCaptured: 0 });

export function appendMidiDiagnosticEvent(capture: MidiDiagnosticCapture, input: Omit<MidiDiagnosticCapturedEvent, "sequence" | "relativeTimeMs">): MidiDiagnosticCapture {
  const inputHasFiniteTimeStamp = Number.isFinite(input.eventTimeStampMs);
  const originTimeStampMs = Number.isFinite(capture.originTimeStampMs)
    ? capture.originTimeStampMs
    : inputHasFiniteTimeStamp ? input.eventTimeStampMs : null;
  const relativeTimeMs = inputHasFiniteTimeStamp && originTimeStampMs !== null
    ? input.eventTimeStampMs - originTimeStampMs
    : Number.NaN;
  const event = Object.freeze({ ...input, sequence: capture.nextSequence, relativeTimeMs });
  const appended = [...capture.events, event];
  const overflow = Math.max(0, appended.length - MIDI_DIAGNOSTIC_CAPTURE_LIMIT);
  return Object.freeze({
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
