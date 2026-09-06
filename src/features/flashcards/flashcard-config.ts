import { booleanField, enumField, parseConfig, requireConfig, selectionField } from "@/lib/config-validation";
import type { PracticeClefMode, PracticeExerciseType, PracticeNoteCategory, PracticeTriadQuality, PracticeTriadPosition } from "@/types/practice";

export type FlashcardConfig = Readonly<{
  schemaVersion: 1;
  mode: PracticeClefMode;
  showTargetName: boolean;
  replayCorrectVirtualChords: boolean;
  enabledExerciseTypes: readonly PracticeExerciseType[];
  enabledNoteCategories: readonly PracticeNoteCategory[];
  enabledTriadQualities: readonly PracticeTriadQuality[];
  enabledTriadPositions: readonly PracticeTriadPosition[];
}>;

export const DEFAULT_FLASHCARD_CONFIG: FlashcardConfig = Object.freeze({
  schemaVersion: 1,
  mode: "bass",
  showTargetName: false,
  replayCorrectVirtualChords: true,
  enabledExerciseTypes: Object.freeze(["notes"] as PracticeExerciseType[]),
  enabledNoteCategories: Object.freeze(["naturals"] as PracticeNoteCategory[]),
  enabledTriadQualities: Object.freeze(["major"] as PracticeTriadQuality[]),
  enabledTriadPositions: Object.freeze(["root"] as PracticeTriadPosition[]),
});

export function parseFlashcardConfig(value: unknown) {
  const parsed = parseConfig<FlashcardConfig>(value, {
    schemaVersion: enumField([1]),
    mode: enumField(["bass", "treble", "mixed"]),
    showTargetName: booleanField,
    replayCorrectVirtualChords: booleanField,
    enabledExerciseTypes: selectionField(["notes", "triads"]),
    enabledNoteCategories: selectionField(["naturals", "accidentals"]),
    enabledTriadQualities: selectionField(["major", "minor", "diminished", "augmented"]),
    enabledTriadPositions: selectionField(["root", "first", "second"]),
  });
  return parsed;
}

export type FlashcardRuntimeSettings = Readonly<Omit<FlashcardConfig, "schemaVersion" | "enabledExerciseTypes" | "enabledNoteCategories" | "enabledTriadQualities" | "enabledTriadPositions"> & {
  enabledExerciseTypes: ReadonlySet<PracticeExerciseType>;
  enabledNoteCategories: ReadonlySet<PracticeNoteCategory>;
  enabledTriadQualities: ReadonlySet<PracticeTriadQuality>;
  enabledTriadPositions: ReadonlySet<PracticeTriadPosition>;
}>;

export function flashcardConfigToSettings(input: FlashcardConfig): FlashcardRuntimeSettings {
  const config = requireConfig(parseFlashcardConfig(input));
  return {
    mode: config.mode,
    showTargetName: config.showTargetName,
    replayCorrectVirtualChords: config.replayCorrectVirtualChords,
    enabledExerciseTypes: new Set(config.enabledExerciseTypes),
    enabledNoteCategories: new Set(config.enabledNoteCategories),
    enabledTriadQualities: new Set(config.enabledTriadQualities),
    enabledTriadPositions: new Set(config.enabledTriadPositions),
  };
}

export function flashcardSettingsToConfig(settings: FlashcardRuntimeSettings): FlashcardConfig {
  return requireConfig(parseFlashcardConfig({
    schemaVersion: 1,
    mode: settings.mode,
    showTargetName: settings.showTargetName,
    replayCorrectVirtualChords: settings.replayCorrectVirtualChords,
    enabledExerciseTypes: [...settings.enabledExerciseTypes],
    enabledNoteCategories: [...settings.enabledNoteCategories],
    enabledTriadQualities: [...settings.enabledTriadQualities],
    enabledTriadPositions: [...settings.enabledTriadPositions],
  }));
}
