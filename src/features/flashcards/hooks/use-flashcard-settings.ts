import { DEFAULT_FLASHCARD_CONFIG, flashcardConfigToSettings, type FlashcardConfig } from "../flashcard-config";
import { useCallback, useState } from "react";
import type {
  PracticeClefMode,
  PracticeExerciseType,
  PracticeNoteCategory,
  PracticeTriadPosition,
  PracticeTriadQuality,
} from "@/types/practice";
import { toggleRequiredSetValue } from "@/lib/toggle-required-set-value";

export function useFlashcardSettings(initialConfig: FlashcardConfig = DEFAULT_FLASHCARD_CONFIG) {
  const [initial] = useState(() => flashcardConfigToSettings(initialConfig));
  const [mode, setMode] = useState<PracticeClefMode>(initial.mode);
  const [showTargetName, setShowTargetName] = useState(initial.showTargetName);

  const [replayCorrectVirtualChords, setReplayCorrectVirtualChords] =
    useState(initial.replayCorrectVirtualChords);

  const [enabledExerciseTypes, setEnabledExerciseTypes] = useState<
    ReadonlySet<PracticeExerciseType>
  >(initial.enabledExerciseTypes);

  const [enabledNoteCategories, setEnabledNoteCategories] = useState<
    ReadonlySet<PracticeNoteCategory>
  >(initial.enabledNoteCategories);

  const [enabledTriadQualities, setEnabledTriadQualities] = useState<
    ReadonlySet<PracticeTriadQuality>
  >(initial.enabledTriadQualities);

  const [enabledTriadPositions, setEnabledTriadPositions] = useState<
    ReadonlySet<PracticeTriadPosition>
  >(initial.enabledTriadPositions);

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
