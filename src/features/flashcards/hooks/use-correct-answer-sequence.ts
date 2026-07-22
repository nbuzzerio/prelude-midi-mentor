import { useCallback, useEffect, useRef } from "react";

type StartCorrectAnswerSequenceOptions = Readonly<{
  nextTargetDelayMs: number;
  successChirpDelayMs: number;
  waitForMidiRelease: boolean;
}>;

type UseCorrectAnswerSequenceOptions = Readonly<{
  onAdvance: () => void;
  onSuccessFeedback: () => void;
}>;

export function useCorrectAnswerSequence({
  onAdvance,
  onSuccessFeedback,
}: UseCorrectAnswerSequenceOptions) {
  const successFeedbackTimerRef = useRef<number | null>(null);
  const advanceTimerRef = useRef<number | null>(null);

  const advanceReadyRef = useRef(false);
  const waitingForMidiReleaseRef = useRef(false);
  const midiHeldNotesRef = useRef<ReadonlySet<number>>(new Set());

  const onAdvanceRef = useRef(onAdvance);
  const onSuccessFeedbackRef = useRef(onSuccessFeedback);

  useEffect(() => {
    onAdvanceRef.current = onAdvance;
  }, [onAdvance]);

  useEffect(() => {
    onSuccessFeedbackRef.current = onSuccessFeedback;
  }, [onSuccessFeedback]);

  const clearSequence = useCallback(() => {
    if (successFeedbackTimerRef.current !== null) {
      window.clearTimeout(successFeedbackTimerRef.current);
      successFeedbackTimerRef.current = null;
    }

    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }

    advanceReadyRef.current = false;
    waitingForMidiReleaseRef.current = false;
  }, []);

  const tryAdvance = useCallback(() => {
    if (!advanceReadyRef.current) {
      return;
    }

    if (waitingForMidiReleaseRef.current && midiHeldNotesRef.current.size > 0) {
      return;
    }

    advanceTimerRef.current = null;
    advanceReadyRef.current = false;
    waitingForMidiReleaseRef.current = false;

    onAdvanceRef.current();
  }, []);

  const startSequence = useCallback(
    ({
      nextTargetDelayMs,
      successChirpDelayMs,
      waitForMidiRelease,
    }: StartCorrectAnswerSequenceOptions) => {
      clearSequence();

      waitingForMidiReleaseRef.current = waitForMidiRelease;

      successFeedbackTimerRef.current = window.setTimeout(() => {
        successFeedbackTimerRef.current = null;
        onSuccessFeedbackRef.current();
      }, successChirpDelayMs);

      advanceTimerRef.current = window.setTimeout(() => {
        advanceReadyRef.current = true;
        tryAdvance();
      }, nextTargetDelayMs);
    },
    [clearSequence, tryAdvance],
  );

  const updateMidiHeldNotes = useCallback(
    (heldNotes: ReadonlySet<number>) => {
      midiHeldNotesRef.current = new Set(heldNotes);

      if (heldNotes.size === 0) {
        tryAdvance();
      }
    },
    [tryAdvance],
  );

  useEffect(() => clearSequence, [clearSequence]);

  return {
    clearSequence,
    startSequence,
    updateMidiHeldNotes,
  };
}
