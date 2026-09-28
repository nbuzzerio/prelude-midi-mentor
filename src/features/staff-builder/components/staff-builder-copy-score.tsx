import { useEffect, useId, useRef, useState } from "react";
import { serializeStaffBuilderPiece } from "../persistence/staff-builder-piece-file";
import type { StaffBuilderScore } from "../staff-builder-types";

const writeToClipboard = (text: string): Promise<void> => navigator.clipboard?.writeText
  ? navigator.clipboard.writeText(text)
  : Promise.reject(new Error("Clipboard unavailable"));

export function StaffBuilderCopyScore({ score, writeText = writeToClipboard }: Readonly<{
  score: StaffBuilderScore;
  writeText?: (text: string) => Promise<void>;
}>) {
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "failed" | "invalid">("idle");
  const [fallbackText, setFallbackText] = useState("");
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const fallbackId = useId();
  useEffect(() => {
    if (copyState === "failed") {
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
    }
  }, [copyState]);

  const copy = async () => {
    setCopyState("copying");
    let text: string;
    try { text = serializeStaffBuilderPiece(score); }
    catch { setCopyState("invalid"); return; }
    try { await writeText(text); setCopyState("copied"); }
    catch { setFallbackText(text); setCopyState("failed"); }
  };

  return <div className="space-y-2">
    <button className="staff-builder-secondary-button min-h-11" disabled={copyState === "copying"} onClick={copy} type="button">{copyState === "copying" ? "Copying…" : "Copy Score for AI"}</button>
    <p className="text-sm text-emerald-300" role="status">{copyState === "copied" ? "Score JSON copied." : ""}</p>
    {copyState === "invalid" && <p role="alert">This score could not be exported as valid Prelude JSON.</p>}
    {copyState === "failed" && <div className="space-y-2">
      <p className="text-sm text-amber-200" role="alert">Clipboard access was unavailable. Copy the selected score JSON below manually.</p>
      <label className="block text-sm" htmlFor={fallbackId}>Staff Builder score JSON</label>
      <textarea className="min-h-64 w-full rounded border border-zinc-600 bg-zinc-900 p-3 font-mono text-sm" id={fallbackId} readOnly ref={fallbackRef} value={fallbackText} />
    </div>}
  </div>;
}
