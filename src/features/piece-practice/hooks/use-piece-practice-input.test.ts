import { act, renderHook } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPiecePracticeSession, pausePiecePracticeClock, resumePiecePracticeClock, restartCurrentPiecePracticeMeasure, restartPiecePractice, type PiecePracticeSessionState } from "../piece-practice-session";
import type { MidiConnectionStatus, MidiReleaseObservation } from "@/hooks/use-midi";
import type { PiecePracticePiece, PiecePracticeTarget } from "../piece-practice-types";
import { usePiecePracticeInput } from "./use-piece-practice-input";
import { focusPiecePracticeProjection } from "../piece-practice-projection";
import type { PiecePracticeAssessmentFocus } from "../piece-practice-assessment";
import { formatPiecePracticeReport } from "../piece-practice-report";

const midiMock = vi.hoisted(() => ({
  mountCount: 0, unmountCount: 0,
  status: "connected" as MidiConnectionStatus,
  options: null as null | { onHeldNotesChanged?: (notes: ReadonlySet<number>) => void; onNotePlayed: (midiNumber: number, attackVelocity?: number, sourceTimeStampMs?: number) => void; onNoteReleased?: (release: MidiReleaseObservation) => void },
}));

vi.mock("@/hooks/use-app-midi-input", () => ({
  useAppMidiInput: (options: typeof midiMock.options) => {
    midiMock.options = options;
    useEffect(() => {
      midiMock.mountCount += 1;
      return () => { midiMock.unmountCount += 1; };
    }, []);
    return { connectMidi: vi.fn(), deviceName: "Test MIDI", error: null, status: midiMock.status };
  },
}));

function target(measureIndex: number, targetIndex: number, expectedMidiNumbers: readonly number[]): PiecePracticeTarget {
  const base: Omit<PiecePracticeTarget, "checks"> = {
    id: `m${measureIndex}:attack:${targetIndex * 480}`, measureIndex, sourceMeasureId: `m${measureIndex}`,
    startTick: targetIndex * 480, absoluteStartTick: measureIndex * 1920 + targetIndex * 480,
    sourceEventIds: [`event-${measureIndex}-${targetIndex}`], expectedMidiNumbers,
    attackedPitches: expectedMidiNumbers.map((midiNumber, index) => ({
      sourceEventId: `event-${measureIndex}-${targetIndex}`, sourcePitchId: `p-${index}`, staff: "treble",
      midiNumber, letter: "C", accidental: "natural", octave: 4, duration: "quarter", durationTicks: 480,
      incomingTieIds: [], outgoingTieIds: [],
    })),
  };
  return { ...base, checks: [{ id: `${base.id}:normal`, kind: "normal", sourceEventIds: base.sourceEventIds, expectedMidiNumbers, attackedPitches: base.attackedPitches }] };
}

function piece(targetsByMeasure: readonly (readonly (readonly number[])[])[] = [[[60], [64]]]): PiecePracticePiece {
  return {
    sourceScoreId: "score", sourceScoreUpdatedAt: "now", title: "Input study", tempoBpm: 96,
    measures: targetsByMeasure.map((targetSets, measureIndex) => ({
      measureIndex, sourceMeasureId: `m${measureIndex}`, absoluteStartTick: measureIndex * 1920, capacityTicks: 1920,
      keySignatureId: "c-major", timeSignature: "4/4", clefs: { treble: "treble", bass: "bass" }, sourceEvents: [], restEventIds: targetSets.length ? [] : [`rest-${measureIndex}`],
      targets: targetSets.map((notes, targetIndex) => target(measureIndex, targetIndex, notes)),
    })),
  };
}

function rolledPiece(normalMidiNumbers: readonly number[] = [72]): PiecePracticePiece {
  const source = piece([[[...normalMidiNumbers, 48, 52, 55]]]);
  const original = source.measures[0]!.targets[0]!;
  const normalPitches = original.attackedPitches.filter(({ midiNumber }) => normalMidiNumbers.includes(midiNumber));
  const rolledPitches = original.attackedPitches.filter(({ midiNumber }) => !normalMidiNumbers.includes(midiNumber));
  const checks = [
    { id: `${original.id}:normal`, kind: "normal" as const, sourceEventIds: ["right"], expectedMidiNumbers: normalMidiNumbers, attackedPitches: normalPitches },
    { id: `${original.id}:rolled:left`, kind: "rolled-chord" as const, direction: "up" as const, sourceEventIds: ["left"], expectedMidiNumbers: [48, 52, 55], attackedPitches: rolledPitches },
  ];
  return { ...source, measures: [{ ...source.measures[0]!, targets: [{ ...original, checks }] }] };
}

function staffedPiece(source: PiecePracticePiece, focus: PiecePracticeAssessmentFocus, lowerMidiNumbers: readonly number[]): PiecePracticePiece {
  const lower = new Set(lowerMidiNumbers);
  const withStaff = { ...source, measures: source.measures.map((measure) => ({ ...measure, targets: measure.targets.map((item) => ({
    ...item,
    attackedPitches: item.attackedPitches.map((pitch) => ({ ...pitch, staff: lower.has(pitch.midiNumber) ? "bass" as const : "treble" as const })),
    checks: item.checks.map((check) => ({ ...check, attackedPitches: check.attackedPitches.map((pitch) => ({ ...pitch, staff: lower.has(pitch.midiNumber) ? "bass" as const : "treble" as const })) })),
  })) })) };
  return focusPiecePracticeProjection(withStaff, focus);
}

