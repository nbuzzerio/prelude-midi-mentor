import { useCallback, useState } from "react";

import { toggleRequiredSetValue } from "@/lib/toggle-required-set-value";
import {
  CHORD_PROGRESSION_TEMPLATES,
  SUPPORTED_CHORD_PROGRESSION_KEYS,
} from "@/lib/music/chord-progressions";
import type {
  ChordProgressionKeyId,
  ChordProgressionTemplateId,
} from "@/lib/music/chord-progressions";

import type {
  PracticeClefMode,
  SequenceArpeggio,
  SequenceDirection,
  SequenceExerciseType,
  SequenceInterval,
  SequenceNoteCategory,
  SequenceScale,
  SequenceScaleDirection,
} from "@/types/practice";

const DEFAULT_ENABLED_DIRECTIONS = new Set<SequenceDirection>(["ascending"]);

const DEFAULT_ENABLED_INTERVALS = new Set<SequenceInterval>([
  "minor-second",
  "major-second",
  "minor-third",
  "major-third",
]);

const DEFAULT_ENABLED_NOTE_CATEGORIES = new Set<SequenceNoteCategory>([
  "naturals",
]);

const DEFAULT_ENABLED_SCALES = new Set<SequenceScale>(["major"]);

const DEFAULT_ENABLED_SCALE_DIRECTIONS = new Set<SequenceScaleDirection>([
  "ascending",
]);

const DEFAULT_ENABLED_ARPEGGIOS = new Set<SequenceArpeggio>(["major"]);

const DEFAULT_ENABLED_CHORD_PROGRESSION_KEY_IDS =
  new Set<ChordProgressionKeyId>(["c-major"]);

const DEFAULT_ENABLED_CHORD_PROGRESSION_TEMPLATE_IDS =
  new Set<ChordProgressionTemplateId>(["major-1451"]);

function hasCompatibleProgressionSelection(
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

export function useSequenceSettings() {
  const [exerciseType, setExerciseType] =
    useState<SequenceExerciseType>("intervals");

  const [mode, setMode] = useState<PracticeClefMode>("treble");

  const [showTargetName, setShowTargetName] = useState(false);

  const [enabledDirections, setEnabledDirections] = useState<
    ReadonlySet<SequenceDirection>
  >(DEFAULT_ENABLED_DIRECTIONS);

  const [enabledIntervals, setEnabledIntervals] = useState<
    ReadonlySet<SequenceInterval>
  >(DEFAULT_ENABLED_INTERVALS);

  const [enabledNoteCategories, setEnabledNoteCategories] = useState<
    ReadonlySet<SequenceNoteCategory>
  >(DEFAULT_ENABLED_NOTE_CATEGORIES);

  const [enabledScales, setEnabledScales] = useState<
    ReadonlySet<SequenceScale>
  >(DEFAULT_ENABLED_SCALES);

  const [enabledScaleDirections, setEnabledScaleDirections] = useState<
    ReadonlySet<SequenceScaleDirection>
  >(DEFAULT_ENABLED_SCALE_DIRECTIONS);

  const [enabledArpeggios, setEnabledArpeggios] = useState<
    ReadonlySet<SequenceArpeggio>
  >(DEFAULT_ENABLED_ARPEGGIOS);

  const [enabledChordProgressionKeyIds, setEnabledChordProgressionKeyIds] =
    useState<ReadonlySet<ChordProgressionKeyId>>(
      DEFAULT_ENABLED_CHORD_PROGRESSION_KEY_IDS,
    );

  const [
    enabledChordProgressionTemplateIds,
    setEnabledChordProgressionTemplateIds,
  ] = useState<ReadonlySet<ChordProgressionTemplateId>>(
    DEFAULT_ENABLED_CHORD_PROGRESSION_TEMPLATE_IDS,
  );

  const toggleDirection = useCallback((direction: SequenceDirection) => {
    setEnabledDirections((currentDirections) =>
      toggleRequiredSetValue(currentDirections, direction),
    );
  }, []);

  const toggleInterval = useCallback((interval: SequenceInterval) => {
    setEnabledIntervals((currentIntervals) =>
      toggleRequiredSetValue(currentIntervals, interval),
    );
  }, []);

  const toggleNoteCategory = useCallback((category: SequenceNoteCategory) => {
    setEnabledNoteCategories((currentCategories) =>
      toggleRequiredSetValue(currentCategories, category),
    );
  }, []);

  const toggleScale = useCallback((scale: SequenceScale) => {
    setEnabledScales((currentScales) =>
      toggleRequiredSetValue(currentScales, scale),
    );
  }, []);

  const toggleScaleDirection = useCallback(
    (direction: SequenceScaleDirection) => {
      setEnabledScaleDirections((currentDirections) =>
        toggleRequiredSetValue(currentDirections, direction),
      );
    },
    [],
  );

  const toggleArpeggio = useCallback((arpeggio: SequenceArpeggio) => {
    setEnabledArpeggios((currentArpeggios) =>
      toggleRequiredSetValue(currentArpeggios, arpeggio),
    );
  }, []);

  const toggleChordProgressionKey = useCallback(
    (keyId: ChordProgressionKeyId) => {
      setEnabledChordProgressionKeyIds((currentKeyIds) => {
        const nextKeyIds = new Set(currentKeyIds);

        if (nextKeyIds.has(keyId)) {
          nextKeyIds.delete(keyId);
        } else {
          nextKeyIds.add(keyId);
        }

        if (
          nextKeyIds.size === 0 ||
          !hasCompatibleProgressionSelection(
            nextKeyIds,
            enabledChordProgressionTemplateIds,
          )
        ) {
          return currentKeyIds;
        }

        return nextKeyIds;
      });
    },
    [enabledChordProgressionTemplateIds],
  );

  const toggleChordProgressionTemplate = useCallback(
    (templateId: ChordProgressionTemplateId) => {
      setEnabledChordProgressionTemplateIds((currentTemplateIds) => {
        const nextTemplateIds = new Set(currentTemplateIds);

        if (nextTemplateIds.has(templateId)) {
          nextTemplateIds.delete(templateId);
        } else {
          nextTemplateIds.add(templateId);
        }

        if (
          nextTemplateIds.size === 0 ||
          !hasCompatibleProgressionSelection(
            enabledChordProgressionKeyIds,
            nextTemplateIds,
          )
        ) {
          return currentTemplateIds;
        }

        return nextTemplateIds;
      });
    },
    [enabledChordProgressionKeyIds],
  );

  return {
    enabledArpeggios,
    enabledChordProgressionKeyIds,
    enabledChordProgressionTemplateIds,
    enabledDirections,
    enabledIntervals,
    enabledNoteCategories,
    enabledScaleDirections,
    enabledScales,
    exerciseType,
    mode,
    setExerciseType,
    setMode,
    setShowTargetName,
    showTargetName,
    toggleArpeggio,
    toggleChordProgressionKey,
    toggleChordProgressionTemplate,
    toggleDirection,
    toggleInterval,
    toggleNoteCategory,
    toggleScale,
    toggleScaleDirection,
  };
}
