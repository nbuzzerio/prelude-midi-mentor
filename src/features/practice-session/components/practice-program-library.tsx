import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppMidiContext } from "@/components/midi/midi-context";
import { IndexedDbPracticePrograms } from "../persistence/practice-program-indexeddb";
import type { PracticeProgramRevision } from "../practice-program-types";
import PracticeProgramImportDialog, { type PracticeProgramStore } from "./practice-program-import-dialog";
import PracticeProgramPreview from "./practice-program-preview";
import WeeklyPracticeGuideDialog from "./weekly-practice-guide-dialog";
import PracticeProgramPractice from "./practice-program-practice";
import { browserLessonStorage, loadLessonPreference, saveLessonPreference } from "../practice-lesson-preferences";
import type { PracticeSessionStorage } from "../practice-session-library";
import { NO_SUGGESTED_LESSON, resolveMorningLesson, type MorningLesson } from "../practice-lesson";
import { getPracticeExerciseConfigurationSummary, getPracticeExerciseTargetSummary } from "../practice-session-presenters";
import { loadRepertoirePreference, saveRepertoirePreference, REPERTOIRE_INSTRUMENTS } from "../practice-repertoire-preferences";
import { freezeLessonRepertoire, selectLessonRepertoire, type LessonRepertoire } from "../practice-lesson-repertoire";
import { rolodexStore } from "../../piece-practice/rolodex/rolodex-store";
import type { RolodexEntry, RolodexStore } from "../../piece-practice/rolodex/rolodex-types";