function initial(source: PiecePracticePiece): PiecePracticeSessionState {
  const result = createPiecePracticeSession(source, { startMeasureIndex: 0, startedAtMs: 0 });
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

function setup(source = piece(), now?: () => number) {
  let state = initial(source);
  const onSessionStateChange = vi.fn((next: PiecePracticeSessionState) => { state = next; });
  const rendered = renderHook(({ sessionState }) => usePiecePracticeInput({ piece: source, sessionState, onSessionStateChange, now }), {
    initialProps: { sessionState: state },
  });
  const sync = () => rendered.rerender({ sessionState: state });
  return { ...rendered, getState: () => state, onSessionStateChange, sync };
}

function midiHeld(...notes: number[]) {
  act(() => midiMock.options?.onHeldNotesChanged?.(new Set(notes)));
}

function midiNote(note: number) {
  act(() => midiMock.options?.onNotePlayed(note));
}

describe("Piece Practice physical transition grace", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); midiMock.status = "connected"; midiMock.options = null; });
  afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); midiMock.status = "connected"; });

  function practice(source = piece([[[81], [79], [77], [76]]]), now = () => Date.now()) {
    const view = setup(source, now);
    const held = new Set<number>();
    const press = (note: number, velocity = 66, sourceTimeStampMs?: number) => {
      held.add(note);
      act(() => {
        midiMock.options?.onHeldNotesChanged?.(new Set(held));
        midiMock.options?.onNotePlayed(note, velocity, sourceTimeStampMs);
      });
      view.sync();
    };
    const release = (note: number, encoding: MidiReleaseObservation["encoding"] = "note-off", releaseVelocity?: number) => {
      held.delete(note);
      act(() => {
        midiMock.options?.onHeldNotesChanged?.(new Set(held));
        midiMock.options?.onNoteReleased?.({ midiNumber: note, encoding, ...(releaseVelocity === undefined ? {} : { releaseVelocity }) });
      });
      view.sync();
    };
    const tick = (ms: number) => { act(() => vi.advanceTimersByTime(ms)); view.sync(); };
    return { ...view, press, release, tick };
  }

  it("accepts a detached A5 to G5 transition", () => {
    const view = practice(); view.press(81); view.release(81); view.tick(251); view.press(79);
    expect(view.getState().completedTargetCount).toBe(2); expect(view.getState().mistakeEvidence).toEqual([]);
  });

  it("accepts legato immediately even when predecessor completion was more than 250ms ago, without retrospective failure", () => {
    const view = practice(); view.press(81); view.tick(251); view.press(79);
    expect(view.getState().completedTargetCount).toBe(2);
    view.tick(500); expect(view.getState().completedTargetCount).toBe(2); expect(view.getState().mistakeEvidence).toEqual([]);
    view.release(81); expect(view.getState().mistakeEvidence).toEqual([]);
    expect(view.getState().releaseEvidence?.[0]).toMatchObject({ midiNumber: 81, occurredAtActiveMs: 751 });
  });

  it("accepts several connected notes without falling behind", () => {
    const view = practice(); view.press(81); view.tick(251); view.press(79); view.tick(42); view.release(81);
    view.tick(243); view.press(77); view.tick(40); view.release(79); view.tick(219); view.press(76); view.release(77);
    expect(view.getState()).toMatchObject({ completedTargetCount: 4, status: "piece-complete", mistakeEvidence: [] });
    expect(view.getState().attackEvidence?.map(({ midiNumber }) => midiNumber)).toEqual([81, 79, 77, 76]);
  });

  it.each([20, 260])("does not grant an older A5 another transition allowance at the next observation after %sms", (delay) => {
    const view = practice(); view.press(81); view.press(79); view.tick(delay); view.press(77);
    expect(view.getState().completedTargetCount).toBe(2);
    expect(view.result.current.feedback.grade).toMatchObject({ correct: false, unexpectedHeldMidiNumbers: [81] });
  });

  it("starts grace on the first attack and never renews it on retries, snapshots, other attacks, or releases", () => {
    const view = practice(piece([[[81], [79, 77]]])); view.press(81); view.press(79); view.tick(225);
    expect(view.getState().mistakeEvidence).toHaveLength(1);
    view.tick(26); midiHeld(81, 79); view.release(99); view.press(79); view.tick(10); view.press(77); view.tick(215);
    expect(view.getState().completedTargetCount).toBe(1);
    expect(view.result.current.feedback.grade).toMatchObject({ missingMidiNumbers: [], extraMidiNumbers: [], unexpectedHeldMidiNumbers: [81] });
  });

  it.each([81, 82])("fails a wrong NEW %s attack immediately even with correct chord attacks and eligible held carryover", (wrong) => {
    const view = practice(piece([[[81], [79, 77]]])); view.press(81); view.press(79); view.press(77); view.press(wrong);
    expect(view.getState().mistakeEvidence).toHaveLength(1);
    expect(view.result.current.feedback.grade).toMatchObject({ correct: false, extraMidiNumbers: [wrong], missingMidiNumbers: [] });
    expect(view.getState().completedTargetCount).toBe(1);
  });

  it("fails a new predecessor A5 attack against single G5 immediately; a later correct G5 cannot erase the mistake", () => {
    const view = practice(); view.press(81); view.press(81);
    expect(view.result.current.feedback.grade).toMatchObject({ correct: false, extraMidiNumbers: [81], missingMidiNumbers: [79] });
    view.press(79); expect(view.getState().completedTargetCount).toBe(2); expect(view.getState().mistakeEvidence).toHaveLength(1);
  });

  it.each([
    { name: "chord to chord", previous: [81, 85], current: [79, 83] },
    { name: "chord to note", previous: [81, 85], current: [79] },
    { name: "note to chord", previous: [81], current: [79, 83] },
  ])("accepts eligible $name overlap", ({ previous, current }) => {
    const view = practice(piece([[previous, current]])); previous.forEach((pitch) => view.press(pitch));
    if (previous.length > 1) view.tick(225);
    view.tick(100); current.forEach((pitch) => view.press(pitch));
    if (current.length > 1) view.tick(225);
    expect(view.getState()).toMatchObject({ completedTargetCount: 2, status: "piece-complete", mistakeEvidence: [] });
  });

  it("uses actual chord attack times instead of a timer callback arriving after 250ms", () => {
    let observedAt = 0;
    const view = practice(piece([[[81], [79, 77]]]), () => observedAt);
    view.press(81); observedAt = 1000; view.press(79); observedAt = 1080; view.press(77);
    observedAt = 1275; view.tick(225);
    expect(view.getState()).toMatchObject({ status: "piece-complete", mistakeEvidence: [] });
  });

  it("retains eligibility for a retry attacked inside the original grace even when collection finishes later", () => {
    const view = practice(piece([[[81], [79, 77]]])); view.press(81); view.press(79); view.tick(225);
    view.tick(15); view.press(79); view.tick(5); view.press(77); view.tick(220);
    expect(view.getState()).toMatchObject({ status: "piece-complete", completedTargetCount: 2 });
    expect(view.getState().mistakeEvidence).toHaveLength(1);
  });

  it("does not excuse actual late chord attacks merely because the timer was late", () => {
    let observedAt = 0;
    const view = practice(piece([[[81], [79, 77]]]), () => observedAt);
    view.press(81); observedAt = 1000; view.press(79); observedAt = 1260; view.press(77); view.tick(225);
    expect(view.result.current.feedback.grade).toMatchObject({ correct: false, unexpectedHeldMidiNumbers: [81] });
  });

  it("records the entire rolled target as predecessor only after its last check completes", () => {
    const rolled = rolledPiece(); const first = rolled.measures[0]!.targets[0]!;
    const source = { ...rolled, measures: [{ ...rolled.measures[0]!, targets: [first, target(0, 1, [79])] }] };
    const view = practice(source); [48, 72, 52].forEach((pitch) => view.press(pitch));
    expect(view.getState().completedTargetCount).toBe(0);
    view.press(55); expect(view.getState().completedTargetCount).toBe(1);
    view.press(79); expect(view.getState()).toMatchObject({ status: "piece-complete", mistakeEvidence: [] });
  });

  it.each(["measure", "piece"] as const)("clears predecessor and release evidence according to Restart %s semantics", (scope) => {
    const source = piece([[[81], [79]]]); const view = practice(source); view.press(81); view.release(99);
    const restarted = scope === "measure" ? restartCurrentPiecePracticeMeasure(source, view.getState(), Date.now())
      : restartPiecePractice(source, view.getState(), Date.now());
    act(() => { view.result.current.resetInput(); view.onSessionStateChange(restarted); }); view.sync();
    view.press(79); expect(view.result.current.feedback.grade).toMatchObject({ correct: false, extraMidiNumbers: [79] });
    if (scope === "piece") expect(view.getState().releaseEvidence).toBeUndefined();
    else expect(view.getState().releaseEvidence).toHaveLength(1);
  });

  it("clears predecessor on skip without granting a skipped target predecessor status", () => {
    const view = practice(); view.press(81); act(() => view.result.current.skipCurrentTarget()); view.sync(); view.press(77);
    expect(view.result.current.feedback.grade).toMatchObject({ correct: false, unexpectedHeldMidiNumbers: [81] });
  });

  it("requires repeated C5 attacks but keeps the existing first-release-clears-Set limitation", () => {
    const view = practice(piece([[[72], [72], [79]]])); view.press(72, 54); view.press(72, 91);
    expect(view.getState().completedTargetCount).toBe(2); expect(view.result.current.midiHeldNotes).toEqual(new Set([72]));
    view.release(72); expect(view.result.current.midiHeldNotes.size).toBe(0); view.release(72); view.press(79);
    expect(view.getState()).toMatchObject({ completedTargetCount: 3, mistakeEvidence: [] });
    expect(view.getState().attackEvidence?.map(({ attackVelocity }) => attackVelocity)).toEqual([54, 91, 66]);
    expect(view.getState().releaseEvidence?.map(({ midiNumber }) => midiNumber)).toEqual([72, 72]);
  });

  it("does not revive predecessor eligibility after a new excerpt/session reset", () => {
    const source = piece([[[81]], [[79], [77]]]); const view = practice(source); view.press(81);
    const newSession = createPiecePracticeSession(source, { startMeasureIndex: 1, endMeasureIndex: 1, startedAtMs: 1000 });
    if (!newSession.ok) throw new Error(newSession.reason);
    act(() => view.onSessionStateChange(newSession.state)); view.sync(); view.press(79);
    expect(view.result.current.feedback.grade).toMatchObject({ correct: false, unexpectedHeldMidiNumbers: [81] });
    expect(view.getState().completedTargetCount).toBe(0);
  });

  it("clears predecessor across pause/resume, ignores paused input, and does not revive grace", () => {
    const view = practice(); view.press(81);
    act(() => view.onSessionStateChange(pausePiecePracticeClock(view.getState(), Date.now()))); view.sync();
    view.press(79); view.release(99); expect(view.getState().completedTargetCount).toBe(1); expect(view.getState().releaseEvidence).toBeUndefined();
    view.tick(1000); act(() => view.onSessionStateChange(resumePiecePracticeClock(view.getState(), Date.now()))); view.sync(); view.press(79);
    expect(view.result.current.feedback.grade).toMatchObject({ correct: false, unexpectedHeldMidiNumbers: [81] });
  });

  it("clears predecessor on disconnect/reconnect without manufacturing release evidence", () => {
    const view = practice(); view.press(81); midiMock.status = "disconnected"; midiHeld(); view.sync();
    expect(view.getState().releaseEvidence).toBeUndefined();
    midiMock.status = "connected"; view.sync(); view.press(79);
    expect(view.result.current.feedback.grade).toMatchObject({ correct: false, unexpectedHeldMidiNumbers: [81] });
  });

  it.each(["note-off", "note-on-zero"] as const)("retains %s release evidence and exact separate attack evidence", (encoding) => {
    const view = practice(); view.press(81, 54, 10.25); view.tick(10); view.press(81, 91, 20.25);
    view.tick(10); view.release(81, encoding, encoding === "note-off" ? 32 : undefined);
    expect(view.result.current.midiHeldNotes.size).toBe(0);
    expect(view.getState().attackEvidence?.map(({ midiNumber, attackVelocity, occurredAtActiveMs, sourceTimeStampMs }) => [midiNumber, attackVelocity, occurredAtActiveMs, sourceTimeStampMs])).toEqual([[81, 54, 0, 10.25], [81, 91, 10, 20.25]]);
    expect(view.getState().releaseEvidence?.[0]).toMatchObject({ midiNumber: 81, encoding, occurredAtActiveMs: 20 });
    view.release(81, encoding); expect(view.getState().releaseEvidence).toHaveLength(2);
  });
});

