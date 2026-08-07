import { useCallback, useState } from "react";
import {
  commitStaffBuilderPendingCapture,
  formatStaffBuilderCapturePosition,
  moveStaffBuilderCaptureBackward,
  moveStaffBuilderCaptureForward,
  type StaffBuilderCaptureState,
  type StaffBuilderPendingCapture,
} from "../staff-builder-capture";
import { resolveStaffBuilderMeasureContext } from "../staff-builder-score";
import type { StaffBuilderScoreV1, StaffBuilderStaff } from "../staff-builder-types";
import type { StaffBuilderStepDuration } from "../staff-builder-time";

const EMPTY_PENDING: StaffBuilderPendingCapture = { treble: [], bass: [] };

function scoreRevision(score: StaffBuilderScoreV1): string {
  return `${score.id}:${score.updatedAt}:${score.title}`;
}

function hasPending(pending: StaffBuilderPendingCapture): boolean {
  return pending.treble.length > 0 || pending.bass.length > 0;
}

function toggleSorted(values: readonly number[], midiNumber: number): readonly number[] {
  if (values.includes(midiNumber)) return values.filter((value) => value !== midiNumber);
  return [...values, midiNumber].sort((a, b) => a - b);
}

export function useStaffBuilderEditor({ score: initialScore, initialCaptureState, onDraftChange, confirmDiscardPending = () => window.confirm("Discard pending pitches and move to another position?") }: Readonly<{
  score: StaffBuilderScoreV1;
  initialCaptureState: StaffBuilderCaptureState;
  onDraftChange: (score: StaffBuilderScoreV1, captureState: StaffBuilderCaptureState) => unknown;
  confirmDiscardPending?: () => boolean;
}>) {
  const [score, setScore] = useState(initialScore);
  const initialRevision = scoreRevision(initialScore);
  const [sourceRevision, setSourceRevision] = useState(initialRevision);
  const [captureState, setCaptureState] = useState(initialCaptureState);
  const [pending, setPending] = useState<StaffBuilderPendingCapture>(EMPTY_PENDING);

  if (initialRevision !== sourceRevision) {
    setSourceRevision(initialRevision);
    setScore(initialScore);
  }

  const persist = useCallback((nextScore: StaffBuilderScoreV1, nextCaptureState: StaffBuilderCaptureState) => {
    setScore(nextScore);
    setCaptureState(nextCaptureState);
    onDraftChange(nextScore, nextCaptureState);
  }, [onDraftChange]);

  const setActiveStaff = useCallback((activeStaff: StaffBuilderStaff) => {
    if (activeStaff === captureState.activeStaff) return;
    const next = { ...captureState, activeStaff };
    persist(score, next);
  }, [captureState, persist, score]);

  const setStepDuration = useCallback((stepDuration: StaffBuilderStepDuration) => {
    if (stepDuration === captureState.stepDuration) return;
    const next = { ...captureState, stepDuration };
    persist(score, next);
  }, [captureState, persist, score]);

  const addMidiPitch = useCallback((midiNumber: number) => {
    setPending((current) => {
      const staff = captureState.activeStaff;
      if (current[staff].includes(midiNumber)) return current;
      return { ...current, [staff]: [...current[staff], midiNumber].sort((a, b) => a - b) };
    });
  }, [captureState.activeStaff]);

  const toggleVirtualPitch = useCallback((midiNumber: number) => {
    setPending((current) => {
      const staff = captureState.activeStaff;
      return { ...current, [staff]: toggleSorted(current[staff], midiNumber) };
    });
  }, [captureState.activeStaff]);

  const navigate = useCallback((direction: "forward" | "backward") => {
    if (direction === "backward") {
      const cursor = moveStaffBuilderCaptureBackward(score, captureState.cursor, captureState.stepDuration);
      if (cursor === captureState.cursor) return false;
      if (hasPending(pending) && !confirmDiscardPending()) return false;
      setPending(EMPTY_PENDING);
      persist(score, { ...captureState, cursor });
      return true;
    }
    if (hasPending(pending) && !confirmDiscardPending()) return false;
    const moved = moveStaffBuilderCaptureForward(score, captureState.cursor, captureState.stepDuration);
    setPending(EMPTY_PENDING);
    persist(moved.score, { ...captureState, cursor: moved.cursor });
    return true;
  }, [captureState, confirmDiscardPending, pending, persist, score]);

  const lockAndContinue = useCallback(() => {
    const committed = commitStaffBuilderPendingCapture(score, captureState.cursor, pending);
    const moved = moveStaffBuilderCaptureForward(committed, captureState.cursor, captureState.stepDuration);
    setPending(EMPTY_PENDING);
    persist(moved.score, { ...captureState, cursor: moved.cursor });
  }, [captureState, pending, persist, score]);

  return {
    score,
    captureState,
    positionLabel: formatStaffBuilderCapturePosition(
      resolveStaffBuilderMeasureContext(score, captureState.cursor.measureIndex).timeSignature,
      captureState.cursor.offsetTicks,
    ),
    pending,
    hasPending: hasPending(pending),
    setActiveStaff,
    setStepDuration,
    addMidiPitch,
    toggleVirtualPitch,
    previousPosition: () => navigate("backward"),
    nextPosition: () => navigate("forward"),
    lockAndContinue,
    clearCurrentEntry: () => setPending(EMPTY_PENDING),
  };
}
