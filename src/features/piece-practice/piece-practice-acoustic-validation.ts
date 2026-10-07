import { MONOPHONIC_CONFIG, type PitchObservationEnvelope } from "@/lib/audio/monophonic/pitch-analysis-types";
import { centsBetween, describeFrequency, equalTemperedFrequency } from "@/lib/audio/monophonic/pitch-math";
import type { AcousticPitchGrade, PiecePracticeInputConfiguration } from "./piece-practice-acoustic-types";

export const PITCH_TOLERANCE_PRESETS = Object.freeze({ Tight: 15, Normal: 25, Forgiving: 40 });
export const validPitchTolerance = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 49;

export function validPiecePracticeInputConfiguration(value: unknown): value is PiecePracticeInputConfiguration {
  if (!value || typeof value !== "object" || !("mode" in value)) return false;
  if (value.mode === "keyboard") return true;
  return value.mode === "microphone" && "instrument" in value && (value.instrument === "violin" || value.instrument === "ocarina")
    && "pitchToleranceCents" in value && validPitchTolerance(value.pitchToleranceCents);
}

/** Fresh raw frequency is authoritative; retained/smoothed display pitch is not. */
export function reliableAcousticObservation({ observation, snapshot }: PitchObservationEnvelope): boolean {
  return observation.reason === "usable" && observation.frequencyHz !== null && Number.isFinite(observation.frequencyHz)
    && observation.frequencyHz >= MONOPHONIC_CONFIG.minHz && observation.frequencyHz <= MONOPHONIC_CONFIG.maxHz
    && Number.isFinite(observation.quality) && observation.quality >= MONOPHONIC_CONFIG.minQuality
    && Number.isFinite(observation.levelDbfs) && observation.levelDbfs >= MONOPHONIC_CONFIG.minDbfs
    && snapshot.fresh && snapshot.state === "stable" && snapshot.ageMs !== null && snapshot.ageMs >= 0
    && snapshot.ageMs <= MONOPHONIC_CONFIG.staleMs;
}

export function gradeAcousticPitch(frequencyHz: number | null, expectedSemitone: number, pitchToleranceCents: number): AcousticPitchGrade | null {
  if (!validPitchTolerance(pitchToleranceCents)) return null;
  if (!Number.isInteger(expectedSemitone) || expectedSemitone < 0 || expectedSemitone > 127 || frequencyHz === null) return null;
  const detected = describeFrequency(frequencyHz);
  if (!detected) return null;
  const centsFromExpected = centsBetween(frequencyHz, equalTemperedFrequency(expectedSemitone));
  // A few floating-point ulps at an exact boundary are arithmetic error, not a wider musical tolerance.
  const accepted = Math.abs(centsFromExpected) <= pitchToleranceCents + 1e-10;
  return { accepted, rejection: accepted ? null : detected.semitone === expectedSemitone ? "outside-tolerance" : "wrong-pitch",
    frequencyHz, nearestSemitone: detected.semitone, expectedSemitone, centsFromExpected, pitchToleranceCents };
}
