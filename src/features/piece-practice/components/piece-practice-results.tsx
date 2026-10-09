import { useEffect, useMemo, useRef, useState } from "react";
import { useBrowserPrint } from "@/hooks/use-browser-print";
import { PracticeDiagnosticChips } from "@/components/practice-diagnostic-chips";
import { StaffBuilderPrintScore } from "@/features/staff-builder/components/staff-builder-print-score";
import { StaffBuilderScoreView, type StaffBuilderDiagnosticHighlight } from "@/features/staff-builder/components/staff-builder-score-view";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import {
  formatPiecePracticeMidiPitch,
  selectPiecePracticeMeasureDiagnosticChips,
  type PiecePracticeMistakeEvidence,
} from "../piece-practice-evidence";
import { formatPiecePracticeReport, formatPiecePracticeAttackEvidence, formatPiecePracticeAcousticEvidence, formatPiecePracticeInputConfiguration, getPiecePracticeReportPitchContext, mistakeText, type PiecePracticeReportPresentation } from "../piece-practice-report";
import type { PiecePracticePiece } from "../piece-practice-types";
import { piecePracticeAssessmentLabel } from "../piece-practice-assessment";
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

type ResultPresentation = "clean" | "mistake" | "hesitation" | "both" | "skip-only" | "process-only";

function resultPresentation(result: ReturnType<typeof getPiecePracticeMeasureResults>[number]): ResultPresentation {
  if (result.mistakeCount && result.hesitationCount) return "both";
  if (result.mistakeCount) return "mistake";
  if (result.hesitationCount) return "hesitation";
  return result.skippedTargetCount ? "skip-only" : result.restartCount ? "process-only" : "clean";
}

