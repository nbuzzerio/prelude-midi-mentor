import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import type { AppUpdate } from "../app-updates";

export function WhatsNewModal({ updates, onAcknowledge }: Readonly<{ updates: readonly AppUpdate[]; onAcknowledge: () => void }>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element?.showModal(); // Native top-layer dialog makes the background inert.
    heading.current?.focus();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected && previous !== document.body) previous.focus();
      else document.querySelector<HTMLElement>("main button")?.focus();
    };
  }, []);
  const keyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    event.stopPropagation(); // Background window shortcuts must not act through the modal.
    if (event.key === "Escape") { event.preventDefault(); onAcknowledge(); return; }
    if (event.key !== "Tab") return;
    const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>("button");
    const first = buttons?.[0]; const last = buttons?.[buttons.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && (document.activeElement === heading.current || document.activeElement === first)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return <dialog aria-labelledby={titleId} aria-modal="true" className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_1.5rem)] max-w-xl overflow-y-auto rounded-xl border border-white/15 bg-zinc-950 p-4 text-zinc-100 shadow-2xl backdrop:bg-black/70 sm:p-6 print:hidden" onCancel={(event) => { event.preventDefault(); onAcknowledge(); }} onKeyDown={keyDown} ref={dialog}>
    <header className="flex items-start justify-between gap-3"><h2 className="text-xl font-bold" id={titleId} ref={heading} tabIndex={-1}>What's New in Prelude</h2><button aria-label="Close What's New" className="min-h-11 rounded border border-zinc-600 px-3" onClick={onAcknowledge} type="button">Close</button></header>
    <div className="my-5 space-y-6">{updates.map((update) => <section aria-labelledby={`${titleId}-${update.id}`} key={update.id}>
      <h3 className="font-semibold" id={`${titleId}-${update.id}`}>{update.title}</h3>
      <p className="mt-1 text-sm text-zinc-400"><time dateTime={update.date}>{update.date}</time>{update.version ? ` · v${update.version}` : ""}</p>
      <ul className="mt-3 list-disc space-y-2 pl-5">{update.changes.map((change) => <li key={change}>{change}</li>)}</ul>
    </section>)}</div>
    <footer className="flex justify-end border-t border-white/10 pt-4"><button className="min-h-11 rounded bg-sky-500 px-4 font-semibold text-white" onClick={onAcknowledge} type="button">Got it</button></footer>
  </dialog>;
}
