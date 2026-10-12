import { useId, useLayoutEffect, useRef, useState } from "react";
import { requestBrowserDownload, type DownloadSnapshot } from "@/lib/files/browser-download";
import { downloadFilename, formatDownloadNumber, sanitizeDownloadName } from "@/lib/files/download-filename";

export function DownloadDialog({ snapshot, onCancel, onRequested, deliver = requestBrowserDownload }: Readonly<{
  snapshot: DownloadSnapshot;
  onCancel: () => void;
  onRequested: (filename: string) => void;
  deliver?: (blob: Blob, filename: string) => void;
}>) {
  const [source] = useState(() => Object.freeze({ ...snapshot, deliver, onRequested, onCancel }));
  const [name, setName] = useState(() => sanitizeDownloadName(source.name, source.fallback));
  const [number, setNumber] = useState("001");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDivElement>(null), nameInput = useRef<HTMLInputElement>(null);
  const requested = useRef(false);
  const id = useId();
  const valid = formatDownloadNumber(number) !== null;
  const filename = valid ? downloadFilename(name, source.extension, source.fallback, number) : "Choose a number from 001 to 999";
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    nameInput.current?.focus(); nameInput.current?.select();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  const control = "min-h-11 w-full min-w-0 rounded border border-zinc-500 bg-zinc-950 px-3 focus-visible:outline-2 focus-visible:outline-sky-300";
  return <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4">
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-help`} className="max-h-[90dvh] w-full max-w-lg overflow-auto rounded-xl border border-zinc-600 bg-zinc-950 p-4 text-white" onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); source.onCancel(); }
      if (event.key !== "Tab") return;
      const controls = [...dialog.current!.querySelectorAll<HTMLElement>("input, button:not(:disabled)")];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <form className="grid min-w-0 gap-3" onSubmit={event => {
      event.preventDefault(); if (!valid || requested.current) return;
      try { source.deliver(source.blob, filename); }
      catch { setError("Prelude could not request this download. Your original export is retained; try again or cancel."); return; }
      requested.current = true; source.onRequested(filename);
    }}>
      <h2 id={`${id}-title`} className="text-xl font-bold">Download file</h2>
      {source.detail && <p className="break-words text-sm text-zinc-300">{source.detail}</p>}
      <label className="grid min-w-0 gap-1">Name<input ref={nameInput} className={control} maxLength={256} value={name} onChange={event => setName(event.target.value)} /></label>
      <label className="grid min-w-0 gap-1">Number<input className={control} type="text" inputMode="numeric" maxLength={3} value={number} aria-invalid={!valid} aria-describedby={!valid ? `${id}-number-error` : undefined} onChange={event => setNumber(event.target.value)} /></label>
      {!valid && <p id={`${id}-number-error`} className="text-amber-200">Choose a whole number from 001 to 999. 000 is reserved.</p>}
      <label className="grid min-w-0 gap-1">Format<input className={`${control} text-zinc-300`} readOnly value={`${source.format} (.${source.extension})`} /></label>
      <div className="min-w-0"><p className="font-semibold">Filename preview</p><output aria-label="Filename preview" className="block break-all">{filename}</output></div>
      <p id={`${id}-help`} className="text-sm text-zinc-300">Number names only this download; it does not change take or segment numbering. Your browser chooses the location and handles duplicate names. Verify the file before discarding temporary evidence.</p>
      {error && <p role="alert" className="text-amber-200">{error}</p>}
      <div className="flex flex-wrap gap-2"><button className="min-h-11 rounded bg-sky-600 px-4 font-semibold disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-sky-300" type="submit" disabled={!valid}>Download</button><button className="min-h-11 rounded border border-zinc-500 px-4 focus-visible:outline-2 focus-visible:outline-sky-300" type="button" onClick={source.onCancel}>Cancel</button></div>
    </form>
    </div>
  </div>;
}
