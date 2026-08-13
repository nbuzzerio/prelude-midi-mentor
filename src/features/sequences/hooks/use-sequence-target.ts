import { useCallback, useRef, useState } from "react";

import { generateSequenceTarget } from "@/lib/music/generators/sequences";
import {
  SEQUENCE_DEFAULT_STEP_DURATION_TICKS,
  SEQUENCE_DEFAULT_TIMING,
} from "@/lib/music/sequence-timing";
import { getClefForMode } from "@/lib/music/note-utils";
import type {
  ChordProgressionKeyId,
  ChordProgressionTemplateId,
} from "@/lib/music/chord-progressions";

import type {
  PracticeClefMode,
  SequenceArpeggio,
  SequenceArpeggioDirection,
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
      durationTicks: SEQUENCE_DEFAULT_STEP_DURATION_TICKS,
      notes: [
        {
          midiNumber: 60,
          name: "C",
          octave: 4,
        },
      ],
    },
    {
      durationTicks: SEQUENCE_DEFAULT_STEP_DURATION_TICKS,
      notes: [
        {
          midiNumber: 64,
          name: "E",
          octave: 4,
        },
      ],
    },
  ],
  timing: SEQUENCE_DEFAULT_TIMING,
};

const DEFAULT_ARPEGGIO_DIRECTIONS = new Set<SequenceArpeggioDirection>([
  "ascending-descending",
]);

type UseSequenceTargetOptions = Readonly<{
  enabledArpeggios: ReadonlySet<SequenceArpeggio>;
  enabledArpeggioDirections?: ReadonlySet<SequenceArpeggioDirection>;
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
  enabledArpeggioDirections = DEFAULT_ARPEGGIO_DIRECTIONS,
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
        enabledArpeggioDirections,
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
      enabledArpeggioDirections,
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
