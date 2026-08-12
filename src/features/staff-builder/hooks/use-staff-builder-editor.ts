import { useCallback, useMemo, useState } from "react";
import {
  commitStaffBuilderPendingCapture,
  commitStaffBuilderCaptureRest,
  formatStaffBuilderCapturePosition,
  moveStaffBuilderCaptureBackward,
  moveStaffBuilderCaptureForward,
  type StaffBuilderCaptureState,
  type StaffBuilderCaptureInputMode,
  type StaffBuilderPendingCapture,
  routeStaffBuilderCapturePitch,
} from "../staff-builder-capture";
import { insertStaffBuilderMeasure, resolveStaffBuilderMeasureContext, setStaffBuilderMeasureKeySignature, setStaffBuilderMeasureTimeSignature, updateStaffBuilderTempo } from "../staff-builder-score";
import { deleteStaffBuilderEvent, getInitialStaffBuilderRhythmSelection, reconcileStaffBuilderEventSelection, setStaffBuilderEventDuration, type StaffBuilderEventSelection, type StaffBuilderRhythmState } from "../staff-builder-rhythm";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import { stepDurationToTicks, type StaffBuilderDuration, type StaffBuilderStepDuration, type StaffBuilderTimeSignature } from "../staff-builder-time";
import type { MusicKeyId } from "@/lib/music/keys";
import { createStaffBuilderTies, fillAllStaffBuilderGapsWithRests, fillStaffBuilderGapWithRests, removeStaffBuilderTie, setStaffBuilderInitialKey, setStaffBuilderInitialTime, splitStaffBuilderEventAcrossBarline } from "../staff-builder-corrections";
import { validateStaffBuilderScore, type StaffBuilderIssue } from "../staff-builder-validation";
import { useStaffBuilderHistory } from "./use-staff-builder-history";
import { useStaffBuilderRhythmEditor } from "./use-staff-builder-rhythm-editor";

export type StaffBuilderEditorPass = "capture" | "rhythm";
export type StaffBuilderPersistedEditorState = Readonly<{ editorPass: StaffBuilderEditorPass; captureState: StaffBuilderCaptureState; rhythmState: StaffBuilderRhythmState }>;

