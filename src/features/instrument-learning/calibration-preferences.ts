import { ADJUSTABLE_CALIBRATION_POLICY, validCalibrationTolerance } from "./calibration-types";

export const VIOLIN_CALIBRATION_TOLERANCE_KEY = "prelude-violin-calibration-tolerance-v1";
type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;
export function readCalibrationTolerance(storage: () => PreferenceStorage = () => window.localStorage): Readonly<{ value: number; message: string }> {
  const fallback = ADJUSTABLE_CALIBRATION_POLICY.defaultToleranceCents;
  try {
    const text = storage().getItem(VIOLIN_CALIBRATION_TOLERANCE_KEY);
    if (text === null) return { value: fallback, message: "" };
    const record: unknown = JSON.parse(text);
    if (record && typeof record === "object" && "version" in record && record.version === 1
      && "toleranceCents" in record && validCalibrationTolerance(record.toleranceCents)) return { value: record.toleranceCents, message: "" };
    return { value: fallback, message: "The remembered calibration tolerance is invalid. Using ±10 cents." };
  } catch { return { value: fallback, message: "Calibration tolerance could not be loaded. Using ±10 cents." }; }
}

export function saveCalibrationTolerance(value: number, storage: () => PreferenceStorage = () => window.localStorage): boolean {
  if (!validCalibrationTolerance(value)) return false;
  try { storage().setItem(VIOLIN_CALIBRATION_TOLERANCE_KEY, JSON.stringify({ version: 1, toleranceCents: value })); return true; }
  catch { return false; }
}
