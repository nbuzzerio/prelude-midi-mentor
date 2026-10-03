import { parseStaffBuilderScore } from "@/features/staff-builder/persistence/staff-builder-schema";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import { focusPiecePracticeProjection, projectStaffBuilderPieceForPractice } from "../piece-practice-projection";
import { getCurrentPiecePracticeTarget, getPiecePracticeElapsedMs, resolvePiecePracticeEmptyRolledChecks, type PiecePracticeSessionState } from "../piece-practice-session";
import type { PiecePracticePiece } from "../piece-practice-types";

export const PIECE_PRACTICE_DB_NAME = "prelude-piece-practice";
export const PIECE_PRACTICE_DB_VERSION = 1;
export const PIECE_PRACTICE_STORE_NAME = "piece-practice-runs";
const TERMINAL_LIMIT = 8;

export type PiecePracticeRunStatus = "active" | "completed" | "ended-incomplete";
export type PiecePracticeCheckpointV1 = Omit<PiecePracticeSessionState, "activeSinceMs" | "startedAtMs" | "restartEvidence"> & Readonly<{ restartEvidence?: PiecePracticeSessionState["restartEvidence"] }>;
export type PiecePracticeRunRecordV1 = Readonly<{
  schemaVersion: 1;
  runId: string;
  revision: number;
  status: PiecePracticeRunStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  sourceScoreId: string;
  sourceScoreUpdatedAt: string;
  sourceScore: StaffBuilderScore;
  configuration: Readonly<{ startMeasureIndex: number; endMeasureIndex: number | null; assessmentFocus: "both" | "upper" | "lower" }>;
  checkpoint: PiecePracticeCheckpointV1;
}>;

export type ParsedPiecePracticeRun =
  | Readonly<{ ok: true; record: PiecePracticeRunRecordV1; piece: PiecePracticePiece }>
  | Readonly<{ ok: false; reason: "corrupt" | "unsupported" }>;

export type UnrecoverablePiecePracticeRun = Readonly<{ value: unknown; reason: "corrupt" | "unsupported"; runId: string | null; status: string | null; updatedAt: string | null }>;

export function selectPiecePracticeRecovery(records: readonly unknown[]): Readonly<{
  active: readonly Extract<ParsedPiecePracticeRun, { ok: true }>[];
  latestCompleted: Extract<ParsedPiecePracticeRun, { ok: true }> | null;
  unrecoverable: readonly UnrecoverablePiecePracticeRun[];
}> {
  const valid: Extract<ParsedPiecePracticeRun, { ok: true }>[] = [];
  const unrecoverable: UnrecoverablePiecePracticeRun[] = [];
  for (const value of records) {
    const parsed = parsePiecePracticeRun(value);
    if (parsed.ok) valid.push(parsed);
    else unrecoverable.push({ value, reason: parsed.reason,
      runId: object(value) && typeof value.runId === "string" ? value.runId : null,
      status: object(value) && typeof value.status === "string" ? value.status : null,
      updatedAt: object(value) && timestamp(value.updatedAt) ? value.updatedAt : null });
  }
  const compare = (left: Extract<ParsedPiecePracticeRun, { ok: true }>, right: Extract<ParsedPiecePracticeRun, { ok: true }>, field: "updatedAt" | "completedAt") =>
    String(right.record[field] ?? "").localeCompare(String(left.record[field] ?? "")) || right.record.runId.localeCompare(left.record.runId);
  return {
    active: valid.filter(({ record }) => record.status === "active").sort((left, right) => compare(left, right, "updatedAt")),
    latestCompleted: valid.filter(({ record }) => record.status === "completed").sort((left, right) => compare(left, right, "completedAt"))[0] ?? null,
    unrecoverable,
  };
}

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const nonnegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const integer = (value: unknown): value is number => nonnegative(value) && Number.isInteger(value);
const timestamp = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const numbers = (value: unknown): value is number[] => Array.isArray(value) && value.every(nonnegative);
const focus = (value: unknown): value is "both" | "upper" | "lower" => value === "both" || value === "upper" || value === "lower";
const midiNumbers = (value: unknown): value is number[] => Array.isArray(value) && value.every((item) => integer(item) && item <= 127);
function pitchSnapshot(value: unknown, piece: PiecePracticePiece): boolean {
  if (!object(value)) return false;
  const event = piece.measures.flatMap((measure) => measure.sourceEvents)
    .find((candidate) => candidate.sourceEventId === value.sourceEventId);
  const pitch = event?.kind === "notes" ? event.pitches.find((candidate) => candidate.sourcePitchId === value.sourcePitchId) : undefined;
  return Boolean(pitch && event?.staff === value.staff && pitch.midiNumber === value.midiNumber
    && pitch.letter === value.letter && pitch.accidental === value.accidental && pitch.octave === value.octave);
}
const pitchSnapshots = (value: unknown, piece: PiecePracticePiece): boolean => Array.isArray(value) && value.every((item) => pitchSnapshot(item, piece));

