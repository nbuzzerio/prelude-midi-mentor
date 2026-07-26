import { useCallback, useEffect, useRef } from "react";

import {
  NEXT_SEQUENCE_DELAY_MS,
  SEQUENCE_INCORRECT_FEEDBACK_MS,
  SEQUENCE_STEP_DELAY_MS,
  SUCCESS_CHIRP_DELAY_MS,
} from "../sequence-timing";

type StartStepTransitionOptions = Readonly<{
  stepDelayMs?: number;
  waitForMidiRelease: boolean;
}>;

type StartIncorrectStepTransitionOptions = Readonly<{
  incorrectFeedbackMs?: number;
  waitForMidiRelease: boolean;
}>;

type StartSequenceCompletionTransitionOptions = Readonly<{
  nextSequenceDelayMs?: number;
  successChirpDelayMs?: number;
  waitForMidiRelease: boolean;
}>;

type UseSequenceTransitionOptions = Readonly<{
  onAdvanceSequence: () => void;
  onAdvanceStep: () => boolean;
  onRetrySequence: () => boolean;
  onSuccessFeedback: () => void;
}>;

export function useSequenceTransition({
  onAdvanceSequence,
  onAdvanceStep,
  onRetrySequence,
  onSuccessFeedback,
}: UseSequenceTransitionOptions) {
  const timeoutIdsRef = useRef<ReadonlyArray<number>>([]);

  const midiHeldNotesRef = useRef<ReadonlySet<number>>(new Set());

  const pendingMidiReleaseActionRef = useRef<(() => void) | null>(null);

  const clearTimeouts = useCallback(() => {
    timeoutIdsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });

    timeoutIdsRef.current = [];
  }, []);

  const clearTransition = useCallback(() => {
    clearTimeouts();
    pendingMidiReleaseActionRef.current = null;
  }, [clearTimeouts]);

  const registerTimeout = useCallback(
    (callback: () => void, delayMs: number) => {
      const timeoutId = window.setTimeout(() => {
        timeoutIdsRef.current = timeoutIdsRef.current.filter(
          (currentId) => currentId !== timeoutId,
        );

        callback();
      }, delayMs);

      timeoutIdsRef.current = [...timeoutIdsRef.current, timeoutId];
    },
    [],
  );

  const runAfterOptionalMidiRelease = useCallback(
    ({
      action,
      waitForMidiRelease,
    }: Readonly<{
      action: () => void;
      waitForMidiRelease: boolean;
    }>) => {
      if (!waitForMidiRelease || midiHeldNotesRef.current.size === 0) {
        action();
        return;
      }

      pendingMidiReleaseActionRef.current = action;
    },
    [],
  );

  const updateMidiHeldNotes = useCallback((heldNotes: ReadonlySet<number>) => {
    midiHeldNotesRef.current = new Set(heldNotes);

    if (
      midiHeldNotesRef.current.size !== 0 ||
      !pendingMidiReleaseActionRef.current
    ) {
      return;
    }

    const pendingAction = pendingMidiReleaseActionRef.current;

    pendingMidiReleaseActionRef.current = null;
    pendingAction();
  }, []);

  const startStepTransition = useCallback(
    ({
      stepDelayMs = SEQUENCE_STEP_DELAY_MS,
      waitForMidiRelease,
    }: StartStepTransitionOptions) => {
      clearTransition();

      if (stepDelayMs === 0 && !waitForMidiRelease) {
        onAdvanceStep();
        return;
      }

      registerTimeout(() => {
        runAfterOptionalMidiRelease({
          action: () => {
            onAdvanceStep();
          },
          waitForMidiRelease,
        });
      }, stepDelayMs);
    },
    [
      clearTransition,
      onAdvanceStep,
      registerTimeout,
      runAfterOptionalMidiRelease,
    ],
  );

  const startIncorrectStepTransition = useCallback(
    ({
      incorrectFeedbackMs = SEQUENCE_INCORRECT_FEEDBACK_MS,
      waitForMidiRelease,
    }: StartIncorrectStepTransitionOptions) => {
      clearTransition();

      registerTimeout(() => {
        runAfterOptionalMidiRelease({
          action: () => {
            onRetrySequence();
          },
          waitForMidiRelease,
        });
      }, incorrectFeedbackMs);
    },
    [
      clearTransition,
      onRetrySequence,
      registerTimeout,
      runAfterOptionalMidiRelease,
    ],
  );

  const startSequenceCompletionTransition = useCallback(
    ({
      nextSequenceDelayMs = NEXT_SEQUENCE_DELAY_MS,
      successChirpDelayMs = SUCCESS_CHIRP_DELAY_MS,
      waitForMidiRelease,
    }: StartSequenceCompletionTransitionOptions) => {
      clearTransition();

      registerTimeout(() => {
        onSuccessFeedback();
      }, successChirpDelayMs);

      registerTimeout(() => {
        runAfterOptionalMidiRelease({
          action: onAdvanceSequence,
          waitForMidiRelease,
        });
      }, nextSequenceDelayMs);
    },
    [
      clearTransition,
      onAdvanceSequence,
      onSuccessFeedback,
      registerTimeout,
      runAfterOptionalMidiRelease,
    ],
  );

  useEffect(() => {
    return clearTransition;
  }, [clearTransition]);

  return {
    clearTransition,
    startIncorrectStepTransition,
    startSequenceCompletionTransition,
    startStepTransition,
    updateMidiHeldNotes,
  };
}
