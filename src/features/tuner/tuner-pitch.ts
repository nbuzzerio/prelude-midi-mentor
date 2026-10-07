import { spellKeyAwareMidiNumber } from "@/lib/music/key-aware-spelling";
import { centsBetween, equalTemperedFrequency } from "@/lib/audio/monophonic/pitch-math";
export { centsBetween, equalTemperedFrequency } from "@/lib/audio/monophonic/pitch-math";
export { MONOPHONIC_CONFIG as TUNER_CONFIG } from "@/lib/audio/monophonic/pitch-analysis-types";
export type { PitchObservation } from "@/lib/audio/monophonic/pitch-analysis-types";

export function describeTunerPitch(frequencyHz: number, retainedSemitone?: number) {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) return null;
  const coordinate = 69 + 12 * Math.log2(frequencyHz / 440);
  const semitone = retainedSemitone ?? Math.round(coordinate);
  const note = spellKeyAwareMidiNumber({ midiNumber: semitone });
  return note ? { name: note.name, octave: note.octave, semitone, frequencyHz,
    cents: centsBetween(frequencyHz, equalTemperedFrequency(semitone)) } : null;
}
