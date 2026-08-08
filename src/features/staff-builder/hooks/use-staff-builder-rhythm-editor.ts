import { useCallback, useState } from "react";
import type { NoteLetter } from "@/lib/music/note-utils";
import type { StaffBuilderDuration } from "../staff-builder-time";
import type { StaffBuilderScoreV1, StaffBuilderStaff } from "../staff-builder-types";
import {
  convertStaffBuilderEventToRest,
  deleteStaffBuilderEvent,
  getInitialStaffBuilderRhythmSelection,
  getSelectedStaffBuilderEvent,
  getStaffBuilderEventSelections,
  moveStaffBuilderEventSelection,
  moveStaffBuilderEventToStaff,
  reconcileStaffBuilderEventSelection,
  respellStaffBuilderPitch,
  setStaffBuilderEventDuration,
  type StaffBuilderEventSelection,
  type StaffBuilderRhythmEditError,
  type StaffBuilderRhythmState,
} from "../staff-builder-rhythm";

const ERROR_MESSAGES: Readonly<Record<StaffBuilderRhythmEditError, string>> = {
  "staff-conflict": "The destination staff already has an event at this position.",
  "tied-event": "Tied events cannot be removed or converted until the tie-editing phase.",
  "event-missing": "The selected event is no longer available.",
  "pitch-missing": "The selected pitch is no longer available.",
  "invalid-spelling": "That spelling is not available without changing the pitch or using a double accidental.",
};

function selectionFromState(score: StaffBuilderScoreV1, state: StaffBuilderRhythmState): StaffBuilderEventSelection | null {
  const candidate = state.selectedEventId === null ? null : { measureIndex: state.measureIndex, eventId: state.selectedEventId };
  return reconcileStaffBuilderEventSelection(score, candidate);
}

function restoresEmptyMeasure(score: StaffBuilderScoreV1, state: StaffBuilderRhythmState): boolean {
  return state.selectedEventId === null && score.measures[state.measureIndex]?.events.length === 0;
}

export function useStaffBuilderRhythmEditor({ score, initialState, onMutation, onSelectionChange }: Readonly<{
  score: StaffBuilderScoreV1;
  initialState: StaffBuilderRhythmState;
  onMutation: (score: StaffBuilderScoreV1, selection: StaffBuilderEventSelection | null) => void;
  onSelectionChange: (selection: StaffBuilderEventSelection | null) => void;
}>) {
  const [selection, setSelection] = useState<StaffBuilderEventSelection | null>(() => restoresEmptyMeasure(score, initialState) ? null : selectionFromState(score, initialState));
  const [measureIndex, setMeasureIndex] = useState(initialState.measureIndex);
  const [emptyMeasureSelected, setEmptyMeasureSelected] = useState(() => restoresEmptyMeasure(score, initialState));
  const [status, setStatus] = useState<string | null>(null);
  const reconciled = emptyMeasureSelected ? null : reconcileStaffBuilderEventSelection(score, selection);
  if (reconciled?.eventId !== selection?.eventId || reconciled?.measureIndex !== selection?.measureIndex) setSelection(reconciled);
  const activeSelection = reconciled;
  const selectedEvent = getSelectedStaffBuilderEvent(score, activeSelection);
  const ordered = getStaffBuilderEventSelections(score);
  const selectedIndex = activeSelection ? ordered.findIndex((item) => item.eventId === activeSelection.eventId && item.measureIndex === activeSelection.measureIndex) : -1;

  const select = useCallback((next: StaffBuilderEventSelection | null) => {
    setSelection(next);
    setEmptyMeasureSelected(false);
    if (next) setMeasureIndex(next.measureIndex);
    setStatus(null);
    onSelectionChange(next);
  }, [onSelectionChange]);

  const apply = useCallback((result: ReturnType<typeof setStaffBuilderEventDuration>, nextSelection = activeSelection) => {
    if (!result.ok) { setStatus(ERROR_MESSAGES[result.error]); return false; }
    if (result.score === score) { setStatus(null); return false; }
    setStatus(null);
    onMutation(result.score, nextSelection);
    return true;
  }, [activeSelection, onMutation, score]);

  return {
    selection: activeSelection,
    measureIndex: activeSelection?.measureIndex ?? measureIndex,
    selectedEvent,
    selectedIndex,
    eventCount: ordered.length,
    canPrevious: selectedIndex > 0,
    canNext: selectedIndex >= 0 && selectedIndex < ordered.length - 1,
    status,
    setSelection: (next: StaffBuilderEventSelection | null) => { setSelection(next); setEmptyMeasureSelected(false); if (next) setMeasureIndex(next.measureIndex); setStatus(null); },
    goToMeasure: (nextMeasureIndex: number) => {
      const nextSelection = ordered.find((item) => item.measureIndex === nextMeasureIndex) ?? null;
      setMeasureIndex(nextMeasureIndex);
      setSelection(nextSelection);
      setEmptyMeasureSelected(nextSelection === null);
      setStatus(null);
      return nextSelection;
    },
    selectInitial: () => select(getInitialStaffBuilderRhythmSelection(score)),
    previousEvent: () => activeSelection && select(moveStaffBuilderEventSelection(score, activeSelection, "previous")),
    nextEvent: () => activeSelection && select(moveStaffBuilderEventSelection(score, activeSelection, "next")),
    assignDuration: (duration: StaffBuilderDuration) => activeSelection ? apply(setStaffBuilderEventDuration(score, activeSelection, duration)) : false,
    convertToRest: (duration: StaffBuilderDuration) => activeSelection ? apply(convertStaffBuilderEventToRest(score, activeSelection, duration)) : false,
    moveToStaff: (staff: StaffBuilderStaff) => activeSelection ? apply(moveStaffBuilderEventToStaff(score, activeSelection, staff)) : false,
    respellPitch: (pitchId: string, letter: NoteLetter) => activeSelection ? apply(respellStaffBuilderPitch(score, activeSelection, pitchId, letter)) : false,
    deleteEvent: () => {
      if (!activeSelection) return false;
      const deleted = deleteStaffBuilderEvent(score, activeSelection);
      if (!deleted.result.ok) { setStatus(ERROR_MESSAGES[deleted.result.error]); return false; }
      setSelection(deleted.selection);
      setStatus(null);
      onMutation(deleted.result.score, deleted.selection);
      return true;
    },
  };
}
