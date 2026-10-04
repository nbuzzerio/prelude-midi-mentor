import { useEffect, useId, useRef, useState } from "react";
import { StaffBuilderScoreView } from "@/features/staff-builder/components/staff-builder-score-view";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import { piecePracticeAssessmentLabel } from "../piece-practice-assessment";
import type { PiecePracticeMeasureDiagnostic } from "../piece-practice-evidence";
import { comparePiecePracticeTargetedPractice, selectPiecePracticeTargetedPractice, type PiecePracticeTargetedPracticeComparison } from "../piece-practice-targeted-practice";
import type { PiecePracticeSessionState } from "../piece-practice-session";

function evidenceReasons(result: PiecePracticeMeasureDiagnostic): string[] {
  return [
    result.mistakeCount ? `${result.mistakeCount} ${result.mistakeCount === 1 ? "mistake" : "mistakes"}` : null,
    result.skippedTargetCount ? `${result.skippedTargetCount} skipped ${result.skippedTargetCount === 1 ? "target" : "targets"}` : null,
    result.restartCount ? `${result.restartCount} measure ${result.restartCount === 1 ? "restart" : "restarts"}` : null,
    result.hesitationCount ? `${result.hesitationCount} recorded slow ${result.hesitationCount === 1 ? "response" : "responses"}` : null,
  ].filter((reason): reason is string => reason !== null);
}

function Counts({ label, result }: Readonly<{ label: string; result: PiecePracticeMeasureDiagnostic }>) {
  return <div className="min-w-0 rounded-lg border border-zinc-600 p-3"><h4 className="font-semibold">{label}</h4>
    <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
      <dt>Mistakes</dt><dd>{result.mistakeCount}</dd>
      <dt>Skipped targets</dt><dd>{result.skippedTargetCount}</dd>
      <dt>Measure restarts</dt><dd>{result.restartCount}</dd>
      <dt>Recorded slow responses</dt><dd>{result.hesitationCount}</dd>
    </dl>
  </div>;
}

export function PiecePracticeTargetedPracticeComparisonView({ comparison, focusedResultUnsaved = false }: Readonly<{ comparison: PiecePracticeTargetedPracticeComparison; focusedResultUnsaved?: boolean }>) {
  return <section aria-label={`Measure ${comparison.original.measureNumber} practice comparison`} className="grid gap-3">
    <h3 className="font-bold">Measure {comparison.original.measureNumber}: practice comparison</h3>
    <div className="grid gap-3 sm:grid-cols-2"><Counts label="Original run" result={comparison.original} /><Counts label="Latest completed focused run" result={comparison.focused} /></div>
    {focusedResultUnsaved && <p role="status">Focused result is not safely stored; these counts are currently available only in this visit.</p>}
    <p className="text-sm text-zinc-300">Counts include all attempts in each run. Passage starts and repetitions can differ, so these counts do not measure musical ability. Skips and restarts are process evidence; zero mistakes alone does not mean every target was played.</p>
  </section>;
}