function validEvidenceLocation(value: unknown, piece: PiecePracticePiece): value is Record<string, unknown> {
  if (!object(value) || !integer(value.sequence) || !integer(value.measureIndex) || !piece.measures[value.measureIndex]
    || value.sourceMeasureId !== piece.measures[value.measureIndex].sourceMeasureId || !nonnegative(value.occurredAtActiveMs)
    || typeof value.targetId !== "string" || !value.targetId) return false;
  return true;
}

function validMistake(value: unknown, piece: PiecePracticePiece): boolean {
  if (!validEvidenceLocation(value, piece) || typeof value.checkId !== "string" || !pitchSnapshots(value.expectedPitches, piece)) return false;
  if (value.kind === "normal-attempt") return midiNumbers(value.receivedMidiNumbers) && midiNumbers(value.missingMidiNumbers)
    && midiNumbers(value.extraMidiNumbers) && midiNumbers(value.unexpectedHeldMidiNumbers)
    && (value.predecessorPitches === undefined || pitchSnapshots(value.predecessorPitches, piece));
  if (value.kind === "rolled-unexpected-pitch") return integer(value.receivedMidiNumber) && value.receivedMidiNumber <= 127 && midiNumbers(value.accumulatedMidiNumbers);
  if (value.kind === "rolled-timeout") return midiNumbers(value.accumulatedMidiNumbers) && midiNumbers(value.missingMidiNumbers) && nonnegative(value.windowMs);
  return false;
}

function validTargetTiming(value: unknown, piece: PiecePracticePiece): boolean {
  return object(value) && integer(value.sequence) && integer(value.measureIndex) && Boolean(piece.measures[value.measureIndex])
    && value.sourceMeasureId === piece.measures[value.measureIndex].sourceMeasureId && typeof value.targetId === "string"
    && strings(value.sourceEventIds) && pitchSnapshots(value.expectedPitches, piece)
    && ["first-attempt", "target-activation", "unarmed-skip"].includes(String(value.timingBasis))
    && (value.activatedAtActiveMs === null || nonnegative(value.activatedAtActiveMs))
    && (value.responseDurationMs === null || nonnegative(value.responseDurationMs))
    && nonnegative(value.completedAtActiveMs) && nonnegative(value.expectedWindowMs)
    && nonnegative(value.hesitationThresholdMs) && typeof value.isHesitation === "boolean"
    && ["completed", "skipped"].includes(String(value.outcome));
}

