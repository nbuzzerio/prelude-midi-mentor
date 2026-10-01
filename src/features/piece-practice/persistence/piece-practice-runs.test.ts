import { describe, expect, it } from "vitest";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import { focusPiecePracticeProjection, projectStaffBuilderPieceForPractice } from "../piece-practice-projection";
import { armPiecePracticeFirstTarget, createPiecePracticeSession, pausePiecePracticeClock, recordPiecePracticeMidiAttack, recordPiecePracticeMidiRelease, skipCurrentPiecePracticeTarget, submitPiecePracticeAttempt, submitPiecePracticePitch } from "../piece-practice-session";
import { formatPiecePracticeReport } from "../piece-practice-report";
import { createPiecePracticeRun, hydratePiecePracticeRun, parsePiecePracticeRun, PiecePracticeRunWriteCoordinator, revisePiecePracticeRun, selectPiecePracticeRecovery, type PiecePracticeRunRecordV1 } from "./piece-practice-runs";

const DATE = "2026-09-30T12:00:00.000Z";
const score: StaffBuilderScore = {
  schemaVersion: 4, id: "score-1", title: "Original score", createdAt: DATE, updatedAt: DATE,
  tempoBpm: 120, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", annotations: [], ties: [],
  measures: [{ id: "m1", events: [
    { id: "upper", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "whole" }, pitches: [{ id: "c4", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 }] },
    { id: "lower", kind: "notes", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "whole" }, pitches: [{ id: "c3", midiNumber: 48, letter: "C", accidental: "natural", octave: 3 }] },
  ] }],
};

function setup(assessmentFocus: "both" | "upper" | "lower" = "both") {
  const projected = projectStaffBuilderPieceForPractice(score);
  if (!projected.ok) throw new Error("Test score must project.");
  const piece = focusPiecePracticeProjection(projected.piece, assessmentFocus);
  const created = createPiecePracticeSession(piece, { startMeasureIndex: 0, startedAtMs: 100 });
  if (!created.ok) throw new Error("Test session must start.");
  return { piece, state: created.state };
}

