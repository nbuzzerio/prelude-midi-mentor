import { useRef, useState } from "react";
import { ContinuousScore } from "../continuous/continuous-score";
import { editEntry, instruments, parseEntry, playability } from "./rolodex-model";
import { rolodexStore } from "./rolodex-store";
import type { RolodexEntry, RolodexInstrument, RolodexSaveResult, RolodexSourceInstrument, RolodexStore } from "./rolodex-types";

export const rolodexButton = "min-h-11 rounded-lg border border-zinc-500 px-3 py-2 font-semibold disabled:opacity-40";
export const rolodexField = "min-h-11 min-w-0 rounded border border-zinc-500 bg-zinc-950 p-2";
export function RolodexEditor({ entry, existing = false, store = rolodexStore, onSaved, onCancel }: Readonly<{
  entry: RolodexEntry; existing?: boolean; store?: RolodexStore;
  onSaved: (result: RolodexSaveResult) => void; onCancel: () => void;
}>) {
  const [draft, setDraft] = useState(entry);
  const [confirmed, setConfirmed] = useState(existing);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const pending = useRef<RolodexEntry | null>(null), writing = useRef(false);
  const update = (changes: Partial<RolodexEntry>) => { setDraft(d => ({ ...d, ...changes })); pending.current = null; setError(""); };
  const save = async () => {
    if (writing.current || !confirmed) return;
    writing.current = true; setBusy(true); setError("");
    try {
      if (!pending.current) {
        const edited = editEntry(entry, { nickname: draft.nickname.trim(), start: draft.start, end: draft.end, sourceInstrument: draft.sourceInstrument,
          eligibleInstruments: draft.eligibleInstruments, practiceInstrument: draft.practiceInstrument, bpm: draft.bpm, status: draft.status, priority: draft.priority });
        pending.current = existing ? edited : parseEntry({ ...edited, revision: 1, prescriptionRevision: 1 });
      }
      const result = await store.save(pending.current, existing ? entry.revision : null);
      onSaved(result);
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed. Existing passages were preserved."); }
    finally { writing.current = false; setBusy(false); }
  };
  // Display validation never mutates the captured source.
  let unavailable: string | null;
  try { unavailable = playability(editEntry(entry, { start: draft.start, end: draft.end, bpm: draft.bpm, eligibleInstruments: draft.eligibleInstruments, practiceInstrument: draft.practiceInstrument })); }
  catch (e) { unavailable = e instanceof Error ? e.message : "Check passage settings."; }
  return <section className="grid min-w-0 gap-4 rounded-xl border border-zinc-600 bg-zinc-900 p-4 text-zinc-100" aria-label={existing ? "Edit Rolodex passage" : "Save to Practice Rolodex"}>
    <h2 className="text-xl font-bold">{existing ? "Edit passage" : "Save to Practice Rolodex"}</h2>
    <p>{entry.sourceTitle} · Frozen source, original measure numbers. Saving does not require a performance or MIDI connection.</p>
    {entry.evidence && <p>Suggested from a saved pitch-first run: {entry.evidence.reasons}. Adjust the range before saving.</p>}
    <fieldset disabled={busy} className="grid min-w-0 gap-3">
      <label className="grid gap-1">Passage nickname (optional)<input className={rolodexField} maxLength={120} value={draft.nickname} onChange={e => update({ nickname: e.target.value })} /></label>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="grid gap-1">First measure<select className={rolodexField} value={draft.start} onChange={e => {
          const start = Number(e.target.value); update({ start, end: Math.max(start, Math.min(draft.end, start + 3)) });
        }}>{draft.score.measures.map((m, i) => <option key={m.id} value={i}>{i + 1}</option>)}</select></label>
        <label className="grid gap-1">Last measure<select className={rolodexField} value={draft.end} onChange={e => update({ end: Number(e.target.value) })}>
          {draft.score.measures.slice(draft.start, draft.start + 4).map((m, i) => <option key={m.id} value={draft.start + i}>{draft.start + i + 1}</option>)}</select></label>
      </div>
      <label className="grid gap-1">Source instrument<select className={rolodexField} value={draft.sourceInstrument} onChange={e => {
        const sourceInstrument = e.target.value as RolodexSourceInstrument;
        update({ sourceInstrument, ...(sourceInstrument === "unknown" ? {} : { eligibleInstruments: [sourceInstrument], practiceInstrument: sourceInstrument }) });
        setConfirmed(false);
      }}><option value="unknown">Unknown — no authoritative instrument metadata</option>{instruments.map(i => <option key={i} value={i}>{i[0]!.toUpperCase() + i.slice(1)}</option>)}</select></label>
      <fieldset><legend>Eligible practice instruments — explicitly permitted by you</legend><div className="flex flex-wrap gap-4">{instruments.map(i =>
        <label className="flex min-h-11 items-center gap-2" key={i}><input type="checkbox" checked={draft.eligibleInstruments.includes(i)} onChange={e => {
          const eligibleInstruments = e.target.checked ? [...draft.eligibleInstruments, i] : draft.eligibleInstruments.filter(v => v !== i);
          update({ eligibleInstruments, practiceInstrument: eligibleInstruments.includes(draft.practiceInstrument) ? draft.practiceInstrument : eligibleInstruments[0] ?? draft.practiceInstrument });
          setConfirmed(false);
        }} />{i[0]!.toUpperCase() + i.slice(1)}</label>)}</div></fieldset>
      <label className="grid gap-1">Practice instrument<select className={rolodexField} value={draft.practiceInstrument} onChange={e => update({ practiceInstrument: e.target.value as RolodexInstrument })}>
        {draft.eligibleInstruments.map(i => <option key={i} value={i}>{i[0]!.toUpperCase() + i.slice(1)}</option>)}</select></label>
      <p>Mode: Continuous Tempo · physical MIDI Piano is the only executable Rolodex profile in this checkpoint. Violin/Ocarina eligibility can be saved for later; no acoustic engine is launched.</p>
      <label className="grid gap-1">Target quarter-note BPM<input className={rolodexField} type="number" min={40} max={120} step={1} value={draft.bpm} onChange={e => update({ bpm: Number(e.target.value) })} /></label>
      {existing && <p>Changing range, eligibility, selected instrument or target BPM begins a new qualification context. Earlier evidence keeps its original target.</p>}
      {existing && <label className="grid gap-1">Manual organization (separate from measured progress)<select className={rolodexField} value={draft.status} onChange={e => update({ status: e.target.value as RolodexEntry["status"] })}>
        <option value="needs-practice">Needs Practice</option><option value="improving">Improving</option><option value="paused">Paused</option><option value="archived">Archived</option></select></label>}
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={draft.priority} onChange={e => update({ priority: e.target.checked })} />Prioritize this passage</label>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I confirm the source instrument and eligible practice instruments.</label>
    </fieldset>
    <p>Review: measures {draft.start + 1}–{draft.end + 1} · {draft.bpm} quarter BPM · {draft.practiceInstrument} · policy {draft.policy.version}.</p>
    {unavailable && <p role="status">Saved collection only until compatible settings are chosen: {unavailable}</p>}
    <details><summary className="min-h-11 cursor-pointer py-2">Preview first selected measure</summary><ContinuousScore score={entry.score} measureIndex={draft.start} /></details>
    {error && <p role="alert">{error} Changes have not been acknowledged. Retry uses the same passage identity.</p>}
    <div className="flex flex-wrap gap-3"><button className={rolodexButton} disabled={busy || !confirmed || !draft.eligibleInstruments.length} type="button" onClick={() => { void save(); }}>{busy ? "Saving passage…" : error ? "Retry Save Passage" : "Save Passage"}</button>
      <button className={rolodexButton} disabled={busy} type="button" onClick={onCancel}>Cancel</button></div>
    <p className="text-sm text-zinc-400">Browser-local storage. Application ceilings do not guarantee browser quota. Keep a JSON backup.</p>
  </section>;
}