function Recommendation({ result, score, state, disabled, onPractice, latest, latestUnsaved, focusRequested }: Readonly<{
  result: PiecePracticeMeasureDiagnostic;
  score: StaffBuilderScore;
  state: PiecePracticeSessionState;
  disabled: boolean;
  onPractice?: (measureIndex: number) => void;
  latest?: PiecePracticeSessionState;
  latestUnsaved: boolean;
  focusRequested: boolean;
}>) {
  const [showNotation, setShowNotation] = useState(false);
  const measureAvailable = score.measures[result.measureIndex]?.id === result.sourceMeasureId;
  const practiceButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (focusRequested && !disabled) practiceButton.current?.focus(); }, [focusRequested, disabled]);
  const notationId = useId();
  const comparison = latest ? comparePiecePracticeTargetedPractice(state, latest, result.measureIndex) : null;
  return <li className="grid min-w-0 gap-3 rounded-lg border border-zinc-600 p-3">
    <h3 className="text-lg font-semibold">Measure {result.measureNumber}</h3>
    <p>Recorded in the original run: {evidenceReasons(result).join("; ")}.</p>
    <div className="flex flex-wrap gap-2">
      {onPractice && <button className="min-h-11 rounded-lg bg-sky-600 px-4 py-2 font-semibold hover:bg-sky-500 disabled:opacity-50" disabled={disabled || !measureAvailable} onClick={() => onPractice(result.measureIndex)} ref={practiceButton} type="button">Practice measure {result.measureNumber}</button>}
      {measureAvailable && <button aria-controls={notationId} aria-expanded={showNotation} className="min-h-11 rounded-lg border border-zinc-500 px-3 py-2" onClick={() => setShowNotation((show) => !show)} type="button">{showNotation ? "Hide" : "View"} notation for measure {result.measureNumber}</button>}
    </div>
    {!measureAvailable && <p>This measure is unavailable in the score snapshot. Its recorded evidence is shown above.</p>}
    <div aria-label={`Measure ${result.measureNumber} notation`} className="min-w-0 overflow-x-auto" hidden={!showNotation || !measureAvailable} id={notationId} role="region" tabIndex={0}>{showNotation && measureAvailable && <StaffBuilderScoreView measureIndex={result.measureIndex} score={score} ghostedStaff={state.assessmentFocus === "upper" ? "bass" : state.assessmentFocus === "lower" ? "treble" : undefined} />}</div>
    {comparison && <PiecePracticeTargetedPracticeComparisonView comparison={comparison} focusedResultUnsaved={latestUnsaved} />}
  </li>;
}

export function PiecePracticeTargetedPractice({ state, score, disabled = false, onPractice, latestResults = [], unsavedMeasureIndices = [], focusMeasureIndex = null }: Readonly<{
  state: PiecePracticeSessionState;
  score: StaffBuilderScore;
  disabled?: boolean;
  onPractice?: (measureIndex: number) => void;
  latestResults?: readonly PiecePracticeSessionState[];
  unsavedMeasureIndices?: readonly number[];
  focusMeasureIndex?: number | null;
}>) {
  const headingId = useId();
  const recommendations = selectPiecePracticeTargetedPractice(state);
  return <section aria-labelledby={headingId} className="grid min-w-0 gap-3 rounded-xl border border-sky-700/70 p-4">
    <h2 className="text-xl font-bold" id={headingId} tabIndex={-1}>Targeted Practice</h2>
    <p>Revisit measures using evidence from this completed run. Assessment: {piecePracticeAssessmentLabel(state.assessmentFocus)}.</p>
    <details className="text-sm text-zinc-300"><summary className="min-h-11 cursor-pointer py-2 font-semibold">How measures are suggested · provisional</summary>
      <p>Higher mistake counts come first, then skipped targets, measure restarts, and recorded slow responses. Ties use score order. Measures with mistakes, skips or restarts come before measures with slow responses alone. These provisional suggestions are not difficulty or ability scores.</p>
      <p className="mt-2">Each action practices one original measure with the same Staff Focus and score snapshot. Original and focused evidence stay separate. Return navigation and comparisons last for this visit; saved attempts use ordinary Piece Practice recovery and retention.</p>
    </details>
    {state.status !== "piece-complete" ? <p>Complete this Piece Practice run to see measures to revisit.</p>
      : recommendations.length === 0 ? <p>No measures to recommend: this run recorded no mistakes, skips, measure restarts or slow-response diagnostics.</p>
        : <ol aria-label="Measures to revisit" className="grid gap-3">{recommendations.map((result) => <Recommendation disabled={disabled} focusRequested={focusMeasureIndex === result.measureIndex} key={result.sourceMeasureId} latest={latestResults.find((latest) => latest.startMeasureIndex === result.measureIndex)} latestUnsaved={unsavedMeasureIndices.includes(result.measureIndex)} onPractice={onPractice} result={result} score={score} state={state} />)}</ol>}
  </section>;
}
