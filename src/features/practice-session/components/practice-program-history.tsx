import { memo, useEffect, useState } from "react";
import { IndexedDbPracticeAttempts } from "../persistence/practice-attempt-indexeddb";
import { PracticeAttemptOwnership } from "../persistence/practice-attempt-ownership";
import { programCalendarNow, weeklyProgramProgress, type ProgramHistoryRecord } from "../practice-program-attempt";
import { programCalendarWeek } from "../practice-program-calendar";
import type { PracticeProgramRevision } from "../practice-program-types";

function PracticeProgramHistory({ program, changed }: Readonly<{ program: PracticeProgramRevision; changed: number }>) {
  const [records, setRecords] = useState<readonly ProgramHistoryRecord[]>([]), [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0), [chosenDate, setChosenDate] = useState("");
  const [calendar, setCalendar] = useState(() => programCalendarNow(Date.now()));
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let current = true; const store = new IndexedDbPracticeAttempts();
    void new PracticeAttemptOwnership().recover(store, program.programId, Date.now()).then(values => { if (current) { setRecords(values); setCalendar(programCalendarNow(Date.now())); setError(""); setLoaded(true); } }, failure => { if (current) { setLoaded(false); setError(failure instanceof Error ? failure.message : "History is unavailable; existing data was not changed."); } });
    return () => { current = false; store.close(); };
  }, [program.programId, changed, refresh]);
  const [year, month, day] = (chosenDate || calendar.localDate).split("-").map(Number);
  const week = programCalendarWeek({ year: year!, month: month!, day: day! });
  const progress = weeklyProgramProgress(records, program.programId, week.weekStartLocalDate);
  const coverage = program.program.exercises.filter(exercise => (progress.exercises.get(exercise.id)?.attempts ?? 0) > 0).length;
  const known = loaded && !error;
  return <section aria-label="Saved weekly progress" className="space-y-3 rounded border border-white/10 p-3">
    <div className="flex flex-wrap items-center gap-3"><h3 className="mr-auto text-lg font-semibold">Saved weekly progress</h3><button className="min-h-11 rounded border border-zinc-600 px-3" onClick={() => setRefresh(value => value + 1)} type="button">Refresh history</button></div>
    <label className="block">History week<input className="ml-2 min-h-11 max-w-full rounded bg-zinc-800 px-2" onChange={event => setChosenDate(event.target.value)} type="date" value={chosenDate || calendar.localDate} /></label>
    <p className="text-sm">Week starting Sunday {week.weekStartLocalDate} · {known ? coverage : "Unknown"} distinct pool exercises attempted{program.program.weeklyGoal ? ` / ${program.program.weeklyGoal.distinctExercisesPracticed} coverage goal` : ""}</p>
    <p className="text-sm text-zinc-400">Coverage counts saved started attempts, separately from completion or musical quality. Missing days are neutral. Only acknowledged evidence appears here.</p>
    {error && <p className="text-red-300" role="alert">{error}</p>}
    <ul className="space-y-2">{program.program.exercises.map(exercise => {
      const count = progress.exercises.get(exercise.id);
      return <li className="rounded bg-zinc-900 p-2" key={exercise.id}><p className="font-medium">{exercise.label}</p><p className="text-sm text-zinc-300">{!known ? "Saved evidence unknown" : count?.attempts ? `${count.attempts} attempts · ${count.completed} completed · ${count.incomplete} incomplete · ${count.skips} skips` : `${count?.skips ?? 0} skips · Not yet practiced`}{exercise.weeklyTarget ? ` · ${known ? count?.completed ?? 0 : "Unknown"} / ${exercise.weeklyTarget.completedAttempts} completed-attempt goal` : ""}</p></li>;
    })}</ul>
    <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">Recent dated records for this week ({known ? progress.recent.length : "Unknown"})</summary>
      {known && !progress.recent.length && <p className="text-sm text-zinc-400">No saved evidence for this week.</p>}
      <ol className="space-y-2">{(known ? progress.recent : []).map(row => <li className="break-words rounded border border-white/10 p-3 text-sm" key={row.recordId}>
        <p>{row.calendar.localDate} · {row.exercise.label} · Revision {row.programRevision}</p>
        <p>{row.kind === "skip" ? "Explicit selection skip (no performance attempt)" : `${row.outcome === "in-progress" ? "Unfinished checkpoint — active elsewhere or awaiting interruption recovery" : row.outcome} · ${(row.activeDurationMs / 1000).toFixed(1)}s observed active time · ${row.prescribedUnits} prescribed units · ${row.bonusUnits} bonus units`}</p>
        {row.kind === "attempt" && row.metrics && <p>Native {row.metrics.engine === "melody" ? "diagnostic trials" : "completed units"}: {row.metrics.completedUnits}{row.metrics.incorrectResponses === null ? "" : ` · Incorrect responses: ${row.metrics.incorrectResponses}`}{row.metrics.averageResponseDurationMs === null ? "" : ` · Mean response/completion: ${row.metrics.averageResponseDurationMs}ms`}</p>}
        {row.kind === "attempt" && row.metrics?.pitchPercent !== null && row.metrics && <p>Native Reading Flow averages: pitch {row.metrics.pitchPercent}% · timing {row.metrics.timingPercent ?? "Unknown"}% · movement {row.metrics.movementPercent ?? "Unknown"}%</p>}
        {row.kind === "attempt" && !!row.metrics?.sources?.length && <p>Answer sources: {row.metrics.sources.join(", ")}</p>}
        <details><summary className="cursor-pointer py-2">Attempt provenance and settings</summary><p>{row.calendar.utcStartedAt} · {row.calendar.timeZone ?? "Timezone unknown"} · UTC offset {row.calendar.utcOffsetMinutes} minutes · {row.kind === "attempt" ? row.attemptId : "Skip"} · Occurrence {row.occurrenceId}</p><pre className="max-w-full overflow-x-auto">{JSON.stringify(row.exercise, null, 2)}</pre></details>
      </li>)}</ol>
    </details>
  </section>;
}
export default memo(PracticeProgramHistory);
