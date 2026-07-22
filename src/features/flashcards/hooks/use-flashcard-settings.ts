import { useCallback, useState } from "react";
import type {
  PracticeClefMode,
  PracticeExerciseType,
  PracticeNoteCategory,
  PracticeTriadPosition,
  PracticeTriadQuality,
} from "@/types/practice";

function toggleRequiredSetValue<T>(
  currentValues: ReadonlySet<T>,
  value: T,
): ReadonlySet<T> {
  const nextValues = new Set(currentValues);

  if (nextValues.has(value)) {
    if (nextValues.size === 1) {
      return currentValues;
    }

    nextValues.delete(value);
  } else {
    nextValues.add(value);
  }

  return nextValues;
}

export function useFlashcardSettings() {
  const [mode, setMode] = useState<PracticeClefMode>("bass");
  const [showTargetName, setShowTargetName] = useState(false);

  const [replayCorrectVirtualChords, setReplayCorrectVirtualChords] =
    useState(true);

  const [enabledExerciseTypes, setEnabledExerciseTypes] = useState<
    ReadonlySet<PracticeExerciseType>
  >(new Set(["notes"]));

  const [enabledNoteCategories, setEnabledNoteCategories] = useState<
    ReadonlySet<PracticeNoteCategory>
  >(new Set(["naturals"]));

  const [enabledTriadQualities, setEnabledTriadQualities] = useState<
    ReadonlySet<PracticeTriadQuality>
  >(new Set(["major"]));

  const [enabledTriadPositions, setEnabledTriadPositions] = useState<
    ReadonlySet<PracticeTriadPosition>
  >(new Set(["root"]));

  const toggleExerciseType = useCallback(
    (exerciseType: PracticeExerciseType) => {
      setEnabledExerciseTypes((currentTypes) =>
        toggleRequiredSetValue(currentTypes, exerciseType),
      );
    },
    [],
  );

  const toggleNoteCategory = useCallback((category: PracticeNoteCategory) => {
    setEnabledNoteCategories((currentCategories) =>
      toggleRequiredSetValue(currentCategories, category),
    );
  }, []);

  const toggleTriadQuality = useCallback((quality: PracticeTriadQuality) => {
    setEnabledTriadQualities((currentQualities) =>
      toggleRequiredSetValue(currentQualities, quality),
    );
  }, []);

  const toggleTriadPosition = useCallback((position: PracticeTriadPosition) => {
    setEnabledTriadPositions((currentPositions) =>
      toggleRequiredSetValue(currentPositions, position),
    );
  }, []);

  return {
    enabledExerciseTypes,
    enabledNoteCategories,
    enabledTriadPositions,
    enabledTriadQualities,
    mode,
    replayCorrectVirtualChords,
    setMode,
    setReplayCorrectVirtualChords,
    setShowTargetName,
    showTargetName,
    toggleExerciseType,
    toggleNoteCategory,
    toggleTriadPosition,
    toggleTriadQuality,
  };
}
