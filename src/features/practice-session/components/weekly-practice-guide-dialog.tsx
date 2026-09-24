import { useEffect, useMemo, useRef, useState } from "react";
import { createWeeklyPracticeLlmSpecification } from "../import/weekly-practice-specification";
import WeeklyPracticeDialog from "./weekly-practice-dialog";

export type WeeklyPracticeClipboardWriter = (text: string) => Promise<void>;
const writeToClipboard: WeeklyPracticeClipboardWriter = (text) => navigator.clipboard?.writeText ? navigator.clipboard.writeText(text) : Promise.reject(new Error("Clipboard unavailable"));

export default function WeeklyPracticeGuideDialog({ onClose, writeText = writeToClipboard }: Readonly<{ onClose: () => void; writeText?: WeeklyPracticeClipboardWriter }>) {
  const guide = useMemo(() => createWeeklyPracticeLlmSpecification(), []);
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (copyState === "failed") { fallbackRef.current?.focus(); fallbackRef.current?.select(); } }, [copyState]);
  const copy = async () => {
    setCopyState("copying");
    try { await writeText(guide); setCopyState("copied"); }
    catch { setCopyState("failed"); }
  };
  return <WeeklyPracticeDialog description="Prelude can import weekly practice plans created by ChatGPT or another AI assistant." footer={<><button className="min-h-11 rounded bg-sky-500 px-4 font-semibold disabled:opacity-40" disabled={copyState === "copying"} onClick={copy} type="button">{copyState === "copying" ? "Copying…" : "Copy for AI"}</button><button className="min-h-11 rounded border border-zinc-600 px-4" onClick={onClose} type="button">Close</button></>} onClose={onClose} title="Generate a plan with AI">
    <div className="space-y-4">
      <ol className="ml-5 list-decimal space-y-2 text-zinc-200"><li>Copy Prelude&apos;s generation guide.</li><li>Paste it into a new conversation with your AI assistant.</li><li>Describe the student&apos;s experience, goals, available days and time, repertoire, and current weaknesses.</li><li>Answer any useful follow-up questions, then ask for the final weekly plan.</li><li>Paste or upload the returned JSON using Import Weekly Plan.</li></ol>
      <p className="rounded border border-sky-400/20 bg-sky-400/10 p-3 text-sm text-zinc-300">Prelude does not send student information to an AI service. Copying the guide only places text on your clipboard.</p>
      <details className="rounded border border-white/10 p-3"><summary className="min-h-11 cursor-pointer py-2 font-medium">What does the guide contain?</summary><p className="mt-2 text-sm text-zinc-400">Prelude&apos;s supported exercises, allowed settings and targets, format rules, examples, and warnings about unsupported capabilities.</p></details>
      {copyState === "copied" && <p aria-live="polite" className="text-emerald-300" role="status">Copied — paste this into your AI chat.</p>}
      {copyState === "failed" && <section className="space-y-2"><p className="text-red-300" role="alert">Clipboard access was unavailable. Select and copy the guide below.</p><label className="block font-medium" htmlFor="weekly-practice-guide-fallback">Prelude generation guide</label><textarea className="min-h-64 w-full rounded border border-zinc-600 bg-zinc-900 p-3 font-mono text-sm" id="weekly-practice-guide-fallback" readOnly ref={fallbackRef} value={guide} /></section>}
    </div>
  </WeeklyPracticeDialog>;
}