describe("Piece Practice durable run V1", () => {
  it("creates an active versioned snapshot before the first note and preserves focus", () => {
    const { state } = setup("lower");
    const record = createPiecePracticeRun(score, state, 100);
    expect(record.schemaVersion).toBe(1);
    expect(record.status).toBe("active");
    expect(record.revision).toBe(1);
    expect(record.runId).toBeTruthy();
    expect(record.sourceScore).toEqual(score);
    expect(record.sourceScore).not.toBe(score);
    expect(record.configuration.assessmentFocus).toBe("lower");
    expect(record.checkpoint.firstTargetTimingPending).toBe(true);
    expect(record.checkpoint.currentTargetActivatedAtActiveMs).toBeNull();
    expect("activeSinceMs" in record.checkpoint).toBe(false);
    expect("startedAtMs" in record.checkpoint).toBe(false);
    expect(parsePiecePracticeRun(record).ok).toBe(true);
  });

  it("rebuilds grading and original notation from the score snapshot", () => {
    for (const assessmentFocus of ["both", "upper", "lower"] as const) {
      const { state } = setup(assessmentFocus);
      const record = createPiecePracticeRun(score, state, 100);
      const parsed = parsePiecePracticeRun(structuredClone(record));
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      expect(parsed.piece.assessmentFocus).toBe(assessmentFocus);
      expect(parsed.piece.measures[0].sourceEvents).toHaveLength(2);
      expect(parsed.piece.measures[0].targets[0].expectedMidiNumbers).toEqual(
        assessmentFocus === "both" ? [48, 60] : assessmentFocus === "upper" ? [60] : [48],
      );
      expect(parsed.record.sourceScore.title).toBe("Original score");
    }
  });

  it("increments revision within one run and persists armed and unarmed timing", () => {
    const { piece, state } = setup();
    const initial = createPiecePracticeRun(score, state, 100);
    const armed = armPiecePracticeFirstTarget(piece, state, 180);
    const next = revisePiecePracticeRun(initial, armed, 200);
    expect(next.runId).toBe(initial.runId);
    expect(next.revision).toBe(2);
    expect(next.checkpoint.currentTargetActivatedAtActiveMs).toBe(80);
    expect(next.checkpoint.firstTargetTimingPending).toBe(true);
    const restored = hydratePiecePracticeRun(next, 50_000);
    expect(restored.clockPaused).toBe(true);
    expect(restored.activeElapsedMs).toBe(100);
    expect(restored.currentTargetActivatedAtActiveMs).toBe(80);
    expect(hydratePiecePracticeRun(initial, 50_000).currentTargetActivatedAtActiveMs).toBeNull();
  });

  it("excludes browser downtime and resets incomplete rolled timing without synthetic releases", () => {
    const { state } = setup();
    const withPartial = { ...state, currentCheckProgress: state.currentCheckProgress.map((progress) => ({ ...progress, accumulatedMidiNumbers: [48], startedAtMs: 130 })) };
    const record = createPiecePracticeRun(score, withPartial, 150);
    const restored = hydratePiecePracticeRun(record, 1_000_000);
    expect(restored.activeElapsedMs).toBe(50);
    expect(restored.currentCheckProgress[0].accumulatedMidiNumbers).toEqual([]);
    expect(restored.currentCheckProgress[0].startedAtMs).toBeNull();
    expect(restored.releaseEvidence).toBeUndefined();
  });

  it("preserves completed check progress while resetting incomplete assembly", () => {
    const rolledScore: StaffBuilderScore = { ...score, measures: [{ ...score.measures[0], events: score.measures[0].events.map((event) =>
      event.kind === "notes" && event.id === "lower" ? { ...event, arpeggiation: "up" as const,
        pitches: [...event.pitches, { id: "e3", midiNumber: 52, letter: "E" as const, accidental: "natural" as const, octave: 3 }] } : event) }] };
    const projected = projectStaffBuilderPieceForPractice(rolledScore);
    if (!projected.ok) throw new Error("Expected roll projection.");
    const created = createPiecePracticeSession(projected.piece, { startMeasureIndex: 0, startedAtMs: 100 });
    if (!created.ok) throw new Error("Expected session.");
    const targetId = projected.piece.measures[0].targets[0].id;
    const normal = submitPiecePracticeAttempt(projected.piece, created.state, { targetId,
      attempt: { attackMidiNumbers: [60], heldMidiNumbers: [] }, atMs: 120 });
    if (!normal.accepted) throw new Error("Expected normal check.");
    const rolled = submitPiecePracticePitch(projected.piece, normal.state, { targetId, midiNumber: 48, atMs: 130 });
    if (!rolled.accepted) throw new Error("Expected rolled check.");
    const restored = hydratePiecePracticeRun(createPiecePracticeRun(rolledScore, rolled.state, 140), 10_000);
    expect(restored.currentCheckProgress.find((progress) => progress.completed)?.completed).toBe(true);
    expect(restored.currentCheckProgress.find((progress) => !progress.completed)).toMatchObject({ accumulatedMidiNumbers: [], startedAtMs: null });
  });

  it("round trips physical attack velocity, release, and source timestamps", () => {
    const { piece, state } = setup();
    const attack = recordPiecePracticeMidiAttack(piece, state, 60, 103, 120, 4_000);
    const released = recordPiecePracticeMidiRelease(attack, { midiNumber: 60, encoding: "note-off", releaseVelocity: 45, sourceTimeStampMs: 4_100 }, 140);
    const record = createPiecePracticeRun(score, released, 140);
    const parsed = parsePiecePracticeRun(record);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.record.checkpoint.attackEvidence?.[0]).toMatchObject({ attackVelocity: 103, sourceTimeStampMs: 4_000 });
    expect(parsed.record.checkpoint.releaseEvidence?.[0]).toMatchObject({ releaseVelocity: 45, sourceTimeStampMs: 4_100 });
  });

  it("round trips mistakes, skips, target timings, and completed progress", () => {
    const { piece, state } = setup("upper");
    const target = piece.measures[0].targets[0];
    const wrong = submitPiecePracticeAttempt(piece, state, { targetId: target.id, attempt: { attackMidiNumbers: [61], heldMidiNumbers: [] }, atMs: 200 });
    expect(wrong.accepted).toBe(true);
    if (!wrong.accepted) return;
    const skipped = skipCurrentPiecePracticeTarget(piece, wrong.state, 300);
    expect(skipped.skipped).toBe(true);
    if (!skipped.skipped) return;
    const parsed = parsePiecePracticeRun(createPiecePracticeRun(score, skipped.state, 300));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.record.checkpoint.mistakeEvidence).toHaveLength(1);
    expect(parsed.record.checkpoint.skipEvidence).toHaveLength(1);
    expect(parsed.record.checkpoint.targetTimings).toHaveLength(1);
    expect(parsed.record.checkpoint.completedMeasureIndexes).toEqual([0]);
    expect(parsed.record.status).toBe("completed");
  });

  it("persists paused time and terminal status", () => {
    const { state } = setup();
    const paused = pausePiecePracticeClock(state, 250);
    const first = createPiecePracticeRun(score, paused, 10_000);
    expect(first.checkpoint.activeElapsedMs).toBe(150);
    expect(first.checkpoint.clockPaused).toBe(true);
    const ended = revisePiecePracticeRun(first, paused, 10_000, "ended-incomplete");
    expect(ended.status).toBe("ended-incomplete");
    expect(ended.completedAt).toBeNull();
  });

  it("retains a physical release observed after completion without moving completion time", () => {
    const { piece, state } = setup("upper");
    const finished = skipCurrentPiecePracticeTarget(piece, state, 200);
    if (!finished.skipped) throw new Error("Expected completion.");
    const completed = createPiecePracticeRun(score, finished.state, 200, new Date(DATE));
    const released = recordPiecePracticeMidiRelease(finished.state, { midiNumber: 60, encoding: "note-off", releaseVelocity: 30 }, 250);
    const revised = revisePiecePracticeRun(completed, released, 250, "completed", new Date(Date.parse(DATE) + 1000));
    expect(revised.completedAt).toBe(completed.completedAt);
    expect(revised.checkpoint.releaseEvidence).toHaveLength(1);
    expect(revised.revision).toBe(completed.revision + 1);
  });

  it("rejects corrupt, missing snapshot, and future records without mutating them", () => {
    const record = createPiecePracticeRun(score, setup().state, 100);
    for (const candidate of [
      { ...record, sourceScore: null },
      { ...record, checkpoint: { ...record.checkpoint, currentMeasureIndex: 99 } },
      { ...record, schemaVersion: 2 },
    ]) {
      const before = structuredClone(candidate);
      expect(parsePiecePracticeRun(candidate).ok).toBe(false);
      expect(candidate).toEqual(before);
    }
  });

  it("regenerates the same detailed report after a snapshot-only round trip", () => {
    const { piece, state } = setup("upper");
    const attacked = recordPiecePracticeMidiAttack(piece, state, 60, 97, 150, 4_000);
    const target = piece.measures[0].targets[0];
    const finished = submitPiecePracticeAttempt(piece, attacked, { targetId: target.id,
      attempt: { attackMidiNumbers: [60], heldMidiNumbers: [] }, atMs: 160 });
    if (!finished.accepted) throw new Error("Expected valid attempt.");
    const record = createPiecePracticeRun(score, finished.state, 160);
    const parsed = parsePiecePracticeRun(structuredClone(record));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const options = { title: score.title, rangeText: "Measure 1", includeAttackStrength: true, showMidiDetails: true };
    expect(formatPiecePracticeReport({ ...options, piece: parsed.piece, state: hydratePiecePracticeRun(parsed.record, 100_000) }))
      .toBe(formatPiecePracticeReport({ ...options, piece, state: finished.state }));
    expect(parsed.record.checkpoint.attackEvidence?.[0].attackVelocity).toBe(97);
    expect(parsed.record.sourceScore.title).toBe("Original score");
  });
});

