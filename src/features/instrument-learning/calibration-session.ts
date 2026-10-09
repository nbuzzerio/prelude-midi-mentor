import { CALIBRATION_POLICY, emptyCalibrationMeasurement, VIOLIN_REFERENCES, type CalibrationAttempt, type CalibrationMeasurement, type CalibrationSession } from "./calibration-types";

export function createCalibrationSession(id: string, replacesCalibrationId: string | null = null): CalibrationSession {
  return { id, revision: 1, replacesCalibrationId, instrument: "violin", profileId: "violin-standard-open-strings", profileVersion: 1,
    referenceA4Hz: 440, temperament: "12-tone-equal", policyVersion: CALIBRATION_POLICY.version, referenceIndex: 0, phase: "collecting",
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
    measurement: state.measurement, disposition, choice }];
  const referenceIndex = state.referenceIndex + (choice === "retry" ? 0 : 1);
  return { ...state, attempts, referenceIndex, revision: state.revision + 1,
    phase: referenceIndex === VIOLIN_REFERENCES.length ? "summary" : "collecting", measurement: emptyCalibrationMeasurement() };
}
