import { useCallback, useEffect, useRef, useState } from "react";
import { CHORD_ATTEMPT_GRACE_MS, useChordAttempt } from "@/hooks/use-chord-attempt";
import { useAppMidiInput } from "@/hooks/use-app-midi-input";
import {
  getCurrentPiecePracticeTarget,
  expirePiecePracticeRolledChecks,
  getPiecePracticeRolledWindowMs,
  submitPiecePracticePitch,
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
  now?: () => number;
}>;

const IDLE_FEEDBACK: PiecePracticeInputFeedback = { status: "idle", source: null, grade: null };

export function usePiecePracticeInput({ piece, sessionState, onSessionStateChange, now = Date.now }: UsePiecePracticeInputOptions) {
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
      previousSuccessfulTargetMidiNumbers: [
        ...previousSuccessfulTargetMidiNumbersRef.current,
        ...target.checks.filter(({ kind }) => kind === "rolled-chord").flatMap(({ expectedMidiNumbers }) => expectedMidiNumbers),
      ],
    });
    const result = submitPiecePracticeAttempt(piece, currentState, {
      targetId: target.id,
      attempt: { attackMidiNumbers, heldMidiNumbers, allowedHeldMidiNumbers },
    });
    if (!result.accepted) return;
    sessionStateRef.current = result.state;
    const advanced = getCurrentPiecePracticeTarget(piece, result.state)?.id !== target.id;
    if (result.grade.correct && advanced) {
      previousSuccessfulTargetMidiNumbersRef.current = target.expectedMidiNumbers;
      lingeringAllowanceOriginTargetIdRef.current = target.id;
    }
    setFeedback({ status: !result.grade.correct ? "incorrect" : advanced ? "correct" : "idle", source: advanced || !result.grade.correct ? source : null, grade: result.grade });
    clearTransientAttempts();
    onSessionStateChange(result.state);
  }, [clearTransientAttempts, onSessionStateChange, piece]);

  const submitPitch = useCallback((source: PiecePracticeInputSource, midiNumber: number) => {
    const currentState = sessionStateRef.current;
    const target = getCurrentPiecePracticeTarget(piece, currentState);
    if (!target) return { target: null, matched: false, incorrect: false, advanced: false };
    const result = submitPiecePracticePitch(piece, currentState, { targetId: target.id, midiNumber, atMs: now(), completeSingleNormalCheck: false });
    if (!result.accepted) return { target, matched: false, incorrect: false, advanced: false };
    sessionStateRef.current = result.state;
    const advanced = getCurrentPiecePracticeTarget(piece, result.state)?.id !== target.id;
    if (result.state !== currentState) onSessionStateChange(result.state);
    if (result.incorrect) setFeedback({ status: "incorrect", source, grade: null });
    else if (advanced) {
      previousSuccessfulTargetMidiNumbersRef.current = target.expectedMidiNumbers;
      lingeringAllowanceOriginTargetIdRef.current = target.id;
      setFeedback({ status: "correct", source, grade: null });
      clearTransientAttempts();
    }
    return { target, matched: result.matched, incorrect: result.incorrect, advanced };
  }, [clearTransientAttempts, now, onSessionStateChange, piece]);

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
    const pendingIds = new Set(sessionStateRef.current.currentCheckProgress.filter(({ completed }) => !completed).map(({ checkId }) => checkId));
    const rolledChecks = target.checks.filter((check) => check.kind === "rolled-chord" && pendingIds.has(check.id));
    const normalCheck = target.checks.find((check) => check.kind === "normal" && pendingIds.has(check.id));
    if (rolledChecks.length > 0) {
      const result = submitPitch("midi", midiNumber);
      if (result.advanced || result.incorrect || !normalCheck || !normalCheck.expectedMidiNumbers.includes(midiNumber)) return;
      if (normalCheck.expectedMidiNumbers.length === 1) {
        submitAttack("midi", [midiNumber], midiHeldNotesRef.current);
        return;
      }
    }
    if (normalCheck?.expectedMidiNumbers.length === 1 || (rolledChecks.length === 0 && target.expectedMidiNumbers.length === 1)) {
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
  }, [addNoteToAttempt, clearAttempt, clearVirtualSelection, isAttemptActive, piece, startAttempt, submitAttack, submitPitch]);

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
    const pendingIds = new Set(sessionStateRef.current.currentCheckProgress.filter(({ completed }) => !completed).map(({ checkId }) => checkId));
    const rolledChecks = target.checks.filter((check) => check.kind === "rolled-chord" && pendingIds.has(check.id));
    const normalCheck = target.checks.find((check) => check.kind === "normal" && pendingIds.has(check.id));
    if (rolledChecks.length > 0) {
      const result = submitPitch("virtual", midiNumber);
      if (result.advanced || result.incorrect || !normalCheck || !normalCheck.expectedMidiNumbers.includes(midiNumber)) return;
      if (normalCheck.expectedMidiNumbers.length === 1) {
        submitAttack("virtual", [midiNumber]);
        return;
      }
    }
    if (normalCheck?.expectedMidiNumbers.length === 1 || (rolledChecks.length === 0 && target.expectedMidiNumbers.length === 1)) {
      clearVirtualSelection();
      submitAttack("virtual", [midiNumber]);
      return;
    }
    const next = new Set(virtualSelectionRef.current);
    if (next.has(midiNumber)) next.delete(midiNumber);
    else next.add(midiNumber);
    virtualSelectionRef.current = next;
    setVirtualSelectedMidiNumbers(next);
    if (normalCheck && next.size === normalCheck.expectedMidiNumbers.length) submitAttack("virtual", next);
  }, [clearAttempt, clearVirtualSelection, piece, submitAttack, submitPitch]);

  useEffect(() => {
    const deadlines = sessionState.currentCheckProgress
      .filter(({ completed, startedAtMs }) => !completed && startedAtMs !== null)
      .map(({ startedAtMs }) => (startedAtMs as number) + getPiecePracticeRolledWindowMs(piece.tempoBpm));
    if (deadlines.length === 0) return;
    const deadline = Math.min(...deadlines);
    const timeout = window.setTimeout(() => {
      const current = sessionStateRef.current;
      const expired = expirePiecePracticeRolledChecks(piece, current, Math.max(now(), deadline));
      if (expired === current) return;
      sessionStateRef.current = expired;
      setFeedback({ status: "incorrect", source: null, grade: null });
      onSessionStateChange(expired);
    }, Math.max(0, deadline - now()));
    return () => window.clearTimeout(timeout);
  }, [now, onSessionStateChange, piece, sessionState.currentCheckProgress]);

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
