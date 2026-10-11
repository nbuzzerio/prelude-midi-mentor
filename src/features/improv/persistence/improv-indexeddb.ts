import { improvControlAccountedBytes, type ImprovTakeMetadata } from "../improv-take";
import { IMPROV_LIBRARY_LIMITS as L, ImprovLibraryError, immutableCopy, libraryError, sameEvidence,
  type ImprovCheckpoint, type ImprovCollection, type ImprovDeletedTake, type ImprovEventChunk,
  type ImprovArchiveLibrary, type ImprovLoadedTake, type ImprovStoredTake, type ImprovCollectionEvidence } from "../improv-library";
import { IMPROV_BACKUP_MAX_BYTES, requireImprovCollectionEvidence } from "../improv-backup";
import { chunkAccountedBytes, connectionAccountedBytes, EMPTY_IMPROV_CONTINUITY, initialAccountedBytes,
  integer, requireChunk, requireCollection, requireConnections, requireControls, requireMetadata, requireTake, requireLoadedTake,
  usableId, validateEvents, wallTime } from "../improv-library-validation";

export const IMPROV_DB_NAME = "prelude-improv";
export const IMPROV_DB_VERSION = 1;
const STORES = ["collections", "takes", "eventChunks"];
type Read = <T>(request: IDBRequest<T>, next: (value: T) => void) => void;
type TransactionWork<T> = (tx: IDBTransaction, read: Read, result: (value: T) => void) => void;

/** All mutations share a transaction scope: allocation and writer fencing work across DB handles/tabs. */
export class IndexedDbImprovLibrary implements ImprovArchiveLibrary {
  private opening: Promise<IDBDatabase> | null = null;
  private handle: IDBDatabase | null = null;
  private closed = false;
  constructor(private readonly options: Readonly<{ factory?: IDBFactory; now?: () => number }> = {}) {}

