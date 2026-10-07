// These limits and gates are provisional, measured in the isolated desktop spike.
export const MONOPHONIC_CONFIG = Object.freeze({
  frameSize: 2048, minHz: 120, maxHz: 2300, minDbfs: -55,
  peakRatio: 0.93, minQuality: 0.90, acquisitionMs: 80,
  octaveDwellMs: 120, maxGapMs: 100, staleMs: 120, clearMs: 400,
});

export type PitchObservation = Readonly<{
  frequencyHz: number | null;
  quality: number; // NSDF periodicity, NOT probability of correct musical identity.
  levelDbfs: number;
  reason: "usable" | "quiet" | "clipped" | "invalid" | "aperiodic" | "out-of-range" | "low-periodicity" | "clock-stalled";
}>;

export type TrackedPitch = Readonly<{ semitone: number; frequencyHz: number }>;
export type PitchSnapshot = Readonly<{
  state: "listening" | "acquiring" | "stable" | "uncertain";
  pitch: TrackedPitch | null; fresh: boolean; ageMs: number | null;
}>;

/** Scalar evidence only. Clocks are local to the owning capture session. */
export type PitchObservationEnvelope = Readonly<{
  observation: PitchObservation;
  snapshot: PitchSnapshot;
  observedAtMs: number;
  audioSeconds: number;
  captureGeneration: number;
}>;
