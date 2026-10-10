import { improvTimestampValidity, type ImprovTakeBoundary, type ImprovTakeConnection, type ImprovTakeEvent,
  type ImprovTakeMetadata } from "./improv-take";
import { improvMessageAccountedBytes } from "./improv-take-recorder";
import { IMPROV_LIBRARY_LIMITS as L, ImprovLibraryError, sameCaptureContext, sameEvidence, type ImprovCollection, type ImprovLoadedTake,
  type ImprovDeletedTake, type ImprovEventChunk, type ImprovJournalContinuity, type ImprovStoredTake } from "./improv-library";

const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const shape = (v: unknown, keys: string): v is Record<string, unknown> => object(v)
  && Object.keys(v).length === keys.split(" ").length && keys.split(" ").every((key) => Object.hasOwn(v, key));
const importShape = (v: unknown, keys: string): v is Record<string, unknown> => shape(v, keys)
  || shape(v, `${keys} importedFrom`);
export const usableId = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 1024;
export const wallTime = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER - L.leaseMs;
export const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const numeric = (v: unknown): v is number => typeof v === "number"; // Nonfinite evidence is intentional.
const maybeNumber = (v: unknown): v is number | null => v === null || numeric(v);
const maybeFinite = (v: unknown) => v === null || (numeric(v) && Number.isFinite(v));
const input = (v: unknown) => shape(v, "id name") && (v.id === null || usableId(v.id))
  && (v.name === null || (typeof v.name === "string" && v.name.length <= 4096));
const context = (v: unknown) => shape(v, "ownerId clockId timeOriginMs")
  && typeof v.ownerId === "string" && v.ownerId.length <= 1024 && typeof v.clockId === "string" && v.clockId.length <= 1024
  && maybeNumber(v.timeOriginMs);
const reasons = new Set(["user-stop", "device-disconnected", "source-reconnected", "consumer-lost", "background", "freeze", "pagehide",
  "capture-unavailable", "continuity-mismatch", "transport-order-mismatch", "event-limit", "byte-limit"]);

