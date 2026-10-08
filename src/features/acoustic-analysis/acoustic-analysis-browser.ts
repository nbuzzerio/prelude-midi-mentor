import { acousticAnalysisFilename } from "./acoustic-analysis-export";

const PREFERENCE_KEY = "prelude-acoustic-analysis-enabled-v1";
export function readAnalysisPreference(): boolean {
  try { return window.localStorage.getItem(PREFERENCE_KEY) !== "off"; } catch { return true; }
}
export function saveAnalysisPreference(enabled: boolean): boolean {
  try { window.localStorage.setItem(PREFERENCE_KEY, enabled ? "on" : "off"); return true; } catch { return false; }
}
export function downloadAcousticAnalysis(json: string, startedAt: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.download = acousticAnalysisFilename(startedAt); anchor.href = url; anchor.hidden = true;
  document.body.append(anchor);
  try { anchor.click(); } finally { anchor.remove(); URL.revokeObjectURL(url); }
}