const EMPTY_PENDING: StaffBuilderPendingCapture = { treble: [], bass: [] };
export const STAFF_BUILDER_TIED_BOUNDARY_INSERT_MESSAGE = "A tie crosses this measure boundary. Remove or resolve the tie before inserting a measure here.";

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
  const [captureStatus, setCaptureStatus] = useState<string | null>(null);
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
    const stepTicks = stepDurationToTicks(stepDuration);
    const offsetTicks = Math.floor(captureState.cursor.offsetTicks / stepTicks) * stepTicks;
    const cursorMoves = offsetTicks !== captureState.cursor.offsetTicks;
    if (cursorMoves && hasPending(pending) && !confirmDiscardPending()) return;
    if (cursorMoves) setPending(EMPTY_PENDING);
    const next = { ...captureState, stepDuration, cursor: { ...captureState.cursor, offsetTicks } };
    persist(score, next);
  }, [captureState, confirmDiscardPending, pending, persist, score]);

  const setCapturePosition = useCallback((position: Readonly<{ measureIndex: number; offsetTicks: number }>) => {
    if (validationActive || editorPass !== "capture" || position.measureIndex !== captureState.cursor.measureIndex) return false;
    const capacity = resolveStaffBuilderMeasureContext(score, position.measureIndex).capacityTicks;
    if (!Number.isInteger(position.offsetTicks) || position.offsetTicks < 0 || position.offsetTicks >= capacity || position.offsetTicks % 120 !== 0) return false;
    if (position.offsetTicks === captureState.cursor.offsetTicks) return false;
    if (hasPending(pending) && !confirmDiscardPending()) return false;
    const nextCaptureState = { ...captureState, cursor: position };
    setPending(EMPTY_PENDING);
    persist(score, nextCaptureState);
    return true;
  }, [captureState, confirmDiscardPending, editorPass, pending, persist, score, validationActive]);

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

  const addRestAndContinue = useCallback(() => {
    const committed = commitStaffBuilderCaptureRest(score, captureState);
    if (!committed.ok) {
      setCaptureStatus("This position is tied. Remove the tie before replacing it with a rest.");
      return false;
    }
    const moved = moveStaffBuilderCaptureForward(committed.score, captureState.cursor, captureState.stepDuration);
    setPending(EMPTY_PENDING);
    setCaptureStatus(`${captureState.stepDuration === "quarter" ? "Quarter" : captureState.stepDuration === "eighth" ? "Eighth" : "Sixteenth"} rest added to ${committed.staves.length === 2 ? "treble and bass" : committed.staves[0]}.`);
    persistOutsideRhythmHistory(moved.score, { ...captureState, cursor: moved.cursor });
    return true;
  }, [captureState, persistOutsideRhythmHistory, score]);

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

  const insertMeasure = useCallback((insertionIndex: number) => {
    if (validationActive) return false;
    if (hasPending(pending) && !confirmDiscardPending()) return false;
    const inserted = insertStaffBuilderMeasure(score, insertionIndex);
    if (!inserted.ok) {
      if (inserted.error === "tie-crosses-boundary") setCaptureStatus(STAFF_BUILDER_TIED_BOUNDARY_INSERT_MESSAGE);
      return false;
    }
    const nextCaptureState = { ...captureState, cursor: { measureIndex: inserted.measureIndex, offsetTicks: 0 } };
    const nextRhythmState = { measureIndex: inserted.measureIndex, selectedEventId: null };
    history.record(score);
    setPending(EMPTY_PENDING);
    setCaptureStatus(`Inserted empty Measure ${inserted.measureIndex + 1}.`);
    rhythm.goToMeasure(inserted.measureIndex);
    persist(inserted.score, nextCaptureState, editorPass, nextRhythmState);
    return true;
  }, [captureState, confirmDiscardPending, editorPass, history, pending, persist, rhythm, score, validationActive]);

  const switchToRhythm = useCallback(() => {
    if (!getInitialStaffBuilderRhythmSelection(score)) return false;
    if (hasPending(pending) && !confirmDiscardPending()) return false;
    const measureIndex = captureState.cursor.measureIndex;
    const events = [...(score.measures[measureIndex]?.events ?? [])].sort((left, right) =>
      Math.abs(left.startTick - captureState.cursor.offsetTicks) - Math.abs(right.startTick - captureState.cursor.offsetTicks)
      || left.startTick - right.startTick
      || (left.staff === right.staff ? 0 : left.staff === "treble" ? -1 : 1)
      || left.id.localeCompare(right.id));
    const selection = events[0] ? { measureIndex, eventId: events[0].id } : null;
    const nextRhythmState = { measureIndex, selectedEventId: selection?.eventId ?? null };
    setPending(EMPTY_PENDING);
    if (selection) rhythm.setSelection(selection);
    else rhythm.goToMeasure(measureIndex);
    persist(score, captureState, "rhythm", nextRhythmState);
    return true;
  }, [captureState, confirmDiscardPending, pending, persist, rhythm, score]);

  const selectRhythmEventFromScore = useCallback((selection: StaffBuilderEventSelection) => {
    if (validationActive || !score.measures[selection.measureIndex]?.events.some(({ id }) => id === selection.eventId)) return false;
    if (editorPass === "capture" && hasPending(pending) && !confirmDiscardPending()) return false;
    const nextRhythmState = selectionToState(selection);
    setPending(EMPTY_PENDING);
    rhythm.setSelection(selection);
    persist(score, captureState, "rhythm", nextRhythmState);
    return true;
  }, [captureState, confirmDiscardPending, editorPass, pending, persist, rhythm, score, selectionToState, validationActive]);

  const switchToCapture = useCallback(() => {
    const selected = rhythm.selectedEvent;
    const nextCursor = selected && rhythm.selection
      ? { measureIndex: rhythm.selection.measureIndex, offsetTicks: selected.startTick }
      : { measureIndex: rhythm.measureIndex, offsetTicks: rhythm.measureIndex === captureState.cursor.measureIndex ? captureState.cursor.offsetTicks : 0 };
    persist(score, { ...captureState, cursor: nextCursor }, "capture", { measureIndex: rhythm.measureIndex, selectedEventId: rhythm.selection?.eventId ?? null });
  }, [captureState, persist, rhythm.measureIndex, rhythm.selectedEvent, rhythm.selection, score]);

  const captureRestAsNote = useCallback((selection: StaffBuilderEventSelection) => {
    const event = score.measures[selection.measureIndex]?.events.find(({ id }) => id === selection.eventId);
    if (!event || event.kind !== "rest") return false;
    if (hasPending(pending) && !confirmDiscardPending()) return false;
    const supportedStep = event.rhythm.status === "final" && (["quarter", "eighth", "sixteenth"] as const).includes(event.rhythm.duration as StaffBuilderStepDuration)
      ? event.rhythm.duration as StaffBuilderStepDuration
      : captureState.stepDuration;
    const nextCaptureState = { ...captureState, cursor: { measureIndex: selection.measureIndex, offsetTicks: event.startTick }, stepDuration: supportedStep, inputMode: event.staff };
    setPending(EMPTY_PENDING);
    setCaptureStatus("Enter replacement pitches, then choose Lock.");
    rhythm.setSelection(selection);
    persist(score, nextCaptureState, "capture", selectionToState(selection));
    return true;
  }, [captureState, confirmDiscardPending, pending, persist, rhythm, score, selectionToState]);

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
      setValidationStatus(correction.kind === "assign-duration" ? "Assign a final duration to correct this issue." : "Shorten this event to correct the overflow.");
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
  const setTempo = useCallback((tempoBpm: number) => {
    if (!Number.isInteger(tempoBpm) || tempoBpm < 40 || tempoBpm > 240) return false;
    return applyHistoryMutation(tempoBpm === score.tempoBpm ? score : updateStaffBuilderTempo(score, tempoBpm));
  }, [applyHistoryMutation, score]);

  return {
    score,
    editorPass,
    captureState,
    positionLabel: formatStaffBuilderCapturePosition(
      resolveStaffBuilderMeasureContext(score, captureState.cursor.measureIndex).timeSignature,
      captureState.cursor.offsetTicks,
    ),
    pending,
    captureStatus,
    rhythm,
    canEnterRhythm: getInitialStaffBuilderRhythmSelection(score) !== null,
    switchToRhythm,
    selectRhythmEventFromScore,
    switchToCapture,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undo,
    redo,
    hasPending: hasPending(pending),
    setInputMode,
    setStepDuration,
    setCapturePosition,
    addMidiPitch,
    toggleVirtualPitch,
    previousPosition: () => navigate("backward"),
    nextPosition: () => navigate("forward"),
    lockAndContinue,
    addRestAndContinue,
    captureRestAsNote,
    clearCurrentEntry: () => setPending(EMPTY_PENDING),
    goToMeasure,
    insertMeasureBefore: (measureIndex: number) => insertMeasure(measureIndex),
    insertMeasureAfter: (measureIndex: number) => insertMeasure(measureIndex + 1),
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
    setTempo,
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
