import { useCallback, useRef, useState } from "react";

import { generateMelodicIntervalTarget } from "@/lib/music/generators/intervals";
import { getClefForMode } from "@/lib/music/note-utils";
import type {
  PracticeClefMode,
  SequenceDirection,
  SequenceInterval,
  SequenceNoteCategory,
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
  enabledDirections: ReadonlySet<SequenceDirection>;
  enabledIntervals: ReadonlySet<SequenceInterval>;
  enabledNoteCategories: ReadonlySet<SequenceNoteCategory>;
  mode: PracticeClefMode;
}>;

export function useSequenceTarget({
  enabledDirections,
  enabledIntervals,
  enabledNoteCategories,
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

      const nextTarget = generateMelodicIntervalTarget({
        clef,
        enabledDirections,
        enabledIntervals,
        enabledNoteCategories,
      });

      sequenceTargetRef.current = nextTarget;
      sequenceLockedRef.current = false;

      setSequenceTarget(nextTarget);
      setStartedAt(Date.now());
    },
    [enabledDirections, enabledIntervals, enabledNoteCategories, mode],
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
