import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { PracticeProgramExecutor } from "../practice-program-executor";
import { programCalendarNow, PROGRAM_ATTEMPT_LIMITS } from "../practice-program-attempt";
import type { PracticeProgramRevision } from "../practice-program-types";
import { PracticeSessionRuntime } from "./practice-session-runtime";
import PracticeLessonSummary, { LessonExerciseFeedback, LessonNativeDetails } from "./practice-lesson-summary";
import { getPracticeLessonCue } from "../practice-lesson-cues";
import PracticeProgramHistory from "./practice-program-history";
import PracticeProgramLesson from "./practice-program-lesson";
import { freezeLessonRepertoire, selectLessonRepertoire, type LessonRepertoire, type RepertoireEvidence } from "../practice-lesson-repertoire";
import { loadRepertoirePreference, saveRepertoirePreference, type RepertoirePreference } from "../practice-repertoire-preferences";
import { rolodexStore } from "../../piece-practice/rolodex/rolodex-store";
import type { RolodexStore } from "../../piece-practice/rolodex/rolodex-types";
import { PracticeLessonRepertoire } from "./practice-lesson-repertoire";
const buttonClass = "min-h-11 rounded border border-zinc-600 px-3 disabled:opacity-40";
const primary = `${buttonClass} bg-sky-500 py-3 font-semibold text-white`;
const ignoreInput = () => {};
export default function PracticeProgramPractice({ program, active, onBusyChange, onClose, createExecutor, onInputChange = ignoreInput, morningSelection, notice, repertoire, repertoirePreference, onRepertoirePreferenceChange, repertoireStore = rolodexStore, wallNow = Date.now }: Readonly<{
  program: PracticeProgramRevision; active: boolean; onBusyChange: (busy: boolean) => void; onClose: () => void;
  createExecutor?: (program: PracticeProgramRevision) => PracticeProgramExecutor;
  onInputChange?: (active: boolean) => void;
  morningSelection?: readonly string[]; notice?: string; repertoire?: LessonRepertoire;
  repertoirePreference?: RepertoirePreference; onRepertoirePreferenceChange?: (enabled: boolean) => void;
  repertoireStore?: Pick<RolodexStore, "list">; wallNow?: () => number;
}>) {
  const [executor] = useState(() => createExecutor?.(program) ?? new PracticeProgramExecutor(program));
  const state = useSyncExternalStore(executor.subscribe, executor.getSnapshot), [selection, setSelection] = useState<readonly string[]>([]);
  const [finishRequested, setFinishRequested] = useState(false);
  const [repertoireInput, setRepertoireInput] = useState(false);
  const [keyboardChoice, setKeyboardChoice] = useState<boolean | null>(null);
  const [localPreference, setLocalPreference] = useState(loadRepertoirePreference);
  const preference = repertoirePreference ?? localPreference;
  const [manualRepertoire, setManualRepertoire] = useState<LessonRepertoire>();
  const [repertoireEvidence, setRepertoireEvidence] = useState<RepertoireEvidence>();
  const [repertoireEntered, setRepertoireEntered] = useState(false);
  const [repertoireNotice, setRepertoireNotice] = useState("");
  const [launching, setLaunching] = useState(false);
  const launch = useRef({ generation: 0, pending: false, resolved: false });
  const interaction = useRef(0), entryIntent = useRef<number | null>(null);
  const nextIntent = useRef<string | null>(null), retryFocus = useRef<{ id: string; interaction: number } | null>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const entryFocusAllowed = useCallback(() => entryIntent.current === interaction.current, []);
  useEffect(() => {
    const interacted = () => { interaction.current++; };
    document.addEventListener("pointerdown", interacted, true);
    document.addEventListener("keydown", interacted, true);
    const hidden = () => { if (document.visibilityState === "hidden") { interaction.current++; launch.current.generation++; launch.current.pending = false; setLaunching(false); } };
    document.addEventListener("visibilitychange", hidden);
    const owner = launch.current;
    return () => { owner.generation++; owner.pending = false; document.removeEventListener("pointerdown", interacted, true); document.removeEventListener("keydown", interacted, true); document.removeEventListener("visibilitychange", hidden); };
  }, []);
  useLayoutEffect(() => {
    if (active) return;
    const generation = ++launch.current.generation;
    launch.current.pending = false; entryIntent.current = null;
    queueMicrotask(() => { if (launch.current.generation === generation) setLaunching(false); });
  }, [active]);
  useEffect(() => executor.attach(), [executor]);
  const busy = executor.busy || state.queue.length > 0;
  useLayoutEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  useLayoutEffect(() => executor.setForeground(active), [active, executor]);
  const morningStarted = useRef(false);
  useEffect(() => {
    if (!morningSelection || morningStarted.current || !active) return;
    morningStarted.current = true;
    executor.select(morningSelection);
    void executor.start();
  }, [active, executor, morningSelection]);
  const inputActive = active && (state.run?.status === "active" || repertoireInput || repertoireEntered && !finishRequested);
  useLayoutEffect(() => { onInputChange(inputActive); return () => onInputChange(false); }, [inputActive, onInputChange]);
  const occurrence = state.queue[state.index];
  const fundamentalNextTitle = program.nativeExercises.find(entry => entry.id === state.queue[state.index + 1]?.exerciseId)?.label;
  const nextTitle = fundamentalNextTitle ?? (manualRepertoire ? "Repertoire" : undefined);
  const nextLabel = !fundamentalNextTitle && manualRepertoire ? "Next: Repertoire" : "Next Exercise";
  const evidencePending = executor.busy || !!repertoireEvidence?.pending;
  const navigationDisabled = state.saving || !!state.error || !active || launching;
  const resetSupplement = () => {
    launch.current.generation++; launch.current.pending = false; launch.current.resolved = false;
    setLaunching(false); setManualRepertoire(undefined); setRepertoireEvidence(undefined); setRepertoireEntered(false); setRepertoireNotice("");
    nextIntent.current = null; retryFocus.current = null;
  };
  const returnToPool = () => {
    if (evidencePending || repertoireEvidence?.datePending) return;
    if (repertoireEvidence?.dateFailed && !window.confirm("A1 performances are saved. Leave without retrying the separate Rolodex practice-date/progress update?")) return;
    if (executor.returnToPool()) { resetSupplement(); setSelection([]); setFinishRequested(false); setKeyboardChoice(null); }
  };
  const finish = () => { if (repertoireEvidence?.pending) return; nextIntent.current = null; retryFocus.current = null; setFinishRequested(true); executor.stop(); };
  const start = async () => {
    if (launch.current.pending || executor.busy || !active || !occurrence) return;
    entryIntent.current = interaction.current;
    if (!launch.current.resolved) {
      const token = ++launch.current.generation;
      launch.current.pending = true; setLaunching(true);
      let selected: LessonRepertoire | undefined, message = "";
      if (preference.enabled) {
        try {
          const list = await repertoireStore.list();
          const entry = selectLessonRepertoire(list.entries, preference, wallNow(), list.acceptance);
          if (entry) selected = freezeLessonRepertoire(entry);
          else message = "No compatible Piano passage was selected; fundamentals proceed normally.";
        } catch { message = "Repertoire could not be read. Fundamentals proceed normally."; }
      }
      if (token !== launch.current.generation) return;
      launch.current.pending = false; launch.current.resolved = true; setLaunching(false);
      setManualRepertoire(selected); setRepertoireNotice(message);
      setRepertoireEvidence(selected ? { occurrence: selected, attempts: [], skipped: false, pending: false, datePending: 0, dateFailed: 0 } : undefined);
    }
    await executor.start();
  };
  const next = () => {
    const generation = launch.current.generation;
    entryIntent.current = interaction.current; nextIntent.current = state.run?.runId ?? null;
    void executor.advanceLesson("next").then(() => {
      const current = executor.getSnapshot();
      if (manualRepertoire && generation === launch.current.generation && current.queue.length && current.index >= current.queue.length && !executor.busy && active && document.visibilityState !== "hidden") setRepertoireEntered(true);
    });
  };
  const repeat = () => { entryIntent.current = interaction.current; nextIntent.current = null; retryFocus.current = null; void executor.advanceLesson("repeat"); };
  const retry = () => {
    entryIntent.current = interaction.current;
    if (nextIntent.current && nextIntent.current === state.run?.runId) retryFocus.current = { id: nextIntent.current, interaction: interaction.current };
    void executor.retry();
  };
  useEffect(() => {
    const intent = retryFocus.current;
    if (!intent || !state.durable?.closed || state.durable.attemptId !== intent.id || state.saving || state.error) return;
    retryFocus.current = null;
    if (active && !finishRequested && intent.interaction === interaction.current && document.visibilityState !== "hidden") nextButton.current?.focus();
  }, [active, finishRequested, state.durable, state.saving, state.error]);
  useEffect(() => { if (finishRequested && state.run?.status === "active") executor.stop(); }, [finishRequested, state.run, executor]);
  const changeOrder = (index: number, delta: number) => { const values = [...selection], other = index + delta; if (other < 0 || other >= values.length) return; [values[index], values[other]] = [values[other]!, values[index]!]; setSelection(values); };
  if (morningSelection) return <PracticeProgramLesson active={active} executor={executor} keyboardChoice={keyboardChoice} onKeyboardChoiceChange={setKeyboardChoice} onClose={onClose} program={program} state={state} repertoire={repertoire} onRepertoireInput={setRepertoireInput} />;
  return <section aria-label="Weekly program practice" className="manual-v2-practice space-y-4 break-words">
    <div><h2 className="text-xl font-semibold">Manual V2 practice</h2><p className="text-sm text-zinc-400">{program.program.title} · Revision {program.revision}</p></div>
    {notice && <p role="status">{notice}</p>}
    {repertoireNotice && <p role="status">{repertoireNotice}</p>}
    {!state.queue.length && <>
      <button className={buttonClass} onClick={() => setSelection(program.program.suggestedRotation?.find(rotation => rotation.day === programCalendarNow(Date.now()).weekday)?.exerciseIds ?? [])} type="button">Use today&apos;s suggested rotation</button>
      <fieldset className="space-y-2"><legend className="font-semibold">Exercise pool</legend><div className="flex flex-wrap gap-2"><button className={buttonClass} type="button" onClick={() => setSelection(program.program.exercises.map(exercise => exercise.id))}>Select All</button><button className={buttonClass} type="button" onClick={() => setSelection([])}>Clear All</button></div>{program.program.exercises.map(exercise => <label className="flex min-h-11 items-center gap-2 rounded border border-white/10 p-2" key={exercise.id}><input checked={selection.includes(exercise.id)} onChange={event => setSelection(values => event.target.checked ? [...values, exercise.id] : values.filter(id => id !== exercise.id))} type="checkbox" /><span>{exercise.label}</span></label>)}</fieldset>
      <div><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={preference.enabled} onChange={event => onRepertoirePreferenceChange ? onRepertoirePreferenceChange(event.target.checked) : setLocalPreference(saveRepertoirePreference({ ...preference, enabled: event.target.checked }))} />Include Rolodex Repertoire</label><p className="text-sm text-zinc-400">One compatible saved Piano passage after the fundamentals. Uses the same optional repertoire preference as Today's Piano Lesson.</p>{preference.enabled && !preference.instruments.includes("piano") && <p role="status">Piano is not enabled in Repertoire settings on Today's Piano Lesson. Fundamentals remain available.</p>}{preference.message && <p role="status">{preference.message}</p>}</div>
      {!!selection.length && <ol className="space-y-2">{selection.map((id, index) => <li className="flex flex-wrap items-center gap-2" key={id}><span className="mr-auto">{index + 1}. {program.program.exercises.find(exercise => exercise.id === id)!.label}</span><button aria-label={`Move ${id} earlier`} className={buttonClass} disabled={!index} onClick={() => changeOrder(index, -1)} type="button">↑</button><button aria-label={`Move ${id} later`} className={buttonClass} disabled={index === selection.length - 1} onClick={() => changeOrder(index, 1)} type="button">↓</button></li>)}</ol>}
      <div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={!selection.length} onClick={() => executor.select(selection)} type="button">Prepare selected exercises</button><button className={buttonClass} onClick={onClose} type="button">Back to definitions</button></div>
    </>}
    {!!state.queue.length && <>
      {state.run?.status !== "active" && <p className="text-sm">Selection {Math.min(state.index + 1, state.queue.length)} of {state.queue.length}{occurrence ? ` · ${program.program.exercises.find(exercise => exercise.id === occurrence.exerciseId)!.label}` : " · Queue finished"}</p>}
      {state.error && <div className="space-y-2"><p className="text-red-300" role="alert">{state.error} Results are pending in this tab; they are not shown as saved.</p><button className={buttonClass} disabled={state.saving || !active} onClick={retry} type="button">Retry saving</button></div>}
      {state.saving && <p role="status">{state.run ? "Saving acknowledged checkpoint…" : "Preparing your exercise…"}</p>}
      {launching && <div><p role="status">Looking for optional Piano repertoire…</p><button className={buttonClass} type="button" onClick={resetSupplement}>Cancel start</button></div>}
      {!finishRequested && !state.run && !state.record && occurrence && <div className="flex flex-wrap gap-2"><button className={primary} disabled={executor.busy || navigationDisabled} onClick={() => void start()} type="button">Start selected exercise</button><button className={buttonClass} disabled={executor.busy || navigationDisabled} onClick={() => void executor.skip()} type="button">Skip this selection</button>{state.index === 0 && <button className={buttonClass} disabled={executor.busy || launching} onClick={() => { if (executor.returnToPool()) resetSupplement(); }} type="button">Edit selection</button>}</div>}
      {finishRequested && <><h3 className="text-lg font-semibold">{evidencePending ? "Finishing practice" : "Manual practice finished"}</h3><PracticeLessonSummary repertoire={repertoireEvidence} workflowLabel="Manual V2 practice" programName={program.program.title} exercises={program.nativeExercises} pending={evidencePending} state={state} /></>}
      {active && !finishRequested && !repertoireEntered && state.run?.status === "active" && <PracticeSessionRuntime allowSkip={false} entryFocusAllowed={entryFocusAllowed} keyboardChoice={keyboardChoice} onKeyboardChoiceChange={setKeyboardChoice} createExerciseToken={() => crypto.randomUUID()} dispatch={executor.handle} key={state.run.runId} now={executor.now} run={state.run} manualQueue={{ position: state.index + 1, total: state.queue.length, cue: getPracticeLessonCue(state.record?.exercise), nextTitle, nextLabel, disabled: navigationDisabled, pendingReason: state.error ? "Retry saving before continuing." : "Saving results before continuing…", canRepeat: state.queue.length < PROGRAM_ATTEMPT_LIMITS.queue, evidence: state.durable, onNext: next, onRepeat: repeat, onFinish: finish }} />}
      {state.run?.status === "summary" && <>
        <p role="status">{state.durable?.closed ? `Saved attempt: ${state.durable.outcome}. Detailed native report below is temporary.` : "Attempt ended. Results are awaiting durable save."}</p>
        {!finishRequested && !repertoireEntered && <><button ref={nextButton} aria-label={nextTitle ? nextLabel : "Finish practice"} className={primary} disabled={executor.busy || !active} onClick={nextTitle ? next : finish} type="button">{nextTitle ? <>{nextLabel} <span aria-hidden="true">→ {nextTitle}</span></> : "Finish practice"}</button>
          {state.durable?.closed && <LessonExerciseFeedback compact attempt={state.durable} />}
          <details><summary className="min-h-11 cursor-pointer py-3 text-sm text-zinc-400">More practice options</summary><button className={buttonClass} disabled={executor.busy || !active || state.queue.length >= PROGRAM_ATTEMPT_LIMITS.queue} onClick={repeat} type="button">Repeat Exercise</button></details>
          <LessonNativeDetails pending={executor.busy} run={state.run} scopeNote={`Manual V2 practice · exercise ${state.index + 1} of ${state.queue.length}. This is a single-attempt native report; other selections are not included.`} />
        </>}
      </>}
      {!finishRequested && !repertoireEntered && !occurrence && !state.run && <button className={primary} disabled={evidencePending || !active} onClick={manualRepertoire ? () => { entryIntent.current = interaction.current; setRepertoireEntered(true); } : finish} type="button">{manualRepertoire ? "Next: Repertoire" : "Finish practice"}</button>}
      {repertoireEntered && manualRepertoire && <PracticeLessonRepertoire key={manualRepertoire.id} occurrence={manualRepertoire} active={active} finished={finishRequested} onFinish={finish} onChange={setRepertoireEvidence} onPlaying={ignoreInput} finishLabel="Finish practice" entryFocusAllowed={entryFocusAllowed} />}
      {state.run?.status !== "active" && <div className="border-t border-white/10 pt-3"><button className={finishRequested ? primary : buttonClass} disabled={evidencePending || !!repertoireEvidence?.datePending || launching} onClick={returnToPool} type="button">Return to exercise pool</button></div>}
    </>}
    <details><summary className="min-h-11 cursor-pointer py-3 text-sm text-zinc-400">History and saved weekly progress</summary><PracticeProgramHistory changed={state.changed} program={program} /></details>
  </section>;
}
