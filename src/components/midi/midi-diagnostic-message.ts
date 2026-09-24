import { getFullNoteName } from "@/lib/music/notes";

type LengthCondition = Readonly<{
  expectedLength: number | null;
  lengthCondition: "expected" | "extra" | "truncated" | "variable";
}>;

type DecodedBase = LengthCondition & Readonly<{
  channel: number | null;
  family: "channel" | "system" | "unknown";
  type: string;
}>;

type NoteMessage = DecodedBase & Readonly<{
  encoding: "note-off" | "note-on-zero";
  noteName: string;
  noteNumber: number;
  releaseVelocity: number;
}>;

export type MidiDiagnosticDecodedMessage =
  | (DecodedBase & Readonly<{ kind: "note-on"; attackVelocity: number; noteName: string; noteNumber: number }>)
  | (NoteMessage & Readonly<{ kind: "note-release" }>)
  | (DecodedBase & Readonly<{ kind: "polyphonic-key-pressure"; noteName: string; noteNumber: number; pressure: number }>)
  | (DecodedBase & Readonly<{ kind: "control-change"; controllerNumber: number; controllerValue: number }>)
  | (DecodedBase & Readonly<{ kind: "program-change"; programNumber: number }>)
  | (DecodedBase & Readonly<{ kind: "channel-pressure"; pressure: number }>)
  | (DecodedBase & Readonly<{ kind: "pitch-bend"; centeredValue: number; value: number }>)
  | (DecodedBase & Readonly<{ kind: "system"; dataValues: readonly number[] }>)
  | (DecodedBase & Readonly<{ kind: "malformed"; statusByte: number | null }>)
  | (DecodedBase & Readonly<{ kind: "unknown"; statusByte: number }>)
;

const CHANNEL_LENGTHS: Readonly<Record<number, number>> = {
  0x80: 3, 0x90: 3, 0xa0: 3, 0xb0: 3, 0xc0: 2, 0xd0: 2, 0xe0: 3,
};
const CHANNEL_TYPES: Readonly<Record<number, string>> = {
  0x80: "Note Off", 0x90: "Note On", 0xa0: "Polyphonic Key Pressure", 0xb0: "Control Change", 0xc0: "Program Change", 0xd0: "Channel Pressure", 0xe0: "Pitch Bend",
};

const SYSTEM_MESSAGES: Readonly<Record<number, Readonly<{ length: number | null; type: string }>>> = {
  0xf0: { length: null, type: "System Exclusive" },
  0xf1: { length: 2, type: "MIDI Time Code Quarter Frame" },
  0xf2: { length: 3, type: "Song Position Pointer" },
  0xf3: { length: 2, type: "Song Select" },
  0xf6: { length: 1, type: "Tune Request" },
  0xf7: { length: 1, type: "End of Exclusive" },
  0xf8: { length: 1, type: "Timing Clock" },
  0xfa: { length: 1, type: "Start" },
  0xfb: { length: 1, type: "Continue" },
  0xfc: { length: 1, type: "Stop" },
  0xfe: { length: 1, type: "Active Sensing" },
  0xff: { length: 1, type: "System Reset" },
};

function lengths(actual: number, expected: number | null): LengthCondition {
  if (expected === null) return { expectedLength: null, lengthCondition: "variable" };
  return { expectedLength: expected, lengthCondition: actual < expected ? "truncated" : actual > expected ? "extra" : "expected" };
}

function malformed(rawBytes: readonly number[], statusByte: number | null, family: DecodedBase["family"], type: string, channel: number | null, expectedLength: number | null): MidiDiagnosticDecodedMessage {
  return { kind: "malformed", family, type, channel, statusByte, ...lengths(rawBytes.length, expectedLength) };
}

