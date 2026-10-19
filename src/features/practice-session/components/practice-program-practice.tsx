import { useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppMidiContext } from "@/components/midi/midi-context";
import { PracticeProgramExecutor } from "../practice-program-executor";
import { programCalendarNow, PROGRAM_ATTEMPT_LIMITS } from "../practice-program-attempt";
import type { PracticeProgramRevision } from "../practice-program-types";
import { PracticeSessionRuntime } from "./practice-session-runtime";
import PracticeLessonSummary, { LessonExerciseFeedback, LessonNativeDetails } from "./practice-lesson-summary";
import { getPracticeLessonCue } from "../practice-lesson-cues";
import PracticeProgramHistory from "./practice-program-history";
import PracticeProgramLesson from "./practice-program-lesson";
const buttonClass = "min-h-11 rounded border border-zinc-600 px-3 disabled:opacity-40";
const primary = `${buttonClass} bg-sky-500 py-3 font-semibold text-white`;
const ignoreInput = () => {};
export default function PracticeProgramPractice({ program, active, onBusyChange, onClose, createExecutor, onInputChange = ignoreInput, morningSelection, notice }: Readonly<{
  program: PracticeProgramRevision; active: boolean; onBusyChange: (busy: boolean) => void; onClose: () => void;
  createExecutor?: (program: PracticeProgramRevision) => PracticeProgramExecutor;
  onInputChange?: (active: boolean) => void;
  morningSelection?: readonly string[]; notice?: string;
}>) {
  const [executor] = useState(() => createExecutor?.(program) ?? new PracticeProgramExecutor(program));
  const state = useSyncExternalStore(executor.subscribe, executor.getSnapshot), [selection, setSelection] = useState<readonly string[]>([]);
  const [finishRequested, setFinishRequested] = useState(false);
  useEffect(() => executor.attach(), [executor]);
  const busy = executor.busy || state.queue.length > 0;
  useLayoutEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  useLayoutEffect(() => executor.setForeground(active), [active, executor]);
  const morningStarted = useRef(false);
  const midi = useContext(AppMidiContext);
  useEffect(() => {
    if (!morningSelection || morningStarted.current || !active) return;
    morningStarted.current = true;
    executor.select(morningSelection);
    void executor.start();
  }, [active, executor, morningSelection]);
  const inputActive = active && state.run?.status === "active";
  useLayoutEffect(() => { onInputChange(inputActive); return () => onInputChange(false); }, [inputActive, onInputChange]);
  const occurrence = state.queue[state.index];
  const nextTitle = program.nativeExercises.find(entry => entry.id === state.queue[state.index + 1]?.exerciseId)?.label;
  const navigationDisabled = state.saving || !!state.error || !active;
  const returnToPool = () => { if (executor.returnToPool()) { setSelection([]); setFinishRequested(false); } };
  const finish = () => { setFinishRequested(true); executor.stop(); };
  useEffect(() => { if (finishRequested && state.run?.status === "active") executor.stop(); }, [finishRequested, state.run, executor]);
  const changeOrder = (index: number, delta: number) => { const values = [...selection], other = index + delta; if (other < 0 || other >= values.length) return; [values[index], values[other]] = [values[other]!, values[index]!]; setSelection(values); };
  if (morningSelection) return <PracticeProgramLesson active={active} executor={executor} onClose={onClose} program={program} state={state} />;
  return <section aria-label="Weekly program practice" className="space-y-4 break-words">
    <div><h2 className="text-xl font-semibold">Manual V2 practice</h2><p className="text-sm text-zinc-400">{program.program.title} · Revision {program.revision}</p></div>
    {notice && <p role="status">{notice}</p>}
    {morningSelection && midi && midi.status !== "connected" && <p className="text-sm text-amber-200" role="status">MIDI is not connected. Use Connect MIDI in the exercise to retry, or use the existing on-screen input. Your program and rotation are already selected.</p>}
    {!state.queue.length && <>
      <button className={buttonClass} onClick={() => setSelection(program.program.suggestedRotation?.find(rotation => rotation.day === programCalendarNow(Date.now()).weekday)?.exerciseIds ?? [])} type="button">Use today&apos;s suggested rotation</button>
      <fieldset className="space-y-2"><legend className="font-semibold">Exercise pool</legend>{program.program.exercises.map(exercise => <label className="flex min-h-11 items-center gap-2 rounded border border-white/10 p-2" key={exercise.id}><input checked={selection.includes(exercise.id)} onChange={event => setSelection(values => event.target.checked ? [...values, exercise.id] : values.filter(id => id !== exercise.id))} type="checkbox" /><span>{exercise.label}</span></label>)}</fieldset>
      {!!selection.length && <ol className="space-y-2">{selection.map((id, index) => <li className="flex flex-wrap items-center gap-2" key={id}><span className="mr-auto">{index + 1}. {program.program.exercises.find(exercise => exercise.id === id)!.label}</span><button aria-label={`Move ${id} earlier`} className={buttonClass} disabled={!index} onClick={() => changeOrder(index, -1)} type="button">↑</button><button aria-label={`Move ${id} later`} className={buttonClass} disabled={index === selection.length - 1} onClick={() => changeOrder(index, 1)} type="button">↓</button></li>)}</ol>}
      <div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={!selection.length} onClick={() => executor.select(selection)} type="button">Prepare selected exercises</button><button className={buttonClass} onClick={onClose} type="button">Back to definitions</button></div>
    </>}
    {!!state.queue.length && <>
      {state.run?.status !== "active" && <p className="text-sm">Selection {Math.min(state.index + 1, state.queue.length)} of {state.queue.length}{occurrence ? ` · ${program.program.exercises.find(exercise => exercise.id === occurrence.exerciseId)!.label}` : " · Queue finished"}</p>}
      {state.error && <div className="space-y-2"><p className="text-red-300" role="alert">{state.error} Results are pending in this tab; they are not shown as saved.</p><button className={buttonClass} disabled={state.saving} onClick={() => void executor.retry()} type="button">Retry saving</button></div>}
      {state.saving && <p role="status">{state.run ? "Saving acknowledged checkpoint…" : "Preparing your exercise…"}</p>}
      {!finishRequested && !state.run && !state.record && occurrence && <div className="flex flex-wrap gap-2"><button className={primary} disabled={executor.busy || !active} onClick={() => void executor.start()} type="button">Start selected exercise</button><button className={buttonClass} disabled={executor.busy} onClick={() => void executor.skip()} type="button">Skip this selection</button>{state.index === 0 && <button className={buttonClass} disabled={executor.busy} onClick={() => executor.returnToPool()} type="button">Edit selection</button>}</div>}
      {finishRequested && <><h3 className="text-lg font-semibold">{executor.busy ? "Finishing practice" : "Manual practice finished"}</h3><PracticeLessonSummary workflowLabel="Manual V2 practice" exercises={program.nativeExercises} pending={executor.busy} state={state} /></>}
      {active && !finishRequested && state.run?.status === "active" && <PracticeSessionRuntime allowSkip={false} createExerciseToken={() => crypto.randomUUID()} dispatch={executor.handle} key={state.run.runId} now={executor.now} run={state.run} manualQueue={{ position: state.index + 1, total: state.queue.length, cue: getPracticeLessonCue(state.record?.exercise), nextTitle, disabled: navigationDisabled, pendingReason: state.error ? "Retry saving before continuing." : "Saving results before continuing…", canRepeat: state.queue.length < PROGRAM_ATTEMPT_LIMITS.queue, evidence: state.durable, onNext: () => void executor.advanceLesson("next"), onRepeat: () => void executor.advanceLesson("repeat"), onFinish: finish }} />}
      {state.run?.status === "summary" && <>
        <p role="status">{state.durable?.closed ? `Saved attempt: ${state.durable.outcome}. Detailed native report below is temporary.` : "Attempt ended. Results are awaiting durable save."}</p>
        {!finishRequested && <><button aria-label={nextTitle ? "Next Exercise" : "Finish practice"} className={primary} disabled={executor.busy || !active} onClick={nextTitle ? () => void executor.advanceLesson("next") : finish} type="button">{nextTitle ? <>Next Exercise <span aria-hidden="true">→ {nextTitle}</span></> : "Finish practice"}</button>
          {state.durable?.closed && <LessonExerciseFeedback compact attempt={state.durable} />}
          <details><summary className="min-h-11 cursor-pointer py-3 text-sm text-zinc-400">More practice options</summary><button className={buttonClass} disabled={executor.busy || state.queue.length >= PROGRAM_ATTEMPT_LIMITS.queue} onClick={() => executor.repeat()} type="button">Repeat Exercise</button></details>
          <LessonNativeDetails pending={executor.busy} run={state.run} scopeNote={`Manual V2 practice · exercise ${state.index + 1} of ${state.queue.length}. This is a single-attempt native report; other selections are not included.`} />
        </>}
      </>}
      {state.run?.status !== "active" && <div className="border-t border-white/10 pt-3"><button className={finishRequested ? primary : buttonClass} disabled={executor.busy} onClick={returnToPool} type="button">Return to exercise pool</button></div>}
    </>}
    <details><summary className="min-h-11 cursor-pointer py-3 text-sm text-zinc-400">History and saved weekly progress</summary><PracticeProgramHistory changed={state.changed} program={program} /></details>
  </section>;
}
