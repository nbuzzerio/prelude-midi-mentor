import { useCallback, useEffect, useRef, useState } from "react";
import { CHORD_ATTEMPT_GRACE_MS, useChordAttempt } from "@/hooks/use-chord-attempt";
import { useAppMidiInput } from "@/hooks/use-app-midi-input";
import {
  getCurrentPiecePracticeTarget,
  submitPiecePracticeAttempt,
  type PiecePracticeSessionState,
} from "../piece-practice-session";
import type { PiecePracticeGrade } from "../piece-practice-validation";
import type { PiecePracticePiece } from "../piece-practice-types";
import { getPiecePracticeAllowedHeldMidiNumbers, getPiecePracticeIncomingTiedMidiNumbers } from "../piece-practice-input";

export type PiecePracticeInputSource = "midi" | "virtual";
export type PiecePracticeInputFeedback = Readonly<{
  status: "idle" | "correct" | "incorrect";
  source: PiecePracticeInputSource | null;
  grade: PiecePracticeGrade | null;
}>;

export type UsePiecePracticeInputOptions = Readonly<{
  piece: PiecePracticePiece;
  sessionState: PiecePracticeSessionState;
  onSessionStateChange: (state: PiecePracticeSessionState) => void;
}>;

const IDLE_FEEDBACK: PiecePracticeInputFeedback = { status: "idle", source: null, grade: null };