const createBrowserStore = () => new IndexedDbPracticePrograms();
const ignoreBusy = () => {};
const wallNow = () => Date.now();
export default function PracticeProgramLibrary({ createStore = createBrowserStore, active = true, onBusyChange = ignoreBusy, onInputChange = ignoreBusy, children, preferenceStorage = browserLessonStorage, now = wallNow, repertoireStore = rolodexStore }: Readonly<{
  createStore?: () => PracticeProgramStore; active?: boolean; onBusyChange?: (busy: boolean) => void; onInputChange?: (active: boolean) => void;
  children?: ReactNode; preferenceStorage?: () => PracticeSessionStorage; now?: () => number;
  repertoireStore?: RolodexStore;
}>) {
  // Read connection controls only. The native engine remains the sole MIDI consumer.
  const midi = useContext(AppMidiContext);
  const owner = useRef<PracticeProgramStore | null>(null); const generation = useRef(0);
  const [programs, setPrograms] = useState<readonly PracticeProgramRevision[]>([]);
  const [revisions, setRevisions] = useState<readonly PracticeProgramRevision[]>([]);
  const [selected, setSelected] = useState<PracticeProgramRevision | null>(null);
  const [error, setError] = useState(""); const [status, setStatus] = useState(""); const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"import" | "guide" | null>(null);
  const [importStore, setImportStore] = useState<PracticeProgramStore | null>(null);
  const [practice, setPractice] = useState<Readonly<{ program: PracticeProgramRevision; startIds?: readonly string[]; notice?: string; repertoire?: LessonRepertoire }> | null>(null);
  const [repertoirePreference, setRepertoirePreference] = useState(() => loadRepertoirePreference(preferenceStorage));
  const [repertoirePreview, setRepertoirePreview] = useState<RolodexEntry | null>(null);
  const [repertoireNotice, setRepertoireNotice] = useState("");
  const [preference, setPreference] = useState(() => loadLessonPreference(preferenceStorage));
  const [lesson, setLesson] = useState<MorningLesson | null>(null);
  const [lessonError, setLessonError] = useState("");
  const [lessonLoading, setLessonLoading] = useState(!!preference.programId);
  const [choices, setChoices] = useState<readonly PracticeProgramRevision[] | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [launching, setLaunching] = useState(false);
  const launchLock = useRef(false), lessonGeneration = useRef(0);
  const importButton = useRef<HTMLButtonElement>(null); const guideButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let cancelled = false;
    if (!active || practice || !repertoirePreference.enabled) return;
    void repertoireStore.list().then(list => {
      if (cancelled) return;
      const selected = selectLessonRepertoire(list.entries, repertoirePreference, now(), list.acceptance);
      setRepertoirePreview(selected);
      setRepertoireNotice(selected ? "" : "No compatible active Piano passage is available. Fundamentals will proceed normally.");
    }, () => { if (!cancelled) { setRepertoirePreview(null); setRepertoireNotice("Repertoire could not be read. Fundamentals remain available."); } });
    return () => { cancelled = true; };
  }, [active, practice, repertoirePreference, repertoireStore, refresh, now]);
  useEffect(() => { const epoch = generation, store = createStore(); owner.current = store; return () => { epoch.current++; owner.current = null; store.close(); }; }, [createStore]);
  useEffect(() => {
    const epoch = lessonGeneration, token = ++epoch.current, store = owner.current;
    const current = () => owner.current === store && lessonGeneration.current === token;
    if (!active || practice) launchLock.current = false;
    if (active && !practice && store) {
      void Promise.resolve().then(async () => {
        if (!current()) return;
        if (!preference.programId) { setLessonLoading(false); setLaunching(false); return; }
        setLessonLoading(true); setLaunching(false); setLessonError("");
        try {
          const values = await store.list();
          if (!current()) return;
          const value = values.find(value => value.programId === preference.programId);
          if (!value) throw Error("The preferred weekly program is no longer available. Choose another saved program.");
          setLesson(resolveMorningLesson(value, now()));
        } catch (failure) {
          if (current()) { setLesson(null); setLessonError(failure instanceof Error ? failure.message : "Today's lesson could not be loaded. Try again or choose a weekly program."); }
        } finally { if (current()) setLessonLoading(false); }
      });
    }
    return () => { epoch.current++; };
  }, [active, practice, preference.programId, refresh, now]);
  useEffect(() => {
    const refreshCurrent = () => { if (active && !practice && !launchLock.current) setRefresh(value => value + 1); };
    const visible = () => { if (document.visibilityState === "visible") refreshCurrent(); };
    window.addEventListener("focus", refreshCurrent);
    document.addEventListener("visibilitychange", visible);
    return () => { window.removeEventListener("focus", refreshCurrent); document.removeEventListener("visibilitychange", visible); };
  }, [active, practice]);
  const choose = async () => {
    if (launchLock.current) return;
    const store = owner.current; if (!store) return;
    const token = ++lessonGeneration.current;
    setLessonLoading(true); setLessonError(""); setChoices(null);
    try {
      const values = await store.list();
      if (owner.current === store && lessonGeneration.current === token) setChoices(values);
    } catch (failure) {
      if (owner.current === store && lessonGeneration.current === token) setLessonError(failure instanceof Error ? failure.message : "Saved programs could not be loaded.");
    } finally { if (owner.current === store && lessonGeneration.current === token) setLessonLoading(false); }
  };
  const openLesson = async (start: boolean) => {
    if (launchLock.current || !active || !preference.programId) return;
    const store = owner.current; if (!store) return;
    launchLock.current = true; setLaunching(true); setLessonError("");
    const token = ++lessonGeneration.current;
    const current = () => owner.current === store && lessonGeneration.current === token;
    // Request only from this deliberate action, never from a mount/read effect.
    const connect = start && lesson?.exerciseIds.length && midi && midi.status !== "connected"
      ? midi.connectMidi().catch(() => undefined) : Promise.resolve();
    try {
      const values = await store.list();
      if (!current()) return;
      const program = values.find(value => value.programId === preference.programId);
      if (!program) throw Error("The preferred weekly program is no longer available. Choose another saved program.");
      const resolved = resolveMorningLesson(program, now());
      setLesson(resolved);
      if (start && resolved.exerciseIds.length) {
        let repertoire: LessonRepertoire | undefined;
        if (repertoirePreference.enabled) {
          try {
            const list = await repertoireStore.list();
            const selected = selectLessonRepertoire(list.entries, repertoirePreference, now(), list.acceptance);
            if (selected) repertoire = freezeLessonRepertoire(selected);
            if (current()) setRepertoireNotice(selected ? "" : "No compatible Piano passage was selected; fundamentals proceed normally.");
          } catch { if (current()) setRepertoireNotice("Repertoire could not be read. Fundamentals proceed normally."); }
        }
        await connect;
        if (current()) setPractice({ program: resolved.program, startIds: resolved.exerciseIds, repertoire });
      } else {
        setPractice({ program: resolved.program, notice: !resolved.exerciseIds.length ? NO_SUGGESTED_LESSON : undefined });
      }
    } catch (failure) {
      if (current()) setLessonError(failure instanceof Error ? failure.message : "Today's lesson could not start. No exercise was started.");
    } finally {
      if (current()) { launchLock.current = false; setLaunching(false); setLessonLoading(false); }
    }
  };
  const load = async (programId?: string) => {
    const store = owner.current; if (!store) return;
    const token = ++generation.current; setBusy(true); setError("");
    try {
      const list = await store.list(); const history = programId ? await store.revisions(programId) : [];
      if (owner.current !== store || generation.current !== token) return;
      setPrograms(list); setRevisions(history); setSelected(programId ? history.at(-1) ?? null : null);
      if (!list.length) setStatus("No saved weekly programs. Import a schema-2 definition to get started.");
    } catch (failure) { if (owner.current === store && generation.current === token) setError(failure instanceof Error ? failure.message : "Saved programs could not be loaded. Existing data is unchanged."); }
    finally { if (owner.current === store && generation.current === token) setBusy(false); }
  };
  const close = () => { const previous = dialog; setDialog(null); (previous === "guide" ? guideButton : importButton).current?.focus(); };
  return <>
    {practice && <PracticeProgramPractice active={active} key={`${practice.program.programId}:${practice.program.revision}`} onBusyChange={onBusyChange} onInputChange={onInputChange} onClose={() => setPractice(null)} program={practice.program} morningSelection={practice.startIds} notice={practice.notice} repertoire={practice.repertoire} />}
    <section aria-label="Today's Piano Lesson" className="mb-4 min-w-0 space-y-3 break-words rounded-xl border border-sky-400/40 bg-sky-950/30 p-4" hidden={!!practice}>
      <h2 className="text-2xl font-bold">Today&apos;s Piano Lesson</h2>
      {lesson && <p className="text-sm">Today&apos;s lesson: {lesson.exerciseIds.length} fundamentals{repertoirePreference.enabled && repertoirePreview ? " + one optional Piano repertoire passage" : ""}.</p>}
      {repertoirePreference.enabled && repertoirePreview && <p className="text-sm">Optional repertoire: {repertoirePreview.nickname || repertoirePreview.sourceTitle} · Measures {repertoirePreview.start + 1}–{repertoirePreview.end + 1} · {repertoirePreview.bpm} BPM</p>}
      <details><summary className="min-h-11 cursor-pointer py-3 text-sm text-zinc-400">Repertoire settings</summary>
        <fieldset disabled={launching} className="space-y-2">
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={repertoirePreference.enabled} onChange={event => { setRepertoirePreview(null); setRepertoirePreference(saveRepertoirePreference({ ...repertoirePreference, enabled: event.target.checked }, preferenceStorage)); }} />Include repertoire practice</label>
          <p className="text-sm">Piano lessons use only compatible passages explicitly enabled and configured for Piano. Manage passages in Staff Builder → Practice Rolodex.</p>
          {REPERTOIRE_INSTRUMENTS.map(instrument => <label className="flex min-h-11 items-center gap-2 capitalize" key={instrument}><input type="checkbox" checked={repertoirePreference.instruments.includes(instrument)} onChange={event => { setRepertoirePreview(null); setRepertoirePreference(saveRepertoirePreference({ ...repertoirePreference, instruments: event.target.checked ? [...repertoirePreference.instruments, instrument] : repertoirePreference.instruments.filter(i => i !== instrument) }, preferenceStorage)); }} />{instrument}</label>)}
          <p className="text-sm">Selection: due retention first, then unpracticed or oldest practice-day passages; priority within that group, oldest practice time, then creation and identity. Repertoire may extend the lesson beyond ten minutes.</p>
          {repertoirePreference.message && <p role="status">{repertoirePreference.message}</p>}
          {repertoirePreference.enabled && repertoireNotice && <p role="status">{repertoireNotice}</p>}
        </fieldset>
      </details>
      {preference.message && <p className="text-sm text-amber-200" role="status">{preference.message}</p>}
      {lessonError && <p className="text-red-300" role="alert">{lessonError}</p>}
      {lessonLoading && !launching && <p role="status">Loading today&apos;s lesson…</p>}
      {lesson && preference.programId && <p className="font-semibold">{lesson.program.program.title} · Revision {lesson.program.revision}</p>}
      {launching ? <div className="flex flex-wrap items-center gap-3"><p role="status">Preparing your exercise…</p><button className="min-h-11 rounded border border-zinc-600 px-4" onClick={() => { lessonGeneration.current++; launchLock.current = false; setLaunching(false); }} type="button">Cancel launch</button></div> : <div className="flex flex-wrap gap-2">
        {lesson && <><button className="min-h-11 max-w-full rounded bg-sky-500 px-4 py-2 font-semibold disabled:opacity-40" disabled={lessonLoading || !!lessonError} onClick={() => void openLesson(true)} type="button">{lesson.exerciseIds.length ? "Start Today's Lesson" : "Choose exercises"}</button><button className="min-h-11 rounded border border-zinc-600 px-4" disabled={lessonLoading} onClick={() => void openLesson(false)} type="button">Edit Lesson</button></>}
        <button className="min-h-11 rounded border border-zinc-600 px-4 disabled:opacity-40" disabled={lessonLoading} onClick={() => void choose()} type="button">{preference.programId ? "Change Weekly Program" : "Choose Weekly Program"}</button>
        {lessonError && preference.programId && <button className="min-h-11 rounded border border-zinc-600 px-4" onClick={() => setRefresh(value => value + 1)} type="button">Retry loading lesson</button>}
      </div>}
      {choices && !launching && <div className="space-y-2" aria-label="Choose preferred weekly program">{choices.length ? choices.map(value => <button className="block min-h-11 max-w-full break-words rounded border border-zinc-600 px-4 py-2 text-left" key={value.programId} onClick={() => { setPreference(saveLessonPreference(value.programId, preferenceStorage)); setLesson(null); setChoices(null); setRefresh(value => value + 1); }} type="button">Use {value.program.title} for today&apos;s lesson</button>) : <p>No saved weekly programs. Use Import Weekly Program below to save one, then choose it here.</p>}</div>}
      {lesson && preference.programId && <>
        <p className="text-sm capitalize">{lesson.weekday}&apos;s suggested rotation</p>
        {lesson.exerciseIds.length ? <ol className="max-h-36 list-inside list-decimal space-y-1 overflow-y-auto text-sm text-zinc-300" aria-label="Today's exercise order" tabIndex={0}>{lesson.exerciseIds.map(id => {
          const exercise = lesson.program.nativeExercises.find(value => value.id === id)!;
          return <li key={id}><strong>{exercise.label}</strong> · {getPracticeExerciseConfigurationSummary(exercise)} · {getPracticeExerciseTargetSummary(exercise)}</li>;
        })}</ol> : <p>{NO_SUGGESTED_LESSON}</p>}
      </>}
    </section>
    {children && <details className="mb-3 rounded-xl border border-white/10 px-4" hidden={!!practice} inert={launching || !!practice || undefined}>
      <summary className="min-h-11 cursor-pointer py-3 text-sm text-zinc-400">Legacy Practice Sessions (V1)</summary>
      <p className="mb-3 text-sm text-zinc-400">Separate preset-based practice. Your saved presets and unsaved drafts stay here.</p>
      {children}
    </details>}
    <details className="rounded-xl border border-white/10 px-4" open={!preference.programId} hidden={!!practice} inert={launching || !!practice || undefined}>
    <summary className="min-h-11 cursor-pointer py-3 text-sm text-zinc-400">Weekly program setup and management</summary>
    <section aria-label="Weekly programs" className="mt-6 space-y-4 rounded-xl border border-white/10 bg-white/5 p-4" hidden={!!practice} inert={launching || !!practice || undefined}>
    <div><h2 className="text-xl font-semibold">Weekly Programs</h2><p className="mt-1 text-sm text-zinc-400">Save a reusable Sunday–Saturday exercise pool. Choose freely, repeat exercises and retain basic attempt history locally.</p></div>
    <div className="flex flex-wrap gap-2">
      <button className="min-h-11 rounded border border-zinc-600 px-4" onClick={() => { setImportStore(owner.current); setDialog("import"); }} ref={importButton} type="button">Import Weekly Program</button>
      <button className="min-h-11 rounded border border-zinc-600 px-4" onClick={() => setDialog("guide")} ref={guideButton} type="button">Weekly Program AI Guide</button>
      <button className="min-h-11 rounded border border-zinc-600 px-4 disabled:opacity-40" disabled={busy} onClick={() => void load()} type="button">View saved programs</button>
    </div>
    {error && <p className="break-words text-red-300" role="alert">{error}</p>}
    {status && <p className="text-sm text-zinc-300" role="status">{status}</p>}
    {busy && <p role="status">Loading definitions…</p>}
    {!!programs.length && <ul className="flex flex-wrap gap-2">{programs.map(value => <li key={value.programId}><button className="min-h-11 break-words rounded bg-zinc-800 px-3 py-2 text-left disabled:opacity-40" disabled={busy} onClick={() => void load(value.programId)} type="button">{value.program.title} · Revision {value.revision}</button></li>)}</ul>}
    {selected && <><label className="block">Saved revision<select className="ml-2 min-h-11 max-w-full rounded border border-zinc-600 bg-zinc-900 px-3" onChange={event => setSelected(revisions.find(value => value.revision === Number(event.target.value)) ?? null)} value={selected.revision}>{revisions.map(value => <option key={value.revision} value={value.revision}>Revision {value.revision}</option>)}</select></label><PracticeProgramPreview value={selected} /></>}
    {dialog === "import" && importStore && <PracticeProgramImportDialog onClose={close} onSaved={message => { close(); setStatus(message); setRefresh(value => value + 1); void load(); }} store={importStore} />}
    {dialog === "guide" && <WeeklyPracticeGuideDialog onClose={close} version={2} />}
    {selected && <button className="min-h-11 rounded bg-sky-500 px-4 font-semibold" onClick={() => setPractice({ program: revisions.at(-1)! })} type="button">Practice current revision</button>}
  </section></details></>;
}