function boundary(v: unknown): v is ImprovTakeBoundary {
  return shape(v, "observation validity contextMatchesStart precedesStart")
    && shape(v.observation, "atMs context") && numeric(v.observation.atMs) && context(v.observation.context)
    && v.validity === improvTimestampValidity(v.observation.atMs)
    && typeof v.contextMatchesStart === "boolean" && typeof v.precedesStart === "boolean";
}
export function requireMetadata(v: unknown): asserts v is ImprovTakeMetadata {
  if (object(v) && v.schemaVersion !== 1) throw new ImprovLibraryError("unsupported");
  if (!shape(v, "schemaVersion takeId selectedInput status start terminal initialState sourceTimestampClock limits eventCount eventWatermark lastTransportSequence connectionCount accountedBytes")
    || !usableId(v.takeId) || !input(v.selectedInput) || !object(v.selectedInput) || !usableId(v.selectedInput.id)
    || !["recording", "completed", "interrupted"].includes(String(v.status)) || !boundary(v.start)
    || v.start.validity !== "valid" || !v.start.contextMatchesStart || v.start.precedesStart
    || !usableId(v.start.observation.context.ownerId) || !usableId(v.start.observation.context.clockId)
    || !(v.start.observation.context.timeOriginMs === null || wallTime(v.start.observation.context.timeOriginMs))
    || !shape(v.initialState, "heldKeys controllers") || v.initialState.heldKeys !== "unknown" || v.initialState.controllers !== "unknown"
    || v.sourceTimestampClock !== "browser-event-unverified" || !shape(v.limits, "maxEvents maxAccountedBytes")
    || !integer(v.limits.maxEvents) || v.limits.maxEvents < 1 || v.limits.maxEvents > L.eventsPerTake
    || !integer(v.limits.maxAccountedBytes) || v.limits.maxAccountedBytes < 1 || v.limits.maxAccountedBytes > L.bytesPerTake
    || !integer(v.eventCount) || v.eventCount > v.limits.maxEvents || v.eventWatermark !== v.eventCount
    || !integer(v.connectionCount) || v.connectionCount > 1 || !integer(v.accountedBytes) || v.accountedBytes > v.limits.maxAccountedBytes
    || (v.eventCount === 0 ? v.lastTransportSequence !== null : !integer(v.lastTransportSequence) || v.lastTransportSequence < 1)) throw new ImprovLibraryError("corrupt");
  if (v.terminal === null) {
    if (v.status !== "recording" || v.connectionCount !== 0) throw new ImprovLibraryError("corrupt");
  } else {
    if (!shape(v.terminal, "reason boundary refusedTransportSequence") || v.status === "recording" || !reasons.has(String(v.terminal.reason))
      || !boundary(v.terminal.boundary) || !maybeNumber(v.terminal.refusedTransportSequence)
      || (v.status === "completed") !== (v.terminal.reason === "user-stop")
      || v.terminal.boundary.contextMatchesStart !== sameCaptureContext(v.start.observation.context, v.terminal.boundary.observation.context)
      || v.terminal.boundary.precedesStart !== (Number.isFinite(v.terminal.boundary.observation.atMs)
        && v.terminal.boundary.observation.atMs < v.start.observation.atMs)) throw new ImprovLibraryError("corrupt");
  }
}
export function initialAccountedBytes(capture: ImprovTakeMetadata): number {
  return 1024 + 2 * (capture.selectedInput.id.length + (capture.selectedInput.name?.length ?? 0)
    + capture.takeId.length + capture.start.observation.context.ownerId.length + capture.start.observation.context.clockId.length);
}
export function connectionAccountedBytes(connection: ImprovTakeConnection): number {
  return 512 + 2 * ((connection.raw.input.id?.length ?? 0) + (connection.raw.input.name?.length ?? 0));
}
export function requireConnections(v: unknown, capture: ImprovTakeMetadata, watermark: number): asserts v is readonly ImprovTakeConnection[] {
  if (!Array.isArray(v) || v.length > capture.connectionCount || v.some((c, i) => !shape(c, "sequence afterEventSequence raw")
    || c.sequence !== i + 1 || !integer(c.afterEventSequence) || c.afterEventSequence > watermark
    || !shape(c.raw, "provenance input state receivedAtMs") || c.raw.provenance !== "input-availability"
    || !input(c.raw.input) || !object(c.raw.input) || c.raw.input.id !== capture.selectedInput.id
    || !["connected", "disconnected"].includes(String(c.raw.state)) || !numeric(c.raw.receivedAtMs))) throw new ImprovLibraryError("corrupt");
}
export const EMPTY_IMPROV_CONTINUITY: ImprovJournalContinuity = Object.freeze({
  lastTransportSequence: null, lastFiniteSourceMs: null, lastFiniteReceiptMs: null,
});
export function validateEvents(v: unknown, capture: ImprovTakeMetadata, after: number, previous: ImprovJournalContinuity): ImprovJournalContinuity {
  if (!Array.isArray(v) || v.length > L.chunkEvents) throw new ImprovLibraryError("limit");
  let { lastTransportSequence, lastFiniteSourceMs, lastFiniteReceiptMs } = previous;
  for (const [index, e] of v.entries()) {
    if (!shape(e, "sequence raw timing") || e.sequence !== after + index + 1
      || !shape(e.raw, "provenance sequence input bytes dataStatus sourceTimeStampMs receivedAtMs")
      || e.raw.provenance !== "browser-midi-message" || !integer(e.raw.sequence) || e.raw.sequence < 1
      || (lastTransportSequence !== null && e.raw.sequence <= lastTransportSequence)
      || !input(e.raw.input) || !object(e.raw.input) || e.raw.input.id !== capture.selectedInput.id
      || !["available", "unavailable", "unreadable"].includes(String(e.raw.dataStatus))
      || (e.raw.dataStatus === "available" ? !Array.isArray(e.raw.bytes) || e.raw.bytes.length > L.bytesPerTake / 8
        || !e.raw.bytes.every(numeric) : e.raw.bytes !== null)
      || !maybeNumber(e.raw.sourceTimeStampMs) || !numeric(e.raw.receivedAtMs)
      || !shape(e.timing, "sourceValidity receiptValidity sourceTimestampRegressed receiptTimestampRegressed transportSequenceGap")) throw new ImprovLibraryError("corrupt");
    const source = e.raw.sourceTimeStampMs; const receipt = e.raw.receivedAtMs;
    if (e.timing.sourceValidity !== improvTimestampValidity(source) || e.timing.receiptValidity !== improvTimestampValidity(receipt)
      || e.timing.sourceTimestampRegressed !== (source !== null && Number.isFinite(source) && lastFiniteSourceMs !== null && source < lastFiniteSourceMs)
      || e.timing.receiptTimestampRegressed !== (Number.isFinite(receipt) && lastFiniteReceiptMs !== null && receipt < lastFiniteReceiptMs)
      || e.timing.transportSequenceGap !== (lastTransportSequence === null ? null : e.raw.sequence - lastTransportSequence - 1)) throw new ImprovLibraryError("corrupt");
    lastTransportSequence = e.raw.sequence;
    if (source !== null && Number.isFinite(source)) lastFiniteSourceMs = source;
    if (Number.isFinite(receipt)) lastFiniteReceiptMs = receipt;
  }
  return { lastTransportSequence, lastFiniteSourceMs, lastFiniteReceiptMs };
}
export function requireCollection(v: unknown): asserts v is ImprovCollection {
  if (object(v) && v.schemaVersion !== 1) throw new ImprovLibraryError("unsupported");
  if (!importShape(v, "schemaVersion collectionId title activity firstTakeId nextTakeNumber revision createdAtMs updatedAtMs deletedAtMs")
    || !usableId(v.collectionId) || typeof v.title !== "string" || !v.title.trim() || v.title.length > 256
    || !["first-take-sight-reading", "free-improvisation"].includes(String(v.activity))
    || (v.firstTakeId !== null && !usableId(v.firstTakeId)) || !integer(v.nextTakeNumber) || v.nextTakeNumber < 1 || v.nextTakeNumber > L.takesPerCollection + 1
    || (v.nextTakeNumber === 1) !== (v.firstTakeId === null) || !integer(v.revision) || v.revision < 1
    || !wallTime(v.createdAtMs) || !wallTime(v.updatedAtMs) || v.updatedAtMs < v.createdAtMs
    || (v.deletedAtMs !== null && !wallTime(v.deletedAtMs))) throw new ImprovLibraryError("corrupt");
  if (Object.hasOwn(v, "importedFrom")) {
    if (!object(v.importedFrom) || Object.hasOwn(v.importedFrom, "importedFrom")) throw new ImprovLibraryError("corrupt");
    requireCollection(v.importedFrom);
    if (v.activity !== v.importedFrom.activity) throw new ImprovLibraryError("corrupt");
  }
}
export function requireTake(v: unknown): asserts v is ImprovStoredTake | ImprovDeletedTake {
  if (object(v) && v.schemaVersion !== 1) throw new ImprovLibraryError("unsupported");
  if (!object(v) || !usableId(v.takeId) || !usableId(v.collectionId) || !integer(v.number) || v.number < 1 || v.number > L.takesPerCollection) throw new ImprovLibraryError("corrupt");
  if (v.kind === "deleted-take") {
    if (!importShape(v, "schemaVersion kind takeId collectionId number deletedAtMs") || !wallTime(v.deletedAtMs)) throw new ImprovLibraryError("corrupt");
    if (Object.hasOwn(v, "importedFrom")) {
      if (!object(v.importedFrom) || Object.hasOwn(v.importedFrom, "importedFrom")) throw new ImprovLibraryError("corrupt");
      requireTake(v.importedFrom);
      if (v.importedFrom.kind !== "deleted-take" || v.number !== v.importedFrom.number) throw new ImprovLibraryError("corrupt");
    }
    return;
  }
  if (!importShape(v, "schemaVersion kind takeId collectionId number writerToken capture status storageStatus committedEventWatermark committedAccountedBytes chunkCount continuity connections revision checkpointAtMs lease recovery captureFailure lastCommit")
    || v.kind !== "take" || !usableId(v.writerToken)) throw new ImprovLibraryError("corrupt");
  requireMetadata(v.capture);
  const imported = Object.hasOwn(v, "importedFrom");
  if ((!imported && v.capture.takeId !== v.takeId) || !["recording", "completed", "interrupted", "incomplete"].includes(String(v.status))
    || v.storageStatus !== "committed" || !integer(v.committedEventWatermark) || v.committedEventWatermark > v.capture.eventWatermark
    || !integer(v.committedAccountedBytes) || v.committedAccountedBytes < initialAccountedBytes(v.capture) || v.committedAccountedBytes > v.capture.accountedBytes
    || !integer(v.chunkCount) || v.chunkCount > L.chunksPerTake || (v.chunkCount === 0) !== (v.committedEventWatermark === 0)
    || !shape(v.continuity, "lastTransportSequence lastFiniteSourceMs lastFiniteReceiptMs")
    || !(v.continuity.lastTransportSequence === null || integer(v.continuity.lastTransportSequence))
    || !maybeFinite(v.continuity.lastFiniteSourceMs) || !maybeFinite(v.continuity.lastFiniteReceiptMs)
    || !integer(v.revision) || v.revision < 1 || !wallTime(v.checkpointAtMs)) throw new ImprovLibraryError("corrupt");
  if (v.captureFailure !== null && (!shape(v.captureFailure, "reason refusedTransportSequence")
    || v.captureFailure.reason !== "unsaved-backlog-limit"
    || !(v.captureFailure.refusedTransportSequence === null || integer(v.captureFailure.refusedTransportSequence)))) throw new ImprovLibraryError("corrupt");
  requireConnections(v.connections, v.capture, v.committedEventWatermark);
  if (v.status === "recording") {
    if (!shape(v.lease, "token expiresAtMs") || v.lease.token !== v.writerToken || !wallTime(v.lease.expiresAtMs) || v.lease.expiresAtMs <= v.checkpointAtMs || v.recovery !== null) throw new ImprovLibraryError("corrupt");
  } else if (v.lease !== null) throw new ImprovLibraryError("corrupt");
  if (v.status === "incomplete") {
    if (!shape(v.recovery, "reason inferredAtMs") || !(v.recovery.reason === "lease-expired" || (imported && v.recovery.reason === "imported-prefix")) || !wallTime(v.recovery.inferredAtMs)) throw new ImprovLibraryError("corrupt");
  } else if (v.recovery !== null) throw new ImprovLibraryError("corrupt");
  if (["completed", "interrupted"].includes(String(v.status)) && (v.status !== v.capture.status
    || v.committedEventWatermark !== v.capture.eventWatermark || v.connections.length !== v.capture.connectionCount)) throw new ImprovLibraryError("corrupt");
  if (v.lastCommit !== null && (!shape(v.lastCommit, "operationId previousRevision chunkIndex fromWatermark finalized")
    || !usableId(v.lastCommit.operationId) || !integer(v.lastCommit.previousRevision) || v.lastCommit.previousRevision >= v.revision
    || !(v.lastCommit.chunkIndex === null || (integer(v.lastCommit.chunkIndex) && v.lastCommit.chunkIndex < v.chunkCount))
    || !integer(v.lastCommit.fromWatermark) || v.lastCommit.fromWatermark > v.committedEventWatermark
    || typeof v.lastCommit.finalized !== "boolean")) throw new ImprovLibraryError("corrupt");
  if (imported) {
    const origin = v.importedFrom;
    if (!object(origin) || Object.hasOwn(origin, "importedFrom")) throw new ImprovLibraryError("corrupt");
    requireTake(origin);
    if (origin.kind !== "take" || v.number !== origin.number || v.status === "recording" || v.lastCommit !== null
      || v.status !== (origin.status === "recording" ? "incomplete" : origin.status)
      || !["capture", "connections", "committedEventWatermark", "committedAccountedBytes", "chunkCount", "continuity", "captureFailure"].every((key) => sameEvidence(v[key], Reflect.get(origin, key)))) throw new ImprovLibraryError("corrupt");
  }
}
export function requireChunk(v: unknown, takeId: string, index: number): asserts v is ImprovEventChunk {
  if (object(v) && v.schemaVersion !== 1) throw new ImprovLibraryError("unsupported");
  if (!shape(v, "schemaVersion takeId index startSequence endSequence events") || v.takeId !== takeId || v.index !== index
    || !integer(v.startSequence) || v.startSequence < 1 || !integer(v.endSequence) || !Array.isArray(v.events)
    || v.events.length < 1 || v.events.length > L.chunkEvents || v.endSequence !== v.startSequence + v.events.length - 1) throw new ImprovLibraryError("corrupt");
}
export function chunkAccountedBytes(events: readonly ImprovTakeEvent[]): number {
  return events.reduce((sum, event) => sum + improvMessageAccountedBytes(event.raw), 0);
}