describe("Piece Practice recovered physical state", () => {
  it("ignores provider-held notes from before recovery and their eventual release", () => {
    const source = piece();
    let state = initial(source);
    const view = renderHook(() => usePiecePracticeInput({ piece: source, sessionState: state, resetHeldOnMount: true,
      now: () => 100, onSessionStateChange: (next) => { state = next; } }));
    act(() => midiMock.options?.onHeldNotesChanged?.(new Set([60])));
    expect([...view.result.current.midiHeldNotes]).toEqual([]);
    act(() => midiMock.options?.onHeldNotesChanged?.(new Set()));
    act(() => midiMock.options?.onNoteReleased?.({ midiNumber: 60, encoding: "note-off", releaseVelocity: 12 }));
    expect(state.releaseEvidence).toBeUndefined();
    act(() => midiMock.options?.onHeldNotesChanged?.(new Set([60])));
    expect([...view.result.current.midiHeldNotes]).toEqual([60]);
  });
});

describe("usePiecePracticeInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    midiMock.mountCount = 0;
    midiMock.unmountCount = 0;
    midiMock.options = null;
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("arms the first physical target on an incorrect Note On, excluding setup delay", () => {
    vi.setSystemTime(0);
    const view = setup(piece([[[60]]]), () => Date.now());
    act(() => vi.advanceTimersByTime(8_000));
    midiNote(61); view.sync();
    expect(view.getState()).toMatchObject({ currentTargetActivatedAtActiveMs: 8_000, firstTargetTimingPending: true });
    expect(view.getState().mistakeEvidence).toHaveLength(1);
    act(() => vi.advanceTimersByTime(900));
    midiNote(60);
    expect(view.getState().targetTimings[0]).toMatchObject({ timingBasis: "first-attempt", activatedAtActiveMs: 8_000, responseDurationMs: 900, isHesitation: false });
    expect(view.getState().completedAtActiveMs).toBe(8_900);
  });

  it("arms the first block chord at its first physical Note On", () => {
    vi.setSystemTime(0);
    const view = setup(piece([[[60, 64, 67]]]), () => Date.now());
    act(() => vi.advanceTimersByTime(8_000));
    midiNote(60); view.sync();
    expect(view.getState().currentTargetActivatedAtActiveMs).toBe(8_000);
    act(() => vi.advanceTimersByTime(100));
    midiNote(64); midiNote(67);
    act(() => vi.advanceTimersByTime(125));
    expect(view.getState().targetTimings[0]).toMatchObject({ timingBasis: "first-attempt", activatedAtActiveMs: 8_000, responseDurationMs: 225 });
  });

  it("arms the first rolled target at its first physical Note On", () => {
    vi.setSystemTime(0);
    const view = setup(rolledPiece(), () => Date.now());
    act(() => vi.advanceTimersByTime(8_000));
    midiNote(48); view.sync();
    expect(view.getState().currentTargetActivatedAtActiveMs).toBe(8_000);
    act(() => vi.advanceTimersByTime(100));
    midiNote(52); view.sync();
    midiNote(72); view.sync();
    act(() => vi.advanceTimersByTime(100));
    midiNote(55);
    expect(view.getState().targetTimings[0]).toMatchObject({ timingBasis: "first-attempt", activatedAtActiveMs: 8_000, responseDurationMs: 200 });
  });

  it("arms the first virtual-keyboard target on its first selection", () => {
    vi.setSystemTime(0);
    const view = setup(piece([[[60, 64]]]), () => Date.now());
    act(() => vi.advanceTimersByTime(8_000));
    act(() => view.result.current.onVirtualNoteToggle(60)); view.sync();
    expect(view.getState().currentTargetActivatedAtActiveMs).toBe(8_000);
    act(() => vi.advanceTimersByTime(300));
    act(() => view.result.current.onVirtualNoteToggle(64));
    expect(view.getState().targetTimings[0]).toMatchObject({ timingBasis: "first-attempt", activatedAtActiveMs: 8_000, responseDurationMs: 300 });
  });

  it("submits correct and incorrect physical single notes through Phase B exactly once", () => {
    const view = setup(piece([[[60]]]));
    midiHeld(61);
    midiNote(61);
    expect(view.getState()).toMatchObject({ currentTargetIndex: 0, status: "practicing" }); expect(view.getState().mistakeEvidence).toHaveLength(1);
    midiHeld(60);
    midiNote(60);
    expect(view.getState()).toMatchObject({ completedTargetCount: 1, status: "piece-complete" });
    midiNote(60);
    expect(view.onSessionStateChange).toHaveBeenCalledTimes(3);
  });

  it("rejects an unrelated held pitch on an otherwise correct single attack", () => {
    const view = setup(piece([[[60]]]));
    midiHeld(48, 60);
    midiNote(60);
    expect(view.result.current.feedback.grade).toMatchObject({ correct: false, unexpectedHeldMidiNumbers: [48] });
  });

  it("collects block physical chords for 225ms with order and duplicate independence", () => {
    const view = setup(piece([[[60, 64, 67]]]));
    midiHeld(67, 60, 64);
    midiNote(67);
    midiNote(60);
    midiNote(60);
    act(() => vi.advanceTimersByTime(224));
    expect(view.onSessionStateChange).toHaveBeenCalledTimes(1);
    expect(view.getState()).toMatchObject({ currentTargetActivatedAtActiveMs: 0, firstTargetTimingPending: true });
    midiNote(64);
    act(() => vi.advanceTimersByTime(1));
    expect(view.getState()).toMatchObject({ status: "piece-complete", completedTargetCount: 1 });
  });

  it("preserves one pending physical chord collector through a same-target presentation rerender", () => {
    const view = setup(piece([[[60, 64, 67]]]));
    midiHeld(60, 64, 67);
    midiNote(60);
    view.sync();
    midiNote(64);
    midiNote(67);
    act(() => vi.advanceTimersByTime(225));

    expect(view.onSessionStateChange).toHaveBeenCalledTimes(2);
    expect(view.getState()).toMatchObject({ status: "piece-complete", completedTargetCount: 1 });
    expect(midiMock.mountCount).toBe(1);
    expect(midiMock.unmountCount).toBe(0);
  });

  it.each([
    { name: "missing", played: [60, 64], held: [60, 64] },
    { name: "extra", played: [60, 64, 67, 69], held: [60, 64, 67, 69] },
  ])("keeps a $name physical chord blocked for retry", ({ played, held }) => {
    const view = setup(piece([[[60, 64, 67]]]));
    midiHeld(...held);
    played.forEach(midiNote);
    act(() => vi.advanceTimersByTime(225));
    expect(view.getState()).toMatchObject({ currentTargetIndex: 0, completedTargetCount: 0 }); expect(view.getState().mistakeEvidence).toHaveLength(1);
  });

  it("discards a stale chord collector after an external target transition", () => {
    const source = piece([[[60, 64], [67]]]);
    const view = setup(source);
    midiNote(60);
    const moved = { ...view.getState(), currentTargetIndex: 1 };
    view.rerender({ sessionState: moved });
    view.onSessionStateChange.mockClear();
    act(() => vi.advanceTimersByTime(225));
    expect(view.onSessionStateChange).not.toHaveBeenCalled();
  });

  it.each(["measure", "piece"])("cancels collection on Restart %s input reset", () => {
    const view = setup(piece([[[60, 64]]]));
    midiNote(60);
    act(() => view.result.current.resetInput());
    view.onSessionStateChange.mockClear();
    act(() => vi.advanceTimersByTime(225));
    expect(view.onSessionStateChange).not.toHaveBeenCalled();
  });

  it("cancels a pending chord timer on unmount", () => {
    const view = setup(piece([[[60, 64]]]));
    midiNote(60);
    view.unmount();
    view.onSessionStateChange.mockClear();
    act(() => vi.advanceTimersByTime(225));
    expect(view.onSessionStateChange).not.toHaveBeenCalled();
  });

  it("skips through the input owner and clears chord, virtual-selection, and feedback state", () => {
    const physical = setup(piece([[[60, 64], [67]]]));
    midiHeld(61);
    midiNote(61);
    act(() => vi.advanceTimersByTime(225));
    expect(physical.result.current.feedback.status).toBe("incorrect");
    midiNote(60);
    expect([...physical.result.current.midiChordAttemptMidiNumbers]).toEqual([60]);
    act(() => expect(physical.result.current.skipCurrentTarget()).toBe(true));
    expect(physical.getState()).toMatchObject({ currentTargetIndex: 1, completedTargetCount: 0, skippedTargetCount: 1 });
    expect(physical.result.current.feedback.status).toBe("idle");
    expect(physical.result.current.midiChordAttemptMidiNumbers.size).toBe(0);
    act(() => vi.advanceTimersByTime(225));
    expect(physical.onSessionStateChange).toHaveBeenCalledTimes(3);
    physical.unmount();

    const virtual = setup(piece([[[60, 64, 67], [72]]]));
    act(() => virtual.result.current.onVirtualNoteToggle(60));
    expect([...virtual.result.current.virtualSelectedMidiNumbers]).toEqual([60]);
    act(() => expect(virtual.result.current.skipCurrentTarget()).toBe(true));
    expect(virtual.result.current.virtualSelectedMidiNumbers.size).toBe(0);
    expect(virtual.getState()).toMatchObject({ currentTargetIndex: 1, completedTargetCount: 0, skippedTargetCount: 1 });
  });

  it("allows a pitch only while its authored sounding span covers the later target", () => {
    const source = { ...piece([[[60], [64], [67]]]), soundingSpans: [{ originEventId: "event-0-0", originPitchId: "p-0", staff: "treble" as const, midiNumber: 60, attackTick: 0, endTick: 960, endpointKeys: ["event-0-0:p-0"] }] };
    const view = setup(source);
    midiHeld(60);
    midiNote(60);
    view.sync();
    midiHeld(60, 64);
    midiNote(64);
    expect(view.getState()).toMatchObject({ currentTargetIndex: 2 }); expect(view.getState().mistakeEvidence).toHaveLength(0);
    view.sync();
    midiHeld(60, 67);
    midiNote(67);
    expect(view.result.current.feedback.grade).toMatchObject({ correct: false, unexpectedHeldMidiNumbers: [60] });
  });

  it("does not let a lingering held pitch satisfy a missing new attack", () => {
    const view = setup(piece([[[60], [64]]]));
    midiHeld(60); midiNote(60); view.sync();
    midiHeld(60); midiNote(60);
    expect(view.result.current.feedback.grade).toMatchObject({ correct: false, missingMidiNumbers: [64], extraMidiNumbers: [60] });
  });

  it("allows an incoming tied pitch only as held while requiring every new chord attack", () => {
    const source = piece([[[64, 67]]]);
    const currentTarget = source.measures[0]!.targets[0]!;
    const laterTarget = { ...currentTarget, startTick: 480, absoluteStartTick: 480 };
    const tiedSource: PiecePracticePiece = { ...source, soundingSpans: [{ originEventId: "origin", originPitchId: "origin-p", staff: "treble", midiNumber: 60, attackTick: 0, endTick: 960, endpointKeys: ["origin:origin-p", "destination:c"] }], measures: [{ ...source.measures[0]!, sourceEvents: [{
      sourceEventId: "destination", kind: "notes", staff: "treble", startTick: 0, absoluteStartTick: 0,
      duration: "quarter", durationTicks: 480, pitches: [{ sourcePitchId: "c", midiNumber: 60, letter: "C", accidental: "natural", octave: 4, incomingTieIds: ["tie"], outgoingTieIds: [], requiresAttack: false }],
    }], targets: [{ ...laterTarget, sourceEventIds: ["destination", ...currentTarget.sourceEventIds] }] }] };
    const view = setup(tiedSource);
    midiHeld(60, 64, 67); midiNote(64); midiNote(67); act(() => vi.advanceTimersByTime(225));
    expect(view.getState().status).toBe("piece-complete");
  });

  it("still rejects a missing untied chord pitch and unrelated held pitch beside a tie", () => {
    const source = piece([[[64, 67]]]);
    const currentTarget = source.measures[0]!.targets[0]!;
    const laterTarget = { ...currentTarget, startTick: 480, absoluteStartTick: 480 };
    const tiedSource: PiecePracticePiece = { ...source, soundingSpans: [{ originEventId: "origin", originPitchId: "origin-p", staff: "treble", midiNumber: 60, attackTick: 0, endTick: 960, endpointKeys: ["origin:origin-p", "destination:c"] }], measures: [{ ...source.measures[0]!, sourceEvents: [{
      sourceEventId: "destination", kind: "notes", staff: "treble", startTick: 0, absoluteStartTick: 0,
      duration: "quarter", durationTicks: 480, pitches: [{ sourcePitchId: "c", midiNumber: 60, letter: "C", accidental: "natural", octave: 4, incomingTieIds: ["tie"], outgoingTieIds: [], requiresAttack: false }],
    }], targets: [{ ...laterTarget, sourceEventIds: ["destination"] }] }] };
    const view = setup(tiedSource);
    midiHeld(48, 60, 64); midiNote(64); act(() => vi.advanceTimersByTime(225));
    expect(view.result.current.feedback.grade).toMatchObject({ correct: false, missingMidiNumbers: [67], unexpectedHeldMidiNumbers: [48] });
  });

  it("submits virtual singles immediately and keeps wrong answers blocked", () => {
    const view = setup(piece([[[60]]]));
    act(() => view.result.current.onVirtualNoteToggle(61));
    expect(view.getState()).toMatchObject({ status: "practicing" }); expect(view.getState().mistakeEvidence).toHaveLength(1);
    act(() => view.result.current.onVirtualNoteToggle(60));
    expect(view.getState().status).toBe("piece-complete");
  });

  it("persists, toggles, and cardinality-submits a virtual chord, then clears selection", () => {
    const view = setup(piece([[[60, 64, 67]]]));
    act(() => view.result.current.onVirtualNoteToggle(60));
    act(() => view.result.current.onVirtualNoteToggle(64));
    act(() => view.result.current.onVirtualNoteToggle(64));
    expect([...view.result.current.virtualSelectedMidiNumbers]).toEqual([60]);
    act(() => view.result.current.onVirtualNoteToggle(64));
    act(() => view.result.current.onVirtualNoteToggle(67));
    expect(view.getState().status).toBe("piece-complete");
    expect(view.result.current.virtualSelectedMidiNumbers.size).toBe(0);
  });

  it("preserves a partial virtual chord through a same-target presentation rerender", () => {
    const view = setup(piece([[[60, 64, 67]]]));
    act(() => view.result.current.onVirtualNoteToggle(60));
    view.sync();

    expect([...view.result.current.virtualSelectedMidiNumbers]).toEqual([60]);
    act(() => view.result.current.onVirtualNoteToggle(64));
    expect([...view.result.current.virtualSelectedMidiNumbers].sort()).toEqual([60, 64]);
    expect(midiMock.mountCount).toBe(1);
    expect(midiMock.unmountCount).toBe(0);
  });

  it("clears a wrong virtual chord for retry and never merges MIDI and virtual attacks", () => {
    const view = setup(piece([[[60, 64]]]));
    midiNote(60);
    act(() => view.result.current.onVirtualNoteToggle(64));
    expect(view.result.current.midiChordAttemptMidiNumbers.size).toBe(0);
    act(() => view.result.current.onVirtualNoteToggle(67));
    expect(view.getState()).toMatchObject({ status: "practicing" }); expect(view.getState().mistakeEvidence).toHaveLength(1);
    expect(view.result.current.virtualSelectedMidiNumbers.size).toBe(0);
  });

  it("keeps one MIDI owner across retries, target and measure changes, then cleans up on unmount", () => {
    const source = piece([[[60]], [[64]]]);
    const view = setup(source);
    midiNote(61); view.sync();
    midiNote(60); view.sync();
    midiNote(64); view.sync();
    expect(midiMock.mountCount).toBe(1);
    expect(midiMock.unmountCount).toBe(0);
    view.unmount();
    expect(midiMock.unmountCount).toBe(1);
  });

  it.each([piece([[]]), piece([[[60]]])])("ignores note input when no attack target is active", (source) => {
    const view = setup(source);
    if (source.measures[0]!.targets.length) {
      midiNote(60); view.sync();
    }
    midiNote(60);
    expect(view.onSessionStateChange).toHaveBeenCalledTimes(source.measures[0]!.targets.length ? 2 : 0);
  });

  it("does not mutate the Piece Practice projection", () => {
    const source = piece([[[60, 64]]]);
    const before = structuredClone(source);
    setup(source);
    midiNote(60); midiNote(64); act(() => vi.advanceTimersByTime(225));
    expect(source).toEqual(before);
  });

  it("routes a same-onset normal note and expressive MIDI roll through independent checks", () => {
    const view = setup(rolledPiece());
    midiNote(48); view.sync();
    act(() => vi.advanceTimersByTime(300));
    midiNote(52); view.sync();
    midiNote(72); view.sync();
    act(() => vi.advanceTimersByTime(300));
    midiNote(55);
    expect(view.getState()).toMatchObject({ status: "piece-complete", completedTargetCount: 1 }); expect(view.getState().mistakeEvidence).toHaveLength(0);
  });

  it("retains normal held-note strictness while allowing pitches owned by the parallel roll", () => {
    const allowed = setup(rolledPiece());
    midiHeld(48, 72);
    midiNote(72);
    expect(allowed.getState().currentCheckProgress[0]?.completed).toBe(true);
    allowed.unmount();

    const unrelated = setup(rolledPiece());
    midiHeld(72, 99);
    midiNote(72);
    expect(unrelated.getState()).toMatchObject({ status: "practicing" }); expect(unrelated.getState().mistakeEvidence).toHaveLength(1);
    expect(unrelated.getState().currentCheckProgress[0]?.completed).toBe(false);
  });

  it("allows held parallel-roll pitches while completing a multi-note normal MIDI chord", () => {
    const view = setup(rolledPiece([72, 76]));
    midiHeld(48, 72, 76);
    midiNote(48); view.sync();
    midiNote(72); midiNote(76);
    act(() => vi.advanceTimersByTime(225));
    expect(view.getState()).toMatchObject({ status: "practicing" }); expect(view.getState().mistakeEvidence).toHaveLength(0);
    expect(view.getState().currentCheckProgress[0]?.completed).toBe(true);
  });

  it("allows an authored tied sounding span beside parallel rolled and normal checks", () => {
    const base = rolledPiece([72, 76]);
    const original = base.measures[0]!.targets[0]!;
    const source: PiecePracticePiece = {
      ...base,
      soundingSpans: [{ originEventId: "tied-origin", originPitchId: "tied-pitch", staff: "bass", midiNumber: 60, attackTick: 0, endTick: 960, endpointKeys: ["tied-origin:tied-pitch"] }],
      measures: [{ ...base.measures[0]!, targets: [{ ...original, startTick: 480, absoluteStartTick: 480 }] }],
    };
    const view = setup(source);
    midiHeld(48, 60, 72, 76);
    midiNote(48); view.sync();
    midiNote(72); midiNote(76);
    act(() => vi.advanceTimersByTime(225));
    expect(view.getState()).toMatchObject({ status: "practicing" }); expect(view.getState().mistakeEvidence).toHaveLength(0);
    expect(view.getState().currentCheckProgress[0]?.completed).toBe(true);
  });

  it("still rejects an unrelated held pitch beside a parallel roll and multi-note normal chord", () => {
    const view = setup(rolledPiece([72, 76]));
    midiHeld(48, 72, 76, 99);
    midiNote(48); view.sync();
    midiNote(72); midiNote(76);
    act(() => vi.advanceTimersByTime(225));
    expect(view.getState()).toMatchObject({ status: "practicing" }); expect(view.getState().mistakeEvidence).toHaveLength(1);
    expect(view.getState().currentCheckProgress[0]?.completed).toBe(false);
    expect(view.result.current.feedback.grade).toMatchObject({ unexpectedHeldMidiNumbers: [99] });
  });

  it("keeps ordinary multi-note MIDI chords strict without a parallel roll", () => {
    const view = setup(piece([[[60, 64]]]));
    midiHeld(48, 60, 64);
    midiNote(60); midiNote(64);
    act(() => vi.advanceTimersByTime(225));
    expect(view.getState()).toMatchObject({ status: "practicing" }); expect(view.getState().mistakeEvidence).toHaveLength(1);
    expect(view.result.current.feedback.grade).toMatchObject({ unexpectedHeldMidiNumbers: [48] });
  });

  it("routes virtual-keyboard pitches through the same parallel rolled evaluator", () => {
    const view = setup(rolledPiece());
    for (const midiNumber of [72, 55, 48, 52]) {
      act(() => view.result.current.onVirtualNoteToggle(midiNumber));
      view.sync();
    }
    expect(view.getState()).toMatchObject({ status: "piece-complete", completedTargetCount: 1 });
  });

  it("expires a partial MIDI roll without clearing its completed normal check", () => {
    const view = setup(rolledPiece());
    midiNote(72); view.sync();
    midiNote(48); view.sync();
    act(() => vi.advanceTimersByTime(938));
    expect(view.getState().currentCheckProgress).toMatchObject([{ completed: true }, { completed: false, accumulatedMidiNumbers: [] }]);
    expect(view.getState().mistakeEvidence).toHaveLength(1);
  });
});

