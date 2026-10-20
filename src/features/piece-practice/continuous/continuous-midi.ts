import { decodeMidiDiagnosticMessage } from "@/components/midi/midi-diagnostic-message";
import type { MidiInputInfo, RawMidiMessage } from "@/lib/midi/midi-transport";
import type { ContinuousAttack } from "./continuous-types";

/** One selected physical transport stream. Releases are gates, never grades. */
export function createContinuousMidiCapture(input: MidiInputInfo) {
  let sequence = 0;
  return (message: RawMidiMessage, audioSeconds: number, performanceSeconds: number): ContinuousAttack | null => {
    if (input.id === null || message.input.id !== input.id || !message.bytes || message.dataStatus !== "available") return null;
    const { decoded } = decodeMidiDiagnosticMessage(message.bytes);
    if (decoded.kind !== "note-on" || decoded.lengthCondition !== "expected"
      || message.bytes.length !== 3 || message.bytes.slice(1).some((b) => !Number.isInteger(b) || b < 0 || b > 127)) return null;
    // Every actual Note On is distinct. A held set is never sampled to fabricate attacks.
    const source = message.sourceTimeStampMs;
    const age = source !== null && Number.isFinite(source) ? message.receivedAtMs - source : NaN;
    const reliable = Number.isFinite(age) && age >= -1 && age <= 50;
    const correction = reliable ? Math.max(0, age) : 0;
    return { id: ++sequence, midi: decoded.noteNumber, channel: message.bytes[0]! & 0x0f,
      velocity: decoded.attackVelocity, timeMs: (audioSeconds - performanceSeconds) * 1000 - correction,
      sourceTimeStampMs: source !== null && Number.isFinite(source) ? source : null,
      receivedAtMs: message.receivedAtMs, audioTimeSeconds: audioSeconds,
      uncertaintyMs: reliable ? Math.max(5, correction) : null, input: { ...message.input }, source: "physical-midi" };
  };
}
