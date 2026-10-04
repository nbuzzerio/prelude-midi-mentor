import type { PiecePracticeMeasureDiagnostic } from "./piece-practice-evidence";
import { getPiecePracticeMeasureResults, type PiecePracticeSessionState } from "./piece-practice-session";

type ImproveSignal = "mistakeCount" | "skippedTargetCount" | "restartCount" | "hesitationCount";

/** PROVISIONAL product policy, not a pedagogical or musical-ability score. */
export const PIECE_PRACTICE_IMPROVE_PRIORITY: readonly ImproveSignal[] = Object.freeze([
  "mistakeCount", "skippedTargetCount", "restartCount", "hesitationCount",
]);

function completedMeasures(state: PiecePracticeSessionState): readonly PiecePracticeMeasureDiagnostic[] {
  if (state.status !== "piece-complete") return [];
  return getPiecePracticeMeasureResults(state).filter(({ measureIndex }) =>
    measureIndex >= state.startMeasureIndex
    && (state.endMeasureIndex === null || measureIndex <= state.endMeasureIndex)
    && state.completedMeasureIndexes.includes(measureIndex));
}

/** Native evidence only; all ties use original score order, never elapsed time. */
export function selectPiecePracticeImprove(state: PiecePracticeSessionState): readonly PiecePracticeMeasureDiagnostic[] {
  return completedMeasures(state).filter(({ isProblem }) => isProblem).sort((left, right) => {
    for (const signal of PIECE_PRACTICE_IMPROVE_PRIORITY) {
      const difference = right[signal] - left[signal];
      if (difference !== 0) return difference;
    }
    return left.measureIndex - right.measureIndex;
  });
}

export type PiecePracticeImproveComparison = Readonly<{
  original: PiecePracticeMeasureDiagnostic;
  focused: PiecePracticeMeasureDiagnostic;
}>;

/** The caller owns the shared immutable score snapshot; no cross-score comparison. */
export function comparePiecePracticeImprove(
  original: PiecePracticeSessionState,
  focused: PiecePracticeSessionState,
  measureIndex: number,
): PiecePracticeImproveComparison | null {
  if (original.assessmentFocus !== focused.assessmentFocus
    || focused.startMeasureIndex !== measureIndex || focused.endMeasureIndex !== measureIndex) return null;
  const before = completedMeasures(original).find((measure) => measure.measureIndex === measureIndex);
  const after = completedMeasures(focused).find((measure) => measure.measureIndex === measureIndex);
  if (!before || !after || before.sourceMeasureId !== after.sourceMeasureId) return null;
  return { original: before, focused: after };
}
