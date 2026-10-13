import { useId, useLayoutEffect, useRef, useState } from "react";
import { requestBrowserDownload, type DownloadSnapshot } from "@/lib/files/browser-download";
import { downloadFilename, formatDownloadNumber, sanitizeDownloadName } from "@/lib/files/download-filename";
import { exportNativeApi, finishNativeSave, nativeSaveOptions, pickerFailure, NATIVE_OVERWRITE_WARNING, type NativeSaveResult } from "@/lib/files/native-save";
import { useExportPreferences } from "@/hooks/use-export-preferences";
import type { ExportPreferences } from "@/lib/files/export-preferences";
import { downloadCounters, type DownloadCounters } from "@/lib/files/download-counters";

export function DownloadDialog({ snapshot, onCancel, onRequested, onSaved, preferences, counters = downloadCounters, deliver = requestBrowserDownload }: Readonly<{
  snapshot: DownloadSnapshot;
  onCancel: () => void;
  onRequested: (filename: string) => void;
  onSaved?: (filename: string) => void;
  preferences?: ExportPreferences;
  counters?: DownloadCounters;
  deliver?: (blob: Blob, filename: string) => void;
}>) {
  const [source] = useState(() => Object.freeze({ ...snapshot, deliver, onRequested, onSaved, onCancel, preferences, counters }));
  const { state: preference, store } = useExportPreferences(source.preferences);
  const [name, setName] = useState(() => sanitizeDownloadName(source.name, source.fallback));
  const [suggestion, setSuggestion] = useState(() => source.counters.suggest(source.name, source.extension, source.fallback));
  const [number, setNumber] = useState(suggestion.number);
  const numberEdited = useRef(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [outcome, setOutcome] = useState<NativeSaveResult | null>(null);
  const operation = useRef<AbortController | null>(null), mounted = useRef(false), generation = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null), nameInput = useRef<HTMLInputElement>(null);
  const requested = useRef(false);
  const id = useId();
  const valid = formatDownloadNumber(number) !== null;
  const filename = valid ? downloadFilename(name, source.extension, source.fallback, number) : "Choose a number from 001 to 999";
  const api = exportNativeApi();
  const configured = Boolean(api && preference.loaded && preference.directory);
  const canUseFolder = configured && preference.permission === "granted";
  const cancel = () => { operation.current?.abort(); source.onCancel(); };
  useLayoutEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (requested.current || event.key !== null && event.key !== source.counters.key(name, source.extension, source.fallback)) return;
      const next = source.counters.suggest(name, source.extension, source.fallback);
      setSuggestion(next);
      if (!numberEdited.current) setNumber(next.number);
    };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [name, source]);
  const editName = (value: string) => {
    setName(value);
    const next = source.counters.suggest(value, source.extension, source.fallback);
    setSuggestion(next);
    if (!numberEdited.current) setNumber(next.number);
  };
  const acknowledge = () => setSuggestion(source.counters.acknowledge(name, source.extension, source.fallback, number));
  useLayoutEffect(() => {
    mounted.current = true; generation.current++;
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    try { element?.showModal(); } catch { element?.setAttribute("open", ""); }
    nameInput.current?.focus(); nameInput.current?.select();
    const epoch = generation;
    const active = mounted;
    const pending = operation;
    return () => { active.current = false; epoch.current++; pending.current?.abort(); element?.close?.(); if (previous?.isConnected) previous.focus(); };
  }, []);
  const saveAs = (elsewhere: boolean) => {
    const current = store.getSnapshot();
    if (!valid || requested.current || current.busy || !current.loaded || !api || (!elsewhere && (!current.directory || current.permission !== "granted"))) return;
    requested.current = true; setBusy(true); setError(""); setOutcome(null);
    const controller = new AbortController(), epoch = generation.current;
    operation.current = controller;
    let picker;
    try { picker = api.showSaveFilePicker(nativeSaveOptions(source, filename, elsewhere ? undefined : current.directory!)); }
    catch (failure) { requested.current = false; setBusy(false); setOutcome(pickerFailure(failure)); operation.current = null; return; }
    void finishNativeSave(picker, source, controller.signal).then(result => {
      if (!mounted.current || epoch !== generation.current || controller.signal.aborted) return;
      setBusy(false); operation.current = null; setOutcome(result);
      if (result.kind === "saved") { acknowledge(); setDelivered(true); source.onSaved?.(result.filename); }
      else requested.current = false;
    });
  };
  const downloadNormally = () => {
    if (!valid || requested.current || busy) return;
    requested.current = true;
    try { source.deliver(source.blob, filename); }
    catch { requested.current = false; setError("Prelude could not request this download. Your original export is retained; try again or cancel."); return; }
    acknowledge();
    setDelivered(true);
    source.onRequested(filename);
  };
  const submitFilename = () => {
    if (!valid || requested.current || busy) return;
    const current = store.getSnapshot();
    if (api) {
      if (!current.loaded || current.busy) { setError("Wait for the preferred-folder access check, or choose a destination explicitly."); return; }
      if (current.directory) {
        if (current.permission === "granted") saveAs(false);
        else setError("Renew preferred-folder access or choose a destination explicitly. Enter does not request a normal download.");
        return;
      }
    }
    downloadNormally();
  };
  const control = "min-h-11 w-full min-w-0 rounded border border-zinc-500 bg-zinc-950 px-3 focus-visible:outline-2 focus-visible:outline-sky-300";
  return <dialog ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-help`} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-auto rounded-xl border border-zinc-600 bg-zinc-950 p-4 text-white backdrop:bg-black/70" onCancel={event => { event.preventDefault(); cancel(); }} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(); }
      if (event.key !== "Tab") return;
      const controls = [...dialog.current!.querySelectorAll<HTMLElement>("input:not(:disabled), button:not(:disabled)")];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <form className="grid min-w-0 gap-3" onSubmit={event => {
      event.preventDefault(); submitFilename();
    }} onKeyDown={event => {
      if (event.key !== "Enter" || !(event.target instanceof HTMLInputElement) || event.nativeEvent.isComposing) return;
      event.preventDefault();
      if (!event.repeat) submitFilename();
    }}>
      <h2 id={`${id}-title`} className="text-xl font-bold">Download file</h2>
      {source.detail && <p className="break-words text-sm text-zinc-300">{source.detail}</p>}
      <label className="grid min-w-0 gap-1">Name<input ref={nameInput} disabled={busy || delivered} className={control} maxLength={256} value={name} onChange={event => editName(event.target.value)} /></label>
      <label className="grid min-w-0 gap-1">Number<input disabled={busy || delivered} className={control} type="text" inputMode="numeric" maxLength={3} value={number} aria-invalid={!valid} aria-describedby={!valid ? `${id}-number-error` : undefined} onChange={event => { numberEdited.current = true; setNumber(event.target.value); }} /></label>
      {!valid && <p id={`${id}-number-error`} className="text-amber-200">Choose a whole number from 001 to 999. 000 is reserved.</p>}
      {suggestion.exhausted && <p role="status" className="text-amber-200">This filename sequence reached 999. Change Name or deliberately enter an earlier Number; names may repeat.</p>}
      {suggestion.message && <p role="status" className="text-amber-200">{suggestion.message}</p>}
      <label className="grid min-w-0 gap-1">Format<input className={`${control} text-zinc-300`} readOnly value={`${source.format} (.${source.extension})`} /></label>
      <div className="min-w-0"><p className="font-semibold">Filename preview</p><output aria-label="Filename preview" className="block break-all">{filename}</output></div>
      <p id={`${id}-help`} className="text-sm text-zinc-300">The next number is remembered locally after saving or requesting a download. It does not change take or segment numbering. Prelude does not check files on disk; simultaneous tabs may suggest the same number. Your browser handles duplicate names. Verify the file before discarding temporary evidence.</p>
      {configured && <>
        <p className="break-all text-sm">Preferred starting folder: {preference.directory!.name}. Access: {preference.permission}.</p>
        <p className="text-sm text-amber-200">{NATIVE_OVERWRITE_WARNING} Prelude keeps your original export for retry; aborting cannot guarantee restoration.</p>
        {!canUseFolder && <p role="status">Renew access or choose the folder again. Save As elsewhere and normal downloads are explicit alternatives.</p>}
        {(!canUseFolder || (outcome && outcome.kind !== "saved")) && <div className="flex flex-wrap gap-2">
          <button type="button" className="min-h-11 rounded border border-zinc-500 px-3 disabled:opacity-40" disabled={busy || preference.busy} onClick={() => { void store.renew(); }}>Check/Renew Access</button>
          <button type="button" className="min-h-11 rounded border border-zinc-500 px-3 disabled:opacity-40" disabled={busy || preference.busy} onClick={() => { void store.choose(); }}>Choose Preferred Folder</button>
        </div>}
      </>}
      {preference.message && configured && <p role="status" className="text-amber-200">{preference.message}</p>}
      {busy && <p role="status">Saving… Keep this page open until saving finishes.</p>}
      {outcome && <p role={outcome.kind === "failed" || outcome.kind === "uncertain" ? "alert" : "status"} data-save-outcome={outcome.kind} className="text-amber-200">{outcome.kind === "saved" ? `Saved: ${outcome.filename}.` : outcome.message}</p>}
      {error && <p role="alert" className="text-amber-200">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {configured && <button className="min-h-11 rounded bg-sky-600 px-4 font-semibold disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-sky-300" type="button" disabled={!valid || busy || delivered || preference.busy || !canUseFolder} onClick={() => saveAs(false)}>Save As…</button>}
        {configured && outcome && outcome.kind !== "saved" && <button className="min-h-11 rounded border border-zinc-500 px-3 disabled:opacity-40" type="button" disabled={!valid || busy || preference.busy} onClick={() => saveAs(true)}>Save As elsewhere</button>}
        {configured && !canUseFolder && !outcome && <button className="min-h-11 rounded border border-zinc-500 px-3 disabled:opacity-40" type="button" disabled={!valid || busy || preference.busy} onClick={() => saveAs(true)}>Save As elsewhere</button>}
        <button className="min-h-11 rounded bg-sky-600 px-4 font-semibold disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-sky-300" type="button" disabled={!valid || busy || delivered} onClick={downloadNormally}>{configured ? "Download Normally" : "Download"}</button>
        <button className="min-h-11 rounded border border-zinc-500 px-4 focus-visible:outline-2 focus-visible:outline-sky-300" type="button" onClick={cancel}>Cancel</button>
      </div>
    </form>
  </dialog>;
}
