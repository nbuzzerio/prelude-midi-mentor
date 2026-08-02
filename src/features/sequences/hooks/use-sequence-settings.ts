import { useCallback, useState } from "react";

import { toggleRequiredSetValue } from "@/lib/toggle-required-set-value";

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

  return {
    enabledArpeggios,
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
    toggleDirection,
    toggleInterval,
    toggleNoteCategory,
    toggleScale,
    toggleScaleDirection,
  };
}
