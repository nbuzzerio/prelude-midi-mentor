import type { ImprovCaptureContext, ImprovTakeControl, ImprovTakeConnection, ImprovTakeEvent, ImprovTakeMetadata } from "./improv-take";

export const IMPROV_LIBRARY_LIMITS = Object.freeze({
  collections: 1_000, takesPerCollection: 1_000, pageSize: 100,
  eventsPerTake: 100_000, bytesPerTake: 64 * 1024 * 1024,
  chunkEvents: 256, chunkBytes: 1024 * 1024, chunksPerTake: 1_024,
  leaseMs: 30_000, checkpointMs: 2_000,
  unsavedEvents: 2_048, unsavedBytes: 8 * 1024 * 1024,
});

export type ImprovCollection = Readonly<{
  schemaVersion: 1; collectionId: string; title: string;
  activity: "first-take-sight-reading" | "free-improvisation";
  firstTakeId: string | null; nextTakeNumber: number; revision: number;
  createdAtMs: number; updatedAtMs: number; deletedAtMs: number | null;
  /** Flat original context. Import never recursively embeds prior backups. */
  importedFrom?: Omit<ImprovCollection, "importedFrom">;
}>;
export type ImprovCaptureFailure = Readonly<{
  reason: "unsaved-backlog-limit"; refusedTransportSequence: number | null;
}>;
export type ImprovStoredTake = Readonly<{
  schemaVersion: 1 | 2; kind: "take"; takeId: string; collectionId: string; number: number;
  controls?: readonly ImprovTakeControl[]; committedControlWatermark?: number;
  writerToken: string;
  capture: ImprovTakeMetadata;
  status: "recording" | "completed" | "interrupted" | "incomplete";
  storageStatus: "committed";
  committedEventWatermark: number; committedAccountedBytes: number; chunkCount: number;
  continuity: ImprovJournalContinuity;
  connections: readonly ImprovTakeConnection[];
  revision: number; checkpointAtMs: number;
  lease: Readonly<{ token: string; expiresAtMs: number }> | null;
  recovery: Readonly<{ reason: "lease-expired" | "imported-prefix"; inferredAtMs: number }> | null;
  captureFailure: ImprovCaptureFailure | null;
  lastCommit: Readonly<{
    operationId: string; previousRevision: number; chunkIndex: number | null;
    fromWatermark: number; finalized: boolean;
  }> | null;
  /** Original stored observation, separate from destination ownership/status. */
  importedFrom?: Omit<ImprovStoredTake, "importedFrom">;
}>;
export type ImprovDeletedTake = Readonly<{
  schemaVersion: 1; kind: "deleted-take"; takeId: string; collectionId: string;
  number: number; deletedAtMs: number;
  importedFrom?: Omit<ImprovDeletedTake, "importedFrom">;
}>;
export type ImprovEventChunk = Readonly<{
  schemaVersion: 1; takeId: string; index: number;
  startSequence: number; endSequence: number; events: readonly ImprovTakeEvent[];
}>;
export type ImprovLoadedTake = Readonly<{ record: ImprovStoredTake; chunks: readonly ImprovEventChunk[] }>;
export type ImprovCollectionEvidence = Readonly<{
  collection: ImprovCollection; takes: readonly (ImprovLoadedTake | ImprovDeletedTake)[];
}>;
export type ImprovCheckpoint = Readonly<{
  takeId: string; writerToken: string; expectedRevision: number; operationId: string;
  capture: ImprovTakeMetadata; events: readonly ImprovTakeEvent[];
  controls?: readonly ImprovTakeControl[];
  connections: readonly ImprovTakeConnection[]; finalize: boolean;
  captureFailure: ImprovCaptureFailure | null;
}>;
export type ImprovJournalContinuity = Readonly<{
  lastTransportSequence: number | null; lastFiniteSourceMs: number | null; lastFiniteReceiptMs: number | null;
}>;
export type ImprovLibraryFailure = "unavailable" | "blocked" | "closed" | "write-failed"
  | "quota" | "corrupt" | "unsupported" | "not-found" | "collision" | "limit"
  | "stale" | "owned" | "lease-expired" | "clock-regressed" | "confirmation-required";
export class ImprovLibraryError extends Error {
  constructor(public readonly reason: ImprovLibraryFailure, message = `Improv library: ${reason}.`) {
    super(message); this.name = "ImprovLibraryError";
  }
}
export function libraryError(error: unknown): ImprovLibraryError {
  if (error instanceof ImprovLibraryError) return error;
  return new ImprovLibraryError(error instanceof DOMException && error.name === "QuotaExceededError" ? "quota" : "write-failed");
}
export interface ImprovLibrary {
  createCollection(collectionId: string, title: string, activity: ImprovCollection["activity"]): Promise<ImprovCollection>;
  listCollections(afterId?: string, limit?: number): Promise<readonly ImprovCollection[]>;
  renameCollection(collectionId: string, title: string, expectedRevision: number): Promise<ImprovCollection>;
  allocateTake(collectionId: string, capture: ImprovTakeMetadata, writerToken: string): Promise<ImprovStoredTake>;
  checkpoint(value: ImprovCheckpoint): Promise<ImprovStoredTake>;
  loadTake(takeId: string): Promise<ImprovLoadedTake>;
  listTakes(collectionId: string, afterNumber?: number, limit?: number): Promise<readonly (ImprovStoredTake | ImprovDeletedTake)[]>;
  recoverTake(takeId: string): Promise<ImprovStoredTake>;
  deleteTake(takeId: string, confirmation: Readonly<{ takeId: string; revision: number; confirmed: true }>): Promise<void>;
  deleteCollection(collectionId: string, confirmation: Readonly<{ collectionId: string; revision: number; confirmed: true }>): Promise<void>;
  close(): void;
}
export interface ImprovArchiveLibrary extends ImprovLibrary {
  exportCollection(collectionId: string): Promise<ImprovCollectionEvidence>;
  importCollection(evidence: ImprovCollectionEvidence, createId?: () => string): Promise<ImprovCollection>;
}

/** IndexedDB uses structured clone, not JSON. Copies also fence caller mutation before async writes. */
export function immutableCopy<T>(value: T): T {
  const copy: T = structuredClone(value);
  const seen = new WeakSet<object>();
  const freeze = (item: unknown) => {
    if (item === null || typeof item !== "object") return;
    if (seen.has(item)) return;
    seen.add(item);
    Object.values(item).forEach(freeze);
    Object.freeze(item);
  };
  freeze(copy);
  return copy;
}
export function sameEvidence(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key)
    && sameEvidence(Reflect.get(left, key), Reflect.get(right, key)));
}
export function sameCaptureContext(left: ImprovCaptureContext, right: ImprovCaptureContext): boolean {
  return left.ownerId === right.ownerId && left.clockId === right.clockId && left.timeOriginMs === right.timeOriginMs;
}
