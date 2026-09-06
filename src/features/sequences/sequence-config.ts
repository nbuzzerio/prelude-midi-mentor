import { booleanField, enumField, parseConfig, requireConfig, selectionField } from "@/lib/config-validation";
import type { SequenceExerciseType, PracticeClefMode, SequenceDirection, SequenceInterval, SequenceNoteCategory, SequenceScale, SequenceScaleDirection, SequenceArpeggio, SequenceArpeggioDirection } from "@/types/practice";
import { MUSICAL_INTERVALS } from "@/lib/music/intervals";
import { CHORD_PROGRESSION_TEMPLATES, SUPPORTED_CHORD_PROGRESSION_KEYS, type ChordProgressionKeyId, type ChordProgressionTemplateId } from "@/lib/music/chord-progressions";

export type SequenceConfig = Readonly<{
  schemaVersion: 1;
  exerciseType: SequenceExerciseType;
  mode: PracticeClefMode;
  showTargetName: boolean;
  enabledDirections: readonly SequenceDirection[];
  enabledIntervals: readonly SequenceInterval[];
  enabledNoteCategories: readonly SequenceNoteCategory[];
  enabledScales: readonly SequenceScale[];
  enabledScaleDirections: readonly SequenceScaleDirection[];
  enabledArpeggios: readonly SequenceArpeggio[];
  enabledArpeggioDirections: readonly SequenceArpeggioDirection[];
  enabledChordProgressionKeyIds: readonly ChordProgressionKeyId[];
  enabledChordProgressionTemplateIds: readonly ChordProgressionTemplateId[];
}>;

export const DEFAULT_SEQUENCE_CONFIG: SequenceConfig = Object.freeze({
  schemaVersion: 1,
  exerciseType: "intervals",
  mode: "treble",
  showTargetName: false,
  enabledDirections: Object.freeze(["ascending"] as SequenceDirection[]),
  enabledIntervals: Object.freeze(["minor-second", "major-second", "minor-third", "major-third"] as SequenceInterval[]),
  enabledNoteCategories: Object.freeze(["naturals"] as SequenceNoteCategory[]),
  enabledScales: Object.freeze(["major"] as SequenceScale[]),
  enabledScaleDirections: Object.freeze(["ascending"] as SequenceScaleDirection[]),
  enabledArpeggios: Object.freeze(["major"] as SequenceArpeggio[]),
  enabledArpeggioDirections: Object.freeze(["ascending-descending"] as SequenceArpeggioDirection[]),
  enabledChordProgressionKeyIds: Object.freeze(["c-major"] as ChordProgressionKeyId[]),
  enabledChordProgressionTemplateIds: Object.freeze(["major-1451"] as ChordProgressionTemplateId[]),
});

export function parseSequenceConfig(value: unknown) {
  const parsed = parseConfig<SequenceConfig>(value, {
    schemaVersion: enumField([1]),
    exerciseType: enumField(["intervals", "scales", "arpeggios", "chord-progressions"]),
    mode: enumField(["bass", "treble", "mixed"]),
    showTargetName: booleanField,
    enabledDirections: selectionField(["ascending", "descending"]),
    enabledIntervals: selectionField(MUSICAL_INTERVALS),
    enabledNoteCategories: selectionField(["naturals", "accidentals"]),
    enabledScales: selectionField(["major", "natural-minor", "harmonic-minor", "melodic-minor", "major-pentatonic", "minor-pentatonic"]),
    enabledScaleDirections: selectionField(["ascending", "descending", "ascending-descending"]),
    enabledArpeggios: selectionField(["major", "minor", "diminished", "augmented", "dominant-seventh", "major-seventh", "minor-seventh"]),
    enabledArpeggioDirections: selectionField(["ascending", "descending", "ascending-descending"]),
    enabledChordProgressionKeyIds: selectionField(SUPPORTED_CHORD_PROGRESSION_KEYS.map(({ id }) => id)),
    enabledChordProgressionTemplateIds: selectionField(CHORD_PROGRESSION_TEMPLATES.map(({ id }) => id)),
  });
  if (parsed.ok && !hasCompatibleProgressionSelection(new Set(parsed.value.enabledChordProgressionKeyIds), new Set(parsed.value.enabledChordProgressionTemplateIds))) return { ok: false as const, reason: "corrupt" as const };
  return parsed;
}

