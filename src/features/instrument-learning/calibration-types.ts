import type { PitchObservationEnvelope } from "@/lib/audio/monophonic/pitch-analysis-types";
import { equalTemperedFrequency } from "@/lib/audio/monophonic/pitch-math";

/** Provisional physical-QA policy, independent of practice acceptance tolerance. */
export const PRECISE_CALIBRATION_POLICY = Object.freeze({ version: 1, settlingMs: 200, windowMs: 800,
  minimumSamples: 20, maxGapMs: 100, spreadCents: 10, driftCents: 5,
  greenCents: 5, yellowCents: 15, fundamentalCents: 50, harmonicCents: 35, acknowledgmentMs: 900 });
/** Provisional beginner preparation policy; never used to offset Piece Practice grading. */
export const LEGACY_BEGINNER_CALIBRATION_POLICY = Object.freeze({ version: 2, id: "violin-beginner-pluck",
  settlingMs: 50, windowMs: 90, minimumSamples: 4, maxGapMs: 100,
  minimumSampleSpacingMs: 25, maximumAgeMs: 3000, maximumSamples: 24,
  compatibilityCents: 20, agreementFraction: 0.75, agreementWindowSamples: 8, spreadCents: 25, madCents: 12, driftCents: null,
  greenCents: 20, yellowCents: 40, fundamentalCents: 100, harmonicCents: 35,
  attackRiseDb: 6, acknowledgmentMs: 1200 });
/** Revised tuning tolerance only; v2 evidence requirements are preserved. */
export const CALIBRATION_POLICY = Object.freeze({ ...LEGACY_BEGINNER_CALIBRATION_POLICY,
  version: 3, id: "violin-beginner-pluck-10c", idealCents: 5, greenCents: 10, yellowCents: 25 });
export type CalibrationPolicy = typeof CALIBRATION_POLICY | typeof PRECISE_CALIBRATION_POLICY;
export const VIOLIN_REFERENCES = Object.freeze([
  { stringId: "G", note: "G3", semitone: 55 }, { stringId: "D", note: "D4", semitone: 62 },
  { stringId: "A", note: "A4", semitone: 69 }, { stringId: "E", note: "E5", semitone: 76 },
].map((reference) => Object.freeze({ ...reference, frequencyHz: equalTemperedFrequency(reference.semitone) })));
export type ViolinReference = typeof VIOLIN_REFERENCES[number];
export type FactProvenance = Readonly<{
  kind: "measured-estimate" | "derived" | "authored" | "recommended" | "inferred" | "user-selected";
  source: string; version: number; evidenceIds: readonly string[]; calibrationRevision: number | null;
  assumptions: readonly string[];
}>;
export type CalibrationSample = Readonly<{ id: string; envelope: PitchObservationEnvelope }>;
export type CalibrationMeasurement = Readonly<{
  status: "valid" | "insufficient" | "ambiguous";
  tuning: "within-band" | "near-target" | "needs-adjustment" | "unknown";
  ambiguity: "possible-harmonic-or-different-pitch" | "outside-fundamental-region" | null;
  stable: boolean; sampleCount: number; startMs: number | null; endMs: number | null;
  medianHz: number | null; cents: number | null; p10Cents: number | null; p90Cents: number | null;
  madCents: number | null; driftCents: number | null; coverageMs: number;
  samples: readonly CalibrationSample[];
}>;
export type CalibrationAttempt = Readonly<{
  revision: number; reference: ViolinReference; measurement: CalibrationMeasurement;
  disposition: "completed" | "skipped" | "continued-with-warning" | null;
  choice: "automatic" | "continue" | "skip" | "retry";
}>;
export type CalibrationSession = Readonly<{
  id: string; revision: number; replacesCalibrationId: string | null;
  instrument: "violin"; profileId: "violin-standard-open-strings"; profileVersion: 1;
  referenceA4Hz: 440; temperament: "12-tone-equal"; policyVersion: 1 | 2 | 3;
  referenceIndex: number; phase: "collecting" | "assessed" | "summary";
  measurement: CalibrationMeasurement; attempts: readonly CalibrationAttempt[];
}>;
export const emptyCalibrationMeasurement = (): CalibrationMeasurement => ({ status: "insufficient", tuning: "unknown",
  ambiguity: null, stable: false, sampleCount: 0, startMs: null, endMs: null, medianHz: null, cents: null,
  p10Cents: null, p90Cents: null, madCents: null, driftCents: null, coverageMs: 0, samples: [] });
