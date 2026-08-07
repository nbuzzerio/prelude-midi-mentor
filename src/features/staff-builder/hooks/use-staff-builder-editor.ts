import { useCallback, useState } from "react";
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
import { resolveStaffBuilderMeasureContext } from "../staff-builder-score";
import { getInitialStaffBuilderRhythmSelection, reconcileStaffBuilderEventSelection, type StaffBuilderEventSelection, type StaffBuilderRhythmState } from "../staff-builder-rhythm";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import type { StaffBuilderStepDuration } from "../staff-builder-time";
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

export function useStaffBuilderEditor({ score: initialScore, initialCaptureState, initialEditorPass = "capture", initialRhythmState = { measureIndex: 0, selectedEventId: null }, onDraftChange, confirmDiscardPending = () => window.confirm("Discard pending pitches and switch editor passes?") }: Readonly<{
  score: StaffBuilderScoreV1;
  initialCaptureState: StaffBuilderCaptureState;
  initialEditorPass?: StaffBuilderEditorPass;
  initialRhythmState?: StaffBuilderRhythmState;
  onDraftChange: (score: StaffBuilderScoreV1, editorState: StaffBuilderPersistedEditorState) => unknown;
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
    return true;
  }, [captureState, editorPass, history, persist, rhythm, score, selectionToState]);

  const redo = useCallback(() => {
    const restored = history.redo(score);
    if (!restored) return false;
    const selection = reconcileStaffBuilderEventSelection(restored, rhythm.selection);
    rhythm.setSelection(selection);
    persist(restored, captureState, editorPass, selectionToState(selection));
    return true;
  }, [captureState, editorPass, history, persist, rhythm, score, selectionToState]);

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
  };
}
