import { useCallback, useEffect, useRef, useState } from "react";
import { CHORD_ATTEMPT_GRACE_MS, useChordAttempt } from "@/hooks/use-chord-attempt";
import { useAppMidiInput } from "@/hooks/use-app-midi-input";
import type { MidiReleaseObservation } from "@/hooks/use-midi";
import {
  armPiecePracticeFirstTarget,
  getCurrentPiecePracticeTarget,
  recordPiecePracticeMidiAttack,
  recordPiecePracticeMidiRelease,
  expirePiecePracticeRolledChecks,
  getPiecePracticeRolledWindowMs,
  skipCurrentPiecePracticeTarget,
  submitPiecePracticePitch,
  submitPiecePracticeAttempt,
  type PiecePracticeSessionState,
} from "../piece-practice-session";
import type { PiecePracticeGrade } from "../piece-practice-validation";
import type { PiecePracticeAttackedPitch, PiecePracticePiece, PiecePracticeTarget } from "../piece-practice-types";
import { classifyPiecePracticePitch, getPiecePracticeAllowedHeldMidiNumbers, getPiecePracticeTransitionHeldMidiNumbers, type PiecePracticeTransition } from "../piece-practice-input";

export type PiecePracticeInputSource = "midi" | "virtual";
export type PiecePracticeInputFeedback = Readonly<{
  status: "idle" | "correct" | "incorrect";
  source: PiecePracticeInputSource | null;
  grade: PiecePracticeGrade | null;
  predecessorPitches?: readonly PiecePracticeAttackedPitch[];
}>;

export type UsePiecePracticeInputOptions = Readonly<{
  piece: PiecePracticePiece;
  sessionState: PiecePracticeSessionState;
  onSessionStateChange: (state: PiecePracticeSessionState) => void;
  resetHeldOnMount?: boolean;
  now?: () => number;
}>;

const IDLE_FEEDBACK: PiecePracticeInputFeedback = { status: "idle", source: null, grade: null };

const monotonicNow = () => performance.now();