function diagnosticHighlights(state: PiecePracticeSessionState, measureIndex: number): readonly StaffBuilderDiagnosticHighlight[] {
  const counts = new Map<string, StaffBuilderDiagnosticHighlight & { count: number }>();
  const add = (highlight: StaffBuilderDiagnosticHighlight) => {
    const key = `${highlight.kind}:${highlight.eventId}:${highlight.pitchId ?? "target"}`;
    counts.set(key, { ...highlight, count: (counts.get(key)?.count ?? 0) + 1 });
  };
  state.mistakeEvidence.filter((item) => item.measureIndex === measureIndex).forEach((item) => {
    const missing = item.kind === "rolled-unexpected-pitch" || item.kind === "acoustic-attempt" ? [] : item.missingMidiNumbers;
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

function AcousticEvidence({ state }: Readonly<{ state: PiecePracticeSessionState }>) {
  if (state.inputConfiguration?.mode !== "microphone") return null;
  return <section className="grid gap-2"><h2 className="font-semibold">Microphone pitch attacks</h2>
    <p>{formatPiecePracticeInputConfiguration(state.inputConfiguration)}</p>
    <p>Response timing includes observation confirmation; no hardware-latency compensation. Acceptance within tolerance does not mean in tune.</p>
    <ol>{(state.acousticEvidence ?? []).map((attack) => <li key={attack.sequence}>{formatPiecePracticeAcousticEvidence(attack)}</li>)}</ol>
    {!state.acousticEvidence?.length && <p>No confirmed microphone attacks.</p>}
  </section>;
}

function MistakeList({ evidence, presentation }: Readonly<{ evidence: readonly PiecePracticeMistakeEvidence[]; presentation: PiecePracticeReportPresentation }>) {
  return <ol className="piece-practice-mistake-list">
    {evidence.map((item, index) => {
      const text = mistakeText(item, presentation);
      return <li key={item.sequence}><strong>Mistake {index + 1}: {text.label}</strong><p>Expected: {text.expected}</p><p>Played: {text.played}</p>{text.missing.length ? <p>Missing: {text.missing.join(", ")}</p> : null}{text.extra.length ? <p>Extra: {text.extra.join(", ")}</p> : null}{text.held.length ? <p>Unexpected held: {text.held.join(", ")}</p> : null}</li>;
    })}
  </ol>;
}

function ResultMeasure({ displayScore, measureIndex, state, presentation, showDetails = true }: Readonly<{ displayScore: StaffBuilderScore; measureIndex: number; state: PiecePracticeSessionState; presentation: PiecePracticeReportPresentation; showDetails?: boolean }>) {
  const result = getPiecePracticeMeasureResults(state).find((item) => item.measureIndex === measureIndex)!;
  const mistakes = state.mistakeEvidence.filter((item) => item.measureIndex === measureIndex);
  const hesitations = state.targetTimings.filter((item) => item.measureIndex === measureIndex && item.isHesitation);
  const unarmedSkips = state.targetTimings.filter((item) => item.measureIndex === measureIndex && item.timingBasis === "unarmed-skip");
  const highlights = diagnosticHighlights(state, measureIndex);
  return <article className="piece-practice-result-detail">
    <p className="sr-only">Measure {result.measureNumber} diagnostic detail.</p>
    {showDetails ? <><p className="sr-only">Red markers identify mistake evidence. Amber dashed markers identify slow responses. Marker tallies show repeated evidence.</p><StaffBuilderScoreView diagnosticHighlights={highlights} measureIndex={measureIndex} score={displayScore} />
      {hesitations.length ? <ul aria-label={`Slow responses in measure ${result.measureNumber}`} className="piece-practice-hesitation-list">{hesitations.map((timing) => <li key={timing.sequence}>Slow response: {timing.expectedPitches.map((pitch) => formatPiecePracticeMidiPitch(pitch.midiNumber, { ...getPiecePracticeReportPitchContext(timing, presentation), expectedPitches: [pitch] })).join(", ") || "target"} — {timing.responseDurationMs === null ? "not timed" : seconds(timing.responseDurationMs)} (threshold {seconds(timing.hesitationThresholdMs)}, expected window {seconds(timing.expectedWindowMs)})</li>)}</ul> : null}
      {unarmedSkips.map((timing) => <p key={timing.sequence}>Skipped before first attempt; response not timed.</p>)}
      {result.skippedTargetCount ? <p>{result.skippedTargetCount} {result.skippedTargetCount === 1 ? "target was" : "targets were"} skipped. Skips are problem signals, not mistakes or hesitations.</p> : null}
      {result.restartCount ? <p>Restarts: {result.restartCount}. Deliberate measure restarts are process signals, not mistakes.</p> : null}
      {mistakes.length ? <details><summary>Show mistakes</summary><MistakeList evidence={mistakes} presentation={presentation} /></details> : null}</> : null}
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

function PracticeReport({ displayScore, options, rangeText, state, title, includeAttackStrength, presentation }: Readonly<{ displayScore: StaffBuilderScore; options: ReportOptions; rangeText: string; state: PiecePracticeSessionState; title: string; includeAttackStrength: boolean; presentation: PiecePracticeReportPresentation }>) {
  const results = getPiecePracticeMeasureResults(state);
  const included = results.filter((item) => options.scope === "excerpt" || item.isProblem);
  const elapsed = state.completedAtActiveMs ?? state.activeElapsedMs;
  return <section aria-label={`${title} practice report`} className="piece-practice-report-document">
    <h1>{title} — Practice report</h1>
    <p>Assessment: {piecePracticeAssessmentLabel(state.assessmentFocus)}</p>
    {options.sessionSummary ? <><p>Practice range: {rangeText}</p><p>Elapsed time: {seconds(elapsed)} · Mistakes: {state.mistakeEvidence.length} · Problem measures: {results.filter(({ isProblem }) => isProblem).map(({ measureNumber }) => measureNumber).join(", ") || "None"}</p></> : null}
    {options.notation && included.length ? <StaffBuilderPrintScore measureIndexes={included.map(({ measureIndex }) => measureIndex)} measuresPerLine={4} score={displayScore} /> : null}
    {included.map((result) => <section className="piece-practice-report-measure" key={result.sourceMeasureId}><h2>Measure {result.measureNumber}</h2><PracticeDiagnosticChips chips={selectPiecePracticeMeasureDiagnosticChips(result)} label={`Measure ${result.measureNumber} diagnostic shorthand`} /><p>{result.mistakeCount} mistakes{options.measureTimes ? ` · ${seconds(result.activeDurationMs)}` : ""}{result.hesitationCount ? ` · ${result.hesitationCount} hesitations` : ""}{result.skippedTargetCount ? ` · ${result.skippedTargetCount} skipped` : ""}{result.restartCount ? ` · Restarts: ${result.restartCount}` : ""}</p>
      {options.notation && (options.mistakeHighlights || options.hesitationHighlights) ? <StaffBuilderScoreView diagnosticHighlights={diagnosticHighlights(state, result.measureIndex).filter(({ kind }) => kind === "mistake" ? options.mistakeHighlights : options.hesitationHighlights)} measureIndex={result.measureIndex} score={displayScore} /> : null}
      {options.chronologicalMistakes ? <MistakeList evidence={state.mistakeEvidence.filter((item) => item.measureIndex === result.measureIndex)} presentation={presentation} /> : null}
      {options.hesitationHighlights ? <ul>{state.targetTimings.filter((item) => item.measureIndex === result.measureIndex && item.isHesitation).map((timing) => <li key={timing.sequence}>Slow response: {timing.expectedPitches.map((pitch) => formatPiecePracticeMidiPitch(pitch.midiNumber, { ...getPiecePracticeReportPitchContext(timing, presentation), expectedPitches: [pitch] })).join(", ") || "target"} — {timing.responseDurationMs === null ? "not timed" : seconds(timing.responseDurationMs)}; threshold {seconds(timing.hesitationThresholdMs)}; expected window {seconds(timing.expectedWindowMs)}</li>)}</ul> : null}
      {state.targetTimings.filter((item) => item.measureIndex === result.measureIndex && item.timingBasis === "unarmed-skip").map((timing) => <p key={timing.sequence}>Skipped before first attempt; response not timed.</p>)}
    </section>)}
    <AcousticEvidence state={state} />
    {includeAttackStrength ? <section><h2>MIDI attack velocity</h2><p>Physical MIDI Note On evidence only; no dynamics assessment.</p><ol>{(state.attackEvidence ?? []).map((attack) => <li key={attack.sequence}>{formatPiecePracticeAttackEvidence(attack, presentation)}</li>)}</ol>{!state.attackEvidence?.length ? <p>No MIDI attack velocity evidence available.</p> : null}</section> : null}
  </section>;
}

export function PiecePracticeResults({ displayScore, piece, rangeText, state, title }: Readonly<{ displayScore: StaffBuilderScore; piece?: PiecePracticePiece; rangeText: string; state: PiecePracticeSessionState; title: string }>) {
  const [includeAttackStrength, setIncludeAttackStrength] = useState(false);
  const [showMidiDetails, setShowMidiDetails] = useState(false);
  const presentation = { piece, showMidiDetails };
  const [copyStatus, setCopyStatus] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const [fallbackText, setFallbackText] = useState("");
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (copyStatus === "failed") { fallbackRef.current?.focus(); fallbackRef.current?.select(); }
  }, [copyStatus, fallbackText]);
  const copyReport = async () => {
    const text = formatPiecePracticeReport({ title, rangeText, state, includeAttackStrength, ...presentation });
    setCopyStatus("copying");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setFallbackText(""); setCopyStatus("copied");
    } catch {
      setFallbackText(text); setCopyStatus("failed");
    }
  };
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [reportDialog, setReportDialog] = useState(false);
  const [reportOptions, setReportOptions] = useState<ReportOptions | null>(null);
  const reportButton = useRef<HTMLButtonElement>(null);
  const results = useMemo(() => getPiecePracticeMeasureResults(state), [state]);
  const visible = problemsOnly ? results.filter(({ isProblem }) => isProblem) : results;
  useBrowserPrint(reportOptions !== null, () => { setReportOptions(null); reportButton.current?.focus(); });
  return <section aria-label="Piece Practice results" className="grid gap-3">
    <div className="flex flex-wrap gap-3"><button className="justify-self-start rounded-lg border border-sky-400/60 px-4 py-2 font-semibold" onClick={() => setReportDialog(true)} ref={reportButton} type="button">Generate Report</button><button className="justify-self-start rounded-lg border border-sky-400/60 px-4 py-2 font-semibold" disabled={copyStatus === "copying"} onClick={() => void copyReport()} type="button">Copy Report</button></div>
    {state.inputConfiguration?.mode !== "microphone" && <><label className="flex min-h-11 items-center gap-2"><input checked={showMidiDetails} onChange={(event) => setShowMidiDetails(event.target.checked)} type="checkbox" />Show MIDI details</label>
    <label className="flex min-h-11 items-center gap-2"><input checked={includeAttackStrength} onChange={(event) => setIncludeAttackStrength(event.target.checked)} type="checkbox" />Include MIDI attack strength</label>
    <p className="text-sm text-zinc-300">Adds exact physical MIDI attack velocities to copied and printed reports. This does not assess dynamics.</p></>}

    <p aria-live="polite" role="status">{copyStatus === "copied" ? "Report copied." : ""}</p>
    {copyStatus === "failed" ? <div><p role="alert">Clipboard access was unavailable. Copy the selected report below manually.</p><label htmlFor="piece-practice-report-copy">Piece Practice report</label><textarea className="min-h-48 w-full" id="piece-practice-report-copy" readOnly ref={fallbackRef} value={fallbackText} /></div> : null}
    <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">Measure results · {results.length} measures · {results.filter(({ isProblem }) => isProblem).length} problem measures</summary>
    <div className="grid gap-3">
    <div><h2 className="text-xl font-bold" id="piece-practice-measure-results-title">Measure results</h2><p>Assessment: {piecePracticeAssessmentLabel(state.assessmentFocus)}</p><p className="text-sm text-zinc-300">Problem measures are emphasized for quick review.</p></div>
    <div className="piece-practice-result-controls"><label className="piece-practice-problem-filter"><input checked={problemsOnly} onChange={(event) => setProblemsOnly(event.target.checked)} type="checkbox" />Show problem measures only</label><div aria-label="Measure result color key" className="piece-practice-result-legend"><span><i data-result-presentation="mistake" />Mistake</span><span><i data-result-presentation="hesitation" />Hesitation</span><span><i data-result-presentation="both" />Both</span></div></div>
    {visible.length ? <ul aria-label="Measure-by-measure results" className="piece-practice-measure-results">{visible.map((result) => <li key={result.sourceMeasureId}>{result.isProblem
      ? <details className="piece-practice-measure-result" data-has-problems data-result-presentation={resultPresentation(result)}><summary><strong>Measure {result.measureNumber}</strong><span>{result.mistakeCount ? `${result.mistakeCount} ${result.mistakeCount === 1 ? "mistake" : "mistakes"}` : "No mistakes"} · {seconds(result.activeDurationMs)}{result.hesitationCount ? ` · ${result.hesitationCount} slow` : ""}{result.skippedTargetCount ? ` · ${result.skippedTargetCount} skipped` : ""}{result.restartCount ? ` · ${result.restartCount} restarts` : ""}</span><PracticeDiagnosticChips chips={selectPiecePracticeMeasureDiagnosticChips(result)} label={`Measure ${result.measureNumber} diagnostic shorthand`} /></summary><ResultMeasure displayScore={displayScore} measureIndex={result.measureIndex} presentation={presentation} state={state} /></details>
      : <div className="piece-practice-measure-result" data-result-presentation="clean"><strong>Measure {result.measureNumber}</strong><span>No mistakes · {seconds(result.activeDurationMs)}</span></div>}</li>)}</ul> : <p>No problem measures in this attempt.</p>}
    </div></details>
    {state.inputConfiguration?.mode === "microphone" && <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">Microphone Pitch Attacks · {state.acousticEvidence?.length ?? 0}</summary><AcousticEvidence state={state} /></details>}
    {reportDialog ? <ReportOptionsDialog onCancel={() => { setReportDialog(false); reportButton.current?.focus(); }} onGenerate={(options) => { setReportDialog(false); setReportOptions(options); }} /> : null}
    {reportOptions ? <PracticeReport includeAttackStrength={includeAttackStrength} displayScore={displayScore} options={reportOptions} presentation={presentation} rangeText={rangeText} state={state} title={title} /> : null}
  </section>;
}
