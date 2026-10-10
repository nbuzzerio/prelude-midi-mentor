import { VIOLIN_REFERENCES } from "./calibration-types";
import type { InstrumentPitchContext } from "./instrument-pitch-context";
import { MONOPHONIC_CONFIG } from "@/lib/audio/monophonic/pitch-analysis-types";
import { equalTemperedFrequency } from "@/lib/audio/monophonic/pitch-math";

export type ViolinStringId = "G" | "D" | "A" | "E";
export type ViolinStringSelection = ViolinStringId | "auto";
export const VIOLIN_STRINGS = Object.freeze(VIOLIN_REFERENCES.map((reference) => Object.freeze({
  ...reference, stringId: reference.stringId as ViolinStringId,
})));

/** Owner-supplied Violin Lounge beginner profile. No extensions or higher positions. */
export const VIOLIN_FIRST_POSITION_GUIDE = Object.freeze([
  { offset: 0, finger: 0, label: "Open" }, { offset: 1, finger: 1, label: "Low 1" },
  { offset: 2, finger: 1, label: "1" }, { offset: 3, finger: 2, label: "Low 2" },
  { offset: 4, finger: 2, label: "High 2" }, { offset: 5, finger: 3, label: "3" },
  { offset: 6, finger: 3, label: "High 3" }, { offset: 7, finger: 4, label: "4" },
].map((position) => Object.freeze(position)));
export const VIOLIN_FIRST_POSITION_PITCHES = Object.freeze([...new Set(VIOLIN_STRINGS.flatMap((string) =>
  VIOLIN_FIRST_POSITION_GUIDE.map(({ offset }) => string.semitone + offset)))].sort((a, b) => a - b));

/** Fixed-tension ideal string: f/f_open = L/(L-x). Schematic, never measured millimeters. */
export function violinPositionFraction(semitones: number): number | null {
  return Number.isFinite(semitones) && semitones >= 0 ? 1 - 2 ** (-semitones / 12) : null;
}
export type ViolinPosition = Readonly<{ stringId: ViolinStringId; semitone: number; offset: number;
  finger: number; label: string; fraction: number }>;

export function violinFirstPositionLocations(semitone: number): readonly ViolinPosition[] {
  if (!Number.isInteger(semitone) || semitone < 0 || semitone > 127) return [];
  return VIOLIN_STRINGS.flatMap((string) => {
    const offset = semitone - string.semitone;
    const position = VIOLIN_FIRST_POSITION_GUIDE.find((item) => item.offset === offset);
    return position ? [Object.freeze({ ...position, semitone, stringId: string.stringId,
      fraction: violinPositionFraction(offset)! })] : [];
  }).sort((a, b) => a.offset - b.offset); // Open string before fourth-finger alternate.
}

export function selectViolinExpectedPosition(semitone: number | null, selection: ViolinStringSelection) {
  const locations = semitone === null ? [] : violinFirstPositionLocations(semitone);
  const recommended = locations[0] ?? null;
  const stringId = selection === "auto" ? recommended?.stringId ?? null : selection;
  return { locations, recommended, stringId, position: locations.find((item) => item.stringId === stringId) ?? null,
    provenance: selection === "auto" ? "Suggested" as const : "User-selected" as const };
}

export type ViolinLivePosition = Readonly<{ position: ViolinPosition | null; message: string }>;
export function getViolinLivePosition(context: InstrumentPitchContext, stringId: ViolinStringId | null): ViolinLivePosition {
  const unavailable = (message: string) => ({ position: null, message });
  if (context.live.state !== "live" || !context.live.pitch) return unavailable(context.live.state === "uncertain"
    ? "Uncertain pitch — no live position shown." : context.live.state === "stale"
      ? "Stale reading — no live position shown." : "No current pitch — no live position shown.");
  const pitch = context.live.pitch;
  if (!Number.isFinite(pitch.frequencyHz) || pitch.frequencyHz < MONOPHONIC_CONFIG.minHz || pitch.frequencyHz > MONOPHONIC_CONFIG.maxHz) {
    return unavailable("Detected frequency outside the supported analysis range — no live position shown.");
  }
  // Conservative presentation warning only; do not fold octaves or change grading.
  if (context.expected) {
    const interval = 12 * Math.log2(pitch.frequencyHz / equalTemperedFrequency(context.expected.semitone));
    if ([12, -12, 12 * Math.log2(3), -12 * Math.log2(3), 24, -24].some((harmonic) => Math.abs(interval - harmonic) <= 0.35)) {
      return unavailable("Possible harmonic or different note — no live position shown.");
    }
  }
  if (!stringId) return unavailable("Choose a string to interpret this live pitch; no suggested string is available.");
  const location = violinFirstPositionLocations(pitch.semitone).find((item) => item.stringId === stringId);
  if (!location) return unavailable(`Live pitch is outside modeled first position on ${stringId} — no live position shown.`);
  const string = VIOLIN_STRINGS.find((item) => item.stringId === stringId)!;
  const offset = 12 * Math.log2(pitch.frequencyHz / string.frequencyHz);
  const fraction = violinPositionFraction(offset);
  if (fraction === null) return unavailable(`Live pitch is below the ${stringId} open-string reference — no stopped position shown.`);
  return { position: { ...location, fraction }, message: `Possible position near ${location.label} on ${stringId}; inferred from pitch only.` };
}
