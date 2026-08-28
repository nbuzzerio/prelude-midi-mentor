import { describe, expect, it } from "vitest";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import { projectStaffBuilderPieceForPractice } from "./piece-practice-projection";
import type { PiecePracticeCheck, PiecePracticeMeasure, PiecePracticePiece, PiecePracticeTarget } from "./piece-practice-types";
import {
  advancePiecePracticeNoAttackMeasure,
  createPiecePracticeSession,
  getCurrentPiecePracticeTarget,
  getPiecePracticeElapsedMs,
  getPiecePracticeProgress,
  getPiecePracticeRolledWindowMs,
  expirePiecePracticeRolledChecks,
  restartCurrentPiecePracticeMeasure,
  restartPiecePractice,
  submitPiecePracticeAttempt,
  submitPiecePracticePitch,
  type PiecePracticeSessionState,
} from "./piece-practice-session";

function target(measureIndex: number, targetIndex: number, expectedMidiNumbers: readonly number[] = [60 + measureIndex + targetIndex]): PiecePracticeTarget {
  const sourceMeasureId = `m${measureIndex + 1}`;
  const base = {
    id: `${sourceMeasureId}:attack:${targetIndex * 480}`,
    measureIndex,
    sourceMeasureId,
    startTick: targetIndex * 480,
    absoluteStartTick: measureIndex * 1920 + targetIndex * 480,
    sourceEventIds: [`event-${measureIndex}-${targetIndex}`],
    expectedMidiNumbers,
    attackedPitches: expectedMidiNumbers.map((midiNumber, pitchIndex) => ({
      sourceEventId: `event-${measureIndex}-${targetIndex}`,
      sourcePitchId: `pitch-${measureIndex}-${targetIndex}-${pitchIndex}`,
      staff: "treble" as const,
      midiNumber,
      letter: "C" as const,
      accidental: "natural" as const,
      octave: 4,
      duration: "quarter" as const,
      durationTicks: 480,
      incomingTieIds: [],
      outgoingTieIds: [],
    })),
  };
  return { ...base, checks: [{ id: `${base.id}:normal`, kind: "normal", sourceEventIds: base.sourceEventIds, expectedMidiNumbers, attackedPitches: base.attackedPitches }] };
}

function measure(measureIndex: number, targetCount: number): PiecePracticeMeasure {
  return {
    measureIndex,
    sourceMeasureId: `m${measureIndex + 1}`,
    absoluteStartTick: measureIndex * 1920,
    capacityTicks: 1920,
    keySignatureId: "c-major",
    timeSignature: "4/4",
    sourceEvents: [],
    restEventIds: targetCount === 0 ? [`rest-${measureIndex}`] : [],
    targets: Array.from({ length: targetCount }, (_value, targetIndex) => target(measureIndex, targetIndex)),
  };
}

function piece(targetCounts: readonly number[] = [2, 1]): PiecePracticePiece {
  return {
    sourceScoreId: "score",
    sourceScoreUpdatedAt: "2026-08-10T12:00:00.000Z",
    title: "Practice study",
    tempoBpm: 96,
    measures: targetCounts.map((targetCount, measureIndex) => measure(measureIndex, targetCount)),
  };
}

function projectedPolyphonicPiece(): PiecePracticePiece {
  const source: StaffBuilderScore = {
    schemaVersion: 3, annotations: [], id: "polyphonic-score", title: "Polyphonic study",
    createdAt: "2026-08-10T12:00:00.000Z", updatedAt: "2026-08-10T12:00:00.000Z",
    tempoBpm: 96, initialKeySignatureId: "c-major", initialTimeSignature: "6/8", ties: [],
    measures: [{ id: "m1", events: [
      { id: "sustain", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "dotted-quarter" }, pitches: [{ id: "e", midiNumber: 64, letter: "E", accidental: "natural", octave: 4 }] },
      { id: "later-c", kind: "notes", staff: "treble", startTick: 480, rhythm: { status: "final", duration: "eighth" }, pitches: [{ id: "c", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 }] },
      { id: "later-d", kind: "notes", staff: "treble", startTick: 720, rhythm: { status: "final", duration: "eighth" }, pitches: [{ id: "d", midiNumber: 62, letter: "D", accidental: "natural", octave: 4 }] },
      { id: "tail", kind: "rest", staff: "treble", startTick: 960, rhythm: { status: "final", duration: "quarter" } },
      { id: "bass-rest", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "dotted-half" } },
    ] }],
  };
  const result = projectStaffBuilderPieceForPractice(source);
  if (!result.ok) throw new Error(result.issues.map(({ code }) => code).join(", "));
  return result.piece;
}