  private now(): number {
    const value = (this.options.now ?? Date.now)();
    if (!wallTime(value)) throw new ImprovLibraryError("clock-regressed");
    return value;
  }
  private open(): Promise<IDBDatabase> {
    if (this.closed) return Promise.reject(new ImprovLibraryError("closed"));
    this.opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      const factory = this.options.factory ?? globalThis.indexedDB;
      if (!factory) { reject(new ImprovLibraryError("unavailable")); return; }
      const request = factory.open(IMPROV_DB_NAME, IMPROV_DB_VERSION);
      let rejected = false;
      request.onblocked = () => { rejected = true; reject(new ImprovLibraryError("blocked")); };
      request.onerror = () => reject(new ImprovLibraryError(request.error?.name === "VersionError" ? "unsupported" : "unavailable"));
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("collections", { keyPath: "collectionId" });
        const takes = db.createObjectStore("takes", { keyPath: "takeId" });
        takes.createIndex("collectionId", "collectionId");
        takes.createIndex("collectionNumber", ["collectionId", "number"], { unique: true });
        const chunks = db.createObjectStore("eventChunks", { keyPath: ["takeId", "index"] });
        chunks.createIndex("takeId", "takeId");
      };
      request.onsuccess = () => {
        const db = request.result;
        if (rejected || this.closed) { db.close(); reject(new ImprovLibraryError("closed")); return; }
        try {
          if (!STORES.every((name) => db.objectStoreNames.contains(name))) throw new ImprovLibraryError("unsupported");
          const schema = db.transaction(STORES, "readonly");
          if (!["collectionId", "collectionNumber"].every((index) => schema.objectStore("takes").indexNames.contains(index))
            || !schema.objectStore("eventChunks").indexNames.contains("takeId")) throw new ImprovLibraryError("unsupported");
        } catch { db.close(); reject(new ImprovLibraryError("unsupported")); return; }
        this.handle = db;
        db.onversionchange = () => { db.close(); this.handle = null; this.opening = null; };
        resolve(db);
      };
    }).catch((error: unknown) => { this.opening = null; throw error instanceof ImprovLibraryError ? error : new ImprovLibraryError("unavailable"); });
    return this.opening;
  }
  private async transaction<T>(mode: IDBTransactionMode, work: TransactionWork<T>): Promise<T> {
    const db = await this.open();
    if (this.closed) throw new ImprovLibraryError("closed");
    return new Promise<T>((resolve, reject) => {
      let tx: IDBTransaction;
      try { tx = db.transaction(STORES, mode); } catch (error) { reject(libraryError(error)); return; }
      let value: T; let ready = false; let failure: unknown;
      const guard = (callback: () => void) => {
        try { callback(); } catch (error) { failure = error; tx.abort(); }
      };
      const read: Read = (request, next) => { request.onsuccess = () => guard(() => next(request.result)); };
      tx.oncomplete = () => ready ? resolve(immutableCopy(value)) : reject(new ImprovLibraryError("corrupt"));
      tx.onabort = () => reject(libraryError(failure ?? tx.error));
      tx.onerror = () => { /* Abort is the authoritative failure; no request-success save acknowledgment. */ };
      guard(() => work(tx, read, (result) => { value = result; ready = true; }));
    });
  }
  close(): void { this.closed = true; this.handle?.close(); this.handle = null; }
  private collection(value: unknown): ImprovCollection {
    if (value === undefined) throw new ImprovLibraryError("not-found");
    requireCollection(value);
    if (value.deletedAtMs !== null) throw new ImprovLibraryError("not-found");
    return value;
  }
  private take(value: unknown): ImprovStoredTake {
    if (value === undefined) throw new ImprovLibraryError("not-found");
    requireTake(value);
    if (value.kind === "deleted-take") throw new ImprovLibraryError("not-found");
    return value;
  }
  private page(after: number, limit: number) {
    if (!integer(after) || !integer(limit) || limit < 1 || limit > L.pageSize) throw new ImprovLibraryError("limit");
  }
  private checkTime(now: number, previous: number) {
    if (now < previous) throw new ImprovLibraryError("clock-regressed");
  }
  createCollection(collectionId: string, title: string, activity: ImprovCollection["activity"]): Promise<ImprovCollection> {
    return this.transaction("readwrite", (tx, read, result) => {
      const now = this.now();
      const value: ImprovCollection = { schemaVersion: 1, collectionId, title, activity, firstTakeId: null,
        nextTakeNumber: 1, revision: 1, createdAtMs: now, updatedAtMs: now, deletedAtMs: null };
      requireCollection(value);
      const store = tx.objectStore("collections");
      read(store.get(collectionId), (existing) => {
        if (existing !== undefined) throw new ImprovLibraryError("collision");
        read(store.count(), (count) => {
          if (count >= L.collections) throw new ImprovLibraryError("limit");
          store.add(value); result(value);
        });
      });
    });
  }
  async listCollections(afterId = "", limit = 50): Promise<readonly ImprovCollection[]> {
    this.page(0, limit);
    return this.transaction("readonly", (tx, read, result) => read(tx.objectStore("collections").getAll(undefined, L.collections + 1), (values: unknown[]) => {
      if (values.length > L.collections) throw new ImprovLibraryError("limit");
      values.forEach(requireCollection);
      result((values as ImprovCollection[]).filter((c) => c.deletedAtMs === null && c.collectionId > afterId)
        .sort((a, b) => a.collectionId < b.collectionId ? -1 : a.collectionId > b.collectionId ? 1 : 0).slice(0, limit));
    }));
  }
  renameCollection(collectionId: string, title: string, expectedRevision: number): Promise<ImprovCollection> {
    return this.transaction("readwrite", (tx, read, result) => read(tx.objectStore("collections").get(collectionId), (value) => {
      const existing = this.collection(value); const now = this.now(); this.checkTime(now, existing.updatedAtMs);
      if (expectedRevision !== existing.revision) throw new ImprovLibraryError("stale");
      const changed = { ...existing, title, revision: existing.revision + 1, updatedAtMs: now };
      requireCollection(changed); tx.objectStore("collections").put(changed); result(changed);
    }));
  }
  async allocateTake(collectionId: string, metadata: ImprovTakeMetadata, writerToken: string): Promise<ImprovStoredTake> {
    requireMetadata(metadata); const capture = immutableCopy(metadata);
    if (!usableId(writerToken)) return Promise.reject(new ImprovLibraryError("corrupt"));
    return this.transaction("readwrite", (tx, read, result) => read(tx.objectStore("collections").get(collectionId), (value) => {
      const collection = this.collection(value);
      read(tx.objectStore("takes").get(capture.takeId), (prior) => {
        if (prior !== undefined) {
          const existing = this.take(prior);
          if (existing.importedFrom) throw new ImprovLibraryError("owned");
          if (existing.collectionId !== collectionId || existing.writerToken !== writerToken
            || !sameEvidence(existing.capture.start, capture.start) || !sameEvidence(existing.capture.selectedInput, capture.selectedInput)
            || !sameEvidence(existing.capture.limits, capture.limits)) throw new ImprovLibraryError("collision");
          if (capture.eventWatermark < existing.committedEventWatermark) throw new ImprovLibraryError("stale");
          result(existing); return; // Retry of the same durable Start does not allocate another number.
        }
        if (collection.nextTakeNumber > L.takesPerCollection) throw new ImprovLibraryError("limit");
        const now = this.now(); this.checkTime(now, collection.updatedAtMs);
        const take: ImprovStoredTake = { schemaVersion: capture.schemaVersion, ...(capture.schemaVersion === 2 ? { controls: [], committedControlWatermark: 0 } : {}), kind: "take", takeId: capture.takeId, collectionId,
          number: collection.nextTakeNumber, writerToken, capture, status: "recording", storageStatus: "committed",
          committedEventWatermark: 0, committedAccountedBytes: initialAccountedBytes(capture), chunkCount: 0,
          continuity: EMPTY_IMPROV_CONTINUITY, connections: [], revision: 1, checkpointAtMs: now,
          lease: { token: writerToken, expiresAtMs: now + L.leaseMs }, recovery: null, captureFailure: null, lastCommit: null };
        requireTake(take);
        tx.objectStore("takes").add(take);
        tx.objectStore("collections").put({ ...collection, firstTakeId: collection.firstTakeId ?? capture.takeId,
          nextTakeNumber: collection.nextTakeNumber + 1, revision: collection.revision + 1, updatedAtMs: now });
        result(take);
      });
    }));
  }
  async checkpoint(request: ImprovCheckpoint): Promise<ImprovStoredTake> {
    if (!Array.isArray(request.events) || request.events.length > L.chunkEvents) throw new ImprovLibraryError("limit");
    const value = immutableCopy(request); requireMetadata(value.capture);
    return this.transaction("readwrite", (tx, read, result) => read(tx.objectStore("takes").get(value.takeId), (raw) => {
      const existing = this.take(raw);
      if (existing.importedFrom) throw new ImprovLibraryError("owned"); // Imported evidence can never resume or accept writer retries.
      if (existing.writerToken !== value.writerToken || existing.status === "incomplete") throw new ImprovLibraryError("owned");
      const duplicate = existing.lastCommit?.operationId === value.operationId;
      if (duplicate) {
        const last = existing.lastCommit!;
        if (value.expectedRevision !== last.previousRevision || value.finalize !== last.finalized
          || !sameEvidence(existing.capture, value.capture) || !sameEvidence(existing.connections, value.connections)
          || !sameEvidence(existing.controls, value.controls)
          || !sameEvidence(existing.captureFailure, value.captureFailure)) throw new ImprovLibraryError("collision");
        if (last.chunkIndex === null) {
          if (value.events.length) throw new ImprovLibraryError("collision");
          result(existing);
        } else read(tx.objectStore("eventChunks").get([value.takeId, last.chunkIndex]), (chunk) => {
          requireChunk(chunk, value.takeId, last.chunkIndex!);
          if (!sameEvidence(chunk.events, value.events)) throw new ImprovLibraryError("collision");
          result(existing);
        });
        return;
      }
      if (existing.status !== "recording" || existing.lease?.token !== value.writerToken) throw new ImprovLibraryError("owned");
      if (existing.revision !== value.expectedRevision) throw new ImprovLibraryError("stale");
      const now = this.now(); this.checkTime(now, existing.checkpointAtMs);
      // A stopped owner's explicit retry may save its suffix after expiry, unless recovery already fenced it.
      if (now >= existing.lease.expiresAtMs && value.capture.status === "recording") throw new ImprovLibraryError("lease-expired");
      if (!usableId(value.operationId) || value.capture.takeId !== existing.takeId
        || value.capture.schemaVersion !== existing.capture.schemaVersion || (value.capture.controlCount ?? 0) < (existing.capture.controlCount ?? 0)
        || !sameEvidence(value.capture.start, existing.capture.start) || !sameEvidence(value.capture.selectedInput, existing.capture.selectedInput)
        || !sameEvidence(value.capture.limits, existing.capture.limits) || value.capture.eventWatermark < existing.capture.eventWatermark
        || (existing.capture.terminal !== null && !sameEvidence(existing.capture, value.capture))
        || (existing.captureFailure !== null && !sameEvidence(existing.captureFailure, value.captureFailure))) throw new ImprovLibraryError("corrupt");
      const continuity = validateEvents(value.events, value.capture, existing.committedEventWatermark, existing.continuity);
      const watermark = existing.committedEventWatermark + value.events.length;
      const chunkBytes = chunkAccountedBytes(value.events);
      if (chunkBytes > L.chunkBytes && (value.events.length !== 1 || chunkBytes > L.bytesPerTake)) throw new ImprovLibraryError("limit");
      if (watermark > value.capture.eventWatermark || (value.events.length && existing.chunkCount >= L.chunksPerTake)) throw new ImprovLibraryError("limit");
      requireConnections(value.connections, value.capture, watermark);
      const controls = value.controls ?? [];
      requireControls(controls, value.capture, watermark);
      if ((value.capture.schemaVersion === 2) !== (value.controls !== undefined) || controls.length < (existing.controls?.length ?? 0)
        || !sameEvidence(existing.controls ?? [], controls.slice(0, existing.controls?.length ?? 0))) throw new ImprovLibraryError("corrupt");
      if (value.connections.length < existing.connections.length || !sameEvidence(existing.connections, value.connections.slice(0, existing.connections.length))) throw new ImprovLibraryError("corrupt");
      if (value.finalize && (value.capture.status === "recording" || watermark !== value.capture.eventWatermark
        || value.connections.length !== value.capture.connectionCount || controls.length !== (value.capture.controlCount ?? 0))) throw new ImprovLibraryError("corrupt");
      const changed: ImprovStoredTake = { ...existing, capture: value.capture,
        ...(value.capture.schemaVersion === 2 ? { controls, committedControlWatermark: controls.length } : {}),
        status: value.finalize ? value.capture.status : "recording", committedEventWatermark: watermark,
        committedAccountedBytes: existing.committedAccountedBytes + chunkBytes
          + value.connections.slice(existing.connections.length).reduce((sum, c) => sum + connectionAccountedBytes(c), 0)
          + controls.slice(existing.controls?.length ?? 0).reduce((sum, c) => sum + improvControlAccountedBytes(c), 0),
        chunkCount: existing.chunkCount + (value.events.length ? 1 : 0), continuity,
        connections: value.connections, revision: existing.revision + 1, checkpointAtMs: now,
        lease: value.finalize ? null : { token: value.writerToken, expiresAtMs: now + L.leaseMs },
        captureFailure: value.captureFailure,
        lastCommit: { operationId: value.operationId, previousRevision: existing.revision,
          chunkIndex: value.events.length ? existing.chunkCount : null, fromWatermark: existing.committedEventWatermark, finalized: value.finalize } };
      requireTake(changed);
      if (watermark === value.capture.eventWatermark && (continuity.lastTransportSequence !== value.capture.lastTransportSequence
        || (value.connections.length === value.capture.connectionCount && controls.length === (value.capture.controlCount ?? 0)
          && changed.committedAccountedBytes !== value.capture.accountedBytes))) throw new ImprovLibraryError("corrupt");
      if (value.events.length) {
        const chunk: ImprovEventChunk = { schemaVersion: 1, takeId: value.takeId, index: existing.chunkCount,
          startSequence: existing.committedEventWatermark + 1, endSequence: watermark, events: value.events };
        tx.objectStore("eventChunks").add(chunk); // Never put/replace recorded chunks.
      }
      tx.objectStore("takes").put(changed); result(changed);
    }));
  }
  private readEvidence(tx: IDBTransaction, read: Read, record: ImprovStoredTake, result: (loaded: ImprovLoadedTake) => void) {
    const takeId = record.takeId;
    read(tx.objectStore("collections").get(record.collectionId), (collectionValue) => {
      if (collectionValue === undefined) throw new ImprovLibraryError("corrupt");
      requireCollection(collectionValue);
      if (collectionValue.deletedAtMs !== null || record.number >= collectionValue.nextTakeNumber
        || (record.number === 1 && collectionValue.firstTakeId !== takeId)) throw new ImprovLibraryError("corrupt");
      read(tx.objectStore("eventChunks").index("takeId").getAll(takeId, L.chunksPerTake + 1), (values: unknown[]) => {
        if (values.length !== record.chunkCount) throw new ImprovLibraryError("corrupt");
        for (const value of values) {
          const candidate = value as Partial<ImprovEventChunk> | null;
          if (!candidate || !integer(candidate.index)) throw new ImprovLibraryError("corrupt");
          requireChunk(candidate, takeId, candidate.index);
        }
        values.sort((a, b) => Number((a as ImprovEventChunk).index) - Number((b as ImprovEventChunk).index));
        const loaded = { record, chunks: values as ImprovEventChunk[] };
        requireLoadedTake(loaded); result(loaded);
      });
    });
  }
  loadTake(takeId: string): Promise<ImprovLoadedTake> {
    return this.transaction("readonly", (tx, read, result) => read(tx.objectStore("takes").get(takeId), (value) => {
      this.readEvidence(tx, read, this.take(value), result);
    }));
  }
  /** One readonly transaction provides an internally consistent, bounded backup, even during capture. */
  exportCollection(collectionId: string): Promise<ImprovCollectionEvidence> {
    return this.transaction("readonly", (tx, read, result) => read(tx.objectStore("collections").get(collectionId), (raw) => {
      const collection = this.collection(raw);
      read(tx.objectStore("takes").index("collectionId").getAll(collectionId, L.takesPerCollection + 1), (values: unknown[]) => {
        if (values.length > L.takesPerCollection) throw new ImprovLibraryError("limit");
        values.forEach(requireTake);
        const ordered = (values as (ImprovStoredTake | ImprovDeletedTake)[]).sort((a, b) => a.number - b.number);
        if (ordered.reduce((sum, t) => sum + (t.kind === "take" ? t.committedAccountedBytes : 0), 0) > IMPROV_BACKUP_MAX_BYTES) throw new ImprovLibraryError("limit");
        const takes: (ImprovLoadedTake | ImprovDeletedTake)[] = [];
        const next = (index: number) => {
          if (index === ordered.length) { const evidence = { collection, takes }; requireImprovCollectionEvidence(evidence); result(evidence); return; }
          const item = ordered[index];
          if (item.kind === "deleted-take") { takes.push(item); next(index + 1); }
          else this.readEvidence(tx, read, item, (loaded) => { takes.push(loaded); next(index + 1); });
        };
        next(0);
      });
    }));
  }
  /** All-or-nothing new history; no merging, promotion, number reuse, live ownership or DB migration. */
  async importCollection(source: ImprovCollectionEvidence, createId: () => string = () => crypto.randomUUID()): Promise<ImprovCollection> {
    requireImprovCollectionEvidence(source);
    const evidence = immutableCopy(source);
    const collectionId = createId(); const takeIds = evidence.takes.map(() => createId());
    if (![collectionId, ...takeIds].every(usableId) || new Set([collectionId, ...takeIds]).size !== takeIds.length + 1) return Promise.reject(new ImprovLibraryError("collision"));
    return this.transaction("readwrite", (tx, read, result) => {
      const now = this.now();
      const collection: ImprovCollection = { ...evidence.collection, collectionId, firstTakeId: takeIds[0] ?? null,
        revision: 1, createdAtMs: now, updatedAtMs: now, importedFrom: evidence.collection.importedFrom ?? evidence.collection };
      requireCollection(collection);
      const entries = evidence.takes.map((item, index) => {
        const takeId = takeIds[index];
        if ("kind" in item) {
          const record: ImprovDeletedTake = { ...item, takeId, collectionId, importedFrom: item.importedFrom ?? item };
          requireTake(record); return { record, chunks: [] };
        }
        const original = item.record;
        const record: ImprovStoredTake = { ...original, takeId, collectionId, writerToken: "imported-no-writer",
          status: original.status === "recording" ? "incomplete" : original.status, lease: null, revision: 1, lastCommit: null,
          recovery: original.status === "recording" ? { reason: "imported-prefix", inferredAtMs: now } : original.recovery,
          importedFrom: original.importedFrom ?? original };
        const loaded = { record, chunks: item.chunks.map((chunk) => ({ ...chunk, takeId })) };
        requireLoadedTake(loaded); return loaded;
      });
      const collections = tx.objectStore("collections"); const takes = tx.objectStore("takes");
      read(collections.get(collectionId), (prior) => {
        if (prior !== undefined) throw new ImprovLibraryError("collision");
        read(collections.count(), (count) => {
          if (count >= L.collections) throw new ImprovLibraryError("limit");
          const check = (index: number) => {
            if (index !== takeIds.length) {
              read(takes.get(takeIds[index]), (existing) => { if (existing !== undefined) throw new ImprovLibraryError("collision"); check(index + 1); });
              return;
            }
            collections.add(collection);
            entries.forEach((entry) => { takes.add(entry.record); entry.chunks.forEach((chunk) => tx.objectStore("eventChunks").add(chunk)); });
            result(collection);
          };
          check(0);
        });
      });
    });
  }
  async listTakes(collectionId: string, afterNumber = 0, limit = 50): Promise<readonly (ImprovStoredTake | ImprovDeletedTake)[]> {
    this.page(afterNumber, limit);
    return this.transaction("readonly", (tx, read, result) => read(tx.objectStore("collections").get(collectionId), (raw) => {
      const collection = this.collection(raw);
      read(tx.objectStore("takes").index("collectionId").getAll(collectionId, L.takesPerCollection + 1), (values: unknown[]) => {
        if (values.length > L.takesPerCollection) throw new ImprovLibraryError("limit");
        values.forEach(requireTake);
        const ordered = (values as (ImprovStoredTake | ImprovDeletedTake)[]).sort((a, b) => a.number - b.number);
        if (ordered.length !== collection.nextTakeNumber - 1 || ordered.some((t, i) => t.collectionId !== collectionId || t.number !== i + 1)
          || (ordered.length && ordered[0].takeId !== collection.firstTakeId)) throw new ImprovLibraryError("corrupt");
        result((values as (ImprovStoredTake | ImprovDeletedTake)[]).filter((t) => t.number > afterNumber).sort((a, b) => a.number - b.number).slice(0, limit));
      });
    }));
  }
  recoverTake(takeId: string): Promise<ImprovStoredTake> {
    return this.transaction("readwrite", (tx, read, result) => read(tx.objectStore("takes").get(takeId), (value) => {
      const existing = this.take(value);
      if (existing.status !== "recording") { result(existing); return; }
      const now = this.now(); this.checkTime(now, existing.checkpointAtMs);
      if (now < existing.lease!.expiresAtMs) throw new ImprovLibraryError("owned");
      this.readEvidence(tx, read, existing, () => {
        const recovered: ImprovStoredTake = { ...existing, status: "incomplete", lease: null,
          revision: existing.revision + 1, recovery: { reason: "lease-expired", inferredAtMs: now } };
        requireTake(recovered); tx.objectStore("takes").put(recovered); result(recovered);
      });
    }));
  }
  deleteTake(takeId: string, confirmation: Readonly<{ takeId: string; revision: number; confirmed: true }>): Promise<void> {
    return this.transaction("readwrite", (tx, read, result) => read(tx.objectStore("takes").get(takeId), (value) => {
      const take = this.take(value);
      if (confirmation?.confirmed !== true || confirmation.takeId !== takeId) throw new ImprovLibraryError("confirmation-required");
      if (confirmation.revision !== take.revision) throw new ImprovLibraryError("stale");
      if (take.status === "recording") throw new ImprovLibraryError("owned");
      read(tx.objectStore("eventChunks").index("takeId").getAll(takeId, L.chunksPerTake + 1), (chunks: ImprovEventChunk[]) => {
        if (chunks.length > L.chunksPerTake) throw new ImprovLibraryError("limit");
        chunks.forEach((c) => tx.objectStore("eventChunks").delete([takeId, c.index]));
        tx.objectStore("takes").put({ schemaVersion: 1, kind: "deleted-take", takeId, collectionId: take.collectionId,
          number: take.number, deletedAtMs: this.now() } satisfies ImprovDeletedTake);
        result(undefined);
      });
    }));
  }
  deleteCollection(collectionId: string, confirmation: Readonly<{ collectionId: string; revision: number; confirmed: true }>): Promise<void> {
    return this.transaction("readwrite", (tx, read, result) => read(tx.objectStore("collections").get(collectionId), (value) => {
      const collection = this.collection(value);
      if (confirmation?.confirmed !== true || confirmation.collectionId !== collectionId) throw new ImprovLibraryError("confirmation-required");
      if (confirmation.revision !== collection.revision) throw new ImprovLibraryError("stale");
      read(tx.objectStore("takes").index("collectionId").getAll(collectionId, L.takesPerCollection + 1), (takes: unknown[]) => {
        if (takes.length > L.takesPerCollection) throw new ImprovLibraryError("limit");
        takes.forEach(requireTake);
        if ((takes as (ImprovStoredTake | ImprovDeletedTake)[]).some((t) => t.kind === "take" && t.status === "recording")) throw new ImprovLibraryError("owned");
        const now = this.now(); this.checkTime(now, collection.updatedAtMs);
        (takes as (ImprovStoredTake | ImprovDeletedTake)[]).forEach((take) => {
          if (take.kind === "deleted-take") return;
          read(tx.objectStore("eventChunks").index("takeId").getAll(take.takeId, L.chunksPerTake + 1), (chunks: ImprovEventChunk[]) => {
            if (chunks.length > L.chunksPerTake) throw new ImprovLibraryError("limit");
            chunks.forEach((c) => tx.objectStore("eventChunks").delete([take.takeId, c.index]));
            tx.objectStore("takes").put({ schemaVersion: 1, kind: "deleted-take", takeId: take.takeId, collectionId,
              number: take.number, deletedAtMs: now } satisfies ImprovDeletedTake);
          });
        });
        const tombstone = { ...collection, title: "Deleted collection", deletedAtMs: now, updatedAtMs: now, revision: collection.revision + 1 };
        delete tombstone.importedFrom;
        tx.objectStore("collections").put(tombstone);
        result(undefined);
      });
    }));
  }
}
