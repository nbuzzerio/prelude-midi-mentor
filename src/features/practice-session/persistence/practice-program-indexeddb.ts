import { canonicalProgramJson, validatePracticeProgram } from "../practice-program-validation";
import { PRACTICE_PROGRAM_LIMITS as L, validProgramId, type PracticeProgramHead, type PracticeProgramRevision } from "../practice-program-types";
import { parsePracticeExerciseEntry } from "../practice-session-validation";

export const PRACTICE_PROGRAM_DATABASE = "prelude-practice-programs";
const STORES = ["programs", "revisions"];
export type ProgramStorageFailure = "unavailable" | "blocked" | "closed" | "quota" | "write-failed" | "corrupt" | "unsupported" | "conflict" | "stale" | "confirmation-required" | "limit";
export class PracticeProgramStorageError extends Error {
  constructor(public readonly reason: ProgramStorageFailure, message: string) { super(message); this.name = "PracticeProgramStorageError"; }
}
const fail = (reason: ProgramStorageFailure, message: string): never => { throw new PracticeProgramStorageError(reason, message); };
function storageError(error: unknown): PracticeProgramStorageError {
  if (error instanceof PracticeProgramStorageError) return error;
  const name = error instanceof DOMException ? error.name : "";
  return new PracticeProgramStorageError(name === "VersionError" ? "unsupported" : name === "QuotaExceededError" ? "quota" : "write-failed",
    name === "VersionError" ? "A newer weekly-program database is present. It has not been changed." : "Weekly-program storage failed. Existing data is unchanged; keep the import for retry.");
}
function head(value: unknown): PracticeProgramHead {
  const row = value as PracticeProgramHead;
  if (row?.schemaVersion !== 1) return fail(row?.schemaVersion > 1 ? "unsupported" : "corrupt", "The saved program index is corrupt or newer. It has not been changed.");
  if (Object.keys(row).sort().join() !== "programId,revision,schemaVersion" || !validProgramId(row.programId) || !Number.isSafeInteger(row.revision) || row.revision < 1) return fail("corrupt", "The saved program index is invalid. It has not been changed.");
  return row;
}
function revision(value: unknown): PracticeProgramRevision {
  const row = value as PracticeProgramRevision;
  if (row?.schemaVersion !== 1) return fail(row?.schemaVersion > 1 ? "unsupported" : "corrupt", "The saved program revision is corrupt or newer. It has not been changed.");
  const parsed = validatePracticeProgram(row.program);
  if (!parsed.ok || Object.keys(row).sort().join() !== "nativeExercises,program,programId,revision,schemaVersion"
    || row.programId !== parsed.value.programId || row.revision !== parsed.value.revision
    || !Array.isArray(row.nativeExercises) || row.nativeExercises.length !== parsed.value.nativeExercises.length) return fail("corrupt", "The saved program revision is invalid. It has not been changed.");
  // Validate the preserved native snapshots, comparing only the fields selected by the
  // interchange contract. Other native settings retain their historical default values.
  const selected: Record<string, readonly string[]> = {
    "note-recognition": ["mode", "showTargetName", "enabledExerciseTypes", "enabledNoteCategories"],
    triads: ["mode", "showTargetName", "enabledExerciseTypes", "enabledTriadQualities", "enabledTriadPositions"],
    "melodic-intervals": ["exerciseType", "mode", "showTargetName", "enabledDirections", "enabledIntervals", "enabledNoteCategories"],
    "random-scales": ["exerciseType", "scalePracticeMode", "mode", "showTargetName", "enabledScales", "enabledScaleDirections", "enabledNoteCategories"],
    "scale-repertoire": ["exerciseType", "scalePracticeMode", "scaleRepertoire", "mode", "showTargetName"],
    arpeggios: ["exerciseType", "mode", "showTargetName", "enabledArpeggios", "enabledArpeggioDirections", "enabledNoteCategories"],
    "chord-progressions": ["exerciseType", "mode", "showTargetName", "enabledChordProgressionKeyIds", "enabledChordProgressionTemplateIds"],
    "ear-intervals": ["enabledDirections", "enabledIntervals"],
    "reading-flow": ["staff", "keyId", "tempoBpm", "measureCount", "continuousPractice", "continuousDurationMinutes"],
  };
  row.nativeExercises.forEach((entry, index) => {
    const native = parsePracticeExerciseEntry(entry), expected = parsed.value.nativeExercises[index]!;
    const fields = selected[parsed.value.program.exercises[index]!.type]!;
    if (!native.ok || native.value.id !== expected.id || native.value.label !== expected.label || native.value.engine !== expected.engine
      || canonicalProgramJson(native.value.target) !== canonicalProgramJson(expected.target)
      || fields.some(key => canonicalProgramJson(Reflect.get(native.value.config, key)) !== canonicalProgramJson(Reflect.get(expected.config, key)))) return fail("corrupt", "A saved native exercise snapshot is invalid or disagrees with its definition. Nothing was changed.");
  });
  return structuredClone(row);
}
export type ProgramImportReview = Readonly<{ candidate: PracticeProgramRevision; kind: "new" | "identical" | "newer"; currentRevision: number | null }>;
/** Definitions only. All revisions and current-head changes commit in one serialized native transaction. */
export class IndexedDbPracticePrograms {
  private opening: Promise<IDBDatabase> | null = null;
  private closed = false;
  constructor(private factory?: IDBFactory) {}
  private open(): Promise<IDBDatabase> {
    if (this.closed) return Promise.reject(new PracticeProgramStorageError("closed", "The weekly-program store is closed."));
    this.opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      let factory: IDBFactory | undefined;
      try { factory = this.factory ?? globalThis.indexedDB; } catch { /* Access may be blocked. */ }
      if (!factory) { reject(new PracticeProgramStorageError("unavailable", "IndexedDB is unavailable. Your existing presets are unaffected.")); return; }
      let request: IDBOpenDBRequest;
      try { request = factory.open(PRACTICE_PROGRAM_DATABASE, 1); } catch (error) { reject(storageError(error)); return; }
      let refused = false;
      request.onblocked = () => { refused = true; reject(new PracticeProgramStorageError("blocked", "Weekly-program storage is blocked by another tab. Close it and retry.")); };
      request.onerror = () => reject(storageError(request.error));
      request.onupgradeneeded = () => {
        if (refused || this.closed) { request.transaction?.abort(); return; }
        try {
          const db = request.result;
          db.createObjectStore("programs", { keyPath: "programId" });
          db.createObjectStore("revisions", { keyPath: ["programId", "revision"] }).createIndex("programId", "programId");
        } catch (error) { request.transaction?.abort(); reject(storageError(error)); }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (refused || this.closed) { db.close(); reject(new PracticeProgramStorageError("closed", "Weekly-program storage was closed.")); return; }
        if (!STORES.every(store => db.objectStoreNames.contains(store))) { db.close(); reject(new PracticeProgramStorageError("corrupt", "The weekly-program database structure is invalid.")); return; }
        try {
          if (!db.transaction(STORES, "readonly").objectStore("revisions").indexNames.contains("programId")) throw new PracticeProgramStorageError("corrupt", "The weekly-program revision index is missing. Nothing was changed.");
        } catch (error) { db.close(); reject(storageError(error)); return; }
        db.onversionchange = () => { db.close(); this.opening = null; };
        resolve(db);
      };
    }).catch(error => { this.opening = null; throw error; });
    return this.opening;
  }
  private async transaction<T>(mode: IDBTransactionMode, work: (tx: IDBTransaction, read: <V>(request: IDBRequest<V>, done: (value: V) => void) => void, result: (value: T) => void) => void): Promise<T> {
    const db = await this.open();
    if (this.closed) return fail("closed", "The weekly-program store is closed.");
    return new Promise<T>((resolve, reject) => {
      let tx: IDBTransaction; try { tx = db.transaction(STORES, mode); } catch (error) { reject(storageError(error)); return; }
      let value: T; let hasResult = false; let failure: unknown;
      const abort = (error: unknown) => { failure = error; try { tx.abort(); } catch { reject(storageError(error)); } };
      const read = <V,>(request: IDBRequest<V>, done: (value: V) => void) => { request.onsuccess = () => { try { done(request.result); } catch (error) { abort(error); } }; };
      tx.oncomplete = () => hasResult ? resolve(value) : reject(new PracticeProgramStorageError("corrupt", "The program transaction did not return a result."));
      tx.onabort = () => reject(storageError(failure ?? tx.error)); tx.onerror = () => { failure ??= tx.error; };
      try { work(tx, read, next => { value = next; hasResult = true; }); } catch (error) { abort(error); }
    });
  }
  private inspect(tx: IDBTransaction, read: <V>(request: IDBRequest<V>, done: (value: V) => void) => void, candidate: PracticeProgramRevision, done: (review: ProgramImportReview) => void) {
    read(tx.objectStore("programs").getAll(undefined, L.programs + 1), (rows: unknown[]) => {
      if (rows.length > L.programs) return fail("limit", "The saved program limit has been reached.");
      const heads = rows.map(head), current = heads.find(row => row.programId === candidate.programId);
      read(tx.objectStore("revisions").index("programId").getAll(candidate.programId, L.revisionsPerProgram + 1), (values: unknown[]) => {
        if (values.length > L.revisionsPerProgram) return fail("limit", "The saved revision limit has been reached.");
        const revisions = values.map(revision);
        if ((!current && revisions.length) || (current && (!revisions.some(row => row.revision === current.revision) || revisions.some(row => row.revision > current.revision)))
          || revisions.some(row => row.programId !== candidate.programId)) return fail("corrupt", "Program revisions disagree with their current index. Nothing was changed.");
        const same = revisions.find(row => row.revision === candidate.revision);
        if (same) {
          if (canonicalProgramJson(same.program) !== canonicalProgramJson(candidate.program)) return fail("conflict", `Program ${candidate.programId}, revision ${candidate.revision}, already has different content. Use a newer revision; existing content is unchanged.`);
          done({ candidate: same, kind: "identical", currentRevision: current!.revision }); return;
        }
        if (current && candidate.revision <= current.revision) return fail("stale", `Current revision is ${current.revision}. Import a newer revision; older missing revisions cannot replace it.`);
        if (revisions.length === L.revisionsPerProgram || !current && heads.length === L.programs) return fail("limit", "The weekly-program storage limit has been reached. Existing definitions are retained.");
        done({ candidate, kind: current ? "newer" : "new", currentRevision: current?.revision ?? null });
      });
    });
  }
  async review(candidate: PracticeProgramRevision): Promise<ProgramImportReview> {
    const copy = revision(candidate);
    return this.transaction("readonly", (tx, read, result) => this.inspect(tx, read, copy, result));
  }
  async save(candidate: PracticeProgramRevision, expectedCurrentRevision: number | null, confirmNewerRevision = false): Promise<ProgramImportReview> {
    const copy = revision(candidate);
    return this.transaction("readwrite", (tx, read, result) => this.inspect(tx, read, copy, review => {
      if (review.kind === "identical") { result(review); return; }
      if (review.currentRevision !== expectedCurrentRevision) return fail("stale", "Another tab changed this program. Validate and preview again before saving.");
      if (review.kind === "newer" && !confirmNewerRevision) return fail("confirmation-required", "Confirm making this newer revision current. Earlier revisions remain unchanged.");
      tx.objectStore("revisions").add(copy);
      tx.objectStore("programs").put({ schemaVersion: 1, programId: copy.programId, revision: copy.revision } satisfies PracticeProgramHead);
      result(review);
    }));
  }
  list(): Promise<readonly PracticeProgramRevision[]> {
    return this.transaction("readonly", (tx, read, result) => read(tx.objectStore("programs").getAll(undefined, L.programs + 1), (rows: unknown[]) => {
      if (rows.length > L.programs) return fail("limit", "The program list exceeds its supported limit.");
      const heads = rows.map(head), values: PracticeProgramRevision[] = [];
      if (!heads.length) { result(values); return; }
      for (const current of heads) read(tx.objectStore("revisions").get([current.programId, current.revision]), value => {
        const saved = revision(value);
        if (saved.programId !== current.programId || saved.revision !== current.revision) return fail("corrupt", "The current program revision is inconsistent.");
        values.push(saved); if (values.length === heads.length) result(values.sort((a, b) => a.programId.localeCompare(b.programId)));
      });
    }));
  }
  revisions(programId: string): Promise<readonly PracticeProgramRevision[]> {
    if (!validProgramId(programId)) return Promise.reject(new PracticeProgramStorageError("corrupt", "Invalid program ID."));
    return this.transaction("readonly", (tx, read, result) => read(tx.objectStore("revisions").index("programId").getAll(programId, L.revisionsPerProgram + 1), (rows: unknown[]) => {
      if (rows.length > L.revisionsPerProgram) return fail("limit", "The revision list exceeds its supported limit.");
      const values = rows.map(revision); if (values.some(row => row.programId !== programId)) return fail("corrupt", "The revision identity is inconsistent.");
      result(values.sort((a, b) => a.revision - b.revision));
    }));
  }
  close() { this.closed = true; void this.opening?.then(db => db.close(), () => {}); }
}