function memoryBackend(initial: readonly PiecePracticeRunRecordV1[] = []) {
  const records = new Map<string, PiecePracticeRunRecordV1>(initial.map((record) => [record.runId, record]));
  const discarded: string[] = [];
  let failures = 0;
  let writes = 0;
  return {
    records, discarded,
    failNext(count: number) { failures = count; },
    get writes() { return writes; },
    async list(): Promise<unknown[]> { return [...records.values()]; },
    async put(record: PiecePracticeRunRecordV1) {
      writes += 1;
      if (failures > 0) { failures -= 1; throw new Error("quota"); }
      if ((records.get(record.runId)?.revision ?? 0) < record.revision) records.set(record.runId, record);
    },
    async discard(runId: string) { records.delete(runId); discarded.push(runId); },
  };
}

describe("Piece Practice write coordination", () => {
  it("coalesces active revisions 2 through 100 while revision 1 is in flight", async () => {
    const { state } = setup();
    const backend = memoryBackend();
    const puts: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const writer = new PiecePracticeRunWriteCoordinator({ ...backend, put: async (record) => {
      puts.push(record.revision);
      if (record.revision === 1) await gate;
      await backend.put(record);
    } });
    let record = createPiecePracticeRun(score, state, 100);
    const pending = [writer.save(record)];
    for (let revision = 2; revision <= 100; revision += 1) {
      record = revisePiecePracticeRun(record, state, 100 + revision);
      pending.push(writer.save(record));
    }
    expect(puts).toEqual([1]);
    release();
    await Promise.all(pending);
    expect(puts).toEqual([1, 100]);
    expect(backend.records.get(record.runId)?.revision).toBe(100);
  });

  it("replaces pending active checkpoints with completion but never drops the terminal write", async () => {
    const { piece, state } = setup("upper");
    const finished = skipCurrentPiecePracticeTarget(piece, state, 200);
    if (!finished.skipped) throw new Error("Expected completion.");
    const backend = memoryBackend();
    const puts: Array<{ revision: number; status: string }> = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const writer = new PiecePracticeRunWriteCoordinator({ ...backend, put: async (record) => {
      puts.push({ revision: record.revision, status: record.status });
      if (record.revision === 1) await gate;
      await backend.put(record);
    } });
    let record = createPiecePracticeRun(score, state, 100);
    const pending = [writer.save(record)];
    for (let revision = 2; revision <= 5; revision += 1) {
      record = revisePiecePracticeRun(record, state, 100 + revision);
      pending.push(writer.save(record));
    }
    const completed = revisePiecePracticeRun(record, finished.state, 200, "completed");
    pending.push(writer.save(completed));
    release();
    await Promise.all(pending);
    expect(puts).toEqual([{ revision: 1, status: "active" }, { revision: 6, status: "completed" }]);
    expect(backend.records.get(record.runId)?.status).toBe("completed");
  });

  it("commits old-run terminalization before a new run's active record", async () => {
    const { state } = setup();
    const backend = memoryBackend();
    const puts: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const writer = new PiecePracticeRunWriteCoordinator({ ...backend, put: async (record) => {
      puts.push(`${record.runId}:${record.status}:${record.revision}`);
      if (puts.length === 1) await gate;
      await backend.put(record);
    } });
    const oldRun = createPiecePracticeRun(score, state, 100);
    const newerActive = revisePiecePracticeRun(oldRun, state, 120);
    const ended = revisePiecePracticeRun(newerActive, state, 130, "ended-incomplete");
    const newRun = createPiecePracticeRun(score, state, 140);
    const pending = [writer.save(oldRun), writer.save(newerActive), writer.save(ended), writer.save(newRun)];
    release();
    await Promise.all(pending);
    expect(puts).toEqual([
      `${oldRun.runId}:active:1`, `${oldRun.runId}:ended-incomplete:3`, `${newRun.runId}:active:1`,
    ]);
    expect(backend.records.get(oldRun.runId)?.status).toBe("ended-incomplete");
    expect(backend.records.get(newRun.runId)?.status).toBe("active");
  });

  it("keeps list and discard ordered between scheduled saves", async () => {
    const { state } = setup();
    const backend = memoryBackend();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const writer = new PiecePracticeRunWriteCoordinator({ ...backend, put: async (record) => {
      if (record.revision === 1) await gate;
      await backend.put(record);
    } });
    const first = createPiecePracticeRun(score, state, 100);
    const second = revisePiecePracticeRun(first, state, 120);
    const writingFirst = writer.save(first);
    const writingSecond = writer.save(second);
    const listing = writer.list();
    const discarding = writer.discard(first.runId);
    release();
    await Promise.all([writingFirst, writingSecond]);
    expect((await listing as PiecePracticeRunRecordV1[])[0].revision).toBe(2);
    await discarding;
    expect(backend.records.has(first.runId)).toBe(false);
  });

  it("serializes late writes and never replaces a newer revision or completion", async () => {
    const { state } = setup();
    const first = createPiecePracticeRun(score, state, 100);
    const second = revisePiecePracticeRun(first, state, 200);
    const backend = memoryBackend();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const put = backend.put.bind(backend);
    const writer = new PiecePracticeRunWriteCoordinator({ ...backend, put: async (record) => {
      if (record.revision === 1) await gate;
      await put(record);
    } });
    const firstWrite = writer.save(first);
    const secondWrite = writer.save(second);
    release();
    await Promise.all([firstWrite, secondWrite]);
    expect(backend.records.get(first.runId)?.revision).toBe(2);
    await writer.save(first);
    expect(backend.records.get(first.runId)?.revision).toBe(2);
  });

  it("retains only eight terminal runs and never evicts an active run", async () => {
    const { piece, state } = setup("upper");
    const target = piece.measures[0].targets[0];
    const completed = skipCurrentPiecePracticeTarget(piece, state, 200);
    if (!completed.skipped) throw new Error("Expected skip.");
    const active = createPiecePracticeRun(score, state, 100);
    const backend = memoryBackend([active]);
    const writer = new PiecePracticeRunWriteCoordinator(backend);
    for (let index = 0; index < 10; index += 1) {
      await writer.save(createPiecePracticeRun(score, completed.state, 200, new Date(Date.parse(DATE) + index * 1_000)));
    }
    expect([...backend.records.values()].filter((record) => record.status === "completed")).toHaveLength(8);
    expect(backend.records.has(active.runId)).toBe(true);
    expect(backend.discarded).toHaveLength(2);
    expect(backend.records.get(active.runId)?.status).toBe("active");
    expect(target).toBeTruthy();
  });

  it("cleans oldest terminal evidence then retries one failed write", async () => {
    const { piece, state } = setup("upper");
    const finished = skipCurrentPiecePracticeTarget(piece, state, 200);
    if (!finished.skipped) throw new Error("Expected completion.");
    const old = createPiecePracticeRun(score, finished.state, 200, new Date(DATE));
    const active = createPiecePracticeRun(score, state, 100);
    const backend = memoryBackend([old, active]);
    backend.failNext(1);
    await new PiecePracticeRunWriteCoordinator(backend).save(revisePiecePracticeRun(active, state, 150));
    expect(backend.writes).toBe(2);
    expect(backend.discarded).toEqual([old.runId]);
    expect(backend.records.get(active.runId)?.revision).toBe(2);
  });

  it("stops after one retry and leaves the in-memory checkpoint intact", async () => {
    const { state } = setup();
    const record = createPiecePracticeRun(score, state, 100);
    const backend = memoryBackend();
    backend.failNext(2);
    await expect(new PiecePracticeRunWriteCoordinator(backend).save(record)).rejects.toThrow("quota");
    expect(backend.writes).toBe(2);
    expect(state.status).toBe("practicing");
    expect(backend.records.has(record.runId)).toBe(false);
  });

  it("does not silently delete corrupt terminal data and discards only the chosen run", async () => {
    const { piece, state } = setup("upper");
    const finished = skipCurrentPiecePracticeTarget(piece, state, 200);
    if (!finished.skipped) throw new Error("Expected completion.");
    const first = createPiecePracticeRun(score, finished.state, 200);
    const second = createPiecePracticeRun(score, finished.state, 200);
    const backend = memoryBackend([first, second]);
    backend.records.set("corrupt", { ...first, runId: "corrupt", sourceScore: null as unknown as StaffBuilderScore });
    const writer = new PiecePracticeRunWriteCoordinator(backend);
    await writer.discard(first.runId);
    expect(backend.records.has(first.runId)).toBe(false);
    expect(backend.records.has(second.runId)).toBe(true);
    expect(backend.records.has("corrupt")).toBe(true);
  });

  it("chooses the newest active record deterministically and leaves others available", () => {
    const { state } = setup();
    const older = createPiecePracticeRun(score, state, 100, new Date(DATE));
    const newer = createPiecePracticeRun(score, state, 100, new Date(Date.parse(DATE) + 1_000));
    const selected = selectPiecePracticeRecovery([older, newer]);
    expect(selected.active).toEqual([newer, older]);
    expect(selected.latestCompleted).toBeNull();
  });
});
