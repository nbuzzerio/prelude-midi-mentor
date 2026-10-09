import { version } from "../../../package.json";
import { MONOPHONIC_CONFIG } from "@/lib/audio/monophonic/pitch-analysis-types";
import { CALIBRATION_POLICY, LEGACY_BEGINNER_CALIBRATION_POLICY, PRECISE_CALIBRATION_POLICY, type CalibrationMeasurement } from "@/features/instrument-learning/calibration-types";
import { ANALYSIS_POLICY, type AnalysisData } from "./acoustic-analysis-types";
import { summarizeAcousticAnalysis } from "./acoustic-analysis-summary";

export const ANALYSIS_DEFINITIONS = Object.freeze({
  frequencyUnit: "Hz", timeUnit: "ms", clocks: "atMs is monotonic time relative to this analysis session; audioMs is relative to its capture segment. Practice occurredAtActiveMs excludes paused time.",
  cents: "1200 * log2(detectedHz / referenceHz). Positive is sharp/above; negative is flat/below.",
  reference: "A4 = 440 Hz, 12-tone equal temperament, scientific pitch numbering. Numeric semitone 69 = A4; these are not MIDI messages.",
  quality: "NSDF periodicity, NOT pitch-identity probability. A high value can accompany an octave error.",
  frequency: "Detector estimate; null means no usable frequency, not zero Hz. TrackedHz is separately smoothed/retained display evidence.",
  level: "levelDbfs is digital signal level, NOT acoustic SPL. The analyzer uses -180 dBFS as a floor/sentinel.",
  attacks: "Articulation is an algorithmic hypothesis, not an observed physical bow/tongue action. Confirmation delay is NOT hardware latency or earliest physical attack pitch.",
  trace: "First actual source observation per fixed 100 ms bin, split at context boundaries. Actual timestamps are retained without interpolation. Counts/min/max/reasons summarize that bin, relative to context.referenceHz.",
  attribution: "targetVisitId identifies the displayed target context, not proof that continued sound was intended for it. Continued sound after acceptance is unassignable without new attack evidence.",
  calibration: "Beginner short-note candidates: 50 ms attack guard, 4 agreeing raw observations and 90 ms sampled ringing, optionally combined across compatible candidates within 3 seconds. Median and spread are estimates, not confidence. Quiet gaps do not count as ringing coverage. Baselines never change concert targets or grading.",
  provenance: { observation: "measured-estimate: monophonic MPM/NSDF", trackedPitch: "derived: pitch stabilizer",
    target: "authored: Piece Practice source projection", calibration: "derived: calibration policy v3 (beginner pluck, 10-cent acceptance); historical attempts retain their own policyVersion; prompted string is assumed, actual physical string unknown",
    choice: "user-selected, except explicitly automatic green advance", supportedKinds: ["measured-estimate", "derived", "authored", "recommended", "inferred", "user-selected"] },
  states: { listening: "No retained pitch", acquiring: "Candidate being acquired", stable: "Fresh tracked pitch, not necessarily stable tuning", uncertain: "Retained pitch is not reliable" },
  reasons: { usable: "Analyzer gates passed", quiet: "Below level gate", clipped: "Excess clipped samples", invalid: "Invalid input samples",
    aperiodic: "No periodic peak", "out-of-range": "Estimate outside supported range", "low-periodicity": "Below NSDF gate", "clock-stalled": "Audio clock did not progress" },
  retention: "4-second bounded ring; diagnostic windows approximately 1s before/2s after events, 60s total reserved coverage with 10s reserved for calibration. Collection stops at duration/event/memory limits. See coverage for gaps, omitted windows and truncation.",
  limitations: "No raw audio exists. Discarded observations cannot be reconstructed. Downsampled trace cannot support reliable vibrato-rate analysis. No convergence, mastery, physical-fingering or tuning-drift inference is made.",
});

