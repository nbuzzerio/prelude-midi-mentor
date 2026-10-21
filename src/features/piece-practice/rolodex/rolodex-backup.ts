import type { DownloadSnapshot } from "@/lib/files/browser-download";
import { bytes, parseEntry, prescriptionKey, ROLODEX_LIMITS, stable } from "./rolodex-model";
import type { RolodexEntry } from "./rolodex-types";

export function parseBackup(raw: string): readonly RolodexEntry[] {
  if (new TextEncoder().encode(raw).length > ROLODEX_LIMITS.backupBytes) throw Error("Backup exceeds the 64 MiB application ceiling.");
  const value = JSON.parse(raw) as { format?: unknown; version?: unknown; entries?: unknown };
  if (!value || value.format !== "prelude-practice-rolodex" || (value.version !== 1 && value.version !== 2) || !Array.isArray(value.entries)
    || value.entries.length > ROLODEX_LIMITS.entries) throw Error("Unsupported or invalid Practice Rolodex backup.");
  // A backup carries prescriptions, not proof of native performance acknowledgement.
  const entries = value.entries.map(parseEntry).map(e => parseEntry({ ...e, lastPractice: null,
    progress: value.version === 1 ? { version: 1, cycle: null, recent: [], pinned: [], cutoff: null, resetAt: null } : {
      ...e.progress, recent: e.progress!.recent.map(s => ({ ...s, restored: true })), pinned: e.progress!.pinned.map(s => ({ ...s, restored: true })) } }));
  if (new Set(entries.map(e => e.id)).size !== entries.length || new Set(entries.map(prescriptionKey)).size !== entries.length) throw Error("The backup contains duplicate identities or passages.");
  return entries;
}
export function exportBackup(entries: readonly RolodexEntry[]): DownloadSnapshot {
  const value = { format: "prelude-practice-rolodex", version: 2, entries: entries.map(parseEntry).map(e => ({ ...e, lastPractice: null })) };
  if (bytes(value) > ROLODEX_LIMITS.backupBytes) throw Error("Export exceeds the backup size ceiling. Export individual passages.");
  const json = JSON.stringify(value); parseBackup(json);
  return { blob: new Blob([json], { type: "application/json" }), name: "practice_rolodex", fallback: "practice_rolodex", extension: "json", format: "Practice Rolodex backup",
    detail: "Frozen music, settings and bounded historical progress. Restored summaries are historical, not new native acknowledgements. Physical acceptance is never enabled by import; raw A1 evidence is separate." };
}
/** Explicit preview choice: skip matching content; remap conflicting IDs only when requested. */
export function prepareImport(incoming: readonly RolodexEntry[], existing: readonly RolodexEntry[], remap: boolean) {
  let skipped = 0;
  const entries = incoming.flatMap(e => {
    if (existing.some(old => prescriptionKey(old) === prescriptionKey(e))) { skipped++; return []; }
    const collision = existing.find(old => old.id === e.id);
    if (collision && stable(collision) !== stable(e)) {
      if (!remap) throw Error("A passage ID already exists with different content. Choose Import Conflicts as New or cancel.");
      return [parseEntry({ ...e, id: crypto.randomUUID(), revision: 1, lastPractice: null })];
    }
    return [e];
  });
  return { entries, skipped };
}
