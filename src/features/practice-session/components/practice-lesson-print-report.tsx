import { useRef, useState, type ReactNode } from "react";
import type { RepertoireEvidence } from "../practice-lesson-repertoire";
import { PracticeLessonRepertoireSummary } from "./practice-lesson-repertoire-summary";
import { createPortal } from "react-dom";
import { useBrowserPrint } from "@/hooks/use-browser-print";
import { printFilenameTitle } from "@/lib/files/print-filename";
import { lessonExerciseFeedback, lessonSummaryRows } from "../practice-lesson-feedback";
import type { ProgramExecutionState } from "../practice-program-executor";
import type { PracticeExerciseEntry } from "../practice-session-types";
import { derivePracticeSessionReport } from "../practice-session-report";
import { getPracticeExerciseConfigurationSummary, getPracticeExerciseTargetSummary } from "../practice-session-presenters";
import { ExerciseDiagnostics } from "./practice-session-report";

/** Current queue only. No history query, synthetic run, or new stored lesson. */
export function PracticeLessonPrintControls({ state, exercises, pending, programName, workflowLabel, overview, repertoire }: Readonly<{
  state: ProgramExecutionState; exercises: readonly PracticeExerciseEntry[]; pending: boolean;
  programName: string; workflowLabel: string; overview: ReactNode; repertoire?: RepertoireEvidence;
}>) {
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false);
  const [printing, setPrinting] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const blocked = pending || !!repertoire?.pending || state.saving || !!state.error || state.acknowledged.some(({ record }) => record.kind === "attempt" && !record.closed);
  const active = printing && !blocked;
  useBrowserPrint(active, () => { setPrinting(false); buttonRef.current?.focus(); }, printFilenameTitle(`${programName} ${workflowLabel}`, "practice-session"));
  const rows = lessonSummaryRows(state.queue, state.acknowledged.map(entry => entry.record), exercises);
  const label = workflowLabel === "Manual V2 practice" ? "Print Practice Summary" : "Print Lesson Summary";
  return <div className="space-y-2">
    <p className="text-xs text-zinc-400">This full summary is available only for the current queue in this tab. After reload, only individual attempt history is available; the full lesson conversation and native details cannot be recovered.</p>
    <label className="flex min-h-11 items-center gap-2"><input checked={includeDiagnostics} onChange={event => setIncludeDiagnostics(event.target.checked)} type="checkbox" />Include native exercise diagnostics</label>
    <button className="min-h-11 rounded border border-sky-400/60 px-4 font-semibold disabled:opacity-40" disabled={blocked || !rows.length} onClick={() => setPrinting(true)} ref={buttonRef} type="button">{label}</button>
    {blocked && <p role="status">Save all pending results before printing the full summary.</p>}
    {active && createPortal(<section aria-label={`${programName} printable lesson summary`} className="practice-session-print-document" data-lesson-repertoire={repertoire ? "true" : undefined}>
      {repertoire && <style>{"@media print { html:has(body > [data-lesson-repertoire]), body:has(> [data-lesson-repertoire]) { background: white !important; } }"}</style>}
      <header><h1>{workflowLabel === "Manual V2 practice" ? "Practice Summary" : "Piano Lesson Summary"}</h1><h2>{programName}</h2><p>{workflowLabel} · {repertoire ? `Current lesson only · ${rows.length} fundamental selection${rows.length === 1 ? "" : "s"} + optional repertoire` : `Current queue only · ${rows.length} selections`}</p></header>
      <section className="practice-session-print-summary">{overview}</section>
      <h2>Exercises in performed / authored order</h2>
      {rows.map((row, index) => {
        const attempt = row.record?.kind === "attempt" && row.record.closed ? row.record : null;
        const feedback = attempt ? lessonExerciseFeedback(attempt) : null;
        const native = attempt && state.acknowledged.find(entry => entry.record.recordId === attempt.recordId)?.report;
        return <article className="practice-session-print-exercise" key={row.occurrenceId}>
          <header><h2>Exercise {index + 1} of {rows.length} · {row.exercise?.label ?? row.exerciseId}</h2><p><strong>Outcome:</strong> {row.outcome}</p></header>
          {row.exercise && <p>{getPracticeExerciseConfigurationSummary(row.exercise)} · Target: {getPracticeExerciseTargetSummary(row.exercise)}</p>}
          {attempt && feedback && <>
            <section className="practice-session-print-block"><h3>{feedback.phase}</h3>{feedback.lines.map(line => <p key={line}>{line}</p>)}<p>{feedback.sources}</p>
              <p>Prescribed active time: {Math.round(attempt.prescribedDurationMs / 1000)}s{attempt.exercise.engine !== "melody" && ` · ${attempt.prescribedUnits} completed ${attempt.prescribedUnits === 1 ? "unit" : "units"}`}</p>
              {feedback.unfinished && <p>{feedback.unfinished}</p>}
            </section>
            {feedback.bonus && <p>Bonus: {attempt.bonusUnits} completed units · {Math.round(attempt.bonusDurationMs / 1000)}s active. Overall native diagnostics may include this work.</p>}
            <section className="practice-session-print-block"><p><strong>Teaching observation:</strong> {feedback.observation}</p><p><strong>Next time:</strong> {feedback.suggestion}</p></section>
            <p>Saved attempt: {attempt.attemptId} · Occurrence: {row.occurrenceId} · Program revision: {attempt.programRevision} · Started: {attempt.calendar.utcStartedAt} · Write version: {attempt.writeVersion}</p>
            {includeDiagnostics && <section className="practice-session-print-diagnostics"><h3>Individual native diagnostics</h3>{native ? <ExerciseDiagnostics compactMelody exercise={derivePracticeSessionReport(native).exercises[0]!} /> : <p>Full native diagnostics are unavailable; saved scalar measurements are shown above.</p>}</section>}
          </>}
        </article>;
      })}
      {repertoire && <PracticeLessonRepertoireSummary evidence={repertoire} />}
      <p>This report uses acknowledged saved attempts from this exact queue. Native measurements retain their original prescribed-target or overall-recorded-work scope. No combined native run or cross-engine score is inferred.</p>
    </section>, document.body)}
  </div>;
}
