import { useCallback, useContext, useEffect, useState } from "react";
import { AppMidiContext } from "@/components/midi/midi-context";
import type { PracticeProgramExecutor, ProgramExecutionState } from "../practice-program-executor";
import type { PracticeProgramRevision } from "../practice-program-types";
import { PROGRAM_ATTEMPT_LIMITS } from "../practice-program-attempt";
import { getPracticeLessonCue } from "../practice-lesson-cues";
import { PracticeSessionRuntime, PracticeSessionSummary } from "./practice-session-runtime";
import { useLessonPacing } from "./use-lesson-pacing";

const button = "min-h-11 rounded border border-zinc-600 px-3 py-2 disabled:opacity-40";
const primary = `${button} bg-sky-500 font-semibold text-white`;
/** Presentation and ephemeral pacing only. Queue/attempt/recovery ownership stays in the executor. */
export default function PracticeProgramLesson({ executor, state, active, program, onClose }: Readonly<{
  executor: PracticeProgramExecutor; state: ProgramExecutionState; active: boolean;
  program: PracticeProgramRevision; onClose: () => void;
}>) {
  const [finishRequested, setFinishRequested] = useState(false);
  const [ready, setReady] = useState<{ attemptId: string; available: boolean } | null>(null);
  const [foreground, setForeground] = useState(() => document.visibilityState !== "hidden");
  useEffect(() => {
    const update = () => setForeground(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const run = state.run, attemptId = run?.runId;
  useEffect(() => { if (finishRequested && run?.status === "active") executor.stop(); }, [finishRequested, run, executor]);
  const activityChanged = useCallback((available: boolean) => {
    if (attemptId && executor.getSnapshot().run?.runId === attemptId) setReady({ attemptId, available });
  }, [attemptId, executor]);
  const pacing = useLessonPacing(active && foreground && !finishRequested && !state.error && run?.status === "active" && run.completionPresentation !== "target-complete" && ready?.attemptId === attemptId && !!ready?.available, executor.now);
  const occurrence = state.queue[state.index];
  const exercise = program.nativeExercises.find(entry => entry.id === occurrence?.exerciseId);
  const upcoming = state.queue[state.index + (run ? 1 : 0)];
  const nextTitle = program.nativeExercises.find(entry => entry.id === upcoming?.exerciseId)?.label;
  const evidencePending = executor.busy || state.saving || !!state.error || !!state.record && (
    !state.durable?.closed || state.durable.attemptId !== state.record.attemptId || state.durable.writeVersion < state.record.writeVersion
  );
  const finished = finishRequested || !!state.queue.length && !occurrence;
  const disabled = state.saving || !!state.error || !active || finishRequested;
  const next = () => void executor.advanceLesson("next");
  const repeat = () => void executor.advanceLesson("repeat");
  const skip = () => void executor.advanceLesson("skip");
  const finish = () => { setFinishRequested(true); executor.stop(); };
  const returnToEntry = () => { if (!evidencePending && executor.returnToPool()) onClose(); };
  const midi = useContext(AppMidiContext);
  const result = <>
    <p role="status">{!evidencePending && state.durable?.closed ? `Saved attempt: ${state.durable.outcome}.` : "Attempt ended. Results are awaiting durable save."}</p>
    {run?.status === "summary" && <details><summary className="min-h-11 cursor-pointer py-3">Detailed native report and printing</summary><div inert={evidencePending || undefined}><PracticeSessionSummary onBack={returnToEntry} run={run} /></div></details>}
  </>;
  return <section aria-label="Today's active piano lesson" className="space-y-3 break-words">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-xl font-semibold">Today&apos;s Piano Lesson</h2><p className="text-sm text-zinc-400">{program.program.title} · Revision {program.revision}</p></div>
      <p className="text-sm tabular-nums" aria-label="Lesson active practice time">{pacing.label} active · about 10 minutes</p>
    </header>
    {pacing.plannedTimeReached && !finished && <p className="text-sm text-sky-200" role="status">You&apos;ve reached today&apos;s planned practice time. Finish when ready.</p>}
    {midi && midi.status !== "connected" && <p className="text-sm text-amber-200" role="status">MIDI is not connected. Use Connect MIDI in the exercise to retry, or use the existing on-screen input. Your program and rotation are already selected.</p>}
    {state.error && <div><p role="alert" className="text-red-300">{state.error} Results are pending in this tab; they are not shown as saved.</p><button className={button} disabled={state.saving || !active} onClick={() => void executor.retry()} type="button">Retry saving</button></div>}
    {state.saving && <p role="status">{run ? "Saving your exercise…" : "Preparing your exercise…"}</p>}
    {finished ? <>
      <h3 className="text-lg font-semibold">{evidencePending ? "Finishing lesson" : "Lesson finished"}</h3>
      <p role="status">{evidencePending ? "Results are awaiting durable save. Keep this tab open and retry saving if needed." : "Unperformed exercises remain unperformed."}</p>
      {run?.status === "summary" && result}
      <button className={primary} disabled={evidencePending} onClick={returnToEntry} type="button">Return</button>
    </> : <>
      {active && !finishRequested && run?.status === "active" && <PracticeSessionRuntime allowSkip={false} hostedStart createExerciseToken={() => crypto.randomUUID()} dispatch={executor.handle} key={run.runId} now={executor.now} onPracticeActivityChange={activityChanged} run={run} lesson={{ position: state.index + 1, total: state.queue.length, cue: getPracticeLessonCue(exercise), nextTitle, disabled, canRepeat: state.queue.length < PROGRAM_ATTEMPT_LIMITS.queue, onNext: next, onRepeat: repeat, onFinish: finish }} />}
      {run?.status === "summary" && <>
        <h3 className="font-semibold">Exercise {state.index + 1} of {state.queue.length} · {exercise?.label}</h3>
        {result}
        <div className="flex flex-wrap gap-2">
          {nextTitle && <button className={primary} disabled={disabled || executor.busy} onClick={next} type="button">Next Exercise</button>}
          <button className={button} disabled={disabled || executor.busy || state.queue.length >= PROGRAM_ATTEMPT_LIMITS.queue} onClick={repeat} type="button">Repeat Exercise</button>
        </div>
      </>}
      {!run && !state.record && exercise && <>
        <h3 className="font-semibold">Exercise {state.index + 1} of {state.queue.length} · {exercise.label}</h3><p className="text-sm text-zinc-300">{getPracticeLessonCue(exercise)}</p>
        <button className={primary} disabled={disabled} onClick={next} type="button">Next Exercise</button>
      </>}
      {nextTitle && <p className="text-sm text-zinc-300">Next: {nextTitle}</p>}
      {nextTitle && (run?.status === "summary" || run?.completionPresentation === "target-complete" || !run && !state.record) && <button className={button} disabled={disabled || state.saving || !!state.error} onClick={skip} type="button">Skip Exercise: {nextTitle}</button>}
      <div className="flex flex-wrap gap-2">{!(run?.status === "active" && (exercise?.engine === "melody" || run.completionPresentation !== "practicing" && !nextTitle)) && <button className={button} disabled={finishRequested || !!state.error || !active} onClick={finish} type="button">Finish Lesson</button>}<button className={button} disabled={evidencePending} onClick={returnToEntry} type="button">Return</button></div>
      <p className="text-xs text-zinc-400">Finish Lesson stops current work and leaves the rest unperformed. Return is available after pending results are saved.</p>
    </>}
  </section>;
}
