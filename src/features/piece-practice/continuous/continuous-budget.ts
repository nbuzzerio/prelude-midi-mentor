import type { MidiInputInfo } from "@/lib/midi/midi-transport";
import type { ContinuousAttack, ContinuousPassage } from "./continuous-types";

export const CONTINUOUS_MAX_MEASURES = 16;
export const CONTINUOUS_MAX_ATTACKS = 2048;
export const CONTINUOUS_MAX_RECORD_BYTES = 2 * 1024 * 1024;
export const continuousBytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

/** Transient allowance, not a new persisted field or a change to assessment. */
export function continuousBudget(passage: ContinuousPassage, input: MidiInputInfo) {
  const expectedAttacks = passage.expected.reduce((n, e) => n + e.target.expectedMidiNumbers.length, 0);
  // Bound every possible terminal association without running the assessor on
  // each Note On. Numbers occupy at most 25 JSON bytes (including a minus sign).
  // Strings/IDs come from the actual frozen targets, not an average-size score.
  const groups = passage.expected.map(e => ({ targetId: e.target.id, measureIndex: e.target.measureIndex,
    eventIds: e.target.sourceEventIds, timeMs: e.timeMs, partialChord: false,
    pitches: e.target.expectedMidiNumbers.map(midi => ({ midi, attackId: Number.MAX_SAFE_INTEGER,
      outcome: "unobserved", timing: "uncertain", offsetMs: -Number.MAX_VALUE })) }));
  const terminalBytes = continuousBytes(passage) + continuousBytes(input) + continuousBytes(groups)
    + CONTINUOUS_MAX_ATTACKS * 18 + 8192;
  // Worst finite-number representation for all seven numeric evidence fields,
  // with the exact selected device's escaped UTF-8 metadata on every attack.
  const attackBytes = continuousBytes({ id: Number.MAX_SAFE_INTEGER, midi: 127, channel: 15, velocity: 127,
    timeMs: -Number.MAX_VALUE, sourceTimeStampMs: -Number.MAX_VALUE, receivedAtMs: -Number.MAX_VALUE,
    audioTimeSeconds: -Number.MAX_VALUE, uncertaintyMs: -Number.MAX_VALUE, input, source: "physical-midi" }) + 17;
  return { expectedAttacks, terminalBytes, attackBytes,
    requiredBytes: terminalBytes + expectedAttacks * attackBytes };
}

export function admitContinuousPassage(passage: ContinuousPassage, input: MidiInputInfo) {
  const budget = continuousBudget(passage, input);
  if (budget.expectedAttacks > CONTINUOUS_MAX_ATTACKS) {
    throw Error(`This range needs ${budget.expectedAttacks.toLocaleString()} pitch attacks; the limit is 2,048. Select a shorter or less dense range.`);
  }
  if (budget.requiredBytes > CONTINUOUS_MAX_RECORD_BYTES) {
    throw Error("This range cannot safely retain its MIDI evidence within the 2 MiB record limit. Select a shorter or less dense range.");
  }
  return budget;
}

export function continuousAttackBytes(attack: ContinuousAttack) { return continuousBytes(attack) + 1; }
