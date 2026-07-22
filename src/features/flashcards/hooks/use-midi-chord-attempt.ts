import { useCallback, useEffect, useRef, useState } from "react";

type AttemptCompleteHandler = (
  midiNumbers: ReadonlySet<number>,
) => void;

export function useMidiChordAttempt(gracePeriodMs: number) {
  const [attemptNotes, setAttemptNotes] = useState<ReadonlySet<number>>(
    new Set(),
  );

  const attemptNotesRef = useRef<Set<number>>(new Set());
  const attemptActiveRef = useRef(false);
  const attemptTimerRef = useRef<number | null>(null);

  const clearAttempt = useCallback(() => {
    if (attemptTimerRef.current !== null) {
      window.clearTimeout(attemptTimerRef.current);
      attemptTimerRef.current = null;
    }

    attemptActiveRef.current = false;
    attemptNotesRef.current = new Set();

    setAttemptNotes(new Set());
  }, []);

  const startAttempt = useCallback(
    (
      firstMidiNumber: number,
      onAttemptComplete: AttemptCompleteHandler,
    ) => {
      const firstAttemptNotes = new Set([firstMidiNumber]);

      attemptActiveRef.current = true;
      attemptNotesRef.current = firstAttemptNotes;

      setAttemptNotes(firstAttemptNotes);

      attemptTimerRef.current = window.setTimeout(() => {
        const completedAttempt = new Set(attemptNotesRef.current);

        attemptTimerRef.current = null;
        attemptActiveRef.current = false;
        attemptNotesRef.current = new Set();

        setAttemptNotes(new Set());

        onAttemptComplete(completedAttempt);
      }, gracePeriodMs);
    },
    [gracePeriodMs],
  );

  const addNoteToAttempt = useCallback((midiNumber: number) => {
    const nextAttemptNotes = new Set(attemptNotesRef.current);

    nextAttemptNotes.add(midiNumber);
    attemptNotesRef.current = nextAttemptNotes;

    setAttemptNotes(nextAttemptNotes);
  }, []);

  const isAttemptActive = useCallback(
    () => attemptActiveRef.current,
    [],
  );

  useEffect(() => {
    return () => {
      if (attemptTimerRef.current !== null) {
        window.clearTimeout(attemptTimerRef.current);
      }
    };
  }, []);

  return {
    addNoteToAttempt,
    attemptNotes,
    clearAttempt,
    isAttemptActive,
    startAttempt,
  };
}