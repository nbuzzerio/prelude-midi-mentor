import { targetFingerprint } from "./rolodex-qualification";
import { appendProgress, validateAcceptance, validateSummary } from "./rolodex-progress";
import type { RolodexAcceptance } from "./rolodex-progress-types";
import { bytes, parseEntry, prescriptionKey, ROLODEX_LIMITS, stable, validatePractice } from "./rolodex-model";
import type { RolodexEntry, RolodexPractice, RolodexStore } from "./rolodex-types";

export const ROLODEX_DB = "prelude-practice-rolodex-v1";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(Error("IndexedDB is unavailable. Your passages have not been changed.")); return; }
    const request = indexedDB.open(ROLODEX_DB, 2);
    let abandoned = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("passages")) request.result.createObjectStore("passages", { keyPath: "id" });
      if (!request.result.objectStoreNames.contains("settings")) request.result.createObjectStore("settings", { keyPath: "id" });
    };
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
    || stable(next.lastPractice) !== stable(previous.lastPractice) || stable(next.progress) !== stable(previous.progress)
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
async function transaction<T>(mode: IDBTransactionMode, action: (records: unknown[], store: IDBObjectStore, acceptance: RolodexAcceptance | null, settings: IDBObjectStore) => T): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(["passages", "settings"], mode), store = tx.objectStore("passages");
      let result: T, failure: unknown;
      const settings = tx.objectStore("settings"), gate = settings.get("physical-acceptance"), request = store.getAll();
      request.onsuccess = () => { try { const acceptance = (gate.result === undefined ? null : gate.result.acceptance) as RolodexAcceptance | null; validateAcceptance(acceptance); result = action(request.result, store, acceptance, settings); } catch (error) { failure = error; tx.abort(); } };
      tx.oncomplete = () => resolve(result);
      tx.onabort = tx.onerror = () => reject(failure ?? tx.error ?? Error("Rolodex storage failed. Existing passages were preserved. Retry when storage is available."));
    });
  } finally { db.close(); }
}
export const rolodexStore: RolodexStore = {
  list: () => transaction("readonly", (records, _store, acceptance) => {
    const entries: RolodexEntry[] = []; let unavailableCount = 0;
    records.forEach(r => { try { entries.push(parseEntry(r)); } catch { unavailableCount++; } });
    return { entries, unavailableCount, acceptance };
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
  acknowledge: async (id, practice: RolodexPractice) => {
    // Hash outside the transaction; recheck the musical configuration inside it.
    const checked = practice.summary ? (await rolodexStore.list()).entries.find(e => e.id === id) : undefined;
    if (checked && practice.summary && checked.prescriptionRevision === practice.prescriptionRevision
      && await targetFingerprint(checked) !== practice.summary.target) throw Error("The saved musical target differs from this native performance. A1 evidence is preserved.");
    return transaction("readwrite", (records, store, acceptance) => {
    validatePractice(practice);
    const entries = records.map(parseEntry), previous = entries.find(e => e.id === id);
    if (!previous) throw Error("The performance is saved in A1, but its Rolodex entry is unavailable.");
    if (practice.prescriptionRevision > previous.prescriptionRevision) throw Error("Practice prescription is unavailable.");
    const { summary: supplied, ...date } = practice;
    let progress = previous.progress;
    if (supplied) {
      validateSummary(supplied);
      if (previous.prescriptionRevision === supplied.prescriptionRevision && (!checked || checked.prescriptionRevision !== previous.prescriptionRevision
        || stable(checked.score) !== stable(previous.score) || prescriptionKey(checked) !== prescriptionKey(previous))) throw Error("The musical prescription changed during the progress write. Retry without changing native evidence.");
      if (supplied.attemptId !== practice.attemptId || supplied.passageId !== id || supplied.prescriptionRevision !== practice.prescriptionRevision
        || supplied.endedAt !== practice.endedAt || supplied.outcome !== practice.outcome || supplied.inputId !== practice.inputId || supplied.restored) throw Error("Conflicting native progress acknowledgement.");
      // Recheck acceptance in the write transaction: another tab may have disabled/replaced it.
      const summary = supplied.acceptance && stable(supplied.acceptance) !== stable(acceptance)
        ? { ...supplied, acceptance: null, reasons: [...supplied.reasons, "Acceptance changed before the progress write."] } : supplied;
      progress = appendProgress(previous, summary);
    }
    const lastPractice = previous.lastPractice && previous.lastPractice.endedAt >= date.endedAt ? previous.lastPractice : date;
    if (stable(progress) === stable(previous.progress) && stable(lastPractice) === stable(previous.lastPractice)) return previous;
    const next = parseEntry({ ...previous, revision: previous.revision + 1, updatedAt: new Date().toISOString(), lastPractice, progress });
    checkLimits([...entries.filter(e => e.id !== id), next]); store.put(next); return next;
    });
  },
};
/** Deliberate owner action only; absent settings mean qualification OFF. */
export function savePhysicalAcceptance(next: RolodexAcceptance, expectedGeneration: string | null): Promise<void> {
  validateAcceptance(next);
  return transaction("readwrite", (_records, _store, previous, settings) => {
    if (previous?.generation === next.generation && stable(previous) === stable(next)) return;
    if (previous?.generation === next.generation) throw Error("Changed acceptance requires a new activation generation.");
    if ((previous?.generation ?? null) !== expectedGeneration) throw Error("Acceptance changed in another tab. Reload before changing it.");
    settings.put({ id: "physical-acceptance", acceptance: next });
  });
}
export function reactivateRolodex(id: string, revision: number, resetAt: string): Promise<void> {
  return transaction("readwrite", (records, store) => {
    const entries = records.map(parseEntry), previous = entries.find(e => e.id === id);
    if (!previous) throw Error("Passage unavailable.");
    if (previous.progress?.resetAt === resetAt) return;
    if (previous.revision !== revision) throw Error("Passage changed in another tab. Reload before reactivating.");
    const next = parseEntry({ ...previous, status: "needs-practice", revision: previous.revision + 1, updatedAt: resetAt,
      progress: { ...previous.progress, resetAt, cycle: resetAt } });
    checkLimits([...entries.filter(e => e.id !== id), next]); store.put(next);
  });
}
