import { act, renderHook } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPiecePracticeSession, type PiecePracticeSessionState } from "../piece-practice-session";
import type { PiecePracticePiece, PiecePracticeTarget } from "../piece-practice-types";
import { usePiecePracticeInput } from "./use-piece-practice-input";

const midiMock = vi.hoisted(() => ({
  mountCount: 0, unmountCount: 0,
  options: null as null | { onHeldNotesChanged?: (notes: ReadonlySet<number>) => void; onNotePlayed: (midiNumber: number) => void },
}));

vi.mock("@/hooks/use-app-midi-input", () => ({
  useAppMidiInput: (options: typeof midiMock.options) => {
    midiMock.options = options;
    useEffect(() => {
      midiMock.mountCount += 1;
      return () => { midiMock.unmountCount += 1; };
    }, []);
    return { connectMidi: vi.fn(), deviceName: "Test MIDI", error: null, status: "connected" as const };
  },
}));

function target(measureIndex: number, targetIndex: number, expectedMidiNumbers: readonly number[]): PiecePracticeTarget {
  return {
    id: `m${measureIndex}:attack:${targetIndex * 480}`, measureIndex, sourceMeasureId: `m${measureIndex}`,
    startTick: targetIndex * 480, absoluteStartTick: measureIndex * 1920 + targetIndex * 480,
    sourceEventIds: [`event-${measureIndex}-${targetIndex}`], expectedMidiNumbers,
    attackedPitches: expectedMidiNumbers.map((midiNumber, index) => ({
      sourceEventId: `event-${measureIndex}-${targetIndex}`, sourcePitchId: `p-${index}`, staff: "treble",
      midiNumber, letter: "C", accidental: "natural", octave: 4, duration: "quarter", durationTicks: 480,
      incomingTieIds: [], outgoingTieIds: [],
    })),
  };
}

function piece(targetsByMeasure: readonly (readonly (readonly number[])[])[] = [[[60], [64]]]): PiecePracticePiece {
  return {
    sourceScoreId: "score", sourceScoreUpdatedAt: "now", title: "Input study", tempoBpm: 96,
    measures: targetsByMeasure.map((targetSets, measureIndex) => ({
      measureIndex, sourceMeasureId: `m${measureIndex}`, absoluteStartTick: measureIndex * 1920, capacityTicks: 1920,
      keySignatureId: "c-major", timeSignature: "4/4", sourceEvents: [], restEventIds: targetSets.length ? [] : [`rest-${measureIndex}`],
      targets: targetSets.map((notes, targetIndex) => target(measureIndex, targetIndex, notes)),
    })),
  };
}

