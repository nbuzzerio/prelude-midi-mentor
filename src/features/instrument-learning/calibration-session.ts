import { ADJUSTABLE_CALIBRATION_POLICY, CALIBRATION_POLICY, validCalibrationTolerance, emptyCalibrationMeasurement, VIOLIN_REFERENCES, type CalibrationAttempt, type CalibrationMeasurement, type CalibrationSession } from "./calibration-types";

export function createCalibrationSession(id: string, replacesCalibrationId: string | null = null, acceptanceToleranceCents?: number): CalibrationSession {
  if (acceptanceToleranceCents !== undefined && !validCalibrationTolerance(acceptanceToleranceCents)) throw new Error("Calibration tolerance must be an integer from 1 to 30 cents.");
  return { id, revision: 1, replacesCalibrationId, instrument: "violin", profileId: "violin-standard-open-strings", profileVersion: 1,
    referenceA4Hz: 440, temperament: "12-tone-equal", policyVersion: acceptanceToleranceCents === undefined ? CALIBRATION_POLICY.version : ADJUSTABLE_CALIBRATION_POLICY.version,
    ...(acceptanceToleranceCents === undefined ? {} : { acceptanceToleranceCents }), referenceIndex: 0, phase: "collecting",
    measurement: emptyCalibrationMeasurement(), attempts: [] };
}
export function assessCalibration(state: CalibrationSession, measurement: CalibrationMeasurement): CalibrationSession {
  if (state.phase === "summary") return state;
  return { ...state, measurement, phase: measurement.status === "valid" ? "assessed" : "collecting" };
}
export function advanceCalibration(state: CalibrationSession, choice: "automatic" | "continue" | "skip" | "retry"): CalibrationSession {
  if (state.phase === "summary" || choice === "automatic" && state.measurement.tuning !== "within-band"
    || choice === "continue" && state.measurement.status !== "valid" || state.attempts.length >= 128 && choice === "retry") return state;
  const disposition: CalibrationAttempt["disposition"] = choice === "retry" ? null : choice === "skip" ? "skipped"
    : state.measurement.tuning === "within-band" ? "completed" : "continued-with-warning";
  const attempts = [...state.attempts, { revision: state.revision, reference: VIOLIN_REFERENCES[state.referenceIndex],
    measurement: state.measurement, disposition, choice,
    ...(state.policyVersion === 4 ? { policyVersion: 4 as const, acceptanceToleranceCents: state.acceptanceToleranceCents } : {}) }];
  const referenceIndex = state.referenceIndex + (choice === "retry" ? 0 : 1);
  return { ...state, attempts, referenceIndex, revision: state.revision + 1,
    phase: referenceIndex === VIOLIN_REFERENCES.length ? "summary" : "collecting", measurement: emptyCalibrationMeasurement() };
}

/** Restart only the unfinished reference, retaining earlier choices and their effective settings. */
export function changeCalibrationTolerance(state: CalibrationSession, value: number): CalibrationSession {
  if (state.policyVersion !== 4 || !validCalibrationTolerance(value) || value === state.acceptanceToleranceCents) return state;
  const next = advanceCalibration(state, "retry");
  return next === state ? state : { ...next, acceptanceToleranceCents: value };
}