function measurement(value: CalibrationMeasurement, origin: number) {
  return { status: value.status, tuning: value.tuning, ambiguity: value.ambiguity, stable: value.stable,
    sampleCount: value.sampleCount, startMs: value.startMs === null ? null : value.startMs - origin,
    endMs: value.endMs === null ? null : value.endMs - origin, medianHz: value.medianHz, cents: value.cents,
    p10Cents: value.p10Cents, p90Cents: value.p90Cents, madCents: value.madCents, driftCents: value.driftCents,
    coverageMs: value.coverageMs, retainedSampleCount: value.samples.length, supportingObservationIds: value.samples.map(({ id }) => id),
    samples: value.samples.map(({ id, envelope: e }) => ({ id, atMs: e.observedAtMs - origin, captureGeneration: e.captureGeneration,
      frequencyHz: e.observation.frequencyHz, quality: e.observation.quality, levelDbfs: e.observation.levelDbfs,
      reason: e.observation.reason, state: e.snapshot.state, fresh: e.snapshot.fresh, ageMs: e.snapshot.ageMs,
      trackedHz: e.snapshot.pitch?.frequencyHz ?? null })) };
}
export function createAcousticAnalysisBundle(data: AnalysisData, originMs: number) {
  const calibrations = data.calibrations.map((c) => ({ id: c.id, revision: c.revision, replacesCalibrationId: c.replacesCalibrationId,
    instrument: c.instrument, profileId: c.profileId, profileVersion: c.profileVersion, referenceA4Hz: c.referenceA4Hz,
    temperament: c.temperament, policyVersion: c.policyVersion, phase: c.phase, referenceIndex: c.referenceIndex,
    measurement: measurement(c.measurement, originMs), attempts: c.attempts.map((a) => ({ revision: a.revision,
      reference: { stringId: a.reference.stringId, note: a.reference.note, semitone: a.reference.semitone, frequencyHz: a.reference.frequencyHz },
      disposition: a.disposition, choice: a.choice, measurement: measurement(a.measurement, originMs) })) }));
  return { format: "prelude-acoustic-analysis" as const, schemaVersion: 1 as const, appVersion: version,
    definitions: ANALYSIS_DEFINITIONS, session: { id: data.session.id, runId: data.session.runId, startedAt: data.session.startedAt,
      instrument: data.session.instrument, startMeasureIndex: data.session.startMeasureIndex, endMeasureIndex: data.session.endMeasureIndex,
      focus: data.session.focus, pitchToleranceCents: data.session.pitchToleranceCents, practiceSemantics: "blocking-pitch-attack", transient: true },
    analyzer: { algorithm: "MPM/NSDF", algorithmVersion: 1, source: "src/lib/audio/monophonic", configuration: MONOPHONIC_CONFIG, nominalCadenceHz: 30, effectiveSampleRateHz: null },
    policies: { calibration: CALIBRATION_POLICY, preciseCalibration: PRECISE_CALIBRATION_POLICY, legacyBeginnerCalibration: LEGACY_BEGINNER_CALIBRATION_POLICY, collection: ANALYSIS_POLICY },
    captureSegments: data.captureSegments, lifecycleEvents: data.lifecycleEvents, calibrations, targets: data.targets,
    targetVisits: data.targetVisits, locationAssumptions: [], attacks: data.attacks, attempts: data.attempts,
    trace: data.trace, highResolutionWindows: data.highResolutionWindows,
    derivedSummaries: summarizeAcousticAnalysis(data), coverage: data.coverage,
    environment: { audioProcessing: "Requested mono, echo cancellation/noise suppression/auto gain disabled; effective settings unknown." } };
}
export type AcousticAnalysisBundle = ReturnType<typeof createAcousticAnalysisBundle>;
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
function finiteTree(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(finiteTree);
  if (object(value)) return Object.values(value).every(finiteTree);
  return value === null || ["string", "boolean"].includes(typeof value);
}
/** Validation for this export contract, not a recovery/import feature. */
export function isAcousticAnalysisBundle(value: unknown): value is AcousticAnalysisBundle {
  try { return validateBundle(value); } catch { return false; }
}
function validateBundle(value: unknown): value is AcousticAnalysisBundle {
  if (!object(value) || value.format !== "prelude-acoustic-analysis" || value.schemaVersion !== 1 || typeof value.appVersion !== "string"
    || !object(value.definitions) || !object(value.session) || typeof value.session.id !== "string" || !object(value.coverage)
    || !object(value.analyzer) || !object(value.environment) || !object(value.policies) || !finiteTree(value)) return false;
  const keys = ["captureSegments", "lifecycleEvents", "calibrations", "targets", "targetVisits", "locationAssumptions", "attacks", "attempts", "trace", "highResolutionWindows", "derivedSummaries"];
  if (!keys.every((key) => Array.isArray(value[key]))) return false;
  const data = value as AcousticAnalysisBundle;
  const visits = new Set(data.targetVisits.map((v) => v.id)), targets = new Set(data.targets.map((t) => t.id));
  const segments = new Set(data.captureSegments.map((s) => s.id)), attacks = new Set(data.attacks.map((a) => a.id));
  if (data.targetVisits.some((v) => !targets.has(v.targetId)) || data.attacks.some((a) => !visits.has(a.targetVisitId) || !segments.has(a.captureSegmentId))
    || data.attempts.some((a) => !visits.has(a.targetVisitId) || !attacks.has(a.attackId))) return false;
  if (new Set(data.targetVisits.map((v) => v.id)).size !== data.targetVisits.length
    || new Set(data.captureSegments.map((s) => s.id)).size !== data.captureSegments.length
    || data.targets.some((t) => typeof t.id !== "string" || typeof t.spelling !== "string" || !(t.expectedHz > 0))
    || data.calibrations.some((c) => typeof c.id !== "string" || !Number.isInteger(c.revision) || c.revision < 1 || !Array.isArray(c.attempts))) return false;
  return [...data.trace.map((bin) => bin.observation), ...data.highResolutionWindows.flatMap((window) => window.observations)].every((row) =>
    row && row.atMs >= 0 && segments.has(row.captureSegmentId) && row.context
    && (row.context.targetVisitId === null || visits.has(row.context.targetVisitId))
    && (row.frequencyHz === null || row.frequencyHz > 0));
}
export function serializeAcousticAnalysis(data: AnalysisData, originMs: number): string {
  const bundle = createAcousticAnalysisBundle(data, originMs);
  if (!isAcousticAnalysisBundle(bundle)) throw new Error("Analysis data could not be validated. Practice is unaffected.");
  return JSON.stringify(bundle, null, 2);
}
export function acousticAnalysisFilename(startedAt: string) {
  return `prelude-acoustic-analysis-${startedAt.replace(/[^0-9TZ-]/g, "-")}.json`;
}