export function decodeMidiDiagnosticMessage(bytes: ArrayLike<number>): Readonly<{ decoded: MidiDiagnosticDecodedMessage; rawBytes: readonly number[] }> {
  const rawBytes = Object.freeze(Array.from(bytes));
  const statusByte = rawBytes[0];
  if (statusByte === undefined) return { rawBytes, decoded: malformed(rawBytes, null, "unknown", "Empty message", null, 1) };
  if (statusByte < 0x80) return { rawBytes, decoded: malformed(rawBytes, statusByte, "unknown", "Data without status", null, null) };

  if (statusByte >= 0xf0) {
    const definition = SYSTEM_MESSAGES[statusByte];
    if (!definition) return { rawBytes, decoded: { kind: "unknown", family: "unknown", type: "Reserved or unknown system message", channel: null, statusByte, ...lengths(rawBytes.length, 1) } };
    const condition = lengths(rawBytes.length, definition.length);
    if (condition.lengthCondition === "truncated") return { rawBytes, decoded: malformed(rawBytes, statusByte, "system", definition.type, null, definition.length) };
    return { rawBytes, decoded: { kind: "system", family: "system", type: definition.type, channel: null, dataValues: rawBytes.slice(1), ...condition } };
  }

  const command = statusByte & 0xf0;
  const channel = (statusByte & 0x0f) + 1;
  const expectedLength = CHANNEL_LENGTHS[command];
  if (expectedLength === undefined) return { rawBytes, decoded: { kind: "unknown", family: "unknown", type: "Unknown channel message", channel, statusByte, ...lengths(rawBytes.length, 1) } };
  const condition = lengths(rawBytes.length, expectedLength);
  const type = CHANNEL_TYPES[command]!;
  if (condition.lengthCondition === "truncated") return { rawBytes, decoded: malformed(rawBytes, statusByte, "channel", type, channel, expectedLength) };

  const first = rawBytes[1]!;
  const second = rawBytes[2]!;
  const base = { family: "channel" as const, channel, ...condition };
  if (command === 0x80) return { rawBytes, decoded: { ...base, kind: "note-release", type: "Note Release", encoding: "note-off", noteNumber: first, noteName: getFullNoteName(first), releaseVelocity: second } };
  if (command === 0x90 && second === 0) return { rawBytes, decoded: { ...base, kind: "note-release", type: "Note Release", encoding: "note-on-zero", noteNumber: first, noteName: getFullNoteName(first), releaseVelocity: second } };
  if (command === 0x90) return { rawBytes, decoded: { ...base, kind: "note-on", type: "Note On", noteNumber: first, noteName: getFullNoteName(first), attackVelocity: second } };
  if (command === 0xa0) return { rawBytes, decoded: { ...base, kind: "polyphonic-key-pressure", type, noteNumber: first, noteName: getFullNoteName(first), pressure: second } };
  if (command === 0xb0) return { rawBytes, decoded: { ...base, kind: "control-change", type, controllerNumber: first, controllerValue: second } };
  if (command === 0xc0) return { rawBytes, decoded: { ...base, kind: "program-change", type, programNumber: first } };
  if (command === 0xd0) return { rawBytes, decoded: { ...base, kind: "channel-pressure", type, pressure: first } };
  const value = first | (second << 7);
  return { rawBytes, decoded: { ...base, kind: "pitch-bend", type, value, centeredValue: value - 8192 } };
}

export function formatMidiDiagnosticData(decoded: MidiDiagnosticDecodedMessage): string {
  const length = decoded.lengthCondition === "extra" ? `;unexpectedLength=${decoded.expectedLength}->extra` : decoded.lengthCondition === "truncated" ? `;unexpectedLength=${decoded.expectedLength}->truncated` : "";
  switch (decoded.kind) {
    case "note-on": return `note=${decoded.noteNumber};name=${decoded.noteName};attackVelocity=${decoded.attackVelocity}${length}`;
    case "note-release": return `note=${decoded.noteNumber};name=${decoded.noteName};releaseVelocity=${decoded.releaseVelocity};encoding=${decoded.encoding}${length}`;
    case "polyphonic-key-pressure": return `note=${decoded.noteNumber};name=${decoded.noteName};pressure=${decoded.pressure}${length}`;
    case "control-change": return `controller=${decoded.controllerNumber};value=${decoded.controllerValue}${length}`;
    case "program-change": return `program=${decoded.programNumber}${length}`;
    case "channel-pressure": return `pressure=${decoded.pressure}${length}`;
    case "pitch-bend": return `value=${decoded.value};centered=${decoded.centeredValue}${length}`;
    case "system": return `data=${decoded.dataValues.join(",") || "none"}${length}`;
    case "malformed": return `status=${decoded.statusByte ?? "none"};expectedLength=${decoded.expectedLength ?? "unknown"};actualLength=${decoded.lengthCondition === "truncated" ? "truncated" : "unknown"}`;
    case "unknown": return `status=${decoded.statusByte}${length}`;
  }
}

export function formatMidiDiagnosticRawBytes(rawBytes: readonly number[]): string {
  return rawBytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ");
}
