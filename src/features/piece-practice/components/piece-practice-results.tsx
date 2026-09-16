import { useEffect, useMemo, useRef, useState } from "react";
import { StaffBuilderPrintScore } from "@/features/staff-builder/components/staff-builder-print-score";
import { StaffBuilderScoreView, type StaffBuilderDiagnosticHighlight } from "@/features/staff-builder/components/staff-builder-score-view";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import {
  formatPiecePracticeMidiPitch,
  formatPiecePracticeWrittenPitch,
  type PiecePracticeMistakeEvidence,
} from "../piece-practice-evidence";
import { getPiecePracticeMeasureResults, type PiecePracticeSessionState } from "../piece-practice-session";

type ReportOptions = Readonly<{
  scope: "problems" | "excerpt";
  sessionSummary: boolean;
  notation: boolean;
  mistakeHighlights: boolean;
  hesitationHighlights: boolean;
  chronologicalMistakes: boolean;
  measureTimes: boolean;
}>;

const DEFAULT_REPORT_OPTIONS: ReportOptions = {
  scope: "problems",
  sessionSummary: true,
  notation: true,
  mistakeHighlights: true,
  hesitationHighlights: true,
  chronologicalMistakes: true,
  measureTimes: true,
};

const seconds = (milliseconds: number) => `${(milliseconds / 1_000).toFixed(1)}s`;

function mistakeText(evidence: PiecePracticeMistakeEvidence) {
  const expected = evidence.expectedPitches.map(formatPiecePracticeWrittenPitch).join(", ") || "None";
  if (evidence.kind === "normal-attempt") return {
    expected,
    played: evidence.receivedMidiNumbers.map(formatPiecePracticeMidiPitch).join(", ") || "No new notes",
    missing: evidence.missingMidiNumbers.map((midiNumber) => evidence.expectedPitches.find((pitch) => pitch.midiNumber === midiNumber)).map((pitch, index) => pitch ? formatPiecePracticeWrittenPitch(pitch) : formatPiecePracticeMidiPitch(evidence.missingMidiNumbers[index]!)),
    extra: evidence.extraMidiNumbers.map(formatPiecePracticeMidiPitch),
    held: evidence.unexpectedHeldMidiNumbers.map(formatPiecePracticeMidiPitch),
    label: "Unsuccessful attempt",
  };
  if (evidence.kind === "rolled-unexpected-pitch") return {
    expected,
    played: formatPiecePracticeMidiPitch(evidence.receivedMidiNumber),
    missing: [], extra: [formatPiecePracticeMidiPitch(evidence.receivedMidiNumber)], held: [],
    label: "Unexpected pitch during rolled chord",
  };
  return {
    expected,
    played: evidence.accumulatedMidiNumbers.map(formatPiecePracticeMidiPitch).join(", ") || "No completed roll",
    missing: evidence.missingMidiNumbers.map((midiNumber) => evidence.expectedPitches.find((pitch) => pitch.midiNumber === midiNumber)).map((pitch, index) => pitch ? formatPiecePracticeWrittenPitch(pitch) : formatPiecePracticeMidiPitch(evidence.missingMidiNumbers[index]!)), extra: [], held: [],
    label: "Rolled chord timed out",
  };
}

function diagnosticHighlights(state: PiecePracticeSessionState, measureIndex: number): readonly StaffBuilderDiagnosticHighlight[] {
  const counts = new Map<string, StaffBuilderDiagnosticHighlight & { count: number }>();
  const add = (highlight: StaffBuilderDiagnosticHighlight) => {
    const key = `${highlight.kind}:${highlight.eventId}:${highlight.pitchId ?? "target"}`;
    counts.set(key, { ...highlight, count: (counts.get(key)?.count ?? 0) + 1 });
  };
  state.mistakeEvidence.filter((item) => item.measureIndex === measureIndex).forEach((item) => {
    const missing = item.kind === "rolled-unexpected-pitch" ? [] : item.missingMidiNumbers;
    const mapped = item.expectedPitches.filter(({ midiNumber }) => missing.includes(midiNumber));
    mapped.forEach(({ sourceEventId, sourcePitchId }) => add({ kind: "mistake", eventId: sourceEventId, pitchId: sourcePitchId }));
    const hasUnmappedFailure = mapped.length === 0 || item.kind === "rolled-unexpected-pitch"
      || (item.kind === "normal-attempt" && (item.extraMidiNumbers.length > 0 || item.unexpectedHeldMidiNumbers.length > 0));
    if (hasUnmappedFailure && item.expectedPitches[0]) add({ kind: "mistake", eventId: item.expectedPitches[0].sourceEventId });
  });
  state.targetTimings.filter((item) => item.measureIndex === measureIndex && item.isHesitation).forEach((item) => {
    if (item.sourceEventIds[0]) add({ kind: "hesitation", eventId: item.sourceEventIds[0] });
  });
  return [...counts.values()];
}

