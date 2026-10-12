import { useId, useLayoutEffect, useRef } from "react";
import { useExportPreferences } from "@/hooks/use-export-preferences";
import { exportNativeApi } from "@/lib/files/native-save";
import type { ExportPreferences } from "@/lib/files/export-preferences";

export function ExportSettingsDialog({ onClose, preferences }: Readonly<{ onClose: () => void; preferences?: ExportPreferences }>) {
  const { state, store } = useExportPreferences(preferences);
  const supported = Boolean(exportNativeApi()), id = useId(), dialog = useRef<HTMLDialogElement>(null), close = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    try { element?.showModal(); } catch { element?.setAttribute("open", ""); }
    close.current?.focus();
    return () => { element?.close?.(); if (previous?.isConnected) previous.focus(); };
  }, []);
  const button = "min-h-11 rounded border border-zinc-500 px-3 py-2 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-sky-300";
  return <dialog ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-help`} className="fixed inset-0 m-auto grid max-h-[90dvh] w-[calc(100%_-_2rem)] min-w-0 max-w-lg gap-3 overflow-auto rounded-xl border border-zinc-600 bg-zinc-950 p-4 text-white backdrop:bg-black/70" onCancel={event => { event.preventDefault(); if (!state.busy) onClose(); }} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!state.busy) onClose(); }
      if (event.key !== "Tab") return;
      const controls = [...dialog.current!.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      const first = controls[0], last = controls.at(-1);
      if (!controls.length) { event.preventDefault(); dialog.current?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }} tabIndex={-1}>
      <h2 id={`${id}-title`} className="text-xl font-bold">Settings → Exports</h2>
      <p id={`${id}-help`}>The preferred folder suggests where Save As starts. It does not save automatically or change Chrome’s global download location. This preference is local to this browser/device and may need renewed permission.</p>
      {!supported && <p>Preferred folders are unavailable in this browser or context. Normal browser downloads remain available.</p>}
      <p className="break-all">Current folder: {state.loaded ? state.directory?.name ?? "None selected" : "Loading…"}</p>
      <p role="status">Access: {!state.loaded ? "Checking…" : !state.directory ? "No folder selected" : state.permission === "granted" ? "Granted" : state.permission === "prompt" ? "Permission needed" : state.permission === "denied" ? "Denied" : "Unavailable or stale"}{state.directory && !state.remembered ? " · This tab only" : ""}</p>
      {state.message && <p role="status" className="text-amber-200">{state.message}</p>}
      <div className="flex min-w-0 flex-wrap gap-2">
        <button className={button} type="button" disabled={!supported || state.busy || !state.loaded} onClick={() => { void store.choose(); }}>Choose Preferred Folder</button>
        <button className={button} type="button" disabled={!supported || !state.directory || state.busy} onClick={() => { void store.renew(); }}>Check/Renew Access</button>
        <button className={button} type="button" disabled={(!state.directory && !state.message) || state.busy} onClick={() => { void store.forget(); }}>Forget Folder</button>
        <button ref={close} className={button} type="button" disabled={state.busy} onClick={onClose}>Close Settings</button>
      </div>
  </dialog>;
}
