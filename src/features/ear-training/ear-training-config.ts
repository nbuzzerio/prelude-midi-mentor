import { enumField, parseConfig, requireConfig, selectionField } from "@/lib/config-validation";
import { MUSICAL_INTERVALS, type MusicalInterval, type IntervalDirection } from "@/lib/music/intervals";

export type EarTrainingConfig = Readonly<{
  schemaVersion: 1;
  enabledIntervals: readonly MusicalInterval[];
  enabledDirections: readonly IntervalDirection[];
}>;

export const DEFAULT_EAR_TRAINING_CONFIG: EarTrainingConfig = Object.freeze({
  schemaVersion: 1,
  enabledIntervals: Object.freeze(["minor-second", "major-second", "minor-third", "major-third"] as MusicalInterval[]),
  enabledDirections: Object.freeze(["ascending"] as IntervalDirection[]),
});

export function parseEarTrainingConfig(value: unknown) {
  const parsed = parseConfig<EarTrainingConfig>(value, {
    schemaVersion: enumField([1]),
    enabledIntervals: selectionField(MUSICAL_INTERVALS),
    enabledDirections: selectionField(["ascending", "descending"]),
  });
  return parsed;
}

export type EarTrainingRuntimeSettings = Readonly<Omit<EarTrainingConfig, "schemaVersion" | "enabledIntervals" | "enabledDirections"> & {
  enabledIntervals: ReadonlySet<MusicalInterval>;
  enabledDirections: ReadonlySet<IntervalDirection>;
}>;

export function earTrainingConfigToSettings(input: EarTrainingConfig): EarTrainingRuntimeSettings {
  const config = requireConfig(parseEarTrainingConfig(input));
  return {
    enabledIntervals: new Set(config.enabledIntervals),
    enabledDirections: new Set(config.enabledDirections),
  };
}

export function earTrainingSettingsToConfig(settings: EarTrainingRuntimeSettings): EarTrainingConfig {
  return requireConfig(parseEarTrainingConfig({
    schemaVersion: 1,
    enabledIntervals: [...settings.enabledIntervals],
    enabledDirections: [...settings.enabledDirections],
  }));
}