export type SequenceRuntimeSettings = Readonly<Omit<SequenceConfig, "schemaVersion" | "enabledDirections" | "enabledIntervals" | "enabledNoteCategories" | "enabledScales" | "enabledScaleDirections" | "enabledArpeggios" | "enabledArpeggioDirections" | "enabledChordProgressionKeyIds" | "enabledChordProgressionTemplateIds"> & {
  enabledDirections: ReadonlySet<SequenceDirection>;
  enabledIntervals: ReadonlySet<SequenceInterval>;
  enabledNoteCategories: ReadonlySet<SequenceNoteCategory>;
  enabledScales: ReadonlySet<SequenceScale>;
  enabledScaleDirections: ReadonlySet<SequenceScaleDirection>;
  enabledArpeggios: ReadonlySet<SequenceArpeggio>;
  enabledArpeggioDirections: ReadonlySet<SequenceArpeggioDirection>;
  enabledChordProgressionKeyIds: ReadonlySet<ChordProgressionKeyId>;
  enabledChordProgressionTemplateIds: ReadonlySet<ChordProgressionTemplateId>;
}>;

export function sequenceConfigToSettings(input: SequenceConfig): SequenceRuntimeSettings {
  const config = requireConfig(parseSequenceConfig(input));
  return {
    exerciseType: config.exerciseType,
    mode: config.mode,
    showTargetName: config.showTargetName,
    enabledDirections: new Set(config.enabledDirections),
    enabledIntervals: new Set(config.enabledIntervals),
    enabledNoteCategories: new Set(config.enabledNoteCategories),
    enabledScales: new Set(config.enabledScales),
    enabledScaleDirections: new Set(config.enabledScaleDirections),
    enabledArpeggios: new Set(config.enabledArpeggios),
    enabledArpeggioDirections: new Set(config.enabledArpeggioDirections),
    enabledChordProgressionKeyIds: new Set(config.enabledChordProgressionKeyIds),
    enabledChordProgressionTemplateIds: new Set(config.enabledChordProgressionTemplateIds),
  };
}

export function sequenceSettingsToConfig(settings: SequenceRuntimeSettings): SequenceConfig {
  return requireConfig(parseSequenceConfig({
    schemaVersion: 1,
    exerciseType: settings.exerciseType,
    mode: settings.mode,
    showTargetName: settings.showTargetName,
    enabledDirections: [...settings.enabledDirections],
    enabledIntervals: [...settings.enabledIntervals],
    enabledNoteCategories: [...settings.enabledNoteCategories],
    enabledScales: [...settings.enabledScales],
    enabledScaleDirections: [...settings.enabledScaleDirections],
    enabledArpeggios: [...settings.enabledArpeggios],
    enabledArpeggioDirections: [...settings.enabledArpeggioDirections],
    enabledChordProgressionKeyIds: [...settings.enabledChordProgressionKeyIds],
    enabledChordProgressionTemplateIds: [...settings.enabledChordProgressionTemplateIds],
  }));
}

export function hasCompatibleProgressionSelection(
  keyIds: ReadonlySet<ChordProgressionKeyId>,
  templateIds: ReadonlySet<ChordProgressionTemplateId>,
): boolean {
  const enabledModes = new Set(
    SUPPORTED_CHORD_PROGRESSION_KEYS.filter((key) => keyIds.has(key.id)).map(
      (key) => key.mode,
    ),
  );

  return CHORD_PROGRESSION_TEMPLATES.some(
    (template) =>
      templateIds.has(template.id) && enabledModes.has(template.mode),
  );
}

