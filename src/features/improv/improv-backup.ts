import { IMPROV_LIBRARY_LIMITS as L, ImprovLibraryError, immutableCopy, type ImprovCollectionEvidence, type ImprovArchiveLibrary } from "./improv-library";
import { requireCollection, requireLoadedTake, requireTake } from "./improv-library-validation";

export const IMPROV_BACKUP_VERSION = 1;
export const IMPROV_BACKUP_MAX_BYTES = 64 * 1024 * 1024;
const NUMBER_TAG = "$preludeNumber";
const specialNumbers = { NaN, Infinity, "-Infinity": -Infinity, "-0": -0 };

/** Complete collection history is required: gaps are explicit deletion tombstones, never invented takes. */
export function requireImprovCollectionEvidence(v: unknown): asserts v is ImprovCollectionEvidence {
  if (v === null || typeof v !== "object" || Object.keys(v).length !== 2 || !("collection" in v) || !("takes" in v)) throw new ImprovLibraryError("corrupt");
  requireCollection(v.collection);
  const collection = v.collection;
  if (v.collection.deletedAtMs !== null || !Array.isArray(v.takes) || v.takes.length > L.takesPerCollection
    || v.takes.length !== v.collection.nextTakeNumber - 1) throw new ImprovLibraryError("corrupt");
  const ids = new Set<string>(); let bytes = 0;
  v.takes.forEach((item, i) => {
    // Loaded evidence and tombstones have different shapes; neither can hide a missing numbered entry.
    if (item && typeof item === "object" && "record" in item) {
      requireLoadedTake(item); bytes += item.record.committedAccountedBytes;
      if (bytes > IMPROV_BACKUP_MAX_BYTES) throw new ImprovLibraryError("limit");
      const current = item.record;
      if (current.collectionId !== collection.collectionId || current.number !== i + 1 || ids.has(current.takeId)) throw new ImprovLibraryError("corrupt");
      if (i === 0 && current.takeId !== collection.firstTakeId) throw new ImprovLibraryError("corrupt");
      ids.add(current.takeId); return;
    }
    requireTake(item);
    if (item.kind !== "deleted-take") throw new ImprovLibraryError("corrupt");
    const record = item;
    if (record.collectionId !== collection.collectionId || record.number !== i + 1 || ids.has(record.takeId)
      || (i === 0 && record.takeId !== collection.firstTakeId)) throw new ImprovLibraryError("corrupt");
    ids.add(record.takeId);
  });
}

export function encodeImprovBackup(evidence: ImprovCollectionEvidence): string {
  requireImprovCollectionEvidence(evidence);
  const json = JSON.stringify({ format: "prelude-improv-backup", version: IMPROV_BACKUP_VERSION,
    evidenceKind: "original-midi-delivery", evidence }, (_key, value: unknown) => {
    if (typeof value !== "number") return value;
    if (Object.is(value, -0)) return { [NUMBER_TAG]: "-0" };
    if (!Number.isFinite(value)) return { [NUMBER_TAG]: String(value) };
    return value;
  });
  if (new TextEncoder().encode(json).byteLength > IMPROV_BACKUP_MAX_BYTES) throw new ImprovLibraryError("limit");
  return json;
}

export function parseImprovBackup(json: string): ImprovCollectionEvidence {
  if (typeof json !== "string" || json.length > IMPROV_BACKUP_MAX_BYTES || new TextEncoder().encode(json).byteLength > IMPROV_BACKUP_MAX_BYTES) throw new ImprovLibraryError("limit");
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new ImprovLibraryError("corrupt"); }
  let nodes = 0;
  const decode = (value: unknown, depth: number): unknown => {
    if (++nodes > 5_000_000 || depth > 64) throw new ImprovLibraryError("limit");
    if (typeof value === "number" && (!Number.isFinite(value) || Object.is(value, -0))) throw new ImprovLibraryError("corrupt");
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map((item) => decode(item, depth + 1));
    if (Object.hasOwn(value, NUMBER_TAG)) {
      const tag: unknown = Reflect.get(value, NUMBER_TAG);
      if (Object.keys(value).length !== 1 || typeof tag !== "string" || !Object.hasOwn(specialNumbers, tag)) throw new ImprovLibraryError("corrupt");
      return specialNumbers[tag as keyof typeof specialNumbers];
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item, depth + 1)]));
  };
  const root = decode(parsed, 0);
  if (root === null || typeof root !== "object" || Object.keys(root).length !== 4 || !("format" in root) || root.format !== "prelude-improv-backup"
    || !("version" in root) || !("evidenceKind" in root) || root.evidenceKind !== "original-midi-delivery" || !("evidence" in root)) throw new ImprovLibraryError("corrupt");
  if (root.version !== IMPROV_BACKUP_VERSION) throw new ImprovLibraryError("unsupported");
  requireImprovCollectionEvidence(root.evidence);
  return immutableCopy(root.evidence);
}

export function improvBackupBlob(evidence: ImprovCollectionEvidence): Blob {
  return new Blob([encodeImprovBackup(evidence)], { type: "application/json" });
}

export function restoreImprovBackup(library: ImprovArchiveLibrary, json: string, createId?: () => string) {
  return library.importCollection(parseImprovBackup(json), createId);
}
