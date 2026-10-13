import { canonicalProgramJson } from "../practice-program-validation";
import { parseProgramHistoryRecord, PROGRAM_ATTEMPT_LIMITS as L, type ProgramAttempt, type ProgramHistoryRecord } from "../practice-program-attempt";

export const PRACTICE_ATTEMPT_DATABASE = "prelude-practice-attempts";
export class PracticeAttemptStorageError extends Error {
  constructor(public readonly reason: "storage" | "corrupt" | "conflict" | "limit" | "closed", message: string) { super(message); this.name = "PracticeAttemptStorageError"; }
}
const failure = (error: unknown) => error instanceof PracticeAttemptStorageError ? error : new PracticeAttemptStorageError("storage", "Weekly history could not be saved or loaded. Existing data is retained. Keep pending results and retry.");
function parse(value: unknown) { try { return parseProgramHistoryRecord(value); } catch (error) { throw new PracticeAttemptStorageError("corrupt", error instanceof Error ? error.message : "Saved history is invalid; nothing was changed."); } }
const base = (value: ProgramAttempt) => {
  const { outcome: _outcome, closed: _closed, updatedAt: _updated, endedAt: _ended, activeDurationMs: _active, prescribedDurationMs: _prescribed,
    bonusDurationMs: _bonus, prescribedUnits: _units, bonusUnits: _bonusUnits, metrics: _metrics, targetMetrics: _targetMetrics, writeVersion: _version, leaseUntilMs: _lease, ...identity } = value;
  void [_outcome, _closed, _updated, _ended, _active, _prescribed, _bonus, _units, _bonusUnits, _metrics, _targetMetrics, _version, _lease]; return identity;
};
/** Additive independent database: never upgrades or writes definition/legacy stores. */
export class IndexedDbPracticeAttempts {
  private opening: Promise<IDBDatabase> | null = null; private closed = false;
  constructor(private factory?: IDBFactory) {}
  private open(): Promise<IDBDatabase> {
    if (this.closed) return Promise.reject(new PracticeAttemptStorageError("closed", "Weekly history is closed."));
    this.opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try { const factory = this.factory ?? globalThis.indexedDB; if (!factory) throw Error(); request = factory.open(PRACTICE_ATTEMPT_DATABASE, 1); } catch (error) { reject(failure(error)); return; }
      let blocked = false;
      request.onblocked = () => { blocked = true; reject(new PracticeAttemptStorageError("storage", "Weekly history is blocked by another tab. Close that tab and retry; existing data is unchanged.")); };
      request.onerror = () => reject(failure(request.error));
      request.onupgradeneeded = () => {
        if (blocked || this.closed) { request.transaction?.abort(); return; }
        try { const records = request.result.createObjectStore("records", { keyPath: "recordId" }); records.createIndex("programId", "programId"); records.createIndex("occurrence", ["programId", "programRevision", "occurrenceId", "kind"], { unique: true }); }
        catch (error) { request.transaction?.abort(); reject(failure(error)); }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (blocked || this.closed) { db.close(); reject(new PracticeAttemptStorageError("closed", "Weekly history was closed.")); return; }
        try { const store = db.transaction("records", "readonly").objectStore("records"); if (!store.indexNames.contains("programId") || !store.indexNames.contains("occurrence")) throw new PracticeAttemptStorageError("corrupt", "Weekly history indexes are missing; existing data is unchanged."); }
        catch (error) { db.close(); reject(failure(error)); return; }
        db.onversionchange = () => { db.close(); this.opening = null; }; resolve(db);
      };
    }).catch(error => { this.opening = null; throw error; }); return this.opening;
  }
  private async transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore, read: <V>(request: IDBRequest<V>, done: (value: V) => void) => void, done: (value: T) => void) => void): Promise<T> {
    const db = await this.open(); if (this.closed) throw new PracticeAttemptStorageError("closed", "Weekly history is closed.");
    return new Promise((resolve, reject) => {
      let tx: IDBTransaction; try { tx = db.transaction("records", mode); } catch (error) { reject(failure(error)); return; }
      let result: T, ready = false, error: unknown;
      const abort = (reason: unknown) => { error = reason; try { tx.abort(); } catch { reject(failure(reason)); } };
      const read = <V,>(request: IDBRequest<V>, done: (value: V) => void) => { request.onsuccess = () => { try { done(request.result); } catch (reason) { abort(reason); } }; };
      tx.oncomplete = () => ready ? resolve(result) : reject(failure(null)); tx.onabort = () => reject(failure(error ?? tx.error));
      try { work(tx.objectStore("records"), read, value => { result = value; ready = true; }); } catch (reason) { abort(reason); }
    });
  }
  async save(value: ProgramHistoryRecord, expectedVersion: number | null): Promise<ProgramHistoryRecord> {
    const next = parse(value);
    if (new TextEncoder().encode(JSON.stringify(next)).length > 65536) throw new PracticeAttemptStorageError("limit", "A weekly history record exceeds its 64 KiB bound. Pending results remain in this tab.");
    return this.transaction("readwrite", (store, read, done) => read(store.get(next.recordId), previous => {
      if (previous !== undefined) {
        const current = parse(previous);
        if (canonicalProgramJson(current) === canonicalProgramJson(next)) { done(current); return; }
        if (current.kind !== "attempt" || next.kind !== "attempt" || current.closed || current.ownerId !== next.ownerId
          || current.writeVersion !== expectedVersion || next.writeVersion !== current.writeVersion + 1
          || canonicalProgramJson(base(current)) !== canonicalProgramJson(base(next))
          || current.outcome === "completed" && next.outcome !== "completed"
          || current.targetMetrics !== null && canonicalProgramJson(current.targetMetrics) !== canonicalProgramJson(next.targetMetrics)
          || next.activeDurationMs < current.activeDurationMs || next.prescribedDurationMs < current.prescribedDurationMs || next.bonusDurationMs < current.bonusDurationMs
          || next.prescribedUnits < current.prescribedUnits || next.bonusUnits < current.bonusUnits || next.updatedAt < current.updatedAt) throw new PracticeAttemptStorageError("conflict", "This attempt changed or is already closed. History was not overwritten; refresh before retrying.");
        store.put(next); done(next); return;
      }
      if (expectedVersion !== null || next.kind === "attempt" && (next.writeVersion !== 0 || next.closed || next.outcome !== "in-progress")) throw new PracticeAttemptStorageError("conflict", "An attempt needs its acknowledged start checkpoint before result updates.");
      read(store.count(), count => { if (count >= L.records) throw new PracticeAttemptStorageError("limit", "Weekly history has reached 10,000 records. Nothing was deleted; pending work remains available."); store.add(next); done(next); });
    }));
  }
  list(programId: string): Promise<readonly ProgramHistoryRecord[]> {
    return this.transaction("readonly", (store, read, done) => read(store.index("programId").getAll(programId, L.records + 1), (rows: unknown[]) => {
      if (rows.length > L.records) throw new PracticeAttemptStorageError("limit", "Weekly history exceeds its supported bound.");
      const values = rows.map(parse); if (values.some(value => value.programId !== programId)) throw new PracticeAttemptStorageError("corrupt", "Weekly history identity is inconsistent."); done(values);
    }));
  }
  close() { this.closed = true; void this.opening?.then(db => db.close(), () => {}); }
}