function validCheckpoint(value: unknown, piece: PiecePracticePiece, config: PiecePracticeRunRecordV1["configuration"], status: PiecePracticeRunStatus): value is PiecePracticeCheckpointV1 {
  if (!object(value) || value.assessmentFocus !== config.assessmentFocus || value.startMeasureIndex !== config.startMeasureIndex
    || value.endMeasureIndex !== config.endMeasureIndex || !integer(value.currentMeasureIndex)
    || value.currentMeasureIndex < config.startMeasureIndex || value.currentMeasureIndex > (config.endMeasureIndex ?? piece.measures.length - 1)
    || !["practicing", "awaiting-explicit-measure-advance", "piece-complete"].includes(String(value.status))
    || (status === "completed") !== (value.status === "piece-complete")
    || !integer(value.completedTargetCount) || !integer(value.skippedTargetCount)
    || !integer(value.completedMeasureCount) || !integer(value.currentMeasureCompletedTargetCount)
    || !numbers(value.completedMeasureIndexes) || value.completedMeasureCount !== value.completedMeasureIndexes.length
    || new Set(value.completedMeasureIndexes).size !== value.completedMeasureIndexes.length
    || value.completedMeasureIndexes.some((index) => index < config.startMeasureIndex || index > (config.endMeasureIndex ?? piece.measures.length - 1))
    || !nonnegative(value.activeElapsedMs) || !nonnegative(value.currentMeasureEnteredAtActiveMs)
    || (value.currentTargetActivatedAtActiveMs !== null && !nonnegative(value.currentTargetActivatedAtActiveMs))
    || (value.completedAtActiveMs !== null && !nonnegative(value.completedAtActiveMs))
    || typeof value.clockPaused !== "boolean" || typeof value.firstTargetTimingPending !== "boolean"
    || typeof value.boundaryReattackPending !== "boolean"
    || !Array.isArray(value.currentCheckProgress) || !Array.isArray(value.mistakeEvidence)
    || !Array.isArray(value.skipEvidence) || !Array.isArray(value.targetTimings)
    || (value.restartEvidence !== undefined && !Array.isArray(value.restartEvidence))
    || !Array.isArray(value.measureTimings)
    || (value.attackEvidence !== undefined && !Array.isArray(value.attackEvidence))
    || (value.releaseEvidence !== undefined && !Array.isArray(value.releaseEvidence))) return false;
  if (value.currentTargetIndex !== null && (!Number.isInteger(value.currentTargetIndex) || (value.currentTargetIndex as number) < -1)) return false;
  const state = value as PiecePracticeCheckpointV1;
  const target = getCurrentPiecePracticeTarget(piece, { ...state, restartEvidence: state.restartEvidence ?? [], activeSinceMs: 0, startedAtMs: 0 });
  if (state.status === "practicing" && !target) return false;
  if (state.currentCheckProgress.length !== (target?.checks.length ?? 0) || state.currentCheckProgress.some((progress) =>
    !object(progress) || !target?.checks.some((check) => check.id === progress.checkId) || typeof progress.completed !== "boolean"
    || !numbers(progress.accumulatedMidiNumbers) || (progress.startedAtMs !== null && !nonnegative(progress.startedAtMs)))) return false;
  if (state.mistakeEvidence.some((item, index) => !validMistake(item, piece) || item.sequence !== index)) return false;
  if (state.skipEvidence.some((item, index) => !validEvidenceLocation(item, piece) || item.sequence !== index)) return false;
  if (state.restartEvidence?.some((item, index) => !object(item) || item.sequence !== index || !integer(item.measureIndex)
    || piece.measures[item.measureIndex]?.sourceMeasureId !== item.sourceMeasureId || !nonnegative(item.occurredAtActiveMs))) return false;
  if (state.targetTimings.some((item, index) => !validTargetTiming(item, piece) || item.sequence !== index)) return false;
  if (state.measureTimings.some((item) => !object(item) || !integer(item.measureIndex) || !nonnegative(item.activeDurationMs)
    || piece.measures[item.measureIndex]?.sourceMeasureId !== item.sourceMeasureId)) return false;
  if (state.attackEvidence?.some((item, index) => !object(item) || item.sequence !== index || !integer(item.measureIndex)
    || piece.measures[item.measureIndex]?.sourceMeasureId !== item.sourceMeasureId || typeof item.targetId !== "string"
    || !integer(item.midiNumber) || !integer(item.attackVelocity) || item.attackVelocity < 1 || item.attackVelocity > 127
    || !nonnegative(item.occurredAtActiveMs) || (item.sourceTimeStampMs !== undefined && !nonnegative(item.sourceTimeStampMs)))) return false;
  if (state.releaseEvidence?.some((item, index) => !object(item) || item.sequence !== index || !integer(item.midiNumber)
    || item.midiNumber > 127 || !["note-off", "note-on-zero"].includes(String(item.encoding))
    || (item.releaseVelocity !== undefined && (!integer(item.releaseVelocity) || item.releaseVelocity > 127))
    || (item.sourceTimeStampMs !== undefined && !nonnegative(item.sourceTimeStampMs))
    || !nonnegative(item.occurredAtActiveMs))) return false;
  return true;
}

