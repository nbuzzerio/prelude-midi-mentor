import { useEffect, useId, useMemo, useRef, useState } from "react";
import WeeklyPracticeDialog from "@/features/practice-session/components/weekly-practice-dialog";
import { createStaffBuilderLlmSpecification } from "../staff-builder-llm-specification";

type ClipboardWriter = (text: string) => Promise<void>;
const writeToClipboard: ClipboardWriter = (text) => navigator.clipboard?.writeText ? navigator.clipboard.writeText(text) : Promise.reject(new Error("Clipboard unavailable"));

export function StaffBuilderGuideDialog({ onClose, writeText = writeToClipboard }: Readonly<{ onClose: () => void; writeText?: ClipboardWriter }>) {
  const guide = useMemo(() => createStaffBuilderLlmSpecification(), []);
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const fallback = useRef<HTMLTextAreaElement>(null);
  const fallbackId = useId();
  const inFlight = useRef(false);
  useEffect(() => {
    if (copyState === "failed") { fallback.current?.focus(); fallback.current?.select(); }
  }, [copyState]);
  const copy = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setCopyState("copying");
    try { await writeText(guide); setCopyState("copied"); }
    catch { setCopyState("failed"); }
    finally { inFlight.current = false; }
  };
  return <WeeklyPracticeDialog title="Staff Builder AI Authoring Guide" description="Copy the supported authoring contract so an AI can create importable Prelude score JSON." onClose={onClose} footer={<>
    <button className="min-h-11 rounded bg-sky-500 px-4 font-semibold disabled:opacity-40" disabled={copyState === "copying"} onClick={copy} type="button">{copyState === "copying" ? "Copying…" : "Copy for AI"}</button>
    <button className="min-h-11 rounded border border-zinc-600 px-4" onClick={onClose} type="button">Close</button>
  </>}>
    <div className="space-y-4">
      <p className="text-zinc-200">Copy Score for AI copies your current piece, including unsaved edits. Copy for AI here copies the complete authoring guide for creating new Prelude Staff Builder JSON.</p>
      <ol className="ml-5 list-decimal space-y-2 text-zinc-200"><li>Copy this guide and paste it into a new AI conversation.</li><li>Describe the music you want and request the final score as raw JSON.</li><li>Save the returned JSON as a .prelude.json file and use Import Piece in Piece Library.</li></ol>
      <details className="rounded border border-white/10 p-3"><summary tabIndex={0} className="min-h-11 cursor-pointer py-2 font-medium">Read the authoring guide</summary><pre className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-300">{guide}</pre></details>
      {copyState === "copied" && <p aria-live="polite" role="status" className="text-emerald-300">Authoring guide copied.</p>}
      {copyState === "failed" && <section className="space-y-2"><p role="alert" className="text-red-300">Clipboard access was unavailable. Copy the selected guide below manually.</p><label htmlFor={fallbackId} className="block font-medium">Staff Builder AI authoring guide text</label><textarea id={fallbackId} ref={fallback} readOnly value={guide} className="min-h-64 w-full rounded border border-zinc-600 bg-zinc-900 p-3 font-mono text-sm" /></section>}
    </div>
  </WeeklyPracticeDialog>;
}

export function StaffBuilderGuideHelp() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  return <>
    <button aria-label="Staff Builder AI authoring guide" className="staff-builder-secondary-button min-h-11 min-w-11" ref={trigger} onClick={() => setOpen(true)} type="button">?</button>
    {open && <StaffBuilderGuideDialog onClose={close} />}
  </>;
}
