import { useCallback, useMemo, useState } from "react";
import {
  commitStaffBuilderPendingCapture,
  formatStaffBuilderCapturePosition,
  moveStaffBuilderCaptureBackward,
  moveStaffBuilderCaptureForward,
  type StaffBuilderCaptureState,
  type StaffBuilderCaptureInputMode,
  type StaffBuilderPendingCapture,
  routeStaffBuilderCapturePitch,
} from "../staff-builder-capture";
import { resolveStaffBuilderMeasureContext, setStaffBuilderMeasureKeySignature, setStaffBuilderMeasureTimeSignature } from "../staff-builder-score";
import { deleteStaffBuilderEvent, getInitialStaffBuilderRhythmSelection, reconcileStaffBuilderEventSelection, setStaffBuilderEventDuration, type StaffBuilderEventSelection, type StaffBuilderRhythmState } from "../staff-builder-rhythm";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import type { StaffBuilderDuration, StaffBuilderStepDuration, StaffBuilderTimeSignature } from "../staff-builder-time";
import type { MusicKeyId } from "@/lib/music/keys";
import { createStaffBuilderTies, fillAllStaffBuilderGapsWithRests, fillStaffBuilderGapWithRests, removeStaffBuilderTie, setStaffBuilderInitialKey, setStaffBuilderInitialTime, splitStaffBuilderEventAcrossBarline } from "../staff-builder-corrections";
import { validateStaffBuilderScore, type StaffBuilderIssue } from "../staff-builder-validation";
import { useStaffBuilderHistory } from "./use-staff-builder-history";
import { useStaffBuilderRhythmEditor } from "./use-staff-builder-rhythm-editor";

export type StaffBuilderEditorPass = "capture" | "rhythm";
export type StaffBuilderPersistedEditorState = Readonly<{ editorPass: StaffBuilderEditorPass; captureState: StaffBuilderCaptureState; rhythmState: StaffBuilderRhythmState }>;

const EMPTY_PENDING: StaffBuilderPendingCapture = { treble: [], bass: [] };

function hasPending(pending: StaffBuilderPendingCapture): boolean {
  return pending.treble.length > 0 || pending.bass.length > 0;
}

function toggleSorted(values: readonly number[], midiNumber: number): readonly number[] {
  if (values.includes(midiNumber)) return values.filter((value) => value !== midiNumber);
  return [...values, midiNumber].sort((a, b) => a - b);
}

function scoreFingerprint(score: StaffBuilderScoreV1): string {
  return JSON.stringify(score);
}