/** Future run migrations dispatch here; unknown versions remain untouched. */
export function parsePiecePracticeRun(value: unknown): ParsedPiecePracticeRun {
  if (!object(value)) return { ok: false, reason: "corrupt" };
  if (value.schemaVersion !== 1) return { ok: false, reason: typeof value.schemaVersion === "number" && value.schemaVersion > 1 ? "unsupported" : "corrupt" };
  const score = parseStaffBuilderScore(value.sourceScore);
  if (!score.ok || typeof value.runId !== "string" || !value.runId || !integer(value.revision) || value.revision < 1
    || !["active", "completed", "ended-incomplete"].includes(String(value.status))
    || !timestamp(value.createdAt) || !timestamp(value.updatedAt)
    || (value.completedAt !== null && !timestamp(value.completedAt))
    || (value.status === "completed") !== (value.completedAt !== null)
    || value.sourceScoreId !== score.value.id || value.sourceScoreUpdatedAt !== score.value.updatedAt
    || !object(value.configuration) || !integer(value.configuration.startMeasureIndex)
    || (value.configuration.endMeasureIndex !== null && !integer(value.configuration.endMeasureIndex))
    || !focus(value.configuration.assessmentFocus)) return { ok: false, reason: "corrupt" };
  const projected = projectStaffBuilderPieceForPractice(score.value);
  if (!projected.ok) return { ok: false, reason: "corrupt" };
  const piece = focusPiecePracticeProjection(projected.piece, value.configuration.assessmentFocus);
  if (!piece.measures[value.configuration.startMeasureIndex]
    || (value.configuration.endMeasureIndex !== null && (!piece.measures[value.configuration.endMeasureIndex]
      || value.configuration.endMeasureIndex < value.configuration.startMeasureIndex))
    || !validCheckpoint(value.checkpoint, piece, value.configuration as PiecePracticeRunRecordV1["configuration"], value.status as PiecePracticeRunStatus)) return { ok: false, reason: "corrupt" };
  return { ok: true, record: value as PiecePracticeRunRecordV1, piece };
}

/** Browser clock origins are never written. An incomplete roll retries from its first pitch. */
export function checkpointPiecePractice(state: PiecePracticeSessionState, atMs: number): PiecePracticeCheckpointV1 {
  const { activeSinceMs: _activeSinceMs, startedAtMs: _startedAtMs, ...rest } = state;
  void _activeSinceMs; void _startedAtMs;
  return {
    ...rest,
    activeElapsedMs: getPiecePracticeElapsedMs(state, atMs),
    currentCheckProgress: state.currentCheckProgress.map((progress) => ({
      ...progress,
      accumulatedMidiNumbers: progress.completed ? progress.accumulatedMidiNumbers : [],
      startedAtMs: null,
    })),
  };
}