export function usePiecePracticeInput({ piece, sessionState, onSessionStateChange, resetHeldOnMount = false, now = monotonicNow }: UsePiecePracticeInputOptions) {
  const [feedback, setFeedback] = useState<PiecePracticeInputFeedback>(IDLE_FEEDBACK);
  const [midiHeldNotes, setMidiHeldNotes] = useState<ReadonlySet<number>>(new Set());
  const [virtualSelectedMidiNumbers, setVirtualSelectedMidiNumbers] = useState<ReadonlySet<number>>(new Set());
  const sessionStateRef = useRef(sessionState);
  const midiHeldNotesRef = useRef<ReadonlySet<number>>(new Set());
  const ignoreInitialHeldRef = useRef(resetHeldOnMount);
  const ignoredHeldNotesRef = useRef<Set<number>>(new Set());
  const virtualSelectionRef = useRef<Set<number>>(new Set());
  const chordTargetIdRef = useRef<string | null>(null);
  const chordTimingRef = useRef<{ startedAtMs: number; lastAttackAtMs: number; attacks: Set<number> } | null>(null);
  const transitionRef = useRef<PiecePracticeTransition | null>(null);
  const finalizeMidiChordAttemptRef = useRef<(midiNumbers: ReadonlySet<number>) => void>(() => undefined);

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
    chordTimingRef.current = null;
    clearAttempt();
    clearVirtualSelection();
  }, [clearAttempt, clearVirtualSelection]);

  const resetInput = useCallback(() => {
    transitionRef.current = null;
    clearTransientAttempts();
    setFeedback(IDLE_FEEDBACK);
  }, [clearTransientAttempts]);

  const skipCurrentTarget = useCallback(() => {
    const result = skipCurrentPiecePracticeTarget(piece, sessionStateRef.current, now());
    if (!result.skipped) return false;
    transitionRef.current = null;
    clearTransientAttempts();
    setFeedback(IDLE_FEEDBACK);
    sessionStateRef.current = result.state;
    onSessionStateChange(result.state);
    return true;
  }, [clearTransientAttempts, now, onSessionStateChange, piece]);

  const rememberSuccessfulTarget = useCallback((target: PiecePracticeTarget, source: PiecePracticeInputSource, state: PiecePracticeSessionState) => {
    const next = getCurrentPiecePracticeTarget(piece, state);
    transitionRef.current = source === "midi" && next ? {
      targetId: next.id,
      predecessorPitches: target.attackedPitches,
      eligibleHeldMidiNumbers: target.expectedMidiNumbers.filter((pitch) => midiHeldNotesRef.current.has(pitch)),
      firstAttackAtMs: null,
    } : null;
  }, [piece]);

  const submitAttack = useCallback((source: PiecePracticeInputSource, attackMidiNumbers: Iterable<number>, heldMidiNumbers: Iterable<number> = [], logicalAttemptAtMs = now()) => {
    const currentState = sessionStateRef.current;
    const target = getCurrentPiecePracticeTarget(piece, currentState);
    if (!target) return;
    const predecessorPitches = transitionRef.current?.targetId === target.id ? transitionRef.current.predecessorPitches : [];
    const allowedHeldMidiNumbers = getPiecePracticeAllowedHeldMidiNumbers({
      piece,
      target,
      additionalAllowedMidiNumbers: [
        ...target.checks.filter(({ kind }) => kind === "rolled-chord").flatMap(({ expectedMidiNumbers }) => expectedMidiNumbers),
        ...(source === "midi" ? getPiecePracticeTransitionHeldMidiNumbers(transitionRef.current, target.id, logicalAttemptAtMs) : []),
      ],
    });
    const result = submitPiecePracticeAttempt(piece, currentState, {
      targetId: target.id,
      attempt: { attackMidiNumbers, heldMidiNumbers, allowedHeldMidiNumbers },
      atMs: now(),
      predecessorPitches,
    });
    if (!result.accepted) return;
    sessionStateRef.current = result.state;
    const advanced = getCurrentPiecePracticeTarget(piece, result.state)?.id !== target.id;
    if (result.grade.correct && advanced) rememberSuccessfulTarget(target, source, result.state);
    setFeedback({ status: !result.grade.correct ? "incorrect" : advanced ? "correct" : "idle", source: advanced || !result.grade.correct ? source : null, grade: result.grade, predecessorPitches });
    clearTransientAttempts();
    onSessionStateChange(result.state);
  }, [clearTransientAttempts, now, onSessionStateChange, piece, rememberSuccessfulTarget]);

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
      rememberSuccessfulTarget(target, source, result.state);
      setFeedback({ status: "correct", source, grade: null });
      clearTransientAttempts();
    }
    return { target, matched: result.matched, incorrect: result.incorrect, advanced };
  }, [clearTransientAttempts, now, onSessionStateChange, piece, rememberSuccessfulTarget]);

  const finalizeMidiChordAttempt = useCallback((midiNumbers: ReadonlySet<number>) => {
    const target = getCurrentPiecePracticeTarget(piece, sessionStateRef.current);
    if (!target || chordTargetIdRef.current !== target.id) return;
    const timing = chordTimingRef.current;
    if (!timing) return;
    // Timer delivery is not performance evidence. Actual late attacks still matter.
    const logicalAttemptAtMs = Math.max(timing.startedAtMs, timing.lastAttackAtMs);
    submitAttack("midi", midiNumbers, midiHeldNotesRef.current, logicalAttemptAtMs);
  }, [piece, submitAttack]);

  useEffect(() => {
    finalizeMidiChordAttemptRef.current = finalizeMidiChordAttempt;
  }, [finalizeMidiChordAttempt]);

  const handleMidiNotePlayed = useCallback((midiNumber: number, attackVelocity?: number, sourceTimeStampMs?: number) => {
    if (sessionStateRef.current.clockPaused) return;
    const target = getCurrentPiecePracticeTarget(piece, sessionStateRef.current);
    if (!target) return;
    const atMs = now();
    const classification = classifyPiecePracticePitch(piece, target, midiNumber);
    const transition = transitionRef.current;
    if (classification !== "optional" && transition?.targetId === target.id && transition.firstAttackAtMs === null) {
      transitionRef.current = { ...transition, firstAttackAtMs: atMs };
    }
    const current = sessionStateRef.current;
    const armed = classification === "optional" ? current : armPiecePracticeFirstTarget(piece, current, atMs);
    const withEvidence = recordPiecePracticeMidiAttack(piece, armed, midiNumber, attackVelocity, atMs, sourceTimeStampMs);
    if (withEvidence !== current) {
      sessionStateRef.current = withEvidence;
      onSessionStateChange(withEvidence);
    }
    const pendingIds = new Set(sessionStateRef.current.currentCheckProgress.filter(({ completed }) => !completed).map(({ checkId }) => checkId));
    const rolledChecks = target.checks.filter((check) => check.kind === "rolled-chord" && pendingIds.has(check.id));
    const normalCheck = target.checks.find((check) => check.kind === "normal" && pendingIds.has(check.id));
    if (classification === "optional") return;
    clearVirtualSelection();
    if (normalCheck && rolledChecks.length === 0 && !normalCheck.expectedMidiNumbers.includes(midiNumber)) {
      // Held allowance never excuses a wrong new attack, including the predecessor pitch.
      submitAttack("midi", [...(chordTimingRef.current?.attacks ?? []), midiNumber], midiHeldNotesRef.current, atMs);
      return;
    }
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
      if (chordTimingRef.current) {
        chordTimingRef.current.lastAttackAtMs = atMs;
        chordTimingRef.current.attacks.add(midiNumber);
      }
      addNoteToAttempt(midiNumber);
      return;
    }
    clearAttempt();
    chordTargetIdRef.current = target.id;
    chordTimingRef.current = { startedAtMs: atMs, lastAttackAtMs: atMs, attacks: new Set([midiNumber]) };
    startAttempt(midiNumber);
  }, [addNoteToAttempt, clearAttempt, clearVirtualSelection, isAttemptActive, now, onSessionStateChange, piece, startAttempt, submitAttack, submitPitch]);

  const handleMidiHeldNotesChanged = useCallback((heldNotes: ReadonlySet<number>) => {
    const next = new Set(heldNotes);
    if (ignoreInitialHeldRef.current) {
      ignoredHeldNotesRef.current = new Set(next);
      ignoreInitialHeldRef.current = false;
    }
    const fresh = new Set([...next].filter((midiNumber) => !ignoredHeldNotesRef.current.has(midiNumber)));
    if (transitionRef.current) transitionRef.current = {
      ...transitionRef.current,
      eligibleHeldMidiNumbers: transitionRef.current.eligibleHeldMidiNumbers.filter((pitch) => fresh.has(pitch)),
    };
    midiHeldNotesRef.current = fresh;
    setMidiHeldNotes(fresh);
  }, []);

  const handleMidiNoteReleased = useCallback((release: MidiReleaseObservation) => {
    if (ignoredHeldNotesRef.current.delete(release.midiNumber)) return;
    const current = sessionStateRef.current;
    const next = recordPiecePracticeMidiRelease(current, release, now());
    if (next === current) return;
    sessionStateRef.current = next;
    onSessionStateChange(next);
  }, [now, onSessionStateChange]);

  const midi = useAppMidiInput({ onHeldNotesChanged: handleMidiHeldNotesChanged, onNotePlayed: handleMidiNotePlayed, onNoteReleased: handleMidiNoteReleased });
  const previousMidiStatusRef = useRef(midi.status);
  useEffect(() => {
    if (midi.status !== previousMidiStatusRef.current) {
      transitionRef.current = null;
      clearTransientAttempts();
    }
    previousMidiStatusRef.current = midi.status;
  }, [clearTransientAttempts, midi.status]);

  const previousSessionRef = useRef(sessionState);
  useEffect(() => {
    const previous = previousSessionRef.current;
    const target = getCurrentPiecePracticeTarget(piece, sessionState);
    if (previous.clockPaused !== sessionState.clockPaused || previous.startedAtMs !== sessionState.startedAtMs
      || previous.startMeasureIndex !== sessionState.startMeasureIndex || previous.endMeasureIndex !== sessionState.endMeasureIndex
      || sessionState.completedTargetCount < previous.completedTargetCount || sessionState.skippedTargetCount !== previous.skippedTargetCount
      || sessionState.targetTimings.length < previous.targetTimings.length
      || (transitionRef.current && transitionRef.current.targetId !== target?.id)) {
      transitionRef.current = null;
      clearTransientAttempts();
    }
    sessionStateRef.current = sessionState;
    previousSessionRef.current = sessionState;
  }, [clearTransientAttempts, piece, sessionState]);

  const onVirtualNoteToggle = useCallback((midiNumber: number) => {
    const target = getCurrentPiecePracticeTarget(piece, sessionStateRef.current);
    if (!target || sessionStateRef.current.clockPaused) return;
    const classification = classifyPiecePracticePitch(piece, target, midiNumber);
    if (classification === "optional") {
      const next = new Set(virtualSelectionRef.current);
      if (next.has(midiNumber)) next.delete(midiNumber);
      else next.add(midiNumber);
      virtualSelectionRef.current = next;
      setVirtualSelectedMidiNumbers(next);
      return;
    }
    const current = sessionStateRef.current;
    const armed = armPiecePracticeFirstTarget(piece, current, now());
    if (armed !== current) {
      sessionStateRef.current = armed;
      onSessionStateChange(armed);
    }
    const pendingIds = new Set(sessionStateRef.current.currentCheckProgress.filter(({ completed }) => !completed).map(({ checkId }) => checkId));
    clearAttempt();
    chordTargetIdRef.current = null;
    chordTimingRef.current = null;
    const rolledChecks = target.checks.filter((check) => check.kind === "rolled-chord" && pendingIds.has(check.id));
    const normalCheck = target.checks.find((check) => check.kind === "normal" && pendingIds.has(check.id));
    if (sessionStateRef.current.assessmentFocus !== "both" && normalCheck && rolledChecks.length === 0 && !normalCheck.expectedMidiNumbers.includes(midiNumber)) {
      submitAttack("virtual", [midiNumber]);
      return;
    }
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
    const relevantSelection = new Set([...next].filter((pitch) => classifyPiecePracticePitch(piece, target, pitch) !== "optional"));
    if (normalCheck && relevantSelection.size === normalCheck.expectedMidiNumbers.length) submitAttack("virtual", relevantSelection);
  }, [clearAttempt, clearVirtualSelection, now, onSessionStateChange, piece, submitAttack, submitPitch]);

  useEffect(() => {
    if (sessionState.clockPaused) return;
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
  }, [now, onSessionStateChange, piece, sessionState.clockPaused, sessionState.currentCheckProgress]);

  const targetId = getCurrentPiecePracticeTarget(piece, sessionState)?.id ?? null;
  const previousTargetIdRef = useRef(targetId);
  useEffect(() => {
    const previousTargetId = previousTargetIdRef.current;
    if (previousTargetId === targetId) return;
    clearTransientAttempts();
    previousTargetIdRef.current = targetId;
  }, [clearTransientAttempts, targetId]);

  return {
    ...midi,
    feedback,
    midiChordAttemptMidiNumbers,
    midiHeldNotes,
    onVirtualNoteToggle,
    resetInput,
    skipCurrentTarget,
    virtualSelectedMidiNumbers,
  };
}
