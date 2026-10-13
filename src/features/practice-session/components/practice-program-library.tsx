import { useEffect, useRef, useState } from "react";
import { IndexedDbPracticePrograms } from "../persistence/practice-program-indexeddb";
import type { PracticeProgramRevision } from "../practice-program-types";
import PracticeProgramImportDialog, { type PracticeProgramStore } from "./practice-program-import-dialog";
import PracticeProgramPreview from "./practice-program-preview";
import WeeklyPracticeGuideDialog from "./weekly-practice-guide-dialog";
import PracticeProgramPractice from "./practice-program-practice";

const createBrowserStore = () => new IndexedDbPracticePrograms();
const ignoreBusy = () => {};
export default function PracticeProgramLibrary({ createStore = createBrowserStore, active = true, onBusyChange = ignoreBusy, onInputChange = ignoreBusy }: Readonly<{ createStore?: () => PracticeProgramStore; active?: boolean; onBusyChange?: (busy: boolean) => void; onInputChange?: (active: boolean) => void }>) {
  const owner = useRef<PracticeProgramStore | null>(null); const generation = useRef(0);
  const [programs, setPrograms] = useState<readonly PracticeProgramRevision[]>([]);
  const [revisions, setRevisions] = useState<readonly PracticeProgramRevision[]>([]);
  const [selected, setSelected] = useState<PracticeProgramRevision | null>(null);
  const [error, setError] = useState(""); const [status, setStatus] = useState(""); const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"import" | "guide" | null>(null);
  const [importStore, setImportStore] = useState<PracticeProgramStore | null>(null);
  const [practice, setPractice] = useState<PracticeProgramRevision | null>(null);
  const importButton = useRef<HTMLButtonElement>(null); const guideButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { const epoch = generation, store = createStore(); owner.current = store; return () => { epoch.current++; owner.current = null; store.close(); }; }, [createStore]);
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
  if (practice) return <PracticeProgramPractice active={active} key={`${practice.programId}:${practice.revision}`} onBusyChange={onBusyChange} onInputChange={onInputChange} onClose={() => setPractice(null)} program={practice} />;
  return <section aria-label="Weekly programs" className="mt-6 space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
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
    {dialog === "import" && importStore && <PracticeProgramImportDialog onClose={close} onSaved={message => { close(); setStatus(message); void load(); }} store={importStore} />}
    {dialog === "guide" && <WeeklyPracticeGuideDialog onClose={close} version={2} />}
    {selected && <button className="min-h-11 rounded bg-sky-500 px-4 font-semibold" onClick={() => setPractice(revisions.at(-1)!)} type="button">Practice current revision</button>}
  </section>;
}