function MistakeList({ evidence }: Readonly<{ evidence: readonly PiecePracticeMistakeEvidence[] }>) {
  return <ol className="piece-practice-mistake-list">
    {evidence.map((item, index) => {
      const text = mistakeText(item);
      return <li key={item.sequence}><strong>Mistake {index + 1}: {text.label}</strong><p>Expected: {text.expected}</p><p>Played: {text.played}</p>{text.missing.length ? <p>Missing: {text.missing.join(", ")}</p> : null}{text.extra.length ? <p>Extra: {text.extra.join(", ")}</p> : null}{text.held.length ? <p>Unexpected held: {text.held.join(", ")}</p> : null}</li>;
    })}
  </ol>;
}

function ResultMeasure({ displayScore, measureIndex, state, showDetails = true }: Readonly<{ displayScore: StaffBuilderScore; measureIndex: number; state: PiecePracticeSessionState; showDetails?: boolean }>) {
  const result = getPiecePracticeMeasureResults(state).find((item) => item.measureIndex === measureIndex)!;
  const mistakes = state.mistakeEvidence.filter((item) => item.measureIndex === measureIndex);
  const hesitations = state.targetTimings.filter((item) => item.measureIndex === measureIndex && item.isHesitation);
  const highlights = diagnosticHighlights(state, measureIndex);
  return <article className="piece-practice-result-detail">
    <p className="sr-only">Measure {result.measureNumber} diagnostic detail.</p>
    {showDetails ? <><p className="sr-only">Red markers identify mistake evidence. Amber dashed markers identify slow responses. Marker tallies show repeated evidence.</p><StaffBuilderScoreView diagnosticHighlights={highlights} measureIndex={measureIndex} score={displayScore} />
      {hesitations.length ? <ul aria-label={`Slow responses in measure ${result.measureNumber}`} className="piece-practice-hesitation-list">{hesitations.map((timing) => <li key={timing.sequence}>Slow response: {timing.expectedPitches.map(formatPiecePracticeWrittenPitch).join(", ") || "target"} — {seconds(timing.responseDurationMs)} (threshold {seconds(timing.hesitationThresholdMs)}, expected window {seconds(timing.expectedWindowMs)})</li>)}</ul> : null}
      {result.skippedTargetCount ? <p>{result.skippedTargetCount} {result.skippedTargetCount === 1 ? "target was" : "targets were"} skipped. Skips are problem signals, not mistakes or hesitations.</p> : null}
      {mistakes.length ? <details><summary>Show mistakes</summary><MistakeList evidence={mistakes} /></details> : null}</> : null}
  </article>;
}

function ReportOptionsDialog({ onCancel, onGenerate }: Readonly<{ onCancel: () => void; onGenerate: (options: ReportOptions) => void }>) {
  const [options, setOptions] = useState(DEFAULT_REPORT_OPTIONS);
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
      if (event.key !== "Tab" || !dialog.current) return;
      const controls = [...dialog.current.querySelectorAll<HTMLElement>('button, input:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!controls.length) return;
      const first = controls[0]!;
      const last = controls.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onCancel]);
  const toggle = (key: keyof Omit<ReportOptions, "scope">) => setOptions((current) => ({ ...current, [key]: !current[key] }));
  return <div aria-labelledby="piece-practice-report-options-title" aria-modal="true" className="piece-practice-report-options" ref={dialog} role="dialog"><h2 id="piece-practice-report-options-title" ref={heading} tabIndex={-1}>Generate Report</h2>
    <fieldset><legend>Report scope</legend><label><input checked={options.scope === "problems"} name="report-scope" onChange={() => setOptions({ ...options, scope: "problems" })} type="radio" />Problem measures only</label><label><input checked={options.scope === "excerpt"} name="report-scope" onChange={() => setOptions({ ...options, scope: "excerpt" })} type="radio" />Full practiced excerpt</label></fieldset>
    <fieldset><legend>Report content</legend>{([
      ["sessionSummary", "Session summary"], ["notation", "Rendered notation"], ["mistakeHighlights", "Highlight mistakes on notation"], ["hesitationHighlights", "Highlight hesitations on notation"], ["chronologicalMistakes", "Detailed chronological mistakes"], ["measureTimes", "Measure practice times"],
    ] as const).map(([key, label]) => <label key={key}><input checked={options[key]} onChange={() => toggle(key)} type="checkbox" />{label}</label>)}</fieldset>
    <div><button className="staff-builder-primary-button" onClick={() => onGenerate(options)} type="button">Print / Save PDF</button><button className="staff-builder-secondary-button" onClick={onCancel} type="button">Cancel</button></div>
  </div>;
}

