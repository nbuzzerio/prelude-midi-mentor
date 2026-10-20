import { useState } from "react";
import type { ProgramAttempt } from "../practice-program-attempt";
import type { ProgramExecutionState } from "../practice-program-executor";
import type { PracticeExerciseEntry } from "../practice-session-types";
import type { PracticeSessionRunState } from "../practice-session-runtime";
import { derivePracticeSessionReport } from "../practice-session-report";
import { getPracticeExerciseConceptName } from "../practice-session-presenters";
import { lessonExerciseFeedback, lessonSummaryRows } from "../practice-lesson-feedback";
import { ExerciseDiagnostics } from "./practice-session-report";
import { PracticeSessionPrintControls } from "./practice-session-print-report";
import { PracticeLessonPrintControls } from "./practice-lesson-print-report";

export function LessonNativeDetails({ run, pending = false, scopeNote }: Readonly<{ run: PracticeSessionRunState; pending?: boolean; scopeNote?: string }>) {
  const [open, setOpen] = useState(false);
  const report = derivePracticeSessionReport(run);
  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="min-h-11 cursor-pointer py-3">Detailed native report and printing</summary>
    {open && <div className="space-y-3" inert={pending || undefined}>
      <p className="text-xs text-zinc-400">Full native diagnostics are temporary. Saved attempts retain their native scalar summaries.</p>
      {scopeNote && <p className="text-sm text-zinc-300">{scopeNote}</p>}
      <ExerciseDiagnostics exercise={report.exercises[0]!} />
      <PracticeSessionPrintControls label="Print Exercise Details" report={report} scopeNote={scopeNote} />
    </div>}
  </details>;
}

export function LessonExerciseFeedback({ attempt, compact = false }: Readonly<{ attempt: ProgramAttempt; compact?: boolean }>) {
  const feedback = lessonExerciseFeedback(attempt);
  return <section aria-label="Exercise teaching feedback" className="space-y-1 text-sm">
    {!compact && <><h3 className="font-semibold">{getPracticeExerciseConceptName(attempt.exercise)} · {feedback.outcome}</h3><p className="text-xs text-zinc-400">{feedback.phase}</p></>}
    {(compact ? feedback.lines.slice(0, 2) : feedback.lines).map(line => <p key={line}>{line}</p>)}
    {feedback.unfinished && <p>{feedback.unfinished}</p>}
    <p className="text-sky-100"><strong>Teaching observation:</strong> {feedback.observation}</p>
    {compact ? <details><summary className="min-h-11 cursor-pointer py-3 text-xs text-zinc-400">Measurements and input source</summary><p>{feedback.phase}</p>{feedback.lines.slice(2).map(line => <p key={line}>{line}</p>)}<p>{feedback.sources}</p></details> : <p className="text-xs text-zinc-400">{feedback.sources}</p>}
    {feedback.bonus && <p className="text-xs text-zinc-400">{feedback.bonus}</p>}
  </section>;
}

export default function PracticeLessonSummary({ state, exercises, pending, programName = "Piano practice", workflowLabel = "Today's Piano Lesson" }: Readonly<{
  state: ProgramExecutionState; exercises: readonly PracticeExerciseEntry[]; pending: boolean; programName?: string; workflowLabel?: string;
}>) {
  const rows = lessonSummaryRows(state.queue, state.acknowledged.map(entry => entry.record), exercises, pending ? state.record : null,
    pending && !state.record && (state.saving || state.error) ? state.queue[state.index]?.occurrenceId : undefined);
  const attempts = rows.flatMap(row => row.record?.kind === "attempt" && row.record.closed && row.outcome !== "Results pending" ? [row.record] : []);
  const focus = attempts.find(attempt => (attempt.targetMetrics ?? attempt.metrics)?.incorrectResponses) ?? attempts[0];
  const feedback = focus ? lessonExerciseFeedback(focus) : null;
  const counts = ["Completed", "Stopped early", "Interrupted", "Deliberately skipped", "Unperformed", "Results pending", "Skip save pending", "In progress", "Target reached"]
    .map(outcome => ({ outcome, count: rows.filter(row => row.outcome === outcome).length })).filter(value => value.count > 0);
  const overview = <>
    <div><h3 className="font-semibold">What I practiced</h3>
      {!rows.some(row => row.record?.kind === "attempt") && <p>No exercises were performed.</p>}
      <ol className="list-inside list-decimal space-y-1">{rows.map(row => <li key={row.occurrenceId}>
        {row.exercise?.label ?? row.exerciseId} — {row.outcome}
      </li>)}</ol>
    </div>
    <div><h3 className="font-semibold">What I completed</h3><p>{counts.length ? counts.map(value => `${value.count} ${value.outcome.toLowerCase()}`).join(" · ") : "No selections were undertaken."}</p></div>
    <div><h3 className="font-semibold">One useful observation</h3><p>{feedback ? `${getPracticeExerciseConceptName(focus!.exercise)} (${focus!.targetMetrics ? "prescribed target" : "all recorded work"}): ${feedback.summaryObservation}` : pending ? "Evidence is still pending; a result observation is not available yet." : "There is no completed attempt evidence to interpret."}</p></div>
    <div><h3 className="font-semibold">Next time</h3><p>{feedback?.suggestion ?? "Continue the selected fundamentals at a comfortable pace."}</p></div>
  </>;
  return <section aria-label="Lesson teaching summary" className="space-y-3 text-sm">
    {overview}
    <PracticeLessonPrintControls exercises={exercises} overview={overview} pending={pending} programName={programName} state={state} workflowLabel={workflowLabel} />
    <details><summary className="min-h-11 cursor-pointer py-3">Exercise results and native reports</summary>
      <div className="space-y-4">{rows.flatMap((row, index) => {
        const acknowledged = state.acknowledged.find(entry => entry.record.recordId === row.record?.recordId);
        return row.record?.kind === "attempt" ? [<div key={row.record.attemptId}>
          <p className="font-semibold">{row.exercise?.label} · {row.outcome}</p>
          <LessonExerciseFeedback attempt={row.record} />
          {acknowledged?.report && <LessonNativeDetails pending={pending} run={acknowledged.report} scopeNote={`${workflowLabel} · exercise ${index + 1} of ${rows.length}. This is a single-attempt native report; other selections are not included.`} />}
        </div>] : [];
      })}</div>
    </details>
  </section>;
}
