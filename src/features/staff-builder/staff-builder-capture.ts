import {
  appendStaffBuilderMeasure,
  insertStaffBuilderNotes,
  resolveStaffBuilderMeasureContext,
  type StaffBuilderFactories,
} from "./staff-builder-score";
import {
  moveStaffBuilderPositionBackward,
  moveStaffBuilderPositionForward,
  stepDurationToTicks,
  type StaffBuilderPosition,
  type StaffBuilderStepDuration,
  type StaffBuilderTimeSignature,
} from "./staff-builder-time";
import type { StaffBuilderScoreV1, StaffBuilderStaff } from "./staff-builder-types";

export type StaffBuilderCaptureState = Readonly<{
  cursor: StaffBuilderPosition;
  stepDuration: StaffBuilderStepDuration;
  inputMode: StaffBuilderCaptureInputMode;
}>;

export type StaffBuilderCaptureInputMode = "grand" | StaffBuilderStaff;

export type StaffBuilderPendingCapture = Readonly<Record<StaffBuilderStaff, readonly number[]>>;

export const DEFAULT_STAFF_BUILDER_CAPTURE_STATE: StaffBuilderCaptureState = {
  cursor: { measureIndex: 0, offsetTicks: 0 },
  stepDuration: "quarter",
  inputMode: "grand",
};

export function routeStaffBuilderCapturePitch(inputMode: StaffBuilderCaptureInputMode, midiNumber: number): StaffBuilderStaff {
  if (inputMode === "grand") return midiNumber < 60 ? "bass" : "treble";
  return inputMode;
}

export function getStaffBuilderMeasureCapacities(score: StaffBuilderScoreV1): readonly number[] {
  return score.measures.map((_measure, measureIndex) => resolveStaffBuilderMeasureContext(score, measureIndex).capacityTicks);
}

export type StaffBuilderCursorMove = Readonly<{
  score: StaffBuilderScoreV1;
  cursor: StaffBuilderPosition;
  appendedMeasure: boolean;
}>;

export function formatStaffBuilderCapturePosition(timeSignature: StaffBuilderTimeSignature, offsetTicks: number): string {
  if (!Number.isInteger(offsetTicks) || offsetTicks < 0) throw new Error("Capture position must use non-negative integer ticks.");
  if (timeSignature === "6/8") {
    const eighthPosition = Math.floor(offsetTicks / 240) + 1;
    const subdivision = offsetTicks % 240 === 0 ? "" : ", second sixteenth-note position";
    return `Eighth-note position ${eighthPosition}${subdivision} (compound meter; tick ${offsetTicks})`;
  }
  const beat = Math.floor(offsetTicks / 480) + 1;
  const subdivision = offsetTicks % 480;
  const subdivisionLabel = subdivision === 0
    ? " (quarter-note beat; "
    : subdivision === 240
      ? ", eighth-note subdivision ("
      : `, ${subdivision === 120 ? "second" : "fourth"} sixteenth-note position (`;
  return `Beat ${beat}${subdivisionLabel}tick ${offsetTicks})`;
}

export function moveStaffBuilderCaptureForward(
  score: StaffBuilderScoreV1,
  cursor: StaffBuilderPosition,
  stepDuration: StaffBuilderStepDuration,
  factories?: StaffBuilderFactories,
): StaffBuilderCursorMove {
  const capacities = getStaffBuilderMeasureCapacities(score);
  const capacity = capacities[cursor.measureIndex];
  if (capacity === undefined) throw new Error(`Unknown measure index ${cursor.measureIndex}.`);
  const crossesMeasure = cursor.offsetTicks + stepDurationToTicks(stepDuration) >= capacity;
  const crossesFinalMeasure = crossesMeasure && cursor.measureIndex === score.measures.length - 1;
  const nextScore = crossesFinalMeasure ? appendStaffBuilderMeasure(score, factories) : score;
  return {
    score: nextScore,
    cursor: crossesMeasure
      ? { measureIndex: cursor.measureIndex + 1, offsetTicks: 0 }
      : moveStaffBuilderPositionForward(cursor, stepDuration, capacities),
    appendedMeasure: crossesFinalMeasure,
  };
}

export function moveStaffBuilderCaptureBackward(
  score: StaffBuilderScoreV1,
  cursor: StaffBuilderPosition,
  stepDuration: StaffBuilderStepDuration,
): StaffBuilderPosition {
  if (cursor.measureIndex === 0 && cursor.offsetTicks === 0) return cursor;
  return moveStaffBuilderPositionBackward(cursor, stepDuration, getStaffBuilderMeasureCapacities(score));
}

export function commitStaffBuilderPendingCapture(
  score: StaffBuilderScoreV1,
  cursor: StaffBuilderPosition,
  pending: StaffBuilderPendingCapture,
  factories?: StaffBuilderFactories,
): StaffBuilderScoreV1 {
  let next = score;
  for (const staff of ["treble", "bass"] as const) {
    if (pending[staff].length === 0) continue;
    next = insertStaffBuilderNotes(next, {
      measureIndex: cursor.measureIndex,
      staff,
      startTick: cursor.offsetTicks,
      midiNumbers: pending[staff],
      rhythm: { status: "final", duration: "quarter" },
      factories,
    });
  }
  return next;
}
