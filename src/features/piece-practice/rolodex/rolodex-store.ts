import { bytes, parseEntry, prescriptionKey, ROLODEX_LIMITS, stable, validatePractice } from "./rolodex-model";
import type { RolodexEntry, RolodexPractice, RolodexStore } from "./rolodex-types";

export const ROLODEX_DB = "prelude-practice-rolodex-v1";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(Error("IndexedDB is unavailable. Your passages have not been changed.")); return; }
    const request = indexedDB.open(ROLODEX_DB, 1);
    let abandoned = false;
    request.onupgradeneeded = () => request.result.createObjectStore("passages", { keyPath: "id" });
    request.onsuccess = () => { if (abandoned) request.result.close(); else resolve(request.result); };
    request.onerror = () => reject(request.error ?? Error("Cannot open the Rolodex."));
    request.onblocked = () => { abandoned = true; reject(Error("Close other Prelude tabs and Retry opening the Rolodex.")); };
  });
}
/** Pure transaction planner also used by tests. No write is queued until every check passes. */
export function planSave(records: readonly unknown[], entry: RolodexEntry, expected: number | null) {
  const next = parseEntry(entry);
  const entries = records.map(parseEntry); // Unknown/corrupt data is preserved, never replaced.
  const previous = entries.find(e => e.id === next.id);
  if (previous && stable(previous) === stable(next)) return { entry: previous, duplicate: false, write: false };
  if (expected === null ? Boolean(previous) : !previous || previous.revision !== expected) throw Error("This passage changed in another tab. Reload before editing; existing data is preserved.");
  if (previous && (next.revision !== previous.revision + 1 || next.createdAt !== previous.createdAt
    || stable(next.score) !== stable(previous.score) || next.sourceId !== previous.sourceId
    || stable(next.lastPractice) !== stable(previous.lastPractice)
    || next.prescriptionRevision !== previous.prescriptionRevision + (prescriptionKey(next) === prescriptionKey(previous) ? 0 : 1))) throw Error("An edit cannot replace frozen music or earlier practice evidence.");
  const duplicate = entries.find(e => e.id !== next.id && prescriptionKey(e) === prescriptionKey(next));
  if (duplicate) return { entry: duplicate, duplicate: true, write: false };
  checkLimits([...entries.filter(e => e.id !== next.id), next]);
  return { entry: next, duplicate: false, write: true };
}
export function checkLimits(entries: readonly RolodexEntry[]) {
  if (entries.length > ROLODEX_LIMITS.entries || entries.reduce((n, e) => n + bytes(e), 0) > ROLODEX_LIMITS.totalBytes) throw Error("Rolodex application ceiling reached. Export and explicitly remove passages to make room. Nothing was deleted.");
}
export function planImport(records: readonly unknown[], incoming: readonly RolodexEntry[]): readonly RolodexEntry[] {
  const existing = records.map(parseEntry), additions: RolodexEntry[] = [];
  incoming.forEach(value => {
    const entry = parseEntry(value);
    const all = [...existing, ...additions];
    const collision = all.find(e => e.id === entry.id);
    if (collision) throw Error(`Identity collision for ${entry.nickname || entry.sourceTitle}. No entries imported. Review collisions before importing.`);
    if (all.some(e => prescriptionKey(e) === prescriptionKey(entry))) throw Error("A matching passage already exists. No entries imported. Review duplicates before importing.");
    additions.push(entry);
  });
  checkLimits([...existing, ...additions]); return additions;
}
async function transaction<T>(mode: IDBTransactionMode, action: (records: unknown[], store: IDBObjectStore) => T): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction("passages", mode), store = tx.objectStore("passages");
      let result: T, failure: unknown;
      const request = store.getAll();
      request.onsuccess = () => { try { result = action(request.result, store); } catch (error) { failure = error; tx.abort(); } };
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () => reject(failure ?? tx.error ?? Error("Rolodex storage failed. Existing passages were preserved. Retry when storage is available."));
    });
  } finally { db.close(); }
}
export const rolodexStore: RolodexStore = {
  list: () => transaction("readonly", records => {
    const entries: RolodexEntry[] = []; let unavailableCount = 0;
    records.forEach(r => { try { entries.push(parseEntry(r)); } catch { unavailableCount++; } });
    return { entries, unavailableCount };
  }),
  save: (entry, expected) => transaction("readwrite", (records, store) => {
    const result = planSave(records, entry, expected); if (result.write) store.put(result.entry);
    return { entry: result.entry, duplicate: result.duplicate };
  }),
  remove: (id, revision) => transaction("readwrite", (records, store) => {
    const raw = records.find(r => typeof r === "object" && r !== null && "id" in r && r.id === id);
    if (!raw) return; // Acknowledgement retry after an already committed removal.
    const previous = parseEntry(raw);
    if (previous.revision !== revision) throw Error("This passage changed. Reload before removing it.");
    store.delete(id);
  }),
  importEntries: entries => transaction("readwrite", (records, store) => { planImport(records, entries).forEach(e => store.add(e)); }),
  acknowledge: (id, practice: RolodexPractice) => transaction("readwrite", (records, store) => {
    validatePractice(practice);
    const entries = records.map(parseEntry), previous = entries.find(e => e.id === id);
    if (!previous) throw Error("The performance is saved in A1, but its Rolodex entry is unavailable.");
    if (previous.lastPractice?.attemptId === practice.attemptId) return;
    if (previous.lastPractice && previous.lastPractice.endedAt >= practice.endedAt) return;
    if (practice.prescriptionRevision > previous.prescriptionRevision) throw Error("Practice prescription is unavailable.");
    const next = parseEntry({ ...previous, revision: previous.revision + 1, updatedAt: new Date().toISOString(), lastPractice: practice });
    checkLimits([...entries.filter(e => e.id !== id), next]); store.put(next);
  }),
};
