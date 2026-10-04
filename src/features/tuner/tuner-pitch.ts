import { spellKeyAwareMidiNumber } from "@/lib/music/key-aware-spelling";

// These limits and gates are provisional, measured in the isolated desktop spike.
export const TUNER_CONFIG = Object.freeze({
  frameSize: 2048, minHz: 120, maxHz: 2300, minDbfs: -55,
  peakRatio: 0.93, minQuality: 0.90, acquisitionMs: 80,
  octaveDwellMs: 120, maxGapMs: 100, staleMs: 120, clearMs: 400,
});

export const centsBetween = (frequencyHz: number, referenceHz: number) =>
  1200 * Math.log2(frequencyHz / referenceHz);
export const equalTemperedFrequency = (semitone: number) => 440 * 2 ** ((semitone - 69) / 12);

export function describeTunerPitch(frequencyHz: number, retainedSemitone?: number) {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) return null;
  const coordinate = 69 + 12 * Math.log2(frequencyHz / 440);
  const semitone = retainedSemitone ?? Math.round(coordinate);
  const note = spellKeyAwareMidiNumber({ midiNumber: semitone });
  return note ? { name: note.name, octave: note.octave, semitone, frequencyHz,
    cents: centsBetween(frequencyHz, equalTemperedFrequency(semitone)) } : null;
}

export type PitchObservation = Readonly<{
  frequencyHz: number | null;
  quality: number; // NSDF periodicity, NOT probability of correct musical identity.
  levelDbfs: number;
  reason: "usable" | "quiet" | "clipped" | "invalid" | "aperiodic" | "out-of-range" | "low-periodicity" | "clock-stalled";
}>;
