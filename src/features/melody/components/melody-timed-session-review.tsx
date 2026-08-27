import { forwardRef, type Ref } from "react";

import {
  getMelodyContinuousTrialLatestResult,
  getMelodyContinuousTrialRetryCount,
  getMelodyContinuousTrialsNeedingReview,
  getNextMelodyContinuousTrialNeedingReviewId,
  isMelodyContinuousTrialMastered,
  summarizeMelodyContinuousPractice,
  type MelodyContinuousDiagnosticTrial,
  type MelodyContinuousDurationMinutes,
} from "../melody-continuous-practice";
import {
  getMelodyIntervalAccessibleLabel,
  getMelodyIntervalSemanticKey,
  getMelodyIntervalShortLabel,
  summarizeMelodyRepairIntervals,
  summarizeMelodySightReadIntervals,
  type MelodyIntervalReport,
  type MelodyIntervalStatistic,
} from "../melody-interval-statistics";
import type { MelodyAttemptResult } from "../melody-scoring";
import { MelodyResultDetail, MelodyResultMetrics } from "./melody-result-detail";

export type MelodyReviewFilter = "all" | "needs-review";
export type MelodyReviewResultView = "original" | "latest";

type MelodyTimedSessionReviewProps = Readonly<{
  durationMinutes: MelodyContinuousDurationMinutes;
  filter: MelodyReviewFilter;
  interrupted: boolean;
  pinnedTrialId: string | null;
  resultView: MelodyReviewResultView;
  selectedTrialId: string | null;
  trialHeadingRef?: Ref<HTMLHeadingElement>;
  trials: readonly MelodyContinuousDiagnosticTrial[];
  onFilterChange: (filter: MelodyReviewFilter) => void;
  onNewTimedSession: () => void;
  onNextNeedsReview: (trialId: string) => void;
  onResultViewChange: (view: MelodyReviewResultView) => void;
  onRetryTrial: (trialId: string) => void;
  onReviewMistakes: () => void;
  onSelectTrial: (trialId: string) => void;
  onSettings: () => void;
}>;

function formatMovement(result: MelodyAttemptResult): string {
  return result.movementScorePercent === null
    ? "Not enough notes"
    : `${result.movementScorePercent}%`;
}

function findNavigationTrial(
  candidates: readonly MelodyContinuousDiagnosticTrial[],
  selected: MelodyContinuousDiagnosticTrial,
  direction: "previous" | "next",
): MelodyContinuousDiagnosticTrial | null {
  const selectedIndex = candidates.findIndex(({ id }) => id === selected.id);
  if (selectedIndex >= 0) {
    return candidates[selectedIndex + (direction === "previous" ? -1 : 1)] ?? null;
  }
  const eligible = candidates.filter(({ originalOrder }) => direction === "previous"
    ? originalOrder < selected.originalOrder
    : originalOrder > selected.originalOrder);
  return direction === "previous" ? eligible.at(-1) ?? null : eligible[0] ?? null;
}

function IntervalStatisticRow({ repair, statistic }: Readonly<{
  repair: boolean;
  statistic: MelodyIntervalStatistic;
}>) {
  const percentage = Math.round(statistic.errorRate * 100);
  const opportunityLabel = repair ? "retry opportunities" : "opportunities";
  const statusLabel = statistic.sampleStatus === "recurring" ? "Recurring" : statistic.sampleStatus === "limited-sample" ? "Limited sample" : "Strong";
  const accessibleLabel = `${getMelodyIntervalAccessibleLabel(statistic.interval)}. ${statistic.errors} ${statistic.errors === 1 ? "error" : "errors"} out of ${statistic.opportunities} ${opportunityLabel}. ${percentage} percent error rate. ${statusLabel}.`;
  return <li
    aria-label={accessibleLabel}
    className="melody-interval-statistic"
    key={getMelodyIntervalSemanticKey(statistic.interval)}
  >
    <span aria-hidden="true" className="font-semibold">{getMelodyIntervalShortLabel(statistic.interval)}</span>
    <span aria-hidden="true">{statistic.errors} {statistic.errors === 1 ? "error" : "errors"} / {statistic.opportunities} {opportunityLabel}</span>
    <span aria-hidden="true">{percentage}%</span>
    <span aria-hidden="true">{statusLabel}</span>
  </li>;
}

