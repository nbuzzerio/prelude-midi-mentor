import { sanitizeDownloadName } from "./download-filename";

/** Suggested browser print title only; PDF saving and its extension belong to the browser. */
export function printFilenameTitle(name: string, kind: "piece" | "practice-session"): string {
  const stem = sanitizeDownloadName(name, kind === "piece" ? "piece" : "practice_session");
  const reportStem = kind === "practice-session" && stem !== "report" && !stem.endsWith("_report") ? `${stem}_report` : stem;
  return `${reportStem}_001`;
}