export function hydratePiecePracticeRun(record: PiecePracticeRunRecordV1, atMs: number): PiecePracticeSessionState {
  const score = parseStaffBuilderScore(record.sourceScore);
  if (!score.ok) throw new Error("Cannot hydrate an invalid Piece Practice score snapshot.");
  const projected = projectStaffBuilderPieceForPractice(score.value);
  if (!projected.ok) throw new Error("Cannot hydrate an invalid Piece Practice score snapshot.");
  const piece = focusPiecePracticeProjection(projected.piece, record.configuration.assessmentFocus);
  const state = { ...record.checkpoint, restartEvidence: record.checkpoint.restartEvidence ?? [], clockPaused: true, activeSinceMs: atMs, startedAtMs: atMs };
  return resolvePiecePracticeEmptyRolledChecks(piece, state, atMs);
}

export function createPiecePracticeRun(score: StaffBuilderScore, state: PiecePracticeSessionState, atMs: number, wallClock = new Date()): PiecePracticeRunRecordV1 {
  const timestamp = wallClock.toISOString();
  return {
    schemaVersion: 1, runId: crypto.randomUUID(), revision: 1, status: state.status === "piece-complete" ? "completed" : "active",
    createdAt: timestamp, updatedAt: timestamp, completedAt: state.status === "piece-complete" ? timestamp : null,
    sourceScoreId: score.id, sourceScoreUpdatedAt: score.updatedAt, sourceScore: structuredClone(score),
    configuration: { startMeasureIndex: state.startMeasureIndex, endMeasureIndex: state.endMeasureIndex, assessmentFocus: state.assessmentFocus },
    checkpoint: checkpointPiecePractice(state, atMs),
  };
}

export function revisePiecePracticeRun(record: PiecePracticeRunRecordV1, state: PiecePracticeSessionState, atMs: number, status: PiecePracticeRunStatus = state.status === "piece-complete" ? "completed" : "active", wallClock = new Date()): PiecePracticeRunRecordV1 {
  const timestamp = wallClock.toISOString();
  return { ...record, revision: record.revision + 1, status, updatedAt: timestamp,
    completedAt: status === "completed" ? record.completedAt ?? timestamp : record.completedAt,
    checkpoint: checkpointPiecePractice(state, atMs) };
}

export interface PiecePracticeRunStore {
  list(): Promise<unknown[]>;
  save(record: PiecePracticeRunRecordV1): Promise<void>;
  discard(runId: string): Promise<void>;
}

function request<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { source.onsuccess = () => resolve(source.result); source.onerror = () => reject(source.error); });
}

export type PiecePracticeRunBackend = Readonly<{
  list(): Promise<unknown[]>;
  put(record: PiecePracticeRunRecordV1): Promise<void>;
  discard(runId: string): Promise<void>;
}>;

type SaveWaiter = Readonly<{ resolve: () => void; reject: (error: unknown) => void }>;
type PendingRunOperation =
  | { kind: "save"; record: PiecePracticeRunRecordV1; waiters: SaveWaiter[] }
  | { kind: "list"; resolve: (records: unknown[]) => void; reject: (error: unknown) => void }
  | { kind: "discard"; runId: string; resolve: () => void; reject: (error: unknown) => void };

/** One backend operation at a time; only pending active checkpoints may be superseded. */
export class PiecePracticeRunWriteCoordinator implements PiecePracticeRunStore {
  private readonly pending: PendingRunOperation[] = [];
  private draining = false;
  constructor(private readonly backend: PiecePracticeRunBackend) {}

