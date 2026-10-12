import { acousticAnalysisFilename } from "./acoustic-analysis-export";
import { requestBrowserDownload } from "@/lib/files/browser-download";

const PREFERENCE_KEY = "prelude-acoustic-analysis-enabled-v1";
export function readAnalysisPreference(): boolean {
  try { return window.localStorage.getItem(PREFERENCE_KEY) !== "off"; } catch { return true; }
}
export function saveAnalysisPreference(enabled: boolean): boolean {
  try { window.localStorage.setItem(PREFERENCE_KEY, enabled ? "on" : "off"); return true; } catch { return false; }
}
export function downloadAcousticAnalysis(json: string | Blob, title: string, filename = acousticAnalysisFilename(title)): void {
  requestBrowserDownload(typeof json === "string" ? new Blob([json], { type: "application/json" }) : json, filename);
}
