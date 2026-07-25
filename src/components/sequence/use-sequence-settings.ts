import { useCallback, useState } from "react";

import type {
  PracticeClefMode,
  SequenceDirection,
  SequenceInterval,
  SequenceNoteCategory,
} from "@/types/practice";
import { toggleRequiredSetValue } from "@/lib/toggle-required-set-value";

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

export function useSequenceSettings() {
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

  return {
    enabledDirections,
    enabledIntervals,
    enabledNoteCategories,
    mode,
    setMode,
    setShowTargetName,
    showTargetName,
    toggleDirection,
    toggleInterval,
    toggleNoteCategory,
  };
}