  list(): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
      this.pending.push({ kind: "list", resolve, reject });
      void this.drain();
    });
  }

  private async terminalRecords(): Promise<PiecePracticeRunRecordV1[]> {
    return (await this.backend.list()).flatMap((value) => {
      const parsed = parsePiecePracticeRun(value);
      return parsed.ok && parsed.record.status !== "active" ? [parsed.record] : [];
    }).sort((left, right) => String(right.completedAt ?? right.updatedAt).localeCompare(String(left.completedAt ?? left.updatedAt)));
  }

  private async trim(limit: number): Promise<void> {
    const records = await this.terminalRecords();
    for (const record of records.slice(limit)) await this.backend.discard(record.runId);
  }

  private async write(record: PiecePracticeRunRecordV1): Promise<void> {
    try { await this.backend.put(record); }
    catch {
      try {
        const terminals = await this.terminalRecords();
        if (terminals.length) await this.backend.discard(terminals[terminals.length - 1].runId);
      } catch { /* Retry even if cleanup failed. */ }
      await this.backend.put(record);
    }
    if (record.status !== "active") await this.trim(TERMINAL_LIMIT);
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    while (this.pending.length) {
      const operation = this.pending.shift()!;
      try {
        if (operation.kind === "save") {
          await this.write(operation.record);
          operation.waiters.forEach(({ resolve }) => resolve());
        } else if (operation.kind === "list") {
          operation.resolve(await this.backend.list());
        } else {
          await this.backend.discard(operation.runId);
          operation.resolve();
        }
      } catch (error) {
        if (operation.kind === "save") operation.waiters.forEach(({ reject }) => reject(error));
        else operation.reject(error);
      }
    }
    this.draining = false;
  }

  save(record: PiecePracticeRunRecordV1): Promise<void> {
    return new Promise((resolve, reject) => {
      const last = this.pending.at(-1);
      if (last?.kind === "save" && last.record.runId === record.runId && last.record.status === "active") {
        if (record.status !== "active" || record.revision > last.record.revision) last.record = record;
        last.waiters.push({ resolve, reject });
      } else {
        this.pending.push({ kind: "save", record, waiters: [{ resolve, reject }] });
      }
      void this.drain();
    });
  }

  discard(runId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pending.push({ kind: "discard", runId, resolve, reject });
      void this.drain();
    });
  }
}

export class IndexedDbPiecePracticeRunStore implements PiecePracticeRunStore {
  private database: Promise<IDBDatabase> | null = null;
  private readonly coordinator = new PiecePracticeRunWriteCoordinator({
    list: () => this.listRaw(), put: (record) => this.putRaw(record), discard: (runId) => this.discardRaw(runId),
  });

  private open(): Promise<IDBDatabase> {
    this.database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const opening = indexedDB.open(PIECE_PRACTICE_DB_NAME, PIECE_PRACTICE_DB_VERSION);
      opening.onupgradeneeded = () => {
        const database = opening.result;
        const store = database.createObjectStore(PIECE_PRACTICE_STORE_NAME, { keyPath: "runId" });
        store.createIndex("status", "status");
        store.createIndex("updatedAt", "updatedAt");
        store.createIndex("completedAt", "completedAt");
      };
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error);
      opening.onblocked = () => reject(new Error("Piece Practice storage is blocked by another tab."));
    }).catch((error: unknown) => { this.database = null; throw error; });
    return this.database;
  }

  private async listRaw(): Promise<unknown[]> {
    const database = await this.open();
    return request(database.transaction(PIECE_PRACTICE_STORE_NAME).objectStore(PIECE_PRACTICE_STORE_NAME).getAll());
  }

  private async putRaw(record: PiecePracticeRunRecordV1): Promise<void> {
    const database = await this.open();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(PIECE_PRACTICE_STORE_NAME, "readwrite");
      const store = transaction.objectStore(PIECE_PRACTICE_STORE_NAME);
      const existing = store.get(record.runId);
      existing.onsuccess = () => {
        if (!existing.result || !integer(existing.result.revision) || existing.result.revision < record.revision) store.put(record);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  private async discardRaw(runId: string): Promise<void> {
    const database = await this.open();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(PIECE_PRACTICE_STORE_NAME, "readwrite");
      transaction.objectStore(PIECE_PRACTICE_STORE_NAME).delete(runId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  list(): Promise<unknown[]> { return this.coordinator.list(); }
  save(record: PiecePracticeRunRecordV1): Promise<void> { return this.coordinator.save(record); }
  discard(runId: string): Promise<void> { return this.coordinator.discard(runId); }
}

export const piecePracticeRunStore = new IndexedDbPiecePracticeRunStore();
