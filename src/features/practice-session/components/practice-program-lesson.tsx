import { useCallback, useContext, useEffect, useState } from "react";
import { AppMidiContext } from "@/components/midi/midi-context";
import type { PracticeProgramExecutor, ProgramExecutionState } from "../practice-program-executor";
import type { PracticeProgramRevision } from "../practice-program-types";
import { PROGRAM_ATTEMPT_LIMITS } from "../practice-program-attempt";
import { getPracticeLessonCue } from "../practice-lesson-cues";
import { PracticeSessionRuntime } from "./practice-session-runtime";
import PracticeLessonSummary, { LessonExerciseFeedback, LessonNativeDetails } from "./practice-lesson-summary";
import { useLessonPacing } from "./use-lesson-pacing";
import type { LessonRepertoire, RepertoireEvidence } from "../practice-lesson-repertoire";
import { PracticeLessonRepertoire } from "./practice-lesson-repertoire";

const button = "min-h-11 rounded border border-zinc-600 px-3 py-2 disabled:opacity-40";
const primary = `${button} bg-sky-500 font-semibold text-white`;
/** Presentation and ephemeral pacing only. Queue/attempt/recovery ownership stays in the executor. */
export default function PracticeProgramLesson({ executor, state, active, program, onClose, keyboardChoice, onKeyboardChoiceChange, repertoire, onRepertoireInput }: Readonly<{
  executor: PracticeProgramExecutor; state: ProgramExecutionState; active: boolean;
  program: PracticeProgramRevision; onClose: () => void;
  keyboardChoice?: boolean | null; onKeyboardChoiceChange?: (visible: boolean) => void;
  repertoire?: LessonRepertoire; onRepertoireInput?: (active: boolean) => void;
}>) {
  const [finishRequested, setFinishRequested] = useState(false);
  const [repertoireEntered, setRepertoireEntered] = useState(false);
  const [repertoirePlaying, setRepertoirePlaying] = useState(false);
  const [repertoireEvidence, setRepertoireEvidence] = useState<RepertoireEvidence | undefined>(() => repertoire ? { occurrence: repertoire, attempts: [], skipped: false, pending: false, datePending: 0, dateFailed: 0 } : undefined);
  useEffect(() => { onRepertoireInput?.(repertoireEntered && !finishRequested && active); return () => onRepertoireInput?.(false); }, [repertoireEntered, finishRequested, active, onRepertoireInput]);
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
  const pacing = useLessonPacing(active && foreground && !finishRequested && (repertoirePlaying || !state.error && run?.status === "active" && run.completionPresentation !== "target-complete" && ready?.attemptId === attemptId && !!ready?.available), executor.now);
  const occurrence = state.queue[state.index];
  const exercise = program.nativeExercises.find(entry => entry.id === occurrence?.exerciseId);
  const upcoming = state.queue[state.index + (run ? 1 : 0)];
  const fundamentalNextTitle = program.nativeExercises.find(entry => entry.id === upcoming?.exerciseId)?.label;
  const repertoireNext = !fundamentalNextTitle && !!repertoire;
  const nextTitle = fundamentalNextTitle ?? (repertoire ? "Repertoire" : undefined);
  const nextLabel = repertoireNext ? "Next: Repertoire" : "Next Exercise";
  const evidencePending = !!repertoireEvidence?.pending || executor.busy || state.saving || !!state.error || !!state.record && (
    !state.durable?.closed || state.durable.attemptId !== state.record.attemptId || state.durable.writeVersion < state.record.writeVersion
  );
  const finished = finishRequested || !!state.queue.length && !occurrence && !repertoire;
  const disabled = state.saving || !!state.error || !active || finishRequested;
  const next = () => { void executor.advanceLesson("next").then(() => {
    const current = executor.getSnapshot();
    if (repertoire && current.queue.length && current.index >= current.queue.length && !executor.busy) setRepertoireEntered(true);
  }); };
  const repeat = () => void executor.advanceLesson("repeat");
  const skip = () => void executor.advanceLesson("skip");
  const finish = () => { if (repertoireEvidence?.pending) return; setFinishRequested(true); executor.stop(); };
  const returnToEntry = () => {
    if (evidencePending || repertoireEvidence?.datePending) return;
    if (repertoireEvidence?.dateFailed && !window.confirm("A1 performances are saved. Leave without retrying the separate Rolodex practice-date update?")) return;
    if (executor.returnToPool()) onClose();
  };
  const midi = useContext(AppMidiContext);
  const result = <>
    <p role="status">{!evidencePending && state.durable?.closed ? `Saved attempt: ${state.durable.outcome}.` : "Attempt ended. Results are awaiting durable save."}</p>
    {!finished && state.durable?.closed && !evidencePending && <LessonExerciseFeedback compact attempt={state.durable} />}
    {!finished && run?.status === "summary" && <LessonNativeDetails pending={evidencePending} run={run} scopeNote={`Today's Piano Lesson · exercise ${state.index + 1} of ${state.queue.length}. This is a single-attempt native report; other lesson selections are not included.`} />}
  </>;
  return <section aria-label="Today's active piano lesson" className="space-y-3 break-words">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-xl font-semibold">Today&apos;s Piano Lesson</h2><p className="text-sm text-zinc-400">{program.program.title} · Revision {program.revision}</p></div>
      <p className="text-sm tabular-nums" aria-label="Lesson active practice time">{pacing.label} active · about 10 minutes</p>
    </header>
    {pacing.plannedTimeReached && !finished && <p className="text-sm text-sky-200" role="status">You&apos;ve reached today&apos;s planned practice time. Finish when ready.</p>}
    {!repertoireEntered && midi && midi.status !== "connected" && <p className="text-sm text-amber-200" role="status">MIDI is not connected. Use Connect MIDI in the exercise to retry, or use the existing on-screen input. Your program and rotation are already selected.</p>}
    {state.error && <div><p role="alert" className="text-red-300">{state.error} Results are pending in this tab; they are not shown as saved.</p><button className={button} disabled={state.saving || !active} onClick={() => void executor.retry()} type="button">Retry saving</button></div>}
    {state.saving && <p role="status">{run ? "Saving your exercise…" : "Preparing your exercise…"}</p>}
    {finished ? <>
      <h3 className="text-lg font-semibold">{evidencePending ? "Finishing lesson" : "Lesson finished"}</h3>
      <p role="status">{evidencePending ? "Results are awaiting durable save. Keep this tab open and retry saving if needed." : "Unperformed exercises remain unperformed."}</p>
      <PracticeLessonSummary repertoire={repertoireEvidence} exercises={program.nativeExercises} pending={evidencePending} programName={program.program.title} state={state} />
      {!repertoireEntered && run?.status === "summary" && result}
      <button className={primary} disabled={evidencePending || !!repertoireEvidence?.datePending} onClick={returnToEntry} type="button">Return</button>
    </> : !repertoireEntered && <>
      {active && !finishRequested && run?.status === "active" && <PracticeSessionRuntime allowSkip={false} hostedStart keyboardChoice={keyboardChoice} onKeyboardChoiceChange={onKeyboardChoiceChange} createExerciseToken={() => crypto.randomUUID()} dispatch={executor.handle} key={run.runId} now={executor.now} onPracticeActivityChange={activityChanged} run={run} lesson={{ position: state.index + 1, total: state.queue.length, cue: getPracticeLessonCue(exercise), nextTitle, nextLabel, disabled, pendingReason: state.error ? "Retry saving before continuing." : "Saving results before continuing…", evidence: state.durable, canRepeat: state.queue.length < PROGRAM_ATTEMPT_LIMITS.queue, onNext: next, onRepeat: repeat, onFinish: finish }} />}
      {run?.status === "summary" && <>
        <h3 className="font-semibold">Exercise {state.index + 1} of {state.queue.length} · {exercise?.label}</h3>
        <div className="flex flex-wrap gap-2">
          <button aria-label={nextTitle ? nextLabel : "Finish Lesson"} className={primary} disabled={disabled || executor.busy} onClick={nextTitle ? next : finish} type="button">{nextTitle ? <>{nextLabel} <span aria-hidden="true">→ {nextTitle}</span></> : "Finish Lesson"}</button>
          <details><summary className="min-h-11 cursor-pointer py-3 text-sm text-zinc-400">More practice options</summary><button className={button} disabled={disabled || executor.busy || state.queue.length >= PROGRAM_ATTEMPT_LIMITS.queue} onClick={repeat} type="button">Repeat Exercise</button></details>
        </div>
        {result}
      </>}
      {!run && !state.record && exercise && <>
        <h3 className="font-semibold">Exercise {state.index + 1} of {state.queue.length} · {exercise.label}</h3><p className="text-sm text-zinc-300">{getPracticeLessonCue(exercise)}</p>
        <button className={primary} disabled={disabled} onClick={next} type="button">Next Exercise</button>
      </>}
      {fundamentalNextTitle && (run?.status === "summary" || run?.completionPresentation === "target-complete" || !run && !state.record) && <details><summary className="min-h-11 cursor-pointer py-3 text-sm text-zinc-400">Skip an unstarted selection</summary><button className={button} disabled={disabled || state.saving || !!state.error} onClick={skip} type="button">Skip Exercise: {fundamentalNextTitle}</button></details>}
      {run?.status !== "active" && <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">{(nextTitle || !run) && <button className={button} disabled={finishRequested || !!state.error || !active} onClick={finish} type="button">Finish Lesson early</button>}<button className={button} disabled={evidencePending || !!repertoireEvidence?.datePending} onClick={returnToEntry} type="button">Return</button></div>}
      {run?.status !== "active" && <p className="text-xs text-zinc-400">Finish leaves remaining selections unperformed. Return is available after pending results are saved.</p>}
    </>}
    {!finished && !repertoireEntered && repertoire && !!state.queue.length && !occurrence && <button className={primary} disabled={evidencePending || !active} onClick={() => setRepertoireEntered(true)} type="button">Next: Repertoire</button>}
    {repertoireEntered && repertoire && <PracticeLessonRepertoire occurrence={repertoire} active={active} finished={finished} onFinish={finish} onChange={setRepertoireEvidence} onPlaying={setRepertoirePlaying} />}
  </section>;
}