describe("Piece Practice rolled input source isolation", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); midiMock.status = "connected"; midiMock.options = null; });
  afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); });

  function practice(source = rolledPiece(), now = () => Date.now()) {
    const view = setup(source, now);
    const physical: number[] = [];
    const play = (input: "midi" | "virtual", midiNumber: number) => {
      act(() => {
        if (input === "midi") {
          physical.push(midiNumber);
          midiMock.options?.onNotePlayed(midiNumber, 65, now());
        } else view.result.current.onVirtualNoteToggle(midiNumber);
      });
      view.sync();
    };
    const tick = (ms: number) => { act(() => vi.advanceTimersByTime(ms)); view.sync(); };
    return { ...view, play, tick, physical };
  }

  it.each(["midi", "virtual"] as const)("discards a partial %s roll on source change while preserving a completed normal check and real evidence", (first) => {
    const second = first === "midi" ? "virtual" : "midi";
    const source = rolledPiece();
    const view = practice(source);
    view.play(first, 72);
    view.play(first, 48);
    view.tick(10); view.play(first, 48);
    expect(view.getState().currentCheckProgress[1]).toMatchObject({ accumulatedMidiNumbers: [48], startedAtMs: 0 });
    view.tick(10); view.play(second, 52);
    view.tick(180); view.play(second, 55); view.play(second, 52);
    expect(view.getState()).toMatchObject({ status: "practicing", mistakeEvidence: [] });
    expect(view.getState().currentCheckProgress).toMatchObject([
      { completed: true }, { completed: false, accumulatedMidiNumbers: [52, 55], startedAtMs: 20 },
    ]);
    view.play(second, 48);
    expect(view.getState()).toMatchObject({ status: "piece-complete", completedTargetCount: 1, mistakeEvidence: [] });
    expect(view.getState().attackEvidence?.map(({ midiNumber }) => midiNumber)).toEqual(view.physical);
    expect(view.getState().attackEvidence?.map(({ sequence }) => sequence)).toEqual(view.physical.map((_, index) => index));
    expect(view.getState().attackEvidence?.every(({ attackVelocity }) => attackVelocity === 65)).toBe(true);
    const report = formatPiecePracticeReport({ title: source.title, rangeText: "1", state: view.getState(), piece: source, includeAttackStrength: true });
    expect(report).toContain("Mistakes: 0");
    expect(report).toContain("velocity 65");
  });

  it.each(["midi", "virtual"] as const)("retains a completed parallel rolled check when switching away from %s", (first) => {
    const base = rolledPiece([72, 76]);
    const original = base.measures[0]!.targets[0]!;
    const source: PiecePracticePiece = { ...base, measures: [{ ...base.measures[0]!, targets: [{ ...original,
      checks: original.checks.map((check) => check.kind === "normal" ? { ...check, kind: "rolled-chord", direction: "up" } : check),
    }] }] };
    const view = practice(source);
    const second = first === "midi" ? "virtual" : "midi";
    view.play(first, 72); view.play(first, 76); view.play(first, 48);
    view.play(second, 52); view.play(second, 55);
    expect(view.getState().currentCheckProgress).toMatchObject([
      { completed: true, accumulatedMidiNumbers: [72, 76] },
      { completed: false, accumulatedMidiNumbers: [52, 55] },
    ]);
    view.play(second, 48);
    expect(view.getState()).toMatchObject({ status: "piece-complete", mistakeEvidence: [] });
  });

  it("retains source ownership after a shared pitch completes the parallel normal check", () => {
    const base = rolledPiece();
    const original = base.measures[0]!.targets[0]!;
    const source: PiecePracticePiece = { ...base, measures: [{ ...base.measures[0]!, targets: [{ ...original,
      expectedMidiNumbers: [48, 52, 55],
      attackedPitches: original.attackedPitches.map((pitch) => pitch.midiNumber === 72 ? { ...pitch, midiNumber: 48 } : pitch),
      checks: original.checks.map((check) => check.kind === "normal" ? { ...check, expectedMidiNumbers: [48],
        attackedPitches: check.attackedPitches.map((pitch) => ({ ...pitch, midiNumber: 48 })) } : check),
    }] }] };
    const view = practice(source);
    view.play("midi", 48); view.tick(20); view.play("midi", 52);
    expect(view.getState().currentCheckProgress).toMatchObject([
      { completed: true }, { accumulatedMidiNumbers: [48, 52], startedAtMs: 0 },
    ]);
    view.play("virtual", 55);
    expect(view.getState().currentCheckProgress).toMatchObject([{ completed: true }, { accumulatedMidiNumbers: [55] }]);
    view.play("virtual", 48); view.play("virtual", 52);
    expect(view.getState()).toMatchObject({ status: "piece-complete", mistakeEvidence: [] });
  });

  it("resets all incomplete parallel rolls and lets one fresh shared attack satisfy both", () => {
    const base = rolledPiece([72, 76]);
    const original = base.measures[0]!.targets[0]!;
    const replacePitch = (pitch: PiecePracticeTarget["attackedPitches"][number]) => ({
      ...pitch, midiNumber: pitch.midiNumber === 72 ? 48 : pitch.midiNumber === 76 ? 64 : pitch.midiNumber,
    });
    const source: PiecePracticePiece = { ...base, measures: [{ ...base.measures[0]!, targets: [{ ...original,
      expectedMidiNumbers: [48, 52, 55, 64], attackedPitches: original.attackedPitches.map(replacePitch),
      checks: original.checks.map((check) => check.kind === "normal" ? { ...check, kind: "rolled-chord", direction: "up",
        expectedMidiNumbers: [48, 64], attackedPitches: check.attackedPitches.map(replacePitch) } : check),
    }] }] };
    const view = practice(source);
    view.play("midi", 48);
    expect(view.getState().currentCheckProgress).toMatchObject([{ accumulatedMidiNumbers: [48] }, { accumulatedMidiNumbers: [48] }]);
    view.play("virtual", 52); view.play("virtual", 64); view.play("virtual", 55);
    expect(view.getState().currentCheckProgress).toMatchObject([
      { completed: false, accumulatedMidiNumbers: [64] }, { completed: false, accumulatedMidiNumbers: [52, 55] },
    ]);
    view.play("virtual", 48);
    expect(view.getState()).toMatchObject({ status: "piece-complete", mistakeEvidence: [] });
  });

  it("keeps a completed block chord while clearing its parallel roll on source change", () => {
    const view = practice(rolledPiece([72, 76]));
    view.play("midi", 48); view.play("midi", 72); view.play("midi", 76); view.tick(225);
    expect(view.getState().currentCheckProgress).toMatchObject([{ completed: true }, { accumulatedMidiNumbers: [48], startedAtMs: 0 }]);
    view.play("virtual", 52); view.play("virtual", 55);
    expect(view.getState().currentCheckProgress).toMatchObject([{ completed: true }, { accumulatedMidiNumbers: [52, 55] }]);
    view.play("virtual", 48);
    expect(view.getState()).toMatchObject({ status: "piece-complete", mistakeEvidence: [] });
  });

  it.each((["upper", "lower"] as const).flatMap((focus) => (["midi", "virtual"] as const).map((first) => ({ focus, first }))))(
    "isolates $focus focused rolls from $first while optional input leaves collection untouched", ({ focus, first }) => {
      const source = staffedPiece(rolledPiece(), focus, focus === "lower" ? [48, 52, 55] : [72]);
      const view = practice(source);
      const second = first === "midi" ? "virtual" : "midi";
      view.play(first, 48); view.play(second, focus === "upper" ? 12 : 99); view.play(first, 52);
      expect(view.getState().currentCheckProgress[0]).toMatchObject({ accumulatedMidiNumbers: [48, 52], startedAtMs: 0 });
      view.play(second, 55);
      expect(view.getState()).toMatchObject({ status: "practicing", mistakeEvidence: [] });
      expect(view.getState().currentCheckProgress[0]).toMatchObject({ accumulatedMidiNumbers: [55] });
      view.play(second, 48); view.play(second, 52);
      expect(view.getState()).toMatchObject({ status: "piece-complete", mistakeEvidence: [] });
      expect(view.getState().attackEvidence?.map(({ midiNumber }) => midiNumber)).toEqual(view.physical);
    },
  );

  it.each(["midi", "virtual"] as const)("expires a fresh roll after switching from %s without renewing on duplicates", (first) => {
    const view = practice({ ...rolledPiece(), tempoBpm: 120 });
    const second = first === "midi" ? "virtual" : "midi";
    view.play(first, 72); view.play(first, 48); view.tick(100);
    view.play(second, 52); view.tick(600); view.play(second, 52); view.tick(149);
    expect(view.getState().mistakeEvidence).toEqual([]);
    view.tick(1);
    expect(view.getState().mistakeEvidence).toMatchObject([
      { kind: "rolled-timeout", accumulatedMidiNumbers: [52], missingMidiNumbers: [48, 55], windowMs: 750 },
    ]);
    expect(view.getState().currentCheckProgress).toMatchObject([{ completed: true }, { accumulatedMidiNumbers: [], startedAtMs: null }]);
    view.play(second, 55); view.play(second, 48); view.play(second, 52);
    expect(view.getState().status).toBe("piece-complete");
    expect(view.getState().mistakeEvidence).toHaveLength(1);
  });

  it.each(["midi", "virtual"] as const)("retains an already due %s timeout when the other source arrives before timer delivery", (first) => {
    let atMs = 0;
    const view = practice({ ...rolledPiece(), tempoBpm: 120 }, () => atMs);
    const second = first === "midi" ? "virtual" : "midi";
    view.play(first, 72); view.play(first, 48);
    atMs = 750;
    view.play(second, 52);
    expect(view.getState().mistakeEvidence).toMatchObject([{ kind: "rolled-timeout", accumulatedMidiNumbers: [48], missingMidiNumbers: [52, 55] }]);
    expect(view.getState().currentCheckProgress).toMatchObject([{ completed: true }, { accumulatedMidiNumbers: [52], startedAtMs: 750 }]);
    atMs = 1499; view.play(second, 55); view.play(second, 48);
    expect(view.getState().status).toBe("piece-complete");
    expect(view.getState().mistakeEvidence).toHaveLength(1);
  });

  it.each((["measure", "piece"] as const).flatMap((restart) => (["midi", "virtual"] as const).map((first) => ({ restart, first }))))(
    "clears partial rolls on $restart restart after $first input", ({ restart, first }) => {
      const source = rolledPiece();
      const view = practice(source);
      const second = first === "midi" ? "virtual" : "midi";
      view.play(first, 72); view.play(first, 48);
      act(() => view.onSessionStateChange(restart === "measure"
        ? restartCurrentPiecePracticeMeasure(source, view.getState(), 0)
        : restartPiecePractice(source, view.getState(), 0)));
      view.sync();
      view.play(second, 72); view.play(second, 52); view.play(second, 55);
      expect(view.getState().status).toBe("practicing");
      expect(view.getState().currentCheckProgress[1]).toMatchObject({ accumulatedMidiNumbers: [52, 55] });
      view.play(second, 48);
      expect(view.getState()).toMatchObject({ status: "piece-complete", mistakeEvidence: [] });
    },
  );
});