/** Shared by native loads and untrusted backups; no timestamp sorting or evidence repair. */
export function requireLoadedTake(v: unknown): asserts v is ImprovLoadedTake {
  if (!shape(v, "record chunks")) throw new ImprovLibraryError("corrupt");
  requireTake(v.record);
  if (v.record.kind !== "take" || !Array.isArray(v.chunks) || v.chunks.length !== v.record.chunkCount) throw new ImprovLibraryError("corrupt");
  const record = v.record;
  let watermark = 0; let continuity = EMPTY_IMPROV_CONTINUITY; let bytes = initialAccountedBytes(record.capture);
  v.chunks.forEach((chunk, index) => {
    requireChunk(chunk, record.takeId, index);
    if (chunk.startSequence !== watermark + 1) throw new ImprovLibraryError("corrupt");
    continuity = validateEvents(chunk.events, record.capture, watermark, continuity);
    const size = chunkAccountedBytes(chunk.events);
    if (size > L.chunkBytes && chunk.events.length !== 1) throw new ImprovLibraryError("corrupt");
    bytes += size; watermark = chunk.endSequence;
  });
  bytes += record.connections.reduce((sum, c) => sum + connectionAccountedBytes(c), 0);
  if (watermark !== record.committedEventWatermark || bytes !== record.committedAccountedBytes
    || !sameEvidence(continuity, record.continuity)
    || (watermark === record.capture.eventWatermark && (continuity.lastTransportSequence !== record.capture.lastTransportSequence
      || (record.connections.length === record.capture.connectionCount && bytes !== record.capture.accountedBytes)))) throw new ImprovLibraryError("corrupt");
}
