import { useCallback, useEffect, useRef, useState } from "react";
import { DownloadDialog } from "@/components/download-dialog";
import type { DownloadSnapshot } from "@/lib/files/browser-download";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import { piecePracticeRunStore } from "../persistence/piece-practice-runs";
import { exportBackup, parseBackup, prepareImport } from "./rolodex-backup";
import { editEntry, instruments, playability, ROLODEX_LIMITS, sourceStatus } from "./rolodex-model";
import { RolodexEditor, rolodexButton, rolodexField } from "./rolodex-editor";
import { RolodexPractice } from "./rolodex-practice";
import { rolodexStore } from "./rolodex-store";
import { rolodexSuggestions } from "./rolodex-suggestions";
import type { RolodexEntry, RolodexStore } from "./rolodex-types";

const statusLabel = { "needs-practice": "Needs Practice", improving: "Improving", paused: "Paused", archived: "Archived" };
export function RolodexLibrary({ sources, initialDraft, store = rolodexStore, onExit, onGuardChange }: Readonly<{
  sources: readonly StaffBuilderScore[]; initialDraft?: RolodexEntry; store?: RolodexStore; onExit: () => void;
  onGuardChange?: (guard: (() => boolean) | null) => void;
}>) {
  const [entries, setEntries] = useState<readonly RolodexEntry[]>([]);
  const [unavailable, setUnavailable] = useState(0), [loaded, setLoaded] = useState(false);
  const [editor, setEditor] = useState<{ entry: RolodexEntry; existing: boolean } | null>(initialDraft ? { entry: initialDraft, existing: false } : null);
  const [practice, setPractice] = useState<RolodexEntry | null>(null);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [retryChange, setRetryChange] = useState(false);
  const lock = useRef(false), pendingAction = useRef<(() => Promise<void>) | null>(null);
  const [instrument, setInstrument] = useState("all"), [status, setStatus] = useState("active"), [piece, setPiece] = useState("all"), [priority, setPriority] = useState(false);
  const [download, setDownload] = useState<DownloadSnapshot | null>(null);
  const [imported, setImported] = useState<readonly RolodexEntry[] | null>(null), [remap, setRemap] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<readonly RolodexEntry[] | null>(null);
  const reload = useCallback(async () => {
    const listing = await store.list(); setEntries(listing.entries); setUnavailable(listing.unavailableCount); setLoaded(true);
  }, [store]);
  useEffect(() => {
    let active = true;
    void store.list().then(listing => {
      if (active) { setEntries(listing.entries); setUnavailable(listing.unavailableCount); setLoaded(true); }
    }, () => { if (active) setError("Rolodex could not be read. Existing records are preserved. Retry Load."); });
    return () => { active = false; };
  }, [store]);
  const perform = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; pendingAction.current = action; setRetryChange(true); setBusy(true); setError("");
    try { await action(); pendingAction.current = null; setRetryChange(false); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Storage failed. Existing passages were preserved."); }
    finally { lock.current = false; setBusy(false); }
  };
  const change = (entry: RolodexEntry, changes: Parameters<typeof editEntry>[1]) => {
    const next = editEntry(entry, changes);
    void perform(async () => { const result = await store.save(next, entry.revision); setNotice(result.duplicate ? "A matching passage already exists." : "Passage updated locally."); });
  };
  const backup = (selection: readonly RolodexEntry[]) => { try { setDownload(exportBackup(selection)); } catch (e) { setError(String(e)); } };
  if (practice) return <RolodexPractice entry={practice} store={store} onGuardChange={onGuardChange} onExit={() => { setPractice(null); void reload().catch(() => setError("Could not refresh the Rolodex.")); }} />;
  if (editor) return <RolodexEditor key={`${editor.entry.id}:${editor.entry.revision}`} entry={editor.entry} existing={editor.existing} store={store}
    onCancel={() => setEditor(null)} onSaved={result => {
      setEditor(null); setStatus("all"); setInstrument("all"); setPiece("all"); setPriority(false);
      setNotice(result.duplicate ? `Matching passage already saved: ${result.entry.nickname || result.entry.sourceTitle}. Use its Practice Now action below.` : "Passage saved locally.");
      void reload().catch(() => setError("Save was acknowledged, but the list could not refresh. Retry Load."));
    }} />;
  const filtered = entries.filter(e => (instrument === "all" || e.eligibleInstruments.includes(instrument as typeof e.practiceInstrument))
    && (piece === "all" || e.sourceId === piece) && (!priority || e.priority)
    && (status === "all" || (status === "active" ? e.status === "needs-practice" || e.status === "improving" : e.status === status)));
  return <section className="mx-auto grid w-full min-w-0 max-w-6xl gap-4 rounded-xl bg-zinc-900 p-3 text-zinc-100 sm:p-5" aria-label="Practice Rolodex">
    <header><h1 className="text-2xl font-bold">Practice Rolodex</h1><p>{entries.filter(e => e.status === "needs-practice" || e.status === "improving").length} active passages · your saved musical challenges</p></header>
    <p>Save a passage from the Staff Builder piece library or Continuous Tempo range selection. Frozen music stays here if the original changes.</p>
    <button className={rolodexButton} type="button" disabled={busy} onClick={onExit}>Return to Piece Library</button>
    {notice && <p role="status">{notice}</p>}
    {error && <div role="alert"><p>{error}</p><button type="button" className={rolodexButton} disabled={busy} onClick={() => { void perform(pendingAction.current ?? reload); }}>{retryChange ? "Retry Rolodex Change" : "Retry Load"}</button></div>}
    {unavailable > 0 && <p role="alert">{unavailable} corrupt or unsupported records are preserved. They are excluded from exports and cannot be overwritten. New writes/imports are blocked until the data can be recovered.</p>}
    <details><summary className="min-h-11 cursor-pointer py-2">Filter passages</summary><div className="grid gap-3 sm:grid-cols-3">
      <label className="grid gap-1">Instrument filter<select className={rolodexField} value={instrument} onChange={e => setInstrument(e.target.value)}><option value="all">All instruments</option>{instruments.map(i => <option key={i}>{i}</option>)}</select></label>
      <label className="grid gap-1">Piece filter<select className={rolodexField} value={piece} onChange={e => setPiece(e.target.value)}><option value="all">All pieces</option>{Array.from(new Map(entries.map(e => [e.sourceId, e.sourceTitle]))).map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
      <label className="grid gap-1">Status filter<select className={rolodexField} value={status} onChange={e => setStatus(e.target.value)}><option value="active">Active</option><option value="all">All statuses</option>{Object.entries(statusLabel).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={priority} onChange={e => setPriority(e.target.checked)} />Prioritized only</label>
    </div></details>
    {!loaded && !error && <p role="status">Loading saved passages…</p>}
    {loaded && !filtered.length && <p>No passages in this view.</p>}
    <ul className="grid min-w-0 gap-4">{filtered.sort((a, b) => Number(b.priority) - Number(a.priority) || b.updatedAt.localeCompare(a.updatedAt)).map(entry => {
      const reason = playability(entry);
      return <li className="grid min-w-0 gap-2 rounded-lg border border-zinc-600 p-3" key={entry.id}>
        <h2 className="break-words text-xl font-semibold">{entry.nickname || entry.sourceTitle}</h2><p className="break-words">{entry.sourceTitle} · Measures {entry.start + 1}–{entry.end + 1}</p>
        <p>Eligible: {entry.eligibleInstruments.join(", ")} · Selected: {entry.practiceInstrument} · Continuous Tempo · {entry.bpm} quarter BPM</p>
        <p>{statusLabel[entry.status]}{entry.priority ? " · Prioritized" : ""}</p>
        {entry.lastPractice && <p>Last acknowledged practice: {new Date(entry.lastPractice.endedAt).toLocaleString()} · {entry.lastPractice.outcome}{entry.lastPractice.prescriptionRevision !== entry.prescriptionRevision ? " · earlier passage settings" : ""}</p>}
        {sourceStatus(entry, sources) && <p className="text-sm text-zinc-300">{sourceStatus(entry, sources)}</p>}
        {reason && <p>{reason}</p>}
        <button className={rolodexButton} disabled={Boolean(reason) || busy} type="button" onClick={() => setPractice(entry)}>Practice Now</button>
        <details><summary className="min-h-11 cursor-pointer py-2">Manage passage</summary><div className="flex flex-wrap gap-2">
          <button className={rolodexButton} disabled={busy} type="button" onClick={() => setEditor({ entry, existing: true })}>Edit Range / Settings</button>
          <button className={rolodexButton} disabled={busy} type="button" onClick={() => change(entry, { priority: !entry.priority })}>{entry.priority ? "Remove Priority" : "Prioritize"}</button>
          <button className={rolodexButton} disabled={busy} type="button" onClick={() => change(entry, { status: entry.status === "paused" ? "needs-practice" : "paused" })}>{entry.status === "paused" ? "Resume" : "Pause"}</button>
          <button className={rolodexButton} disabled={busy} type="button" onClick={() => change(entry, { status: entry.status === "archived" ? "needs-practice" : "archived" })}>{entry.status === "archived" ? "Reactivate" : "Archive"}</button>
          <button className={rolodexButton} type="button" onClick={() => backup([entry])}>Export Passage</button>
          <button className={rolodexButton} disabled={busy} type="button" onClick={() => {
            if (window.confirm(`Remove "${entry.nickname || entry.sourceTitle}" from your Rolodex? Export a backup first if needed. Original pieces and A1 attempts remain unchanged.`)) {
              void perform(async () => { await store.remove(entry.id, entry.revision); setNotice("Passage removed."); });
            }
          }}>Remove</button>
        </div></details>
      </li>;
    })}</ul>
    <details><summary className="min-h-11 cursor-pointer py-2">Backup and import</summary>
      <p>Browser-local only. Up to 256 passages, 256 KiB per source, 384 KiB per entry and 64 MiB total. These are application ceilings; available browser quota may be smaller. No automatic removal.</p>
      <div className="flex flex-wrap gap-3"><button className={rolodexButton} type="button" disabled={!loaded || !entries.length} onClick={() => backup(entries)}>Export Rolodex</button>
        <button className={rolodexButton} type="button" disabled={busy} onClick={() => importRef.current?.click()}>Import Rolodex Backup</button></div>
      <input ref={importRef} className="sr-only" aria-label="Choose Rolodex backup" type="file" accept=".json,application/json" onChange={e => {
        const file = e.target.files?.[0]; e.target.value = "";
        if (!file) return;
        if (file.size > ROLODEX_LIMITS.backupBytes) { setError("Backup exceeds 64 MiB."); return; }
        void file.text().then(raw => { setImported(parseBackup(raw)); setRemap(false); setError(""); }, () => setError("Backup could not be read.")).catch(e => setError(String(e)));
      }} />
      {imported && <div className="grid gap-2 border border-zinc-600 p-3">
        <p>Review import: {imported.length} validated passages. Matching musical prescriptions will be skipped. Conflicting IDs require explicit permission to create new identities. No existing entry will be replaced.</p>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={remap} onChange={e => setRemap(e.target.checked)} />Import conflicting identities as new passages</label>
        <button className={rolodexButton} disabled={busy || unavailable > 0} type="button" onClick={() => {
          try {
            const preview = prepareImport(imported, entries, remap);
            void perform(async () => { if (preview.entries.length) await store.importEntries(preview.entries); setImported(null); setStatus("all"); setNotice(`Import acknowledged: ${preview.entries.length} added; ${preview.skipped} matching passages skipped.`); });
          } catch (e) { setError(String(e)); }
        }}>Confirm Import</button><button className={rolodexButton} disabled={busy} type="button" onClick={() => setImported(null)}>Cancel Import</button>
      </div>}
    </details>
    <details><summary className="min-h-11 cursor-pointer py-2">Optional suggestions from saved pitch-first practice</summary>
      <button type="button" className={rolodexButton} onClick={() => {
        void piecePracticeRunStore.list().then(records => setSuggestions(rolodexSuggestions(records))).catch(() => setError("Saved recommendations are unavailable; manual saving is still available."));
      }}>Load Saved Suggestions</button>
      {suggestions?.length === 0 && <p>No retained completed-run recommendations.</p>}
      {suggestions?.map(entry => <div key={entry.id} className="my-3 rounded border border-zinc-600 p-3"><p>{entry.sourceTitle} · Measure {entry.start + 1}: {entry.evidence?.reasons}</p><button type="button" className={rolodexButton} onClick={() => setEditor({ entry, existing: false })}>Save Suggested Passage to Rolodex</button></div>)}
    </details>
    {download && <DownloadDialog snapshot={download} onCancel={() => setDownload(null)} onRequested={name => { setDownload(null); setNotice(`Download requested: ${name}`); }} onSaved={name => { setDownload(null); setNotice(`Backup saved: ${name}`); }} />}
  </section>;
}