describe("Piece Practice Staff Focus input", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); midiMock.options = null; midiMock.status = "connected"; });
  afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); });

  it("grades a nearby wrong physical block attack and ignores a far optional attack before collection", () => {
    const source = staffedPiece(piece([[[40, 42, 46]]]), "lower", [40, 42, 46]);
    const view = setup(source, () => Date.now());
    midiNote(72); view.sync();
    expect(view.getState().currentTargetActivatedAtActiveMs).toBeNull();
    expect(view.result.current.midiChordAttemptMidiNumbers.size).toBe(0);
    midiNote(40); midiNote(49); view.sync();
    expect(view.getState().mistakeEvidence).toMatchObject([{ extraMidiNumbers: [49] }]);
    expect(view.getState().currentTargetActivatedAtActiveMs).toBe(0);
  });

  it("grades nearby wrong rolled Note On but does not poison the roll with far context", () => {
    const source = staffedPiece(rolledPiece(), "lower", [48, 52, 55]);
    const view = setup(source, () => Date.now());
    midiNote(72); view.sync();
    expect(view.getState().currentTargetActivatedAtActiveMs).toBeNull();
    midiNote(48); view.sync();
    midiNote(58); view.sync();
    expect(view.getState().mistakeEvidence).toMatchObject([{ kind: "rolled-unexpected-pitch", receivedMidiNumber: 58 }]);
    expect(view.getState().currentCheckProgress[0]?.accumulatedMidiNumbers).toEqual([48]);
  });

  it("uses the same optional classification for virtual input and arms on the first relevant wrong note", () => {
    const source = staffedPiece(piece([[[40]]]), "lower", [40]);
    const view = setup(source, () => Date.now());
    act(() => view.result.current.onVirtualNoteToggle(72)); view.sync();
    expect(view.getState().currentTargetActivatedAtActiveMs).toBeNull();
    expect(view.getState().mistakeEvidence).toHaveLength(0);
    act(() => vi.advanceTimersByTime(500));
    act(() => view.result.current.onVirtualNoteToggle(43)); view.sync();
    expect(view.getState().mistakeEvidence).toMatchObject([{ extraMidiNumbers: [43] }]);
    expect(view.getState().currentTargetActivatedAtActiveMs).toBe(500);
  });

  it("requires the upper semantic staff while ignoring a lower optional attack", () => {
    const source = staffedPiece(piece([[[81, 60]]]), "upper", [60]);
    const view = setup(source, () => Date.now());
    midiNote(60); view.sync();
    expect(view.getState()).toMatchObject({ status: "practicing", assessmentFocus: "upper" });
    expect(view.getState().mistakeEvidence).toHaveLength(0);
    midiNote(81);
    expect(view.getState()).toMatchObject({ status: "piece-complete", completedTargetCount: 1 });
  });

  it("keeps optional physical attacks and held keys observational while a required single remains missing", () => {
    const source = staffedPiece(piece([[[81, 60]]]), "lower", [60]);
    const view = setup(source, () => Date.now());
    act(() => vi.advanceTimersByTime(8_000));
    midiHeld(81);
    act(() => midiMock.options?.onNotePlayed(81, 66, 12.5)); view.sync();
    expect(view.getState()).toMatchObject({ status: "practicing", currentTargetActivatedAtActiveMs: null });
    expect(view.getState().mistakeEvidence).toHaveLength(0);
    expect(view.getState().attackEvidence).toMatchObject([{ midiNumber: 81, attackVelocity: 66, occurredAtActiveMs: 8_000, sourceTimeStampMs: 12.5 }]);
    act(() => midiMock.options?.onNotePlayed(99, 45)); view.sync();
    expect(view.getState().mistakeEvidence).toHaveLength(0);
    act(() => vi.advanceTimersByTime(700));
    midiHeld(81, 99, 60);
    act(() => midiMock.options?.onNotePlayed(60, 72));
    expect(view.getState()).toMatchObject({ status: "piece-complete", completedTargetCount: 1 });
    expect(view.getState().targetTimings[0]).toMatchObject({ timingBasis: "first-attempt", responseDurationMs: 0 });
    expect(view.getState().mistakeEvidence).toHaveLength(0);
    expect(view.getState().attackEvidence?.map(({ midiNumber }) => midiNumber)).toEqual([81, 99, 60]);
    act(() => midiMock.options?.onNoteReleased?.({ midiNumber: 81, encoding: "note-off", releaseVelocity: 32 }));
    expect(view.getState().releaseEvidence).toMatchObject([{ midiNumber: 81, encoding: "note-off", releaseVelocity: 32 }]);
  });

  it("keeps optional pitches out of a focused block-chord collector", () => {
    const source = staffedPiece(piece([[[81, 34, 38, 41]]]), "lower", [34, 38, 41]);
    const view = setup(source, () => Date.now());
    midiNote(81); midiNote(34); view.sync();
    expect([...view.result.current.midiChordAttemptMidiNumbers]).toEqual([34]);
    act(() => vi.advanceTimersByTime(100));
    midiNote(81); midiNote(38); view.sync();
    expect([...view.result.current.midiChordAttemptMidiNumbers].sort()).toEqual([34, 38]);
    midiNote(41);
    act(() => vi.advanceTimersByTime(125));
    expect(view.getState()).toMatchObject({ status: "piece-complete", completedTargetCount: 1 });
    expect(view.getState().mistakeEvidence).toHaveLength(0);
  });

  it("still blocks an incomplete focused chord despite optional attacks", () => {
    const source = staffedPiece(piece([[[81, 34, 38, 41]]]), "lower", [34, 38, 41]);
    const view = setup(source, () => Date.now());
    midiNote(34); midiNote(81); midiNote(38);
    act(() => vi.advanceTimersByTime(225));
    expect(view.getState()).toMatchObject({ status: "practicing", completedTargetCount: 0 });
    expect(view.getState().mistakeEvidence).toMatchObject([{ missingMidiNumbers: [41], extraMidiNumbers: [], unexpectedHeldMidiNumbers: [] }]);
  });

  it("ignores optional attacks during a focused roll and removes an unassessed roll", () => {
    const lower = setup(staffedPiece(rolledPiece(), "lower", [48, 52, 55]), () => Date.now());
    midiNote(48); lower.sync();
    midiNote(72); lower.sync();
    expect(lower.getState().currentCheckProgress).toMatchObject([{ completed: false, accumulatedMidiNumbers: [48] }]);
    midiNote(52); lower.sync(); midiNote(55);
    expect(lower.getState()).toMatchObject({ status: "piece-complete", completedTargetCount: 1 });
    expect(lower.getState().mistakeEvidence).toHaveLength(0);
    lower.unmount();

    const upperSource = staffedPiece(rolledPiece(), "upper", [48, 52, 55]);
    expect(upperSource.measures[0]!.targets[0]!.checks).toHaveLength(1);
    const upper = setup(upperSource, () => Date.now());
    midiNote(48); upper.sync();
    expect(upper.getState().mistakeEvidence).toHaveLength(0);
    midiNote(72);
    expect(upper.getState()).toMatchObject({ status: "piece-complete", completedTargetCount: 1 });
  });

  it("keeps optional virtual selections visible without poisoning assessed chord input", () => {
    const source = staffedPiece(piece([[[81, 34, 38, 41]]]), "lower", [34, 38, 41]);
    const view = setup(source, () => Date.now());
    act(() => view.result.current.onVirtualNoteToggle(81)); view.sync();
    act(() => view.result.current.onVirtualNoteToggle(99)); view.sync();
    expect([...view.result.current.virtualSelectedMidiNumbers].sort()).toEqual([81, 99]);
    expect(view.getState().currentTargetActivatedAtActiveMs).toBeNull();
    for (const note of [34, 38, 41]) { act(() => view.result.current.onVirtualNoteToggle(note)); view.sync(); }
    expect(view.getState()).toMatchObject({ status: "piece-complete", completedTargetCount: 1 });
    expect(view.getState().mistakeEvidence).toHaveLength(0);
  });

  it("advances focused chord-to-chord, chord-to-note, and note-to-chord transitions", () => {
    const source = staffedPiece(piece([[[34, 38], [36, 41], [43], [45, 48]]]), "lower", [34, 38, 36, 41, 43, 45, 48]);
    const view = setup(source, () => Date.now());
    for (const notes of [[34, 38], [36, 41], [43], [45, 48]]) {
      midiNote(81);
      for (const note of notes) midiNote(note);
      act(() => vi.advanceTimersByTime(225)); view.sync();
    }
    expect(view.getState()).toMatchObject({ status: "piece-complete", completedTargetCount: 4 });
    expect(view.getState().mistakeEvidence).toHaveLength(0);
  });
});


