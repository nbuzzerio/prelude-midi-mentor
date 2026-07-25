import { useCallback, useState } from "react";

import { toggleRequiredSetValue } from "@/lib/toggle-required-set-value";
import type {
  PracticeClefMode,
  SequenceDirection,
  SequenceExerciseType,
  SequenceInterval,
  SequenceNoteCategory,
  SequenceScale,
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

  return {
    enabledDirections,
    enabledIntervals,
    enabledNoteCategories,
    enabledScales,
    exerciseType,
    mode,
    setExerciseType,
    setMode,
    setShowTargetName,
    showTargetName,
    toggleDirection,
    toggleInterval,
    toggleNoteCategory,
    toggleScale,
  };
}
