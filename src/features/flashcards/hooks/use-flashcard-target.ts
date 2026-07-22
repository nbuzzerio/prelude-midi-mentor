import { useCallback, useRef, useState } from "react";
import { generatePracticeTarget } from "@/lib/music/notes";
import type {
  PracticeClefMode,
  PracticeExerciseType,
  PracticeNoteCategory,
  PracticeTarget,
  PracticeTriadPosition,
  PracticeTriadQuality,
} from "@/types/practice";

const INITIAL_PRACTICE_TARGET: PracticeTarget = {
  clef: "bass",
  name: {
    primary: "C3",
    secondary: "Individual note",
  },
  notes: [
    {
      midiNumber: 48,
      name: "C",
      octave: 3,
    },
  ],
};

type UseFlashcardTargetOptions = Readonly<{
  enabledExerciseTypes: ReadonlySet<PracticeExerciseType>;
  enabledNoteCategories: ReadonlySet<PracticeNoteCategory>;
  enabledTriadPositions: ReadonlySet<PracticeTriadPosition>;
  enabledTriadQualities: ReadonlySet<PracticeTriadQuality>;
  mode: PracticeClefMode;
}>;

export function useFlashcardTarget({
  enabledExerciseTypes,
  enabledNoteCategories,
  enabledTriadPositions,
  enabledTriadQualities,
  mode,
}: UseFlashcardTargetOptions) {
  const [practiceTarget, setPracticeTarget] = useState<PracticeTarget>(
    INITIAL_PRACTICE_TARGET,
  );

  const [startedAt, setStartedAt] = useState(0);

  const practiceTargetRef = useRef(practiceTarget);
  const answerLockedRef = useRef(false);

  const generateNextTarget = useCallback(
    (nextMode: PracticeClefMode = mode) => {
      const nextTarget = generatePracticeTarget(
        nextMode,
        enabledExerciseTypes,
        enabledNoteCategories,
        enabledTriadQualities,
        enabledTriadPositions,
      );

      practiceTargetRef.current = nextTarget;
      answerLockedRef.current = false;

      setPracticeTarget(nextTarget);
      setStartedAt(Date.now());
    },
    [
      enabledExerciseTypes,
      enabledNoteCategories,
      enabledTriadPositions,
      enabledTriadQualities,
      mode,
    ],
  );

  const getCurrentTarget = useCallback(
    () => practiceTargetRef.current,
    [],
  );

  const isAnswerLocked = useCallback(
    () => answerLockedRef.current,
    [],
  );

  const lockAnswer = useCallback(() => {
    if (answerLockedRef.current) {
      return false;
    }

    answerLockedRef.current = true;

    return true;
  }, []);

  return {
    generateNextTarget,
    getCurrentTarget,
    isAnswerLocked,
    lockAnswer,
    practiceTarget,
    startedAt,
  };
}