function IntervalDatasetReport({ kind, report }: Readonly<{
  kind: "sight-read" | "repair";
  report: MelodyIntervalReport;
}>) {
  const repair = kind === "repair";
  const title = repair ? "Repair" : "Sight Read";
  const firstAttention = report.needsAttention.slice(0, 3);
  const remainingAttention = report.needsAttention.slice(3);
  return <section className="space-y-3">
    <h4>{title}</h4>
    {report.needsAttention.length === 0
      ? <p>{repair ? "No repair interval errors." : "No sight-read interval errors."}</p>
      : <section className="space-y-2">
        <h5>Needs Attention</h5>
        <ul className="melody-interval-statistics-list space-y-2">
          {firstAttention.map((statistic) => <IntervalStatisticRow key={getMelodyIntervalSemanticKey(statistic.interval)} repair={repair} statistic={statistic} />)}
        </ul>
        {remainingAttention.length > 0 && <details>
          <summary>Show all</summary>
          <ul className="melody-interval-statistics-list mt-2 space-y-2">
            {remainingAttention.map((statistic) => <IntervalStatisticRow key={getMelodyIntervalSemanticKey(statistic.interval)} repair={repair} statistic={statistic} />)}
          </ul>
        </details>}
      </section>}
    {report.strong.length > 0 && <details>
      <summary>Strong {repair ? "Repair" : "Sight Read"} intervals</summary>
      <ul className="melody-interval-statistics-list mt-2 space-y-2">
        {report.strong.map((statistic) => <IntervalStatisticRow key={getMelodyIntervalSemanticKey(statistic.interval)} repair={repair} statistic={statistic} />)}
      </ul>
    </details>}
  </section>;
}

export const MelodyTimedSessionReview = forwardRef<
  HTMLHeadingElement,
  MelodyTimedSessionReviewProps
