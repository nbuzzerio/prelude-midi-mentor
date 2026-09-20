import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useBrowserPrint } from "@/hooks/use-browser-print";
import { getPracticeExerciseConceptName, getPracticeExerciseConfigurationSummary, getPracticeExerciseTargetSummary } from "../practice-session-presenters";
import type { PracticeSessionExerciseReport, PracticeSessionReport, PracticeSessionReportExerciseOutcome } from "../practice-session-report";
import { ExerciseDiagnostics } from "./practice-session-report";
import { DEFAULT_PRACTICE_SESSION_PRINT_OPTIONS, type PracticeSessionPrintOptions } from "../practice-session-print-options";

const optionLabels = [
  ["sessionSummary", "Session summary"], ["exerciseSummaries", "Exercise summaries"],
  ["exerciseDetails", "Exercise details"], ["timing", "Timing"],
  ["includeSkippedAndNotEntered", "Include skipped / not-entered exercises"], ["engineDiagnostics", "Engine diagnostics"],
] as const;

function duration(ms: number) { const seconds = Math.round(ms / 1_000); return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`; }
function outcome(outcomeValue: PracticeSessionReportExerciseOutcome) {
  return outcomeValue === "completed" ? "Target reached" : outcomeValue === "skipped" ? "Skipped for today" : outcomeValue === "ended-before-target" ? "Session ended before target" : outcomeValue === "never-entered" ? "Not reached in this session" : "In progress";
}

function OptionsDialog({ onCancel, onGenerate }: Readonly<{ onCancel: () => void; onGenerate: (options: PracticeSessionPrintOptions) => void }>) {
  const [options, setOptions] = useState(DEFAULT_PRACTICE_SESSION_PRINT_OPTIONS);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => titleRef.current?.focus(), []);
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); onCancel(); return; }
    if (event.key !== "Tab") return;
    const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button, input:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])];
    const first = controls[0]; const last = controls.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return <div className="practice-session-report-dialog-backdrop">
    <div aria-describedby="practice-session-report-options-description" aria-labelledby="practice-session-report-options-title" aria-modal="true" className="practice-session-report-options" onKeyDown={keyDown} ref={dialogRef} role="dialog">
      <header><h2 id="practice-session-report-options-title" ref={titleRef} tabIndex={-1}>Generate Report</h2><p id="practice-session-report-options-description">Choose what to include in the printable Practice Session report.</p></header>
      <fieldset><legend>Printable report contents</legend>{optionLabels.map(([key, label]) => <label key={key}><input checked={options[key]} onChange={() => setOptions((current) => ({ ...current, [key]: !current[key] }))} type="checkbox" />{label}</label>)}</fieldset>
      <div className="flex flex-wrap gap-3"><button className="min-h-11 rounded bg-sky-500 px-4 font-semibold" onClick={() => onGenerate(options)} type="button">Generate printable report</button><button className="min-h-11 rounded border border-zinc-600 px-4" onClick={onCancel} type="button">Cancel</button></div>
    </div>
  </div>;
}

function ExercisePrintSection({ exercise, options, total }: Readonly<{ exercise: PracticeSessionExerciseReport; options: PracticeSessionPrintOptions; total: number }>) {
  return <article className="practice-session-print-exercise">
    <header><p>Exercise {exercise.exerciseIndex + 1} of {total} · {getPracticeExerciseConceptName(exercise.prescription)}</p><h2>{exercise.label}</h2><p><strong>Outcome:</strong> {outcome(exercise.outcome)}</p></header>
    {options.exerciseSummaries && <section className="practice-session-print-block"><h3>Exercise summary</h3><p><strong>Prescription:</strong> {getPracticeExerciseTargetSummary(exercise.prescription)}</p><p>Prescribed work: {exercise.prescribedUnitsCompleted} {exercise.prescribedUnitsCompleted === 1 ? "unit" : "units"}{exercise.bonusUnitsCompleted > 0 ? ` · Bonus work: ${exercise.bonusUnitsCompleted} ${exercise.bonusUnitsCompleted === 1 ? "unit" : "units"}` : ""}</p></section>}
    {options.exerciseDetails && <section className="practice-session-print-block"><h3>Exercise details</h3><p>{getPracticeExerciseConfigurationSummary(exercise.prescription)}</p></section>}
    {options.timing && <section className="practice-session-print-block"><h3>Active exercise time</h3><p>Prescribed: {duration(exercise.prescribedActiveDurationMs)}{exercise.bonusActiveDurationMs > 0 ? ` · Bonus: ${duration(exercise.bonusActiveDurationMs)}` : ""}</p></section>}
    {options.engineDiagnostics && exercise.entered && <section className="practice-session-print-diagnostics"><h3>Engine diagnostics</h3><ExerciseDiagnostics compactMelody exercise={exercise} /></section>}
  </article>;
}

export function PracticeSessionPrintableReport({ options, report }: Readonly<{ options: PracticeSessionPrintOptions; report: PracticeSessionReport }>) {
  const exercises = report.exercises.filter(({ outcome: value }) => options.includeSkippedAndNotEntered || (value !== "skipped" && value !== "never-entered"));
  const showExercises = options.exerciseSummaries || options.exerciseDetails || options.timing || options.engineDiagnostics;
  return <section aria-label={`${report.presetName} printable Practice Session report`} className="practice-session-print-document">
    <header><h1>Practice Session Report</h1><p>{report.presetName}</p><p>Completed practice session</p></header>
    {options.sessionSummary && <section className="practice-session-print-summary"><h2>Session summary</h2><dl><div><dt>Active practice</dt><dd>{duration(report.totalActiveDurationMs)}</dd></div><div><dt>Exercises entered</dt><dd>{report.enteredExerciseCount} of {report.exercises.length}</dd></div><div><dt>Targets reached</dt><dd>{report.targetReachedCount}</dd></div><div><dt>Skipped</dt><dd>{report.skippedCount}</dd></div><div><dt>Ended before target</dt><dd>{report.endedBeforeTargetCount}</dd></div><div><dt>Bonus used</dt><dd>{report.bonusExerciseCount}</dd></div></dl></section>}
    {!options.sessionSummary && options.timing && <p><strong>Total active practice:</strong> {duration(report.totalActiveDurationMs)}</p>}
    {showExercises && <section className="practice-session-print-exercises"><h2>Exercises</h2>{exercises.map((exercise) => <ExercisePrintSection exercise={exercise} key={exercise.exerciseId} options={options} total={report.exercises.length} />)}</section>}
  </section>;
}

export function PracticeSessionPrintControls({ report }: Readonly<{ report: PracticeSessionReport }>) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [printOptions, setPrintOptions] = useState<PracticeSessionPrintOptions | null>(null);
  const generateRef = useRef<HTMLButtonElement>(null);
  const close = () => { setDialogOpen(false); generateRef.current?.focus(); };
  useBrowserPrint(printOptions !== null, () => { setPrintOptions(null); generateRef.current?.focus(); });
  return <>
    <button className="min-h-11 rounded border border-sky-400/60 px-4 font-semibold" onClick={() => setDialogOpen(true)} ref={generateRef} type="button">Generate Report</button>
    {dialogOpen && <OptionsDialog onCancel={close} onGenerate={(options) => { setDialogOpen(false); setPrintOptions(options); }} />}
    {printOptions && <PracticeSessionPrintableReport options={printOptions} report={report} />}
  </>;
}
