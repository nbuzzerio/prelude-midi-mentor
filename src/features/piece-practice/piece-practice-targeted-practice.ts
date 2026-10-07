import type { PiecePracticeMeasureDiagnostic } from "./piece-practice-evidence";
import { getPiecePracticeMeasureResults, type PiecePracticeSessionState } from "./piece-practice-session";
import { samePiecePracticeInputConfiguration } from "./piece-practice-acoustic-types";

type TargetedPracticeSignal = "mistakeCount" | "skippedTargetCount" | "restartCount" | "hesitationCount";

/** PROVISIONAL product policy, not a pedagogical or musical-ability score. */
export const PIECE_PRACTICE_TARGETED_PRACTICE_PRIORITY: readonly TargetedPracticeSignal[] = Object.freeze([
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
export function selectPiecePracticeTargetedPractice(state: PiecePracticeSessionState): readonly PiecePracticeMeasureDiagnostic[] {
  return completedMeasures(state).filter(({ isProblem }) => isProblem).sort((left, right) => {
    for (const signal of PIECE_PRACTICE_TARGETED_PRACTICE_PRIORITY) {
      const difference = right[signal] - left[signal];
      if (difference !== 0) return difference;
    }
    return left.measureIndex - right.measureIndex;
  });
}

export type PiecePracticeTargetedPracticeComparison = Readonly<{
  original: PiecePracticeMeasureDiagnostic;
  focused: PiecePracticeMeasureDiagnostic;
}>;

/** The caller owns the shared immutable score snapshot; no cross-score comparison. */
export function comparePiecePracticeTargetedPractice(
  original: PiecePracticeSessionState,
  focused: PiecePracticeSessionState,
  measureIndex: number,
): PiecePracticeTargetedPracticeComparison | null {
  if (!samePiecePracticeInputConfiguration(original.inputConfiguration, focused.inputConfiguration)
    || original.assessmentFocus !== focused.assessmentFocus
    || focused.startMeasureIndex !== measureIndex || focused.endMeasureIndex !== measureIndex) return null;
  const before = completedMeasures(original).find((measure) => measure.measureIndex === measureIndex);
  const after = completedMeasures(focused).find((measure) => measure.measureIndex === measureIndex);
  if (!before || !after || before.sourceMeasureId !== after.sourceMeasureId) return null;
  return { original: before, focused: after };
}