export function usePiecePracticeInput({ piece, sessionState, onSessionStateChange }: UsePiecePracticeInputOptions) {
  const [feedback, setFeedback] = useState<PiecePracticeInputFeedback>(IDLE_FEEDBACK);
  const [midiHeldNotes, setMidiHeldNotes] = useState<ReadonlySet<number>>(new Set());
  const [virtualSelectedMidiNumbers, setVirtualSelectedMidiNumbers] = useState<ReadonlySet<number>>(new Set());
  const sessionStateRef = useRef(sessionState);
  const midiHeldNotesRef = useRef<ReadonlySet<number>>(new Set());
  const virtualSelectionRef = useRef<Set<number>>(new Set());
  const previousSuccessfulTargetMidiNumbersRef = useRef<readonly number[]>([]);
  const lingeringAllowanceOriginTargetIdRef = useRef<string | null>(null);
  const chordTargetIdRef = useRef<string | null>(null);
  const finalizeMidiChordAttemptRef = useRef<(midiNumbers: ReadonlySet<number>) => void>(() => undefined);

  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);

  const clearVirtualSelection = useCallback(() => {
    virtualSelectionRef.current = new Set();
    setVirtualSelectedMidiNumbers(new Set());
  }, []);

  const {
    addNoteToAttempt,
    attemptNotes: midiChordAttemptMidiNumbers,
    clearAttempt,
    isAttemptActive,
    startAttempt,
  } = useChordAttempt({
    gracePeriodMs: CHORD_ATTEMPT_GRACE_MS,
    onComplete: (midiNumbers) => finalizeMidiChordAttemptRef.current(midiNumbers),
  });

  const clearTransientAttempts = useCallback(() => {
    chordTargetIdRef.current = null;
    clearAttempt();
    clearVirtualSelection();
  }, [clearAttempt, clearVirtualSelection]);

  const resetInput = useCallback(() => {
    clearTransientAttempts();
    previousSuccessfulTargetMidiNumbersRef.current = [];
    lingeringAllowanceOriginTargetIdRef.current = null;
    setFeedback(IDLE_FEEDBACK);
  }, [clearTransientAttempts]);

  const submitAttack = useCallback((source: PiecePracticeInputSource, attackMidiNumbers: Iterable<number>, heldMidiNumbers: Iterable<number> = []) => {
    const currentState = sessionStateRef.current;
    const target = getCurrentPiecePracticeTarget(piece, currentState);
    if (!target) return;
    const allowedHeldMidiNumbers = getPiecePracticeAllowedHeldMidiNumbers({
      incomingTiedMidiNumbers: getPiecePracticeIncomingTiedMidiNumbers(piece, target),
      previousSuccessfulTargetMidiNumbers: previousSuccessfulTargetMidiNumbersRef.current,
    });
    const result = submitPiecePracticeAttempt(piece, currentState, {
      targetId: target.id,
      attempt: { attackMidiNumbers, heldMidiNumbers, allowedHeldMidiNumbers },
    });
    if (!result.accepted) return;
    sessionStateRef.current = result.state;
    if (result.grade.correct) {
      previousSuccessfulTargetMidiNumbersRef.current = target.expectedMidiNumbers;
      lingeringAllowanceOriginTargetIdRef.current = target.id;
    }
    setFeedback({ status: result.grade.correct ? "correct" : "incorrect", source, grade: result.grade });
    clearTransientAttempts();
    onSessionStateChange(result.state);
  }, [clearTransientAttempts, onSessionStateChange, piece]);

  const finalizeMidiChordAttempt = useCallback((midiNumbers: ReadonlySet<number>) => {
    const target = getCurrentPiecePracticeTarget(piece, sessionStateRef.current);
    if (!target || chordTargetIdRef.current !== target.id) return;
    chordTargetIdRef.current = null;
    submitAttack("midi", midiNumbers, midiHeldNotesRef.current);
  }, [piece, submitAttack]);

  useEffect(() => {
    finalizeMidiChordAttemptRef.current = finalizeMidiChordAttempt;
  }, [finalizeMidiChordAttempt]);

  const handleMidiNotePlayed = useCallback((midiNumber: number) => {
    const target = getCurrentPiecePracticeTarget(piece, sessionStateRef.current);
    if (!target) return;
    clearVirtualSelection();
    if (target.expectedMidiNumbers.length === 1) {
      clearAttempt();
      chordTargetIdRef.current = null;
      submitAttack("midi", [midiNumber], midiHeldNotesRef.current);
      return;
    }
    if (isAttemptActive() && chordTargetIdRef.current === target.id) {
      addNoteToAttempt(midiNumber);
      return;
    }
    clearAttempt();
    chordTargetIdRef.current = target.id;
    startAttempt(midiNumber);
  }, [addNoteToAttempt, clearAttempt, clearVirtualSelection, isAttemptActive, piece, startAttempt, submitAttack]);

  const handleMidiHeldNotesChanged = useCallback((heldNotes: ReadonlySet<number>) => {
    const next = new Set(heldNotes);
    midiHeldNotesRef.current = next;
    setMidiHeldNotes(next);
  }, []);

  const midi = useAppMidiInput({ onHeldNotesChanged: handleMidiHeldNotesChanged, onNotePlayed: handleMidiNotePlayed });

  const onVirtualNoteToggle = useCallback((midiNumber: number) => {
    const target = getCurrentPiecePracticeTarget(piece, sessionStateRef.current);
    if (!target) return;
    clearAttempt();
    chordTargetIdRef.current = null;
    if (target.expectedMidiNumbers.length === 1) {
      clearVirtualSelection();
      submitAttack("virtual", [midiNumber]);
      return;
    }
    const next = new Set(virtualSelectionRef.current);
    if (next.has(midiNumber)) next.delete(midiNumber);
    else next.add(midiNumber);
    virtualSelectionRef.current = next;
    setVirtualSelectedMidiNumbers(next);
    if (next.size === target.expectedMidiNumbers.length) submitAttack("virtual", next);
  }, [clearAttempt, clearVirtualSelection, piece, submitAttack]);

  const targetId = getCurrentPiecePracticeTarget(piece, sessionState)?.id ?? null;
  const previousTargetIdRef = useRef(targetId);
  useEffect(() => {
    const previousTargetId = previousTargetIdRef.current;
    if (previousTargetId === targetId) return;
    clearTransientAttempts();
    if (lingeringAllowanceOriginTargetIdRef.current !== previousTargetId) {
      previousSuccessfulTargetMidiNumbersRef.current = [];
      lingeringAllowanceOriginTargetIdRef.current = null;
    }
    previousTargetIdRef.current = targetId;
  }, [clearTransientAttempts, targetId]);

  return {
    ...midi,
    feedback,
    midiChordAttemptMidiNumbers,
    midiHeldNotes,
    onVirtualNoteToggle,
    resetInput,
    virtualSelectedMidiNumbers,
  };
}
