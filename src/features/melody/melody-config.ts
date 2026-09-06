import { booleanField, enumField, parseConfig, requireConfig } from "@/lib/config-validation";
import { DEFAULT_MELODY_SETTINGS, MELODY_STAFFS, MELODY_KEY_IDS, MELODY_TEMPOS, MELODY_MEASURE_COUNTS, type MelodySettings } from "./melody-types";
import { DEFAULT_MELODY_CONTINUOUS_DURATION_MINUTES, MELODY_CONTINUOUS_DURATION_MINUTES, type MelodyContinuousDurationMinutes } from "./melody-continuous-practice";

/** Prescription only: no active deadline, performance, or diagnostic history. */
export type MelodyConfig = Readonly<MelodySettings & {
  schemaVersion: 1;
  continuousPractice: boolean;
  continuousDurationMinutes: MelodyContinuousDurationMinutes;
}>;
export const DEFAULT_MELODY_CONFIG: MelodyConfig = Object.freeze({
  schemaVersion: 1,
  ...DEFAULT_MELODY_SETTINGS,
  continuousPractice: false,
  continuousDurationMinutes: DEFAULT_MELODY_CONTINUOUS_DURATION_MINUTES,
});
export function parseMelodyConfig(value: unknown) {
  return parseConfig<MelodyConfig>(value, {
    schemaVersion: enumField([1]),
    staff: enumField(MELODY_STAFFS),
    keyId: enumField(MELODY_KEY_IDS),
    tempoBpm: enumField(MELODY_TEMPOS),
    measureCount: enumField(MELODY_MEASURE_COUNTS),
    pitchDifficulty: enumField(["easy"]),
    rhythmDifficulty: enumField(["easy"]),
    continuousPractice: booleanField,
    continuousDurationMinutes: enumField(MELODY_CONTINUOUS_DURATION_MINUTES),
  });
}
export function melodyConfigToSettings(input: MelodyConfig): MelodySettings {
  const config = requireConfig(parseMelodyConfig(input));
  return {
    staff: config.staff, keyId: config.keyId, tempoBpm: config.tempoBpm,
    measureCount: config.measureCount, pitchDifficulty: config.pitchDifficulty,
    rhythmDifficulty: config.rhythmDifficulty,
  };
}
export function melodySettingsToConfig(settings: MelodySettings, options: Pick<MelodyConfig, "continuousPractice" | "continuousDurationMinutes">): MelodyConfig {
  return requireConfig(parseMelodyConfig({ ...settings, ...options, schemaVersion: 1 }));
}