function PracticeReport({ displayScore, options, rangeText, state, title }: Readonly<{ displayScore: StaffBuilderScore; options: ReportOptions; rangeText: string; state: PiecePracticeSessionState; title: string }>) {
  const results = getPiecePracticeMeasureResults(state);
  const included = results.filter((item) => options.scope === "excerpt" || item.isProblem);
  const elapsed = state.completedAtActiveMs ?? state.activeElapsedMs;
  return <section aria-label={`${title} practice report`} className="piece-practice-report-document">
    <h1>{title} — Practice report</h1>
    {options.sessionSummary ? <><p>Practice range: {rangeText}</p><p>Elapsed time: {seconds(elapsed)} · Mistakes: {state.mistakeEvidence.length} · Problem measures: {results.filter(({ isProblem }) => isProblem).map(({ measureNumber }) => measureNumber).join(", ") || "None"}</p></> : null}
    {options.notation && included.length ? <StaffBuilderPrintScore measureIndexes={included.map(({ measureIndex }) => measureIndex)} measuresPerLine={4} score={displayScore} /> : null}
    {included.map((result) => <section className="piece-practice-report-measure" key={result.sourceMeasureId}><h2>Measure {result.measureNumber}</h2><p>{result.mistakeCount} mistakes{options.measureTimes ? ` · ${seconds(result.activeDurationMs)}` : ""}{result.hesitationCount ? ` · ${result.hesitationCount} hesitations` : ""}{result.skippedTargetCount ? ` · ${result.skippedTargetCount} skipped` : ""}</p>
      {options.notation && (options.mistakeHighlights || options.hesitationHighlights) ? <StaffBuilderScoreView diagnosticHighlights={diagnosticHighlights(state, result.measureIndex).filter(({ kind }) => kind === "mistake" ? options.mistakeHighlights : options.hesitationHighlights)} measureIndex={result.measureIndex} score={displayScore} /> : null}
      {options.chronologicalMistakes ? <MistakeList evidence={state.mistakeEvidence.filter((item) => item.measureIndex === result.measureIndex)} /> : null}
      {options.hesitationHighlights ? <ul>{state.targetTimings.filter((item) => item.measureIndex === result.measureIndex && item.isHesitation).map((timing) => <li key={timing.sequence}>Slow response: {timing.expectedPitches.map(formatPiecePracticeWrittenPitch).join(", ") || "target"} — {seconds(timing.responseDurationMs)}; threshold {seconds(timing.hesitationThresholdMs)}; expected window {seconds(timing.expectedWindowMs)}</li>)}</ul> : null}
    </section>)}
  </section>;
}

export function PiecePracticeResults({ displayScore, rangeText, state, title }: Readonly<{ displayScore: StaffBuilderScore; rangeText: string; state: PiecePracticeSessionState; title: string }>) {
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [reportDialog, setReportDialog] = useState(false);
  const [reportOptions, setReportOptions] = useState<ReportOptions | null>(null);
  const reportButton = useRef<HTMLButtonElement>(null);
  const results = useMemo(() => getPiecePracticeMeasureResults(state), [state]);
  const visible = problemsOnly ? results.filter(({ isProblem }) => isProblem) : results;
  useEffect(() => {
    if (!reportOptions) return;
    let fallbackTimer: number | undefined;
    const finish = () => { if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer); setReportOptions(null); reportButton.current?.focus(); };
    window.addEventListener("afterprint", finish, { once: true });
    const timer = window.setTimeout(() => { window.print(); fallbackTimer = window.setTimeout(finish, 1_000); }, 0);
    return () => { window.clearTimeout(timer); if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer); window.removeEventListener("afterprint", finish); };
  }, [reportOptions]);
  return <section aria-labelledby="piece-practice-measure-results-title" className="grid gap-3">
    <div><h2 className="text-xl font-bold" id="piece-practice-measure-results-title">Measure results</h2><p className="text-sm text-zinc-300">Problem measures are emphasized for quick review.</p></div>
    <label className="piece-practice-problem-filter"><input checked={problemsOnly} onChange={(event) => setProblemsOnly(event.target.checked)} type="checkbox" />Show problem measures only</label>
    {visible.length ? <ul aria-label="Measure-by-measure results" className="piece-practice-measure-results">{visible.map((result) => <li key={result.sourceMeasureId}>{result.isProblem
      ? <details className="piece-practice-measure-result" data-has-problems><summary><strong>Measure {result.measureNumber}</strong><span>{result.mistakeCount ? `${result.mistakeCount} ${result.mistakeCount === 1 ? "mistake" : "mistakes"}` : "No mistakes"} · {seconds(result.activeDurationMs)}{result.hesitationCount ? ` · ${result.hesitationCount} slow` : ""}{result.skippedTargetCount ? ` · ${result.skippedTargetCount} skipped` : ""}</span></summary><ResultMeasure displayScore={displayScore} measureIndex={result.measureIndex} state={state} /></details>
      : <div className="piece-practice-measure-result"><strong>Measure {result.measureNumber}</strong><span>No mistakes · {seconds(result.activeDurationMs)}</span></div>}</li>)}</ul> : <p>No problem measures in this attempt.</p>}
    <button className="justify-self-start rounded-lg border border-sky-400/60 px-4 py-2 font-semibold" onClick={() => setReportDialog(true)} ref={reportButton} type="button">Generate Report</button>
    {reportDialog ? <ReportOptionsDialog onCancel={() => { setReportDialog(false); reportButton.current?.focus(); }} onGenerate={(options) => { setReportDialog(false); setReportOptions(options); }} /> : null}
    {reportOptions ? <PracticeReport displayScore={displayScore} options={reportOptions} rangeText={rangeText} state={state} title={title} /> : null}
  </section>;
}