>(function MelodyTimedSessionReview({
  durationMinutes,
  filter,
  interrupted,
  pinnedTrialId,
  resultView,
  selectedTrialId,
  trialHeadingRef,
  trials,
  onFilterChange,
  onNewTimedSession,
  onNextNeedsReview,
  onResultViewChange,
  onRetryTrial,
  onReviewMistakes,
  onSelectTrial,
  onSettings,
}, ref) {
  const orderedTrials = [...trials].sort(
    (left, right) => left.originalOrder - right.originalOrder,
  );
  const summary = summarizeMelodyContinuousPractice(orderedTrials);
  const sightReadIntervalReport = summarizeMelodySightReadIntervals(orderedTrials);
  const repairIntervalReport = summarizeMelodyRepairIntervals(orderedTrials);
  const hasRepairEvidence = orderedTrials.some(({ retryResults }) => retryResults.length > 0);
  const needsReview = getMelodyContinuousTrialsNeedingReview(orderedTrials);
  const selectedTrial = orderedTrials.find(({ id }) => id === selectedTrialId) ?? null;
  const candidates = filter === "all" ? orderedTrials : needsReview;
  const previousTrial = selectedTrial
    ? findNavigationTrial(candidates, selectedTrial, "previous")
    : null;
  const nextTrial = selectedTrial
    ? findNavigationTrial(candidates, selectedTrial, "next")
    : null;
  const nextNeedsReviewId = selectedTrial
    ? getNextMelodyContinuousTrialNeedingReviewId(orderedTrials, selectedTrial.id)
    : null;
  const retryCount = selectedTrial
    ? getMelodyContinuousTrialRetryCount(selectedTrial)
    : 0;
  const latestResult = selectedTrial
    ? getMelodyContinuousTrialLatestResult(selectedTrial)
    : null;
  const detailedResult = selectedTrial
    ? resultView === "latest" && retryCount > 0
      ? latestResult
      : selectedTrial.originalResult
    : null;

  return (
    <section className="melody-timed-session-review space-y-5">
      <header className="space-y-2">
        <h2 ref={ref} tabIndex={-1}>
          {interrupted ? "Session interrupted" : "Timed Melody Session Review"}
        </h2>
        {interrupted && <p>Completed trials were preserved; interrupted trial was not recorded.</p>}
      </header>

      <section aria-labelledby="melody-review-overview-title" className="space-y-3">
        <h3 id="melody-review-overview-title">Session overview</h3>
        <div className="melody-review-overview-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article><h4>Timed practice</h4><strong>{durationMinutes}:00</strong></article>
          <article><h4>Diagnostic trials</h4><strong>{summary.trialsCompleted}</strong></article>
          <article><h4>Initially pitch-perfect</h4><strong>{summary.initiallyPitchPerfectTrials}</strong></article>
          <article><h4>Currently mastered</h4><strong>{summary.currentlyMasteredTrials}</strong></article>
          <article><h4>Mastered through repair</h4><strong>{summary.trialsMasteredThroughRepair}</strong></article>
          <article><h4>Review retries</h4><strong>{summary.totalReviewRetries}</strong></article>
          <article><h4>Original Pitch average</h4><strong>{summary.averagePitch === null ? "No completed trials" : `${summary.averagePitch}%`}</strong></article>
          <article><h4>Original Movement average</h4><strong>{summary.averageMovement === null ? "Not enough notes" : `${summary.averageMovement}%`}</strong></article>
          <article><h4>Original Timing average</h4><strong>{summary.averageTiming === null ? "No completed trials" : `${summary.averageTiming}%`}</strong></article>
        </div>
        {summary.allTrialsMastered
          ? <p className="font-semibold text-emerald-300">All diagnostic trials mastered</p>
          : summary.needsReviewTrials > 0
            ? <button className="min-h-11 rounded-lg border border-sky-400 px-4 py-2 font-semibold text-sky-100" onClick={onReviewMistakes} type="button">Review mistakes</button>
            : null}
      </section>

      {orderedTrials.length > 0 && <section aria-labelledby="melody-interval-trouble-title" className="melody-interval-trouble space-y-4">
        <h3 id="melody-interval-trouble-title">Interval Trouble</h3>
        <IntervalDatasetReport kind="sight-read" report={sightReadIntervalReport} />
        {hasRepairEvidence && <IntervalDatasetReport kind="repair" report={repairIntervalReport} />}
      </section>}

      {orderedTrials.length === 0
        ? <p>No diagnostic trials were completed.</p>
        : selectedTrial && detailedResult && latestResult
          ? <section className="melody-review-trial space-y-4" data-pinned={pinnedTrialId === selectedTrial.id || undefined}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div aria-label="Review trial filter" className="flex gap-2" role="group">
                <button aria-pressed={filter === "all"} className="min-h-11 rounded-lg border border-zinc-600 px-3 py-2" onClick={() => onFilterChange("all")} type="button">All</button>
                <button aria-pressed={filter === "needs-review"} className="min-h-11 rounded-lg border border-zinc-600 px-3 py-2" onClick={() => onFilterChange("needs-review")} type="button">Needs Review</button>
              </div>
              <div className="flex gap-2">
                <button aria-label="Previous trial" className="min-h-11 rounded-lg border border-zinc-600 px-3 py-2" disabled={!previousTrial} onClick={() => previousTrial && onSelectTrial(previousTrial.id)} type="button">Previous</button>
                <button aria-label="Next trial" className="min-h-11 rounded-lg border border-zinc-600 px-3 py-2" disabled={!nextTrial} onClick={() => nextTrial && onSelectTrial(nextTrial.id)} type="button">Next</button>
              </div>
            </div>

            <header className="space-y-1">
              <p>Diagnostic trial {selectedTrial.originalOrder} of {orderedTrials.length}</p>
              <h3 ref={trialHeadingRef} tabIndex={-1}>Trial {selectedTrial.originalOrder} result</h3>
              <p className="font-semibold">{isMelodyContinuousTrialMastered(selectedTrial) ? "Mastered" : "Needs Review"}</p>
              {pinnedTrialId === selectedTrial.id && <p>Repair complete. This trial remains selected.</p>}
              <p>Original + {retryCount} {retryCount === 1 ? "retry" : "retries"}</p>
            </header>

            <div className="melody-review-comparison grid gap-4 lg:grid-cols-2">
              <section aria-labelledby="melody-review-original-metrics" className="space-y-2">
                <h4 id="melody-review-original-metrics">Original Sight Read</h4>
                <MelodyResultMetrics headingLevel={5} result={selectedTrial.originalResult} />
              </section>
              {retryCount > 0 && <section aria-labelledby="melody-review-latest-metrics" className="space-y-2">
                <h4 id="melody-review-latest-metrics">Latest Retry</h4>
                <MelodyResultMetrics headingLevel={5} result={latestResult} />
              </section>}
            </div>

            {retryCount > 0 && <div aria-label="Detailed result" className="flex gap-2" role="group">
              <button aria-pressed={resultView === "original"} className="min-h-11 rounded-lg border border-zinc-600 px-3 py-2" onClick={() => onResultViewChange("original")} type="button">Original</button>
              <button aria-pressed={resultView === "latest"} className="min-h-11 rounded-lg border border-zinc-600 px-3 py-2" onClick={() => onResultViewChange("latest")} type="button">Latest</button>
            </div>}

            <MelodyResultDetail exercise={selectedTrial.exercise} result={detailedResult} />

            {retryCount > 0 && <section aria-labelledby="melody-retry-history-title" className="space-y-2">
              <h4 id="melody-retry-history-title">Retry history</h4>
              <ol className="space-y-1">
                {selectedTrial.retryResults.map((retry, index) => <li key={index}>
                  Retry {index + 1} — Pitch {retry.pitchScorePercent}% · Movement {formatMovement(retry)} · Timing {retry.timingScorePercent}%
                </li>)}
              </ol>
            </section>}

            <div className="melody-review-actions flex flex-wrap gap-2">
              <button className="min-h-11 rounded-lg bg-sky-400 px-4 py-2 font-bold text-zinc-950" onClick={() => onRetryTrial(selectedTrial.id)} type="button">Retry This Melody</button>
              <button className="min-h-11 rounded-lg border border-sky-400 px-4 py-2 font-semibold text-sky-100" disabled={!nextNeedsReviewId} onClick={() => nextNeedsReviewId && onNextNeedsReview(selectedTrial.id)} type="button">Next Needs Review</button>
            </div>
          </section>
          : <p>No selected diagnostic trial is available.</p>}

      <div className="melody-review-session-actions flex flex-wrap gap-2">
        <button className="min-h-11 rounded-lg bg-sky-400 px-4 py-2 font-bold text-zinc-950" onClick={onNewTimedSession} type="button">New Timed Session</button>
        <button className="min-h-11 rounded-lg border border-zinc-600 px-3 py-2" onClick={onSettings} type="button">Settings</button>
      </div>
    </section>
  );
});