export function useStaffBuilderEditor({ score: initialScore, initialCaptureState, initialEditorPass = "capture", initialRhythmState = { measureIndex: 0, selectedEventId: null }, onDraftChange, onValidatedSave, confirmDiscardPending = () => window.confirm("Discard pending pitches and switch editor passes?") }: Readonly<{
  score: StaffBuilderScoreV1;
  initialCaptureState: StaffBuilderCaptureState;
  initialEditorPass?: StaffBuilderEditorPass;
  initialRhythmState?: StaffBuilderRhythmState;
  onDraftChange: (score: StaffBuilderScoreV1, editorState: StaffBuilderPersistedEditorState) => unknown;
  onValidatedSave?: (score: StaffBuilderScoreV1, editorState: StaffBuilderPersistedEditorState) => Readonly<{ ok: boolean }>;
  confirmDiscardPending?: () => boolean;
}>) {
  const [score, setScore] = useState(initialScore);
  const initialScoreFingerprint = scoreFingerprint(initialScore);
  const [sourceFingerprint, setSourceFingerprint] = useState(initialScoreFingerprint);
  const [externalScoreGeneration, setExternalScoreGeneration] = useState(0);
  const [captureState, setCaptureState] = useState(initialCaptureState);
  const [editorPass, setEditorPass] = useState<StaffBuilderEditorPass>(initialEditorPass);
  const [rhythmState, setRhythmState] = useState<StaffBuilderRhythmState>(initialRhythmState);
  const [pending, setPending] = useState<StaffBuilderPendingCapture>(EMPTY_PENDING);
  const [validationActive, setValidationActive] = useState(false);
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] = useState<string | null>(null);
  if (initialScoreFingerprint !== sourceFingerprint) {
    setSourceFingerprint(initialScoreFingerprint);
    if (initialScoreFingerprint !== scoreFingerprint(score)) {
      setExternalScoreGeneration((generation) => generation + 1);
      setScore(initialScore);
    }
  }
  const history = useStaffBuilderHistory(50, externalScoreGeneration);

  const persist = useCallback((nextScore: StaffBuilderScoreV1, nextCaptureState: StaffBuilderCaptureState, nextEditorPass = editorPass, nextRhythmState = rhythmState) => {
    setScore(nextScore);
    setCaptureState(nextCaptureState);
    setEditorPass(nextEditorPass);
    setRhythmState(nextRhythmState);
    onDraftChange(nextScore, { editorPass: nextEditorPass, captureState: nextCaptureState, rhythmState: nextRhythmState });
  }, [editorPass, onDraftChange, rhythmState]);

  const persistOutsideRhythmHistory = useCallback((nextScore: StaffBuilderScoreV1, nextCaptureState: StaffBuilderCaptureState) => {
    if (nextScore !== score) history.clear();
    persist(nextScore, nextCaptureState);
  }, [history, persist, score]);

  const selectionToState = useCallback((selection: StaffBuilderEventSelection | null, fallback = rhythmState): StaffBuilderRhythmState => ({
    measureIndex: selection?.measureIndex ?? fallback.measureIndex,
    selectedEventId: selection?.eventId ?? null,
  }), [rhythmState]);

  const handleRhythmSelectionChange = useCallback((selection: StaffBuilderEventSelection | null) => {
    persist(score, captureState, "rhythm", selectionToState(selection));
  }, [captureState, persist, score, selectionToState]);

  const handleRhythmMutation = useCallback((nextScore: StaffBuilderScoreV1, selection: StaffBuilderEventSelection | null) => {
    history.record(score);
    persist(nextScore, captureState, "rhythm", selectionToState(selection));
  }, [captureState, history, persist, score, selectionToState]);

  const rhythm = useStaffBuilderRhythmEditor({ score, initialState: initialRhythmState, onMutation: handleRhythmMutation, onSelectionChange: handleRhythmSelectionChange });
  const issues = useMemo(() => validateStaffBuilderScore(score), [score]);
  const foundIssueIndex = activeIssueId === null ? -1 : issues.findIndex(({ id }) => id === activeIssueId);
  const activeIssueIndex = validationActive && activeIssueId !== null && issues.length > 0 ? Math.max(0, foundIssueIndex) : -1;
  const activeIssue = activeIssueIndex >= 0 ? issues[activeIssueIndex] ?? null : null;

  const selectIssue = useCallback((next: StaffBuilderIssue | null) => {
    setActiveIssueId(next?.id ?? null);
    if (next?.target.eventId) rhythm.setSelection({ measureIndex: next.target.measureIndex, eventId: next.target.eventId });
  }, [rhythm]);

  const reconcileIssueAfterMutation = useCallback((previous: StaffBuilderIssue | null, nextScore: StaffBuilderScoreV1) => {
    const nextIssues = validateStaffBuilderScore(nextScore);
    if (nextIssues.length === 0) { setActiveIssueId(null); setValidationStatus("All issues are corrected. Ready to save."); return; }
    const retained = previous ? nextIssues.find(({ id }) => id === previous.id) : null;
    const next = retained ?? nextIssues.find((candidate) => !previous || candidate.target.measureIndex > previous.target.measureIndex
      || (candidate.target.measureIndex === previous.target.measureIndex && (candidate.target.positionTicks ?? 0) >= (previous.target.positionTicks ?? 0))) ?? nextIssues[0] ?? null;
    setActiveIssueId(next?.id ?? null);
    if (next?.target.eventId) rhythm.setSelection({ measureIndex: next.target.measureIndex, eventId: next.target.eventId });
  }, [rhythm]);

  const applyHistoryMutation = useCallback((nextScore: StaffBuilderScoreV1, selection: StaffBuilderEventSelection | null = rhythm.selection) => {
    if (nextScore === score) return false;
    history.record(score);
    const nextSelection = reconcileStaffBuilderEventSelection(nextScore, selection);
    persist(nextScore, captureState, editorPass, selectionToState(nextSelection));
    reconcileIssueAfterMutation(activeIssue, nextScore);
    return true;
  }, [activeIssue, captureState, editorPass, history, persist, reconcileIssueAfterMutation, rhythm.selection, score, selectionToState]);

  const setInputMode = useCallback((inputMode: StaffBuilderCaptureInputMode) => {
    if (inputMode === captureState.inputMode) return;
    const next = { ...captureState, inputMode };
    persist(score, next);
  }, [captureState, persist, score]);

  const setStepDuration = useCallback((stepDuration: StaffBuilderStepDuration) => {
    if (stepDuration === captureState.stepDuration) return;
    const next = { ...captureState, stepDuration };
    persist(score, next);
  }, [captureState, persist, score]);

  const addMidiPitch = useCallback((midiNumber: number) => {
    setPending((current) => {
      const staff = routeStaffBuilderCapturePitch(captureState.inputMode, midiNumber);
      if (current[staff].includes(midiNumber)) return current;
      return { ...current, [staff]: [...current[staff], midiNumber].sort((a, b) => a - b) };
    });
  }, [captureState.inputMode]);

  const toggleVirtualPitch = useCallback((midiNumber: number) => {
    setPending((current) => {
      const staff = routeStaffBuilderCapturePitch(captureState.inputMode, midiNumber);
      return { ...current, [staff]: toggleSorted(current[staff], midiNumber) };
    });
  }, [captureState.inputMode]);

  const navigate = useCallback((direction: "forward" | "backward") => {
    if (direction === "backward") {
      const cursor = moveStaffBuilderCaptureBackward(score, captureState.cursor, captureState.stepDuration);
      if (cursor === captureState.cursor) return false;
      if (hasPending(pending) && !confirmDiscardPending()) return false;
      setPending(EMPTY_PENDING);
      persistOutsideRhythmHistory(score, { ...captureState, cursor });
      return true;
    }
    if (hasPending(pending) && !confirmDiscardPending()) return false;
    const moved = moveStaffBuilderCaptureForward(score, captureState.cursor, captureState.stepDuration);
    setPending(EMPTY_PENDING);
    persistOutsideRhythmHistory(moved.score, { ...captureState, cursor: moved.cursor });
    return true;
  }, [captureState, confirmDiscardPending, pending, persistOutsideRhythmHistory, score]);

  const lockAndContinue = useCallback(() => {
    const committed = commitStaffBuilderPendingCapture(score, captureState.cursor, pending);
    const moved = moveStaffBuilderCaptureForward(committed, captureState.cursor, captureState.stepDuration);
    setPending(EMPTY_PENDING);
    persistOutsideRhythmHistory(moved.score, { ...captureState, cursor: moved.cursor });
  }, [captureState, pending, persistOutsideRhythmHistory, score]);

  const goToMeasure = useCallback((measureIndex: number) => {
    if (validationActive || !Number.isInteger(measureIndex) || measureIndex < 0 || measureIndex >= score.measures.length) return false;
    if (editorPass === "capture") {
      if (measureIndex === captureState.cursor.measureIndex && captureState.cursor.offsetTicks === 0) return false;
      if (hasPending(pending) && !confirmDiscardPending()) return false;
      const nextCaptureState = { ...captureState, cursor: { measureIndex, offsetTicks: 0 } };
      setPending(EMPTY_PENDING);
      persist(score, nextCaptureState);
      return true;
    }
    if (measureIndex === rhythm.measureIndex) return false;
    const selection = rhythm.goToMeasure(measureIndex);
    persist(score, captureState, "rhythm", { measureIndex, selectedEventId: selection?.eventId ?? null });
    return true;
  }, [captureState, confirmDiscardPending, editorPass, pending, persist, rhythm, score, validationActive]);

  const switchToRhythm = useCallback(() => {
    const selection = reconcileStaffBuilderEventSelection(score, rhythm.selection);
    if (!selection) return false;
    if (hasPending(pending) && !confirmDiscardPending()) return false;
    const nextRhythmState = selectionToState(selection);
    setPending(EMPTY_PENDING);
    rhythm.setSelection(selection);
    persist(score, captureState, "rhythm", nextRhythmState);
    return true;
  }, [captureState, confirmDiscardPending, pending, persist, rhythm, score, selectionToState]);

  const switchToCapture = useCallback(() => {
    persist(score, captureState, "capture", selectionToState(rhythm.selection));
  }, [captureState, persist, rhythm.selection, score, selectionToState]);

  const undo = useCallback(() => {
    const restored = history.undo(score);
    if (!restored) return false;
    const selection = reconcileStaffBuilderEventSelection(restored, rhythm.selection);
    rhythm.setSelection(selection);
    persist(restored, captureState, editorPass, selectionToState(selection));
    reconcileIssueAfterMutation(activeIssue, restored);
    return true;
  }, [activeIssue, captureState, editorPass, history, persist, reconcileIssueAfterMutation, rhythm, score, selectionToState]);

  const redo = useCallback(() => {
    const restored = history.redo(score);
    if (!restored) return false;
    const selection = reconcileStaffBuilderEventSelection(restored, rhythm.selection);
    rhythm.setSelection(selection);
    persist(restored, captureState, editorPass, selectionToState(selection));
    reconcileIssueAfterMutation(activeIssue, restored);
    return true;
  }, [activeIssue, captureState, editorPass, history, persist, reconcileIssueAfterMutation, rhythm, score, selectionToState]);

  const activateValidation = useCallback(() => {
    if (hasPending(pending) && !confirmDiscardPending()) return false;
    setPending(EMPTY_PENDING);
    if (issues.length === 0) {
      const result = onValidatedSave?.(score, { editorPass, captureState, rhythmState });
      setValidationStatus(result?.ok ? "Saved and ready for playback." : "The validated reference could not be saved. Your draft remains available.");
      setValidationActive(false);
      selectIssue(null);
      return result?.ok ?? false;
    }
    setValidationActive(true);
    setValidationStatus(null);
    selectIssue(issues[0] ?? null);
    return true;
  }, [captureState, confirmDiscardPending, editorPass, issues, onValidatedSave, pending, rhythmState, score, selectIssue]);

  const applyIssueCorrection = useCallback((correction: StaffBuilderIssue["corrections"][number]) => {
    let result;
    if (correction.kind === "set-duration") {
      const measureIndex = score.measures.findIndex((measure) => measure.events.some(({ id }) => id === correction.eventId));
      if (measureIndex < 0) return false;
      const selection = { measureIndex, eventId: correction.eventId };
      const changed = setStaffBuilderEventDuration(score, selection, correction.duration);
      if (!changed.ok) return false;
      setValidationStatus(`Changed the event to ${correction.duration.replace("-", " ")} so it ends at the barline.`);
      return applyHistoryMutation(changed.score, selection);
    }
    if (correction.kind === "assign-duration" || correction.kind === "shorten-duration") {
      const measureIndex = score.measures.findIndex((measure) => measure.events.some(({ id }) => id === correction.eventId));
      if (measureIndex < 0) return false;
      const selection = { measureIndex, eventId: correction.eventId };
      const nextRhythmState = selectionToState(selection);
      setValidationActive(false);
      setValidationStatus(correction.kind === "assign-duration" ? "Assign a final duration to correct this issue." : "Shorten this event to correct the overlap or overflow.");
      rhythm.setSelection(selection);
      persist(score, captureState, "rhythm", nextRhythmState);
      return true;
    }
    if (correction.kind === "fill-gap-with-rests") result = fillStaffBuilderGapWithRests(score, { measureIndex: activeIssue?.target.measureIndex ?? 0, staff: correction.staff, startTick: correction.startTick, endTick: correction.endTick });
    else if (correction.kind === "remove-tie") result = removeStaffBuilderTie(score, correction.tieId);
    else if (correction.kind === "delete-event") {
      const located = score.measures.findIndex((measure) => measure.events.some(({ id }) => id === correction.eventId));
      if (located < 0) return false;
      const deleted = deleteStaffBuilderEvent(score, { measureIndex: located, eventId: correction.eventId });
      if (!deleted.result.ok) { setValidationStatus("Remove the event's ties before deleting it."); return false; }
      return applyHistoryMutation(deleted.result.score, deleted.selection);
    } else return false;
    if (!result.ok) { setValidationStatus(`Correction could not be applied (${result.error}).`); return false; }
    setValidationStatus(correction.kind === "fill-gap-with-rests" ? "Added rest for the selected empty beats." : null);
    return applyHistoryMutation(result.score);
  }, [activeIssue?.target.measureIndex, applyHistoryMutation, captureState, persist, rhythm, score, selectionToState]);

  const fillAllGaps = useCallback(() => {
    const gaps = issues.flatMap((currentIssue) => currentIssue.code !== "gap" ? [] : currentIssue.corrections.flatMap((correction) => correction.kind === "fill-gap-with-rests" ? [{ measureIndex: currentIssue.target.measureIndex, staff: correction.staff, startTick: correction.startTick, endTick: correction.endTick }] : []));
    const result = fillAllStaffBuilderGapsWithRests(score, gaps);
    if (!result.ok) { setValidationStatus("Empty beats could not be filled because the score changed. No rests were added."); return false; }
    setValidationStatus("Filled all empty beats with rests.");
    return applyHistoryMutation(result.score);
  }, [applyHistoryMutation, issues, score]);

  const setMeasureKey = useCallback((measureIndex: number, keyId: MusicKeyId | null) => {
    const next = measureIndex === 0 && keyId !== null ? setStaffBuilderInitialKey(score, keyId) : setStaffBuilderMeasureKeySignature(score, measureIndex, keyId);
    return applyHistoryMutation(next);
  }, [applyHistoryMutation, score]);
  const setMeasureTime = useCallback((measureIndex: number, timeSignature: StaffBuilderTimeSignature | null) => {
    const next = measureIndex === 0 && timeSignature !== null ? setStaffBuilderInitialTime(score, timeSignature) : setStaffBuilderMeasureTimeSignature(score, measureIndex, timeSignature);
    if (next === score) return false;
    const capacity = resolveStaffBuilderMeasureContext(next, captureState.cursor.measureIndex).capacityTicks;
    const nextCapture = captureState.cursor.offsetTicks < capacity ? captureState : { ...captureState, cursor: { ...captureState.cursor, offsetTicks: 0 } };
    history.record(score);
    persist(next, nextCapture, editorPass, rhythmState);
    reconcileIssueAfterMutation(activeIssue, next);
    return true;
  }, [activeIssue, captureState, editorPass, history, persist, reconcileIssueAfterMutation, rhythmState, score]);

  return {
    score,
    editorPass,
    captureState,
    positionLabel: formatStaffBuilderCapturePosition(
      resolveStaffBuilderMeasureContext(score, captureState.cursor.measureIndex).timeSignature,
      captureState.cursor.offsetTicks,
    ),
    pending,
    rhythm,
    canEnterRhythm: getInitialStaffBuilderRhythmSelection(score) !== null,
    switchToRhythm,
    switchToCapture,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undo,
    redo,
    hasPending: hasPending(pending),
    setInputMode,
    setStepDuration,
    addMidiPitch,
    toggleVirtualPitch,
    previousPosition: () => navigate("backward"),
    nextPosition: () => navigate("forward"),
    lockAndContinue,
    clearCurrentEntry: () => setPending(EMPTY_PENDING),
    goToMeasure,
    validation: {
      active: validationActive,
      issues,
      activeIssue,
      activeIssueIndex,
      status: validationStatus,
      activate: activateValidation,
      close: () => setValidationActive(false),
      previous: () => selectIssue(issues[Math.max(0, activeIssueIndex - 1)] ?? null),
      next: () => selectIssue(issues[Math.min(issues.length - 1, activeIssueIndex + 1)] ?? null),
      applyCorrection: applyIssueCorrection,
      fillAllGaps,
    },
    applyScoreMutation: applyHistoryMutation,
    setMeasureKey,
    setMeasureTime,
    createTies: (fromEventId: string, toEventId: string, fromPitchIds: readonly string[]) => {
      const result = createStaffBuilderTies(score, { fromEventId, toEventId, fromPitchIds });
      return result.ok ? applyHistoryMutation(result.score) : false;
    },
    splitAndTie: (eventId: string, targetDuration: StaffBuilderDuration, fromPitchIds: readonly string[], useEventId?: string) => {
      const result = splitStaffBuilderEventAcrossBarline(score, { eventId, targetDuration, fromPitchIds, useEventId });
      return result.ok ? applyHistoryMutation(result.score) : false;
    },
    removeTie: (tieId: string) => {
      const result = removeStaffBuilderTie(score, tieId);
      return result.ok ? applyHistoryMutation(result.score) : false;
    },
  };
}
