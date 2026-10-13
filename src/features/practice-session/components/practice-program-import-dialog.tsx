import { useEffect, useId, useRef, useState } from "react";
import { WEEKLY_PRACTICE_LIMITS } from "../import/weekly-practice-contract";
import { parsePracticeProgramText } from "../practice-program-validation";
import type { IndexedDbPracticePrograms, ProgramImportReview } from "../persistence/practice-program-indexeddb";
import PracticeProgramPreview from "./practice-program-preview";
import WeeklyPracticeDialog from "./weekly-practice-dialog";

export type PracticeProgramStore = Pick<IndexedDbPracticePrograms, "review" | "save" | "list" | "revisions" | "close">;
export default function PracticeProgramImportDialog({ store, onClose, onSaved }: Readonly<{ store: PracticeProgramStore; onClose: () => void; onSaved: (message: string) => void }>) {
  const [text, setText] = useState(""); const [error, setError] = useState("");
  const [review, setReview] = useState<ProgramImportReview | null>(null);
  const [confirmed, setConfirmed] = useState(false); const [busy, setBusy] = useState(false);
  const generation = useRef(0); const saving = useRef(false); const mounted = useRef(false); const fieldId = useId();
  useEffect(() => { const epoch = generation; mounted.current = true; return () => { mounted.current = false; epoch.current++; }; }, []);
  const current = (token: number) => mounted.current && generation.current === token;
  const changed = (value: string) => { generation.current++; setText(value); setReview(null); setConfirmed(false); setError(""); setBusy(false); };
  const validate = async () => {
    if (saving.current) return;
    const token = ++generation.current; setReview(null); setConfirmed(false); setError("");
    const parsed = parsePracticeProgramText(text);
    if (!parsed.ok) { setError(parsed.issues.map(issue => `${issue.path}: ${issue.message}`).join("\n")); return; }
    setBusy(true);
    try { const result = await store.review(parsed.value); if (current(token)) setReview(result); }
    catch (failure) { if (current(token)) setError(failure instanceof Error ? failure.message : "Program review failed. Existing data is unchanged."); }
    finally { if (current(token)) setBusy(false); }
  };
  const upload = async (file: File | undefined) => {
    if (!file || saving.current) return;
    const token = ++generation.current; setReview(null); setConfirmed(false); setError(""); setBusy(true);
    try {
      if (file.size > WEEKLY_PRACTICE_LIMITS.jsonBytes) throw Error("The JSON file exceeds the 256 KiB limit.");
      const value = await file.text(); if (current(token)) { setText(value); setBusy(false); }
    } catch (failure) { if (current(token)) { setError(failure instanceof Error ? failure.message : "The file could not be read."); setBusy(false); } }
  };
  const save = async () => {
    if (!review || review.kind === "identical" || saving.current || review.kind === "newer" && !confirmed) return;
    saving.current = true; const token = ++generation.current; setBusy(true); setError("");
    try {
      const saved = await store.save(review.candidate, review.currentRevision, confirmed);
      if (current(token)) onSaved(saved.kind === "identical" ? "This program revision was already saved; nothing changed." : `Saved “${saved.candidate.program.title}”, revision ${saved.candidate.revision}. Earlier revisions are retained.`);
    } catch (failure) { if (current(token)) { setError(failure instanceof Error ? failure.message : "Save failed. Existing data is unchanged."); setReview(null); } }
    finally { saving.current = false; if (current(token)) setBusy(false); }
  };
  return <WeeklyPracticeDialog title="Import Weekly Program" description="Schema 2 saves a flexible exercise pool. Open its saved current revision to select exercises and practice." onClose={onClose} footer={<>
    <button className="min-h-11 rounded border border-zinc-600 px-4 disabled:opacity-40" disabled={busy} onClick={() => void validate()} type="button">Validate and preview</button>
    <button className="min-h-11 rounded bg-sky-500 px-4 font-semibold disabled:opacity-40" disabled={busy || !review || review.kind === "identical" || review.kind === "newer" && !confirmed} onClick={() => void save()} type="button">Save program</button>
    <button className="min-h-11 rounded border border-zinc-600 px-4" onClick={onClose} type="button">Cancel</button>
  </>}>
    <div className="space-y-3">
      <label className="block font-medium" htmlFor={fieldId}>Weekly program JSON</label>
      <textarea className="min-h-48 w-full rounded border border-zinc-600 bg-zinc-900 p-3 font-mono text-sm" disabled={busy} id={fieldId} onChange={event => changed(event.target.value)} value={text} />
      <label className="block text-sm">Upload weekly program JSON<input accept=".json,application/json" className="mt-2 block max-w-full" disabled={busy} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ""; }} type="file" /></label>
      {error && <p className="whitespace-pre-wrap break-words text-sm text-red-300" role="alert">{error}</p>}
      {busy && <p role="status">Processing program…</p>}
      {review && <>
        {review.kind === "identical" && <p className="text-emerald-300" role="status">This identical revision is already saved. Nothing will change.</p>}
        {review.kind === "newer" && <label className="flex min-h-11 items-start gap-2 rounded border border-amber-400/30 p-3"><input checked={confirmed} className="mt-1" disabled={busy} onChange={event => setConfirmed(event.target.checked)} type="checkbox" /><span>Make revision {review.candidate.revision} current instead of {review.currentRevision}. Keep every earlier revision.</span></label>}
        <PracticeProgramPreview value={review.candidate} />
      </>}
    </div>
  </WeeklyPracticeDialog>;
}