function initialized(source = piece(), startMeasureIndex = 0, startedAtMs = 1_000): PiecePracticeSessionState {
  const result = createPiecePracticeSession(source, { startMeasureIndex, startedAtMs });
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

function checkedPiece(checks: readonly PiecePracticeCheck[], tempoBpm = 120): PiecePracticePiece {
  const attackedPitches = checks.flatMap((check) => check.attackedPitches);
  const target: PiecePracticeTarget = {
    id: "m1:attack:0", measureIndex: 0, sourceMeasureId: "m1", startTick: 0, absoluteStartTick: 0, checks,
    sourceEventIds: [...new Set(checks.flatMap(({ sourceEventIds }) => sourceEventIds))],
    expectedMidiNumbers: [...new Set(checks.flatMap(({ expectedMidiNumbers }) => expectedMidiNumbers))].sort((a, b) => a - b),
    attackedPitches,
  };
  return { sourceScoreId: "rolled", sourceScoreUpdatedAt: "now", title: "Rolled", tempoBpm, measures: [{ measureIndex: 0, sourceMeasureId: "m1", absoluteStartTick: 0, capacityTicks: 1920, keySignatureId: "c-major", timeSignature: "4/4", sourceEvents: [], restEventIds: [], targets: [target] }] };
}

function check(kind: "normal" | "rolled-chord", id: string, midiNumbers: readonly number[]): PiecePracticeCheck {
  const attackedPitches = midiNumbers.map((midiNumber, index) => ({ sourceEventId: id, sourcePitchId: `${id}-${index}`, staff: kind === "normal" ? "treble" as const : "bass" as const, midiNumber, letter: "C" as const, accidental: "natural" as const, octave: 4, duration: "quarter" as const, durationTicks: 480, incomingTieIds: [], outgoingTieIds: [] }));
  const base = { id, sourceEventIds: [id], expectedMidiNumbers: midiNumbers, attackedPitches };
  return kind === "normal" ? { ...base, kind } : { ...base, kind, direction: "up" };
}

function submit(source: PiecePracticePiece, state: PiecePracticeSessionState, midiNumbers?: readonly number[]) {
  const current = getCurrentPiecePracticeTarget(source, state);
  if (!current) throw new Error("Expected a current target.");
  return submitPiecePracticeAttempt(source, state, { targetId: current.id, attempt: { attackMidiNumbers: midiNumbers ?? current.expectedMidiNumbers } });
}

function accepted(source: PiecePracticePiece, state: PiecePracticeSessionState, midiNumbers?: readonly number[]): PiecePracticeSessionState {
  const result = submit(source, state, midiNumbers);
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}

describe("Piece Practice blocking session", () => {
  it("grades and blocks a real polyphonic projection without voice-specific session state", () => {
    const source = projectedPolyphonicPiece();
    const before = structuredClone(source);
    let state = initialized(source);
    expect(getCurrentPiecePracticeTarget(source, state)?.expectedMidiNumbers).toEqual([64]);

    state = accepted(source, state, [60]);
    expect(state).toMatchObject({ currentTargetIndex: 0, incorrectAttemptCount: 1, completedTargetCount: 0 });
    state = accepted(source, state, [64]);
    expect(getCurrentPiecePracticeTarget(source, state)?.expectedMidiNumbers).toEqual([60]);
    state = accepted(source, state, [60]);
    expect(getCurrentPiecePracticeTarget(source, state)?.expectedMidiNumbers).toEqual([62]);
    state = accepted(source, state, [62]);
    expect(state).toMatchObject({ status: "piece-complete", completedTargetCount: 3, completedMeasureCount: 1 });

    const restarted = restartCurrentPiecePracticeMeasure(source, state);
    expect(restarted).toMatchObject({ status: "practicing", currentTargetIndex: 0, completedTargetCount: 0, incorrectAttemptCount: 1 });
    expect(source).toEqual(before);
    expect("voiceIndex" in state).toBe(false);
  });
  it("initializes on the first target", () => {
    const state = initialized();
    expect(state).toMatchObject({ startMeasureIndex: 0, currentMeasureIndex: 0, currentTargetIndex: 0, status: "practicing" });
    expect(getCurrentPiecePracticeTarget(piece(), state)?.id).toBe("m1:attack:0");
  });

  it("advances a correct target to the next target", () => {
    expect(accepted(piece(), initialized())).toMatchObject({ currentMeasureIndex: 0, currentTargetIndex: 1, completedTargetCount: 1, status: "practicing" });
  });

  it("keeps an incorrect answer on the same target", () => {
    const result = submit(piece(), initialized(), [99]);
    expect(result.accepted && result.state).toMatchObject({ currentMeasureIndex: 0, currentTargetIndex: 0, completedTargetCount: 0, completedMeasureCount: 0 });
  });

  it("accumulates unlimited incorrect retries on the current target", () => {
    const source = piece();
    let state = initialized(source);
    state = accepted(source, state, [99]);
    state = accepted(source, state, [98]);
    state = accepted(source, state, [97]);
    expect(state).toMatchObject({ incorrectAttemptCount: 3, currentTargetIncorrectAttemptCount: 3, currentTargetIndex: 0 });
  });

  it("returns missing and extra details from an incorrect session submission", () => {
    const source = piece([1]);
    const result = submit(source, initialized(source), [70]);
    expect(result.accepted && result.grade).toMatchObject({ correct: false, missingMidiNumbers: [60], extraMidiNumbers: [70] });
  });

  it("completes a measure after its final target", () => {
    const source = piece([1, 1]);
    const state = accepted(source, initialized(source));
    expect(state).toMatchObject({ completedTargetCount: 1, completedMeasureCount: 1, completedMeasureIndexes: [0] });
  });

  it("automatically advances a completed normal measure", () => {
    const source = piece([1, 1]);
    expect(accepted(source, initialized(source))).toMatchObject({ currentMeasureIndex: 1, currentTargetIndex: 0, status: "practicing" });
  });

  it("begins the next normal measure at target zero", () => {
    const source = piece([2, 2]);
    let state = accepted(source, initialized(source));
    state = accepted(source, state);
    expect(state).toMatchObject({ currentMeasureIndex: 1, currentTargetIndex: 0 });
  });

  it("stops for explicit action when normal progression reaches a no-attack measure", () => {
    const source = piece([1, 0, 1]);
    expect(accepted(source, initialized(source))).toMatchObject({ currentMeasureIndex: 1, currentTargetIndex: null, status: "awaiting-explicit-measure-advance" });
  });

  it("explicitly advances a no-attack measure", () => {
    const source = piece([0, 1]);
    const result = advancePiecePracticeNoAttackMeasure(source, initialized(source));
    expect(result.advanced && result.state).toMatchObject({ completedMeasureCount: 1, completedMeasureIndexes: [0], currentMeasureIndex: 1, currentTargetIndex: 0, status: "practicing" });
  });

  it("requires separate explicit actions for consecutive no-attack measures", () => {
    const source = piece([0, 0, 1]);
    const first = advancePiecePracticeNoAttackMeasure(source, initialized(source));
    if (!first.advanced) throw new Error(first.reason);
    expect(first.state).toMatchObject({ currentMeasureIndex: 1, status: "awaiting-explicit-measure-advance" });
    const second = advancePiecePracticeNoAttackMeasure(source, first.state);
    expect(second.advanced && second.state).toMatchObject({ currentMeasureIndex: 2, status: "practicing", completedMeasureCount: 2 });
  });

  it("requires acknowledgement before completing a final no-attack measure", () => {
    const source = piece([0]);
    const state = initialized(source);
    expect(state.status).toBe("awaiting-explicit-measure-advance");
    const result = advancePiecePracticeNoAttackMeasure(source, state);
    expect(result.advanced && result.state).toMatchObject({ status: "piece-complete", completedMeasureCount: 1 });
  });

  it("rejects explicit advancement outside a no-attack measure", () => {
    const source = piece([1]);
    const state = initialized(source);
    expect(advancePiecePracticeNoAttackMeasure(source, state)).toEqual({ advanced: false, reason: "not-awaiting-explicit-advance", state });
  });

  it("completes a final normal measure exactly once", () => {
    const source = piece([1]);
    const initial = initialized(source);
    const completed = accepted(source, initial);
    expect(completed).toMatchObject({ status: "piece-complete", completedTargetCount: 1, completedMeasureCount: 1 });
    const repeated = submitPiecePracticeAttempt(source, completed, { targetId: "m1:attack:0", attempt: { attackMidiNumbers: [60] } });
    expect(repeated).toEqual({ accepted: false, reason: "not-practicing", state: completed });
  });

  it("rejects a stale target submission without grading the next target", () => {
    const source = piece([2]);
    const initial = initialized(source);
    const next = accepted(source, initial);
    const stale = submitPiecePracticeAttempt(source, next, { targetId: "m1:attack:0", attempt: { attackMidiNumbers: [60] } });
    expect(stale).toEqual({ accepted: false, reason: "stale-target", state: next });
  });

  it("starts at a middle measure", () => {
    expect(initialized(piece([1, 2, 1]), 1)).toMatchObject({ startMeasureIndex: 1, currentMeasureIndex: 1, currentTargetIndex: 0 });
  });

  it("does not count measures before the selected start as completed", () => {
    const state = initialized(piece([1, 1, 1]), 2);
    expect(state).toMatchObject({ completedMeasureCount: 0, completedMeasureIndexes: [] });
    expect(getPiecePracticeProgress(piece([1, 1, 1]), state, 1_000)).toMatchObject({ practiceMeasureCount: 1, practicedMeasureCount: 0 });
  });

  it("starts directly on a middle no-attack measure awaiting action", () => {
    expect(initialized(piece([1, 0, 1]), 1)).toMatchObject({ currentMeasureIndex: 1, currentTargetIndex: null, status: "awaiting-explicit-measure-advance" });
  });

  it("starts on and can complete the final normal measure", () => {
    const source = piece([1, 1, 1]);
    const state = accepted(source, initialized(source, 2));
    expect(state).toMatchObject({ status: "piece-complete", completedMeasureIndexes: [2], completedMeasureCount: 1 });
  });

  it.each([-1, 3, 1.5])("rejects invalid start index %s explicitly", (startMeasureIndex) => {
    expect(createPiecePracticeSession(piece([1, 1, 1]), { startMeasureIndex, startedAtMs: 0 })).toEqual({ ok: false, reason: "invalid-start-measure" });
  });

  it("restarts the current measure at its first target and reconciles target progress", () => {
    const source = piece([3]);
    let state = accepted(source, initialized(source));
    state = accepted(source, state);
    expect(restartCurrentPiecePracticeMeasure(source, state)).toMatchObject({ currentTargetIndex: 0, completedTargetCount: 0, status: "practicing" });
  });

  it("restarts a current no-attack measure without advancing it", () => {
    const source = piece([0, 1]);
    expect(restartCurrentPiecePracticeMeasure(source, initialized(source))).toMatchObject({ currentMeasureIndex: 0, currentTargetIndex: null, status: "awaiting-explicit-measure-advance" });
  });

  it("preserves earlier completed measures when restarting the current measure", () => {
    const source = piece([1, 2]);
    let state = accepted(source, initialized(source));
    state = accepted(source, state);
    const restarted = restartCurrentPiecePracticeMeasure(source, state);
    expect(restarted).toMatchObject({ currentMeasureIndex: 1, currentTargetIndex: 0, completedMeasureIndexes: [0], completedMeasureCount: 1, completedTargetCount: 1 });
  });

  it("keeps session mistakes when restarting the current measure", () => {
    const source = piece([2]);
    let state = accepted(source, initialized(source), [99]);
    state = accepted(source, state);
    expect(restartCurrentPiecePracticeMeasure(source, state)).toMatchObject({ incorrectAttemptCount: 1, currentTargetIncorrectAttemptCount: 0 });
  });

  it("can restart a just-completed final measure without double-counting", () => {
    const source = piece([1]);
    const completed = accepted(source, initialized(source));
    expect(restartCurrentPiecePracticeMeasure(source, completed)).toMatchObject({ status: "practicing", completedTargetCount: 0, completedMeasureCount: 0, completedMeasureIndexes: [] });
  });

  it("restarts the chosen practice range at its selected start measure", () => {
    const source = piece([1, 1, 1]);
    const completed = accepted(source, initialized(source, 1));
    expect(restartPiecePractice(source, completed, 5_000)).toMatchObject({ startMeasureIndex: 1, currentMeasureIndex: 1, currentTargetIndex: 0 });
  });

  it("clears completion and incorrect statistics on Restart Piece", () => {
    const source = piece([2]);
    let state = accepted(source, initialized(source), [99]);
    state = accepted(source, state);
    expect(restartPiecePractice(source, state, 5_000)).toMatchObject({ completedTargetCount: 0, completedMeasureCount: 0, completedMeasureIndexes: [], incorrectAttemptCount: 0, currentTargetIncorrectAttemptCount: 0 });
  });

  it("resets session timing on Restart Piece", () => {
    const source = piece([1]);
    const restarted = restartPiecePractice(source, initialized(source, 0, 1_000), 8_000);
    expect(restarted.startedAtMs).toBe(8_000);
    expect(getPiecePracticeElapsedMs(restarted, 8_750)).toBe(750);
  });

  it("derives progress and elapsed time from injected timestamps without timers", () => {
    const source = piece([1, 1, 1]);
    const state = accepted(source, initialized(source, 1, 2_000));
    expect(getPiecePracticeProgress(source, state, 3_250)).toEqual({
      currentMeasureNumber: 3,
      totalPieceMeasures: 3,
      practiceMeasureCount: 2,
      practicedMeasureCount: 1,
      completedTargetCount: 1,
      incorrectAttemptCount: 0,
      elapsedMs: 1_250,
      status: "practicing",
    });
  });

  it("clamps elapsed time at zero when a clock reading predates session start", () => {
    expect(getPiecePracticeElapsedMs(initialized(piece(), 0, 2_000), 1_500)).toBe(0);
  });

  it("does not mutate the Piece Practice projection through transitions", () => {
    const source = piece([2, 0]);
    const before = structuredClone(source);
    let state = initialized(source);
    state = accepted(source, state, [99]);
    state = accepted(source, state);
    state = restartCurrentPiecePracticeMeasure(source, state);
    restartPiecePractice(source, state, 5_000);
    expect(source).toEqual(before);
  });

  it("does not involve a Staff Builder score in the session API", () => {
    const source = piece([1]);
    expect(accepted(source, initialized(source))).toMatchObject({ status: "piece-complete" });
    expect(source.sourceScoreId).toBe("score");
  });

  it("produces equivalent state for repeated deterministic transition sequences", () => {
    const run = () => {
      const source = piece([2, 0]);
      let state = initialized(source);
      state = accepted(source, state, [99]);
      state = accepted(source, state);
      state = accepted(source, state);
      const advanced = advancePiecePracticeNoAttackMeasure(source, state);
      return advanced.advanced ? advanced.state : advanced;
    };
    expect(run()).toEqual(run());
  });
});

describe("Piece Practice rolled-chord checks", () => {
  it.each([
    [60, 1500], [96, 937.5], [120, 750], [180, 500],
  ])("uses a 1.5-quarter-beat window at %i BPM", (tempoBpm, expectedMs) => {
    expect(getPiecePracticeRolledWindowMs(tempoBpm)).toBe(expectedMs);
  });

  it("accumulates unique required tones in any order and ignores duplicate correct pitches", () => {
    const source = checkedPiece([check("rolled-chord", "roll", [48, 52, 55])]);
    let state = initialized(source, 0, 0);
    state = submitPiecePracticePitch(source, state, { targetId: "m1:attack:0", midiNumber: 55, atMs: 10 }).state;
    state = submitPiecePracticePitch(source, state, { targetId: "m1:attack:0", midiNumber: 55, atMs: 20 }).state;
    expect(state.currentCheckProgress[0]).toMatchObject({ accumulatedMidiNumbers: [55], startedAtMs: 10 });
    state = submitPiecePracticePitch(source, state, { targetId: "m1:attack:0", midiNumber: 48, atMs: 30 }).state;
    state = submitPiecePracticePitch(source, state, { targetId: "m1:attack:0", midiNumber: 52, atMs: 40 }).state;
    expect(state).toMatchObject({ status: "piece-complete", completedTargetCount: 1 });
  });

  it("records wrong pitches without starting, clearing, or extending the rolled window", () => {
    const source = checkedPiece([check("rolled-chord", "roll", [48, 52, 55])]);
    let state = initialized(source, 0, 0);
    state = submitPiecePracticePitch(source, state, { targetId: "m1:attack:0", midiNumber: 99, atMs: 10 }).state;
    expect(state.currentCheckProgress[0]).toMatchObject({ accumulatedMidiNumbers: [], startedAtMs: null });
    state = submitPiecePracticePitch(source, state, { targetId: "m1:attack:0", midiNumber: 48, atMs: 20 }).state;
    state = submitPiecePracticePitch(source, state, { targetId: "m1:attack:0", midiNumber: 98, atMs: 700 }).state;
    expect(state.currentCheckProgress[0]).toMatchObject({ accumulatedMidiNumbers: [48], startedAtMs: 20 });
    expect(state.incorrectAttemptCount).toBe(2);
  });

  it("expires only the incomplete roll and preserves completed parallel checks", () => {
    const source = checkedPiece([check("normal", "right", [72]), check("rolled-chord", "left", [48, 52, 55])]);
    let state = initialized(source, 0, 0);
    state = submitPiecePracticePitch(source, state, { targetId: "m1:attack:0", midiNumber: 72, atMs: 0 }).state;
    state = submitPiecePracticePitch(source, state, { targetId: "m1:attack:0", midiNumber: 48, atMs: 10 }).state;
    state = expirePiecePracticeRolledChecks(source, state, 760);
    expect(state.currentCheckProgress).toMatchObject([
      { checkId: "right", completed: true },
      { checkId: "left", completed: false, accumulatedMidiNumbers: [], startedAtMs: null },
    ]);
    expect(state.incorrectAttemptCount).toBe(1);
  });

  it("counts each independent rolled check that expires in the same pass", () => {
    const source = checkedPiece([check("rolled-chord", "lower", [48, 52]), check("rolled-chord", "upper", [60, 64])]);
    let state = initialized(source, 0, 0);
    state = submitPiecePracticePitch(source, state, { targetId: "m1:attack:0", midiNumber: 48, atMs: 0 }).state;
    state = submitPiecePracticePitch(source, state, { targetId: "m1:attack:0", midiNumber: 60, atMs: 10 }).state;
    state = expirePiecePracticeRolledChecks(source, state, 760);
    expect(state.currentCheckProgress).toMatchObject([
      { checkId: "lower", accumulatedMidiNumbers: [], startedAtMs: null },
      { checkId: "upper", accumulatedMidiNumbers: [], startedAtMs: null },
    ]);
    expect(state).toMatchObject({ incorrectAttemptCount: 2, currentTargetIncorrectAttemptCount: 2 });
  });

  it("lets the expiry-triggering required pitch immediately start a fresh attempt", () => {
    const source = checkedPiece([check("rolled-chord", "roll", [48, 52])]);
    let state = initialized(source, 0, 0);
    state = submitPiecePracticePitch(source, state, { targetId: "m1:attack:0", midiNumber: 48, atMs: 0 }).state;
    state = submitPiecePracticePitch(source, state, { targetId: "m1:attack:0", midiNumber: 52, atMs: 750 }).state;
    expect(state.currentCheckProgress[0]).toMatchObject({ accumulatedMidiNumbers: [52], startedAtMs: 750 });
    expect(state.incorrectAttemptCount).toBe(1);
  });

  it("allows one pitch to satisfy every pending check that expects it", () => {
    const source = checkedPiece([check("normal", "normal", [60]), check("rolled-chord", "roll", [60, 64])]);
    let state = initialized(source, 0, 0);
    state = submitPiecePracticePitch(source, state, { targetId: "m1:attack:0", midiNumber: 60, atMs: 0 }).state;
    expect(state.currentCheckProgress).toMatchObject([{ completed: true }, { accumulatedMidiNumbers: [60] }]);
  });

  it.each([
    [72, 48, 52, 55],
    [48, 52, 72, 55],
    [48, 52, 55, 72],
  ])("completes same-onset normal and rolled checks with the normal note first, middle, or last", (...midiNumbers) => {
    const source = checkedPiece([check("normal", "right", [72]), check("rolled-chord", "left", [48, 52, 55])]);
    let state = initialized(source, 0, 0);
    midiNumbers.forEach((midiNumber, index) => {
      state = submitPiecePracticePitch(source, state, { targetId: "m1:attack:0", midiNumber, atMs: index * 100 }).state;
      if (index < midiNumbers.length - 1) expect(state.completedTargetCount).toBe(0);
    });
    expect(state).toMatchObject({ status: "piece-complete", completedTargetCount: 1 });
  });

  it("clears partial rolled state on measure and piece restart", () => {
    const source = checkedPiece([check("rolled-chord", "roll", [48, 52])]);
    const partial = submitPiecePracticePitch(source, initialized(source, 0, 0), { targetId: "m1:attack:0", midiNumber: 48, atMs: 10 }).state;
    expect(restartCurrentPiecePracticeMeasure(source, partial).currentCheckProgress[0]).toMatchObject({ accumulatedMidiNumbers: [], startedAtMs: null });
    expect(restartPiecePractice(source, partial, 100).currentCheckProgress[0]).toMatchObject({ accumulatedMidiNumbers: [], startedAtMs: null });
  });
});