describe("Piece Practice optional physical attack evidence", () => {
  beforeEach(() => { vi.useFakeTimers(); midiMock.options = null; });
  afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); });
  const attack = (midiNumber: number, velocity: number) => act(() => midiMock.options?.onNotePlayed(midiNumber, velocity));

  it("keeps each block-chord attack, including repeated pitch, before deduplication", () => {
    const view = setup(piece([[[60, 64, 67]]]));
    midiHeld(60, 64, 67);
    attack(60, 54); view.sync(); attack(64, 49); attack(60, 81); attack(67, 45);
    act(() => vi.advanceTimersByTime(225));
    expect(view.getState().status).toBe("piece-complete");
    expect(view.getState().attackEvidence?.map(({ midiNumber, attackVelocity }) => [midiNumber, attackVelocity])).toEqual([[60, 54], [64, 49], [60, 81], [67, 45]]);
    expect(view.getState().attackEvidence?.every(({ targetId }) => targetId === "m0:attack:0")).toBe(true);
  });

  it("retains independent rolled and simultaneous normal-check velocities once each", () => {
    const view = setup(rolledPiece());
    attack(48, 38); attack(72, 104); attack(52, 51); attack(55, 63);
    expect(view.getState().status).toBe("piece-complete");
    expect(view.getState().attackEvidence?.map(({ attackVelocity }) => attackVelocity)).toEqual([38, 104, 51, 63]);
  });

  it("keeps repeated attempts at the same pitch separate", () => {
    const view = setup(piece([[[60]]]));
    attack(61, 40); attack(61, 99); attack(60, 72);
    expect(view.getState().attackEvidence?.map(({ attackVelocity }) => attackVelocity)).toEqual([40, 99, 72]);
    expect(view.getState().mistakeEvidence).toHaveLength(2);
  });

  it("leaves virtual input usable without fabricated velocity", () => {
    const view = setup(piece([[[60]]]));
    act(() => view.result.current.onVirtualNoteToggle(60));
    expect(view.getState().status).toBe("piece-complete");
    expect(view.getState().attackEvidence).toBeUndefined();
  });

  it.each([
    { name: "single with mistake", source: () => piece([[[60]]]), attacks: [61, 60] },
    { name: "block chord", source: () => piece([[[60, 64, 67]]]), attacks: [60, 64, 67] },
    { name: "rolled chord with normal check", source: () => rolledPiece(), attacks: [48, 72, 52, 55] },
  ])("produces identical grading and timing for $name with or without metadata", ({ source, attacks }) => {
    const plain = setup(source(), () => 0); attacks.forEach(midiNote); act(() => vi.advanceTimersByTime(225));
    const expected = plain.getState(); plain.unmount();
    const enhanced = setup(source(), () => 0); attacks.forEach((note, index) => attack(note, 30 + index)); act(() => vi.advanceTimersByTime(225));
    const actual = { ...enhanced.getState() }; delete actual.attackEvidence;
    expect(actual).toEqual(expected);
  });
});
