import { centsBetween } from "@/lib/audio/monophonic/pitch-math";
import { CALIBRATION_POLICY, type FactProvenance, type ViolinReference, type CalibrationPolicy } from "./calibration-types";

export function calibrationAmbiguity(hz: number, reference: ViolinReference, policy: CalibrationPolicy = CALIBRATION_POLICY) {
  if ([0.25, 0.5, 2, 3, 4].some((ratio) => Math.abs(centsBetween(hz, reference.frequencyHz * ratio)) <= policy.harmonicCents)) {
    return "possible-harmonic-or-different-pitch" as const;
  }
  return Math.abs(centsBetween(hz, reference.frequencyHz)) > policy.fundamentalCents + 1e-9
    ? "outside-fundamental-region" as const : null;
}

/** Conditional interpretation only. Never used by grading; unknown string means no residual. */
export function baselineRelativePitch(absoluteCents: number, baseline: {
  stringId: string; cents: number; revision: number; provenance: FactProvenance;
} | null) {
  if (!baseline || !Number.isFinite(absoluteCents) || !Number.isFinite(baseline.cents)) return null;
  return { absoluteCents, residualCents: absoluteCents - baseline.cents, assumedString: baseline.stringId,
    calibrationRevision: baseline.revision, provenance: baseline.provenance,
    meaning: "Conditional residual; does not establish physical finger placement or concert-pitch accuracy." };
}