function initial(source: PiecePracticePiece): PiecePracticeSessionState {
  const result = createPiecePracticeSession(source, { startMeasureIndex: 0, startedAtMs: 0 });
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

function setup(source = piece()) {
  let state = initial(source);
  const onSessionStateChange = vi.fn((next: PiecePracticeSessionState) => { state = next; });
  const rendered = renderHook(({ sessionState }) => usePiecePracticeInput({ piece: source, sessionState, onSessionStateChange }), {
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

  it("submits correct and incorrect physical single notes through Phase B exactly once", () => {
    const view = setup(piece([[[60]]]));
    midiHeld(61);
    midiNote(61);
    expect(view.getState()).toMatchObject({ currentTargetIndex: 0, incorrectAttemptCount: 1, status: "practicing" });
    midiHeld(60);
    midiNote(60);
    expect(view.getState()).toMatchObject({ completedTargetCount: 1, status: "piece-complete" });
    midiNote(60);
    expect(view.onSessionStateChange).toHaveBeenCalledTimes(2);
  });

  it("rejects an unrelated held pitch on an otherwise correct single attack", () => {
    const view = setup(piece([[[60]]]));
    midiHeld(48, 60);
    midiNote(60);
    expect(view.result.current.feedback.grade).toMatchObject({ correct: false, unexpectedHeldMidiNumbers: [48] });
  });

  it("collects block and rolled physical chords for 225ms with order and duplicate independence", () => {
    const view = setup(piece([[[60, 64, 67]]]));
    midiHeld(67, 60, 64);
    midiNote(67);
    midiNote(60);
    midiNote(60);
    act(() => vi.advanceTimersByTime(224));
    expect(view.onSessionStateChange).not.toHaveBeenCalled();
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

    expect(view.onSessionStateChange).toHaveBeenCalledTimes(1);
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
    expect(view.getState()).toMatchObject({ currentTargetIndex: 0, completedTargetCount: 0, incorrectAttemptCount: 1 });
  });

  it("discards a stale chord collector after an external target transition", () => {
    const source = piece([[[60, 64], [67]]]);
    const view = setup(source);
    midiNote(60);
    const moved = { ...view.getState(), currentTargetIndex: 1 };
    view.rerender({ sessionState: moved });
    act(() => vi.advanceTimersByTime(225));
    expect(view.onSessionStateChange).not.toHaveBeenCalled();
  });

  it.each(["measure", "piece"])("cancels collection on Restart %s input reset", () => {
    const view = setup(piece([[[60, 64]]]));
    midiNote(60);
    act(() => view.result.current.resetInput());
    act(() => vi.advanceTimersByTime(225));
    expect(view.onSessionStateChange).not.toHaveBeenCalled();
  });

  it("cancels a pending chord timer on unmount", () => {
    const view = setup(piece([[[60, 64]]]));
    midiNote(60);
    view.unmount();
    act(() => vi.advanceTimersByTime(225));
    expect(view.onSessionStateChange).not.toHaveBeenCalled();
  });

  it("allows only the immediately previous successful target as held context", () => {
    const view = setup(piece([[[60], [64], [67]]]));
    midiHeld(60);
    midiNote(60);
    view.sync();
    midiHeld(60, 64);
    midiNote(64);
    expect(view.getState()).toMatchObject({ currentTargetIndex: 2, incorrectAttemptCount: 0 });
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
    const tiedSource: PiecePracticePiece = { ...source, measures: [{ ...source.measures[0]!, sourceEvents: [{
      sourceEventId: "destination", kind: "notes", staff: "treble", startTick: 0, absoluteStartTick: 0,
      duration: "quarter", durationTicks: 480, pitches: [{ sourcePitchId: "c", midiNumber: 60, letter: "C", accidental: "natural", octave: 4, incomingTieIds: ["tie"], outgoingTieIds: [], requiresAttack: false }],
    }], targets: [{ ...currentTarget, sourceEventIds: ["destination", ...currentTarget.sourceEventIds] }] }] };
    const view = setup(tiedSource);
    midiHeld(60, 64, 67); midiNote(64); midiNote(67); act(() => vi.advanceTimersByTime(225));
    expect(view.getState().status).toBe("piece-complete");
  });

  it("still rejects a missing untied chord pitch and unrelated held pitch beside a tie", () => {
    const source = piece([[[64, 67]]]);
    const currentTarget = source.measures[0]!.targets[0]!;
    const tiedSource: PiecePracticePiece = { ...source, measures: [{ ...source.measures[0]!, sourceEvents: [{
      sourceEventId: "destination", kind: "notes", staff: "treble", startTick: 0, absoluteStartTick: 0,
      duration: "quarter", durationTicks: 480, pitches: [{ sourcePitchId: "c", midiNumber: 60, letter: "C", accidental: "natural", octave: 4, incomingTieIds: ["tie"], outgoingTieIds: [], requiresAttack: false }],
    }], targets: [{ ...currentTarget, sourceEventIds: ["destination"] }] }] };
    const view = setup(tiedSource);
    midiHeld(48, 60, 64); midiNote(64); act(() => vi.advanceTimersByTime(225));
    expect(view.result.current.feedback.grade).toMatchObject({ correct: false, missingMidiNumbers: [67], unexpectedHeldMidiNumbers: [48] });
  });

  it("submits virtual singles immediately and keeps wrong answers blocked", () => {
    const view = setup(piece([[[60]]]));
    act(() => view.result.current.onVirtualNoteToggle(61));
    expect(view.getState()).toMatchObject({ incorrectAttemptCount: 1, status: "practicing" });
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
    expect(view.getState()).toMatchObject({ status: "practicing", incorrectAttemptCount: 1 });
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
    expect(view.onSessionStateChange).toHaveBeenCalledTimes(source.measures[0]!.targets.length ? 1 : 0);
  });

  it("does not mutate the Piece Practice projection", () => {
    const source = piece([[[60, 64]]]);
    const before = structuredClone(source);
    setup(source);
    midiNote(60); midiNote(64); act(() => vi.advanceTimersByTime(225));
    expect(source).toEqual(before);
  });
});
