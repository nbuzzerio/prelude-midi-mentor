import { useCallback, useRef, useState } from "react";

import { generateSequenceTarget } from "@/lib/music/generators/sequences";
import { getClefForMode } from "@/lib/music/note-utils";
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
  SequenceTarget,
} from "@/types/practice";

const INITIAL_SEQUENCE_TARGET: SequenceTarget = {
  clef: "treble",
  name: {
    primary: "Major third",
    secondary: "Ascending melodic interval",
  },
  steps: [
    {
      notes: [
        {
          midiNumber: 60,
          name: "C",
          octave: 4,
        },
      ],
    },
    {
      notes: [
        {
          midiNumber: 64,
          name: "E",
          octave: 4,
        },
      ],
    },
  ],
};

type UseSequenceTargetOptions = Readonly<{
  enabledArpeggios: ReadonlySet<SequenceArpeggio>;
  enabledChordProgressionKeyIds: ReadonlySet<ChordProgressionKeyId>;
  enabledChordProgressionTemplateIds: ReadonlySet<ChordProgressionTemplateId>;
  enabledDirections: ReadonlySet<SequenceDirection>;
  enabledIntervals: ReadonlySet<SequenceInterval>;
  enabledNoteCategories: ReadonlySet<SequenceNoteCategory>;
  enabledScaleDirections: ReadonlySet<SequenceScaleDirection>;
  enabledScales: ReadonlySet<SequenceScale>;
  exerciseType: SequenceExerciseType;
  mode: PracticeClefMode;
}>;

export function useSequenceTarget({
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
}: UseSequenceTargetOptions) {
  const [sequenceTarget, setSequenceTarget] = useState<SequenceTarget>(
    INITIAL_SEQUENCE_TARGET,
  );

  const [startedAt, setStartedAt] = useState(0);

  const sequenceTargetRef = useRef(sequenceTarget);
  const sequenceLockedRef = useRef(false);

  const generateNextTarget = useCallback(
    (nextMode: PracticeClefMode = mode) => {
      const clef = getClefForMode(nextMode);

      const nextTarget = generateSequenceTarget({
        exerciseType,
        clef,
        enabledArpeggios,
        enabledChordProgressionKeyIds,
        enabledChordProgressionTemplateIds,
        enabledDirections,
        enabledIntervals,
        enabledNoteCategories,
        enabledScaleDirections,
        enabledScales,
      });

      sequenceTargetRef.current = nextTarget;
      sequenceLockedRef.current = false;

      setSequenceTarget(nextTarget);
      setStartedAt(Date.now());
    },
    [
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
    ],
  );

  const getCurrentTarget = useCallback(() => sequenceTargetRef.current, []);

  const isSequenceTargetLocked = useCallback(
    () => sequenceLockedRef.current,
    [],
  );

  const lockSequenceTarget = useCallback(() => {
    if (sequenceLockedRef.current) {
      return false;
    }

    sequenceLockedRef.current = true;

    return true;
  }, []);

  return {
    generateNextTarget,
    getCurrentTarget,
    isSequenceTargetLocked,
    lockSequenceTarget,
    sequenceTarget,
    startedAt,
  };
}
