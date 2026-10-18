import { useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppMidiContext } from "@/components/midi/midi-context";
import { PracticeProgramExecutor } from "../practice-program-executor";
import { programCalendarNow, PROGRAM_ATTEMPT_LIMITS } from "../practice-program-attempt";
import type { PracticeProgramRevision } from "../practice-program-types";
import { PracticeSessionRuntime, PracticeSessionSummary } from "./practice-session-runtime";
import PracticeProgramHistory from "./practice-program-history";
const buttonClass = "min-h-11 rounded border border-zinc-600 px-3 disabled:opacity-40";
const ignoreInput = () => {};
export default function PracticeProgramPractice({ program, active, onBusyChange, onClose, createExecutor, onInputChange = ignoreInput, morningSelection, notice }: Readonly<{
  program: PracticeProgramRevision; active: boolean; onBusyChange: (busy: boolean) => void; onClose: () => void;
  createExecutor?: (program: PracticeProgramRevision) => PracticeProgramExecutor;
  onInputChange?: (active: boolean) => void;
  morningSelection?: readonly string[]; notice?: string;
}>) {
  const [executor] = useState(() => createExecutor?.(program) ?? new PracticeProgramExecutor(program));
  const state = useSyncExternalStore(executor.subscribe, executor.getSnapshot), [selection, setSelection] = useState<readonly string[]>([]);
  useEffect(() => executor.attach(), [executor]);
  const busy = executor.busy || state.queue.length > 0;
  useLayoutEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  useLayoutEffect(() => executor.setForeground(active), [active, executor]);
  const morningStarted = useRef(false);
  const [morningAttempt, setMorningAttempt] = useState<string>();
  const midi = useContext(AppMidiContext);
  useEffect(() => {
    if (!morningSelection || morningStarted.current) return;
    morningStarted.current = true;
    executor.select(morningSelection);
    if (active) {
      const started = executor.start(), attemptId = executor.getSnapshot().record?.attemptId;
      void started.then(() => setMorningAttempt(attemptId));
    }
  }, [active, executor, morningSelection]);
  const inputActive = active && state.run?.status === "active";
  useLayoutEffect(() => { onInputChange(inputActive); return () => onInputChange(false); }, [inputActive, onInputChange]);
  const occurrence = state.queue[state.index];
  const returnToPool = () => { if (executor.returnToPool()) setSelection([]); };
  const changeOrder = (index: number, delta: number) => { const values = [...selection], other = index + delta; if (other < 0 || other >= values.length) return; [values[index], values[other]] = [values[other]!, values[index]!]; setSelection(values); };
  return <section aria-label="Weekly program practice" className="space-y-4 break-words">
    <div><h2 className="text-xl font-semibold">{program.program.title} · Weekly practice</h2><p className="text-sm text-zinc-400">Current revision {program.revision}. Choose freely, repeat explicitly, and keep missing days neutral.</p></div>
    {notice && <p role="status">{notice}</p>}
    {morningSelection && midi && midi.status !== "connected" && <p className="text-sm text-amber-200" role="status">MIDI is not connected. Use Connect MIDI in the exercise to retry, or use the existing on-screen input. Your program and rotation are already selected.</p>}
    {!state.queue.length && <>
      <button className={buttonClass} onClick={() => setSelection(program.program.suggestedRotation?.find(rotation => rotation.day === programCalendarNow(Date.now()).weekday)?.exerciseIds ?? [])} type="button">Use today&apos;s suggested rotation</button>
      <fieldset className="space-y-2"><legend className="font-semibold">Exercise pool</legend>{program.program.exercises.map(exercise => <label className="flex min-h-11 items-center gap-2 rounded border border-white/10 p-2" key={exercise.id}><input checked={selection.includes(exercise.id)} onChange={event => setSelection(values => event.target.checked ? [...values, exercise.id] : values.filter(id => id !== exercise.id))} type="checkbox" /><span>{exercise.label}</span></label>)}</fieldset>
      {!!selection.length && <ol className="space-y-2">{selection.map((id, index) => <li className="flex flex-wrap items-center gap-2" key={id}><span className="mr-auto">{index + 1}. {program.program.exercises.find(exercise => exercise.id === id)!.label}</span><button aria-label={`Move ${id} earlier`} className={buttonClass} disabled={!index} onClick={() => changeOrder(index, -1)} type="button">↑</button><button aria-label={`Move ${id} later`} className={buttonClass} disabled={index === selection.length - 1} onClick={() => changeOrder(index, 1)} type="button">↓</button></li>)}</ol>}
      <div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={!selection.length} onClick={() => executor.select(selection)} type="button">Prepare selected exercises</button><button className={buttonClass} onClick={onClose} type="button">Back to definitions</button></div>
    </>}
    {!!state.queue.length && <>
      <p className="text-sm">Selection {Math.min(state.index + 1, state.queue.length)} of {state.queue.length}{occurrence ? ` · ${program.program.exercises.find(exercise => exercise.id === occurrence.exerciseId)!.label}` : " · Queue finished"}</p>
      {state.error && <div className="space-y-2"><p className="text-red-300" role="alert">{state.error} Results are pending in this tab; they are not shown as saved.</p><button className={buttonClass} disabled={state.saving} onClick={() => void executor.retry()} type="button">Retry saving</button></div>}
      {state.saving && <p role="status">{state.run ? "Saving acknowledged checkpoint…" : "Preparing your exercise…"}</p>}
      {!state.run && !state.record && occurrence && <div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={executor.busy || !active} onClick={() => void executor.start()} type="button">Start selected exercise</button><button className={buttonClass} disabled={executor.busy} onClick={() => void executor.skip()} type="button">Skip this selection</button>{state.index === 0 && <button className={buttonClass} disabled={executor.busy} onClick={() => executor.returnToPool()} type="button">Edit selection</button>}</div>}
      {active && state.run?.status === "active" && <PracticeSessionRuntime allowSkip={false} hostedStart={state.run.runId === morningAttempt} createExerciseToken={() => crypto.randomUUID()} dispatch={executor.handle} key={state.run.runId} now={executor.now} run={state.run} />}
      {state.run?.status === "summary" && <>
        <p role="status">{state.durable?.closed ? `Saved attempt: ${state.durable.outcome}. Detailed native report below is temporary.` : "Attempt ended. Results are awaiting durable save."}</p>
        <div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={executor.busy || state.queue.length >= PROGRAM_ATTEMPT_LIMITS.queue} onClick={() => executor.repeat()} type="button">Repeat exercise (new attempt)</button><button className={buttonClass} disabled={executor.busy} onClick={() => executor.next()} type="button">Continue to next selection</button></div>
        <div inert={executor.busy || undefined}><PracticeSessionSummary onBack={returnToPool} run={state.run} /></div>
      </>}
      <button className={buttonClass} disabled={executor.busy} onClick={returnToPool} type="button">Return to exercise pool</button>
    </>}
    <PracticeProgramHistory changed={state.changed} program={program} />
  </section>;
}
