import { createScaleRepertoireTraversal, completeScaleRepertoireEntry, realizeRepertoireScale, type ScalePracticeMode, type ScaleRepertoireId, type ScaleRepertoireTraversal } from "../scale-repertoire";
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

const EMPTY_REPERTOIRE: readonly ScaleRepertoireId[] = Object.freeze([]);
function repertoireTarget(traversal: ScaleRepertoireTraversal, clef: "bass" | "treble"): SequenceTarget {
  const id = traversal.order[traversal.completed];
  return id ? realizeRepertoireScale(id, clef) : {
    clef, name: { primary: "Select at least one scale" }, steps: [], timing: SEQUENCE_DEFAULT_TIMING,
  };
}

type UseSequenceTargetOptions = Readonly<{
  /** Mount-time only; standalone callers retain the fixed starter. */
  generateOnMount?: boolean;
  scalePracticeMode?: ScalePracticeMode;
  scaleRepertoire?: readonly ScaleRepertoireId[];
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
  generateOnMount = false,
  scalePracticeMode = "random",
  scaleRepertoire = EMPTY_REPERTOIRE,
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
  const isRepertoire = exerciseType === "scales" && scalePracticeMode !== "random";
  const [initial] = useState(() => {
    const traversal = isRepertoire ? createScaleRepertoireTraversal(scaleRepertoire, scalePracticeMode) : null;
    const target = !generateOnMount ? INITIAL_SEQUENCE_TARGET
      : traversal ? repertoireTarget(traversal, getClefForMode(mode))
      : generateSequenceTarget({
      exerciseType,
      clef: getClefForMode(mode),
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
    return { target, traversal };
  });
  const [sequenceTarget, setSequenceTarget] = useState(initial.target);
  const [repertoireTraversal, setRepertoireTraversal] = useState(initial.traversal);
  const traversalRef = useRef(initial.traversal);

  const [startedAt, setStartedAt] = useState(() => generateOnMount ? Date.now() : 0);

  const sequenceTargetRef = useRef(sequenceTarget);
  const sequenceLockedRef = useRef(false);
  const repertoireTargetCompletedRef = useRef(false);

  const generateNextTarget = useCallback(
    (nextMode: PracticeClefMode = mode, restartRepertoire = false) => {
      const clef = getClefForMode(nextMode);

      let traversal = traversalRef.current;
      if (isRepertoire) {
        if (restartRepertoire || !traversal || traversal.completed >= traversal.order.length) {
          traversal = createScaleRepertoireTraversal(scaleRepertoire, scalePracticeMode);
        }
      } else {
        traversal = null;
      }
      traversalRef.current = traversal;
      setRepertoireTraversal(traversal);
      const nextTarget = traversal ? repertoireTarget(traversal, clef) : generateSequenceTarget({
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
      repertoireTargetCompletedRef.current = false;

      setSequenceTarget(nextTarget);
      setStartedAt(Date.now());
    },
    [
      isRepertoire,
      scalePracticeMode,
      scaleRepertoire,
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
    () => sequenceLockedRef.current || sequenceTargetRef.current.steps.length === 0,
    [],
  );

  const lockSequenceTarget = useCallback(() => {
    if (sequenceLockedRef.current || sequenceTargetRef.current.steps.length === 0) {
      return false;
    }

    sequenceLockedRef.current = true;

    return true;
  }, []);

  const completeRepertoireTarget = useCallback(() => {
    const traversal = traversalRef.current;
    if (!traversal || !sequenceLockedRef.current || repertoireTargetCompletedRef.current) return false;
    repertoireTargetCompletedRef.current = true;
    const completion = completeScaleRepertoireEntry(traversal);
    traversalRef.current = completion.traversal;
    setRepertoireTraversal(completion.traversal);
    return completion.traversalCompleted;
  }, []);

  return {
    completeRepertoireTarget,
    repertoireTraversal,
    generateNextTarget,
    getCurrentTarget,
    isSequenceTargetLocked,
    lockSequenceTarget,
    sequenceTarget,
    startedAt,
  };
}
