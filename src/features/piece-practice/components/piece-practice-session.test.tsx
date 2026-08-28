import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import { projectStaffBuilderPieceForPractice } from "../piece-practice-projection";
import { submitPiecePracticeAttempt } from "../piece-practice-session";
import type { PiecePracticeInputFeedback } from "../hooks/use-piece-practice-input";
import type { PiecePracticePiece, PiecePracticeTarget } from "../piece-practice-types";
import { PiecePracticeSession } from "./piece-practice-session";

const mocks = vi.hoisted(() => ({
  feedback: { status: "idle", source: null, grade: null } as PiecePracticeInputFeedback,
  resetInput: vi.fn(),
  inputMounts: 0,
  inputUnmounts: 0,
  useInputCalls: 0,
  inputOptions: null as null | { piece: PiecePracticePiece; sessionState: import("../piece-practice-session").PiecePracticeSessionState; onSessionStateChange: (state: import("../piece-practice-session").PiecePracticeSessionState) => void },
  scoreProps: null as null | Record<string, unknown>,
  success: vi.fn(), incorrect: vi.fn(),
}));

vi.mock("@/features/staff-builder/components/staff-builder-score-view", () => ({
  StaffBuilderScoreView: (props: Record<string, unknown>) => {
    mocks.scoreProps = props;
    const highlights = props.eventHighlights as readonly { eventId: string; status: string }[];
    return <div aria-label="Read-only authored score" data-highlights={highlights.map(({ eventId }) => eventId).join(",")} data-testid="score-view" />;
  },
}));
vi.mock("@/hooks/use-mobile-play", () => ({
  useMobilePlay: () => {
    const [isMobilePlayMode, setIsMobilePlayMode] = useState(false);
    return { enterMobilePlay: () => setIsMobilePlayMode(true), exitMobilePlay: () => setIsMobilePlayMode(false), isMobilePlayMode };
  },
}));
vi.mock("@/lib/audio/feedback", () => ({ playSuccessChirp: mocks.success, playIncorrectFeedback: mocks.incorrect }));
vi.mock("../hooks/use-piece-practice-input", () => ({
  usePiecePracticeInput: (options: NonNullable<typeof mocks.inputOptions>) => {
    mocks.useInputCalls += 1;
    mocks.inputOptions = options;
    useEffect(() => {
      mocks.inputMounts += 1;
      return () => { mocks.inputUnmounts += 1; };
    }, []);
    return {
      connectMidi: vi.fn(), deviceName: "Test Piano", error: null, status: "connected",
      feedback: mocks.feedback, midiChordAttemptMidiNumbers: new Set<number>(), midiHeldNotes: new Set<number>(),
      virtualSelectedMidiNumbers: new Set<number>(), onVirtualNoteToggle: (midiNumber: number) => submit([midiNumber]), resetInput: mocks.resetInput,
    };
  },
}));
vi.mock("@/components/notation/piano-keyboard", () => ({ default: ({ onNoteToggle }: { onNoteToggle: (midi: number) => void }) => <div data-testid="piano-keyboard"><button onClick={() => onNoteToggle(60)} type="button">Virtual C4</button></div> }));

function pitch(sourceEventId: string, sourcePitchId: string, midiNumber: number, letter: "C" | "E" | "G" | "A", staff: "treble" | "bass" = "treble") {
  return { sourceEventId, sourcePitchId, staff, midiNumber, letter, accidental: "natural" as const, octave: 4, duration: "quarter" as const, durationTicks: 480, incomingTieIds: [], outgoingTieIds: [] };
}

function target(id: string, measureIndex: number, startTick: number, pitches: ReturnType<typeof pitch>[]): PiecePracticeTarget {
  return { id, measureIndex, sourceMeasureId: `m${measureIndex + 1}`, startTick, absoluteStartTick: measureIndex * 1920 + startTick, sourceEventIds: [...new Set(pitches.map(({ sourceEventId }) => sourceEventId))].sort(), expectedMidiNumbers: [...new Set(pitches.map(({ midiNumber }) => midiNumber))].sort(), attackedPitches: pitches };
}

function piece(): PiecePracticePiece {
  const first = target("m1:attack:0", 0, 0, [pitch("treble-event", "c", 60, "C"), pitch("bass-event", "e", 64, "E", "bass")]);
  const second = target("m1:attack:480", 0, 480, [pitch("polyphonic-event", "g", 67, "G")]);
  const last = target("m3:attack:0", 2, 0, [pitch("last-event", "a", 69, "A")]);
  return {
    sourceScoreId: "score", sourceScoreUpdatedAt: "2026-08-10T12:00:00.000Z", title: "Hallelujah", tempoBpm: 90,
    measures: [
      { measureIndex: 0, sourceMeasureId: "m1", absoluteStartTick: 0, capacityTicks: 1920, keySignatureId: "c-major", timeSignature: "4/4", restEventIds: [], targets: [first, second], sourceEvents: [
        { sourceEventId: "treble-event", kind: "notes", staff: "treble", startTick: 0, absoluteStartTick: 0, duration: "quarter", durationTicks: 480, pitches: [{ sourcePitchId: "c", midiNumber: 60, letter: "C", accidental: "natural", octave: 4, incomingTieIds: [], outgoingTieIds: [], requiresAttack: true }] },
        { sourceEventId: "bass-event", kind: "notes", staff: "bass", startTick: 0, absoluteStartTick: 0, duration: "half", durationTicks: 960, pitches: [{ sourcePitchId: "e", midiNumber: 64, letter: "E", accidental: "natural", octave: 4, incomingTieIds: [], outgoingTieIds: [], requiresAttack: true }] },
        { sourceEventId: "polyphonic-event", kind: "notes", staff: "treble", startTick: 480, absoluteStartTick: 480, duration: "quarter", durationTicks: 480, pitches: [{ sourcePitchId: "g", midiNumber: 67, letter: "G", accidental: "natural", octave: 4, incomingTieIds: [], outgoingTieIds: [], requiresAttack: true }] },
      ] },
      { measureIndex: 1, sourceMeasureId: "m2", absoluteStartTick: 1920, capacityTicks: 1920, keySignatureId: "c-major", timeSignature: "4/4", restEventIds: ["rest"], targets: [], sourceEvents: [{ sourceEventId: "rest", kind: "rest", staff: "treble", startTick: 0, absoluteStartTick: 1920, duration: "whole", durationTicks: 1920 }] },
      { measureIndex: 2, sourceMeasureId: "m3", absoluteStartTick: 3840, capacityTicks: 1920, keySignatureId: "c-major", timeSignature: "4/4", restEventIds: [], targets: [last], sourceEvents: [{ sourceEventId: "last-event", kind: "notes", staff: "treble", startTick: 0, absoluteStartTick: 3840, duration: "whole", durationTicks: 1920, pitches: [{ sourcePitchId: "a", midiNumber: 69, letter: "A", accidental: "natural", octave: 4, incomingTieIds: [], outgoingTieIds: [], requiresAttack: true }] }] },
    ],
  };
}

function realisticPolyphonicScore(): StaffBuilderScore {
  const note = (id: string, staff: "treble" | "bass", startTick: number, duration: "dotted-half" | "dotted-quarter" | "quarter" | "eighth", pitches: readonly { id: string; midiNumber: number; letter: "A" | "C" | "D" | "E" | "F" | "G"; octave: number }[]) => ({
    id, kind: "notes" as const, staff, startTick, rhythm: { status: "final" as const, duration },
    pitches: pitches.map((source) => ({ ...source, accidental: "natural" as const })),
  });
  return {
    schemaVersion: 3, annotations: [], id: "realistic-6-8", title: "Six-Eight Practice Study", createdAt: "2026-08-10T12:00:00.000Z", updatedAt: "2026-08-10T12:00:00.000Z",
    tempoBpm: 72, initialKeySignatureId: "c-major", initialTimeSignature: "6/8",
    measures: [
      { id: "measure-1", events: [
        note("sustained-e", "treble", 0, "dotted-quarter", [{ id: "e4", midiNumber: 64, letter: "E", octave: 4 }]),
        note("later-c", "treble", 480, "eighth", [{ id: "c4", midiNumber: 60, letter: "C", octave: 4 }]),
        note("later-d", "treble", 720, "eighth", [{ id: "d4", midiNumber: 62, letter: "D", octave: 4 }]),
        note("tie-source", "treble", 960, "quarter", [{ id: "source-f4", midiNumber: 65, letter: "F", octave: 4 }]),
        note("bass-chord", "bass", 0, "dotted-quarter", [{ id: "c3", midiNumber: 48, letter: "C", octave: 3 }, { id: "g3", midiNumber: 55, letter: "G", octave: 3 }]),
        { id: "bass-rest", kind: "rest", staff: "bass", startTick: 720, rhythm: { status: "final", duration: "dotted-quarter" } },
      ] },
      { id: "measure-2", events: [
        note("tie-destination-chord", "treble", 0, "dotted-half", [{ id: "destination-f4", midiNumber: 65, letter: "F", octave: 4 }, { id: "new-a4", midiNumber: 69, letter: "A", octave: 4 }]),
        note("bass-e", "bass", 0, "dotted-half", [{ id: "e3", midiNumber: 52, letter: "E", octave: 3 }]),
      ] },
    ],
    ties: [{ id: "cross-measure-f", fromEventId: "tie-source", fromPitchId: "source-f4", toEventId: "tie-destination-chord", toPitchId: "destination-f4" }],
  };
}

function submit(midiNumbers: readonly number[]) {
  const options = mocks.inputOptions;
  if (!options) throw new Error("Input hook is not mounted.");
  const currentTarget = options.piece.measures[options.sessionState.currentMeasureIndex]?.targets[options.sessionState.currentTargetIndex ?? -1];
  if (!currentTarget) return;
  const result = submitPiecePracticeAttempt(options.piece, options.sessionState, { targetId: currentTarget.id, attempt: { attackMidiNumbers: midiNumbers } });
  if (!result.accepted) return;
  mocks.feedback = { status: result.grade.correct ? "correct" : "incorrect", source: "virtual", grade: result.grade };
  options.onSessionStateChange(result.state);
}

function start(source = piece(), measure = 1) {
  const rendered = render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={source} />);
  if (measure !== 1) fireEvent.change(screen.getByLabelText("Start at Measure"), { target: { value: String(measure - 1) } });
  fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
  return rendered;
}

beforeEach(() => {
  mocks.feedback = { status: "idle", source: null, grade: null };
  mocks.resetInput.mockClear(); mocks.useInputCalls = 0; mocks.inputMounts = 0; mocks.inputUnmounts = 0; mocks.inputOptions = null; mocks.scoreProps = null; mocks.success.mockClear(); mocks.incorrect.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PiecePracticeSession", () => {
  it("offers an accessible Start at Measure setup and initializes the selected range", () => {
    start(piece(), 3);
    expect(screen.getByText("Measure 3 of 3 · Practicing from Measure 3")).toBeTruthy();
    expect(screen.getByText("Target 1 of 1")).toBeTruthy();
  });

  it("renders the current authored measure read-only with every cross-staff/polyphonic source highlight", () => {
    start();
    expect(screen.getByTestId("score-view").dataset.highlights).toBe("bass-event,treble-event");
    expect(mocks.scoreProps).toMatchObject({ measureIndex: 0 });
    expect(mocks.scoreProps).not.toHaveProperty("onEventSelect");
    expect(screen.queryByText(/Capture Notes|Rhythm Correction/)).toBeNull();
    expect(screen.getByText("Expected: C4, E4")).toBeTruthy();
  });

  it("shows beginner-readable incorrect details, stays blocked, and announces once", () => {
    start();
    act(() => submit([60, 65]));
    expect(screen.getByText("Incorrect — try the same target again.")).toBeTruthy();
    expect(screen.getByText("Missing: E4")).toBeTruthy();
    expect(screen.getByText("Extra: MIDI 65")).toBeTruthy();
    expect(screen.getByText("Target 1 of 2")).toBeTruthy();
    expect(within(screen.getByRole("status")).getByText(/Incorrect/)).toBeTruthy();
    expect(mocks.incorrect).toHaveBeenCalledTimes(1);
  });

  it("keeps visual grading and retry available if optional feedback audio fails", () => {
    mocks.incorrect.mockImplementationOnce(() => { throw new Error("Audio unavailable"); });
    start();
    act(() => submit([60, 65]));
    expect(screen.getByText(/Incorrect .* try the same target again\./)).toBeTruthy();
    expect(screen.getByText("Target 1 of 2")).toBeTruthy();
  });

  it("advances targets and normal measures through Phase B without a Next button", () => {
    start();
    act(() => submit([64, 60]));
    expect(screen.getByText("Target 2 of 2")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next Measure" })).toBeNull();
    act(() => submit([67]));
    expect(screen.getByText("Measure 2 of 3")).toBeTruthy();
    expect(screen.getByText("No notes to play in this measure.")).toBeTruthy();
    expect(mocks.success).toHaveBeenCalledTimes(2);
  });

  it("requires explicit accessible advancement for each no-attack measure", () => {
    const source = piece();
    const extraRest: PiecePracticePiece = { ...source, measures: [
      { ...source.measures[1]!, measureIndex: 0, sourceMeasureId: "rest-1", absoluteStartTick: 0 },
      { ...source.measures[1]!, measureIndex: 1, sourceMeasureId: "rest-2", absoluteStartTick: 1920 },
      { ...source.measures[2]!, measureIndex: 2 },
    ] };
    start(extraRest);
    fireEvent.click(screen.getByRole("button", { name: "Next Measure" }));
    expect(screen.getByText("Measure 2 of 3")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next Measure" })).toBeTruthy();
  });

  it("resets transient input for Restart Measure and Restart Piece, including the same target", () => {
    start();
    fireEvent.click(screen.getByRole("button", { name: "Restart Measure" }));
    fireEvent.click(screen.getByRole("button", { name: "Restart Piece" }));
    expect(mocks.resetInput).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Target 1 of 2")).toBeTruthy();
  });

  it("shows completion, approved statistics, focuses its heading, and supports Practice Again", () => {
    start(piece(), 3);
    act(() => submit([68]));
    act(() => submit([69]));
    const heading = screen.getByRole("heading", { name: "Piece complete" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("Measures practiced").parentElement?.querySelector("dd")?.textContent).toBe("1");
    expect(screen.getByText("Mistakes").parentElement?.querySelector("dd")?.textContent).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Practice Again" }));
    expect(screen.getByText("Measure 3 of 3 · Practicing from Measure 3")).toBeTruthy();
    expect(mocks.resetInput).toHaveBeenCalledTimes(1);
  });

  it("requires explicit Mobile Play on narrow/coarse layouts and preserves one input tree", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    start();
    expect(screen.getByRole("button", { name: "Test Piano" })).toBeTruthy();
    expect(screen.getAllByTestId("piano-keyboard")).toHaveLength(1);
    expect(screen.getByLabelText("Practice keyboard").dataset.presentation).toBe("standard");
    expect(screen.queryByRole("button", { name: "Exit Mobile Play" })).toBeNull();
    expect(mocks.inputMounts).toBe(1);

    act(() => submit([60, 64]));
    const entry = screen.getByRole("button", { name: "Mobile Play" });
    expect(entry.classList.contains("practice-mobile-play-entry")).toBe(true);
    fireEvent.click(entry);
    expect(screen.getAllByTestId("piano-keyboard")).toHaveLength(1);
    expect(screen.getByLabelText("Practice keyboard").dataset.presentation).toBe("mobile-play");
    expect(screen.getByText("Target 2 of 2")).toBeTruthy();
    expect(mocks.inputMounts).toBe(1);
    expect(mocks.inputUnmounts).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Exit Mobile Play" }));
    expect(screen.getByLabelText("Practice keyboard").dataset.presentation).toBe("standard");
    expect(screen.getByText("Target 2 of 2")).toBeTruthy();
    expect(mocks.inputMounts).toBe(1);
  });

  it("keeps blocking mistakes and session timing state through Mobile Play", () => {
    start();
    act(() => submit([60, 65]));
    expect(mocks.inputOptions?.sessionState).toMatchObject({
      currentMeasureIndex: 0,
      currentTargetIndex: 0,
      currentTargetIncorrectAttemptCount: 1,
      incorrectAttemptCount: 1,
      startedAtMs: 65_000,
    });

    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Exit Mobile Play" }));

    expect(screen.getByText("Target 1 of 2")).toBeTruthy();
    expect(screen.getByText(/Incorrect .* try the same target again\./)).toBeTruthy();
    expect(mocks.inputOptions?.sessionState).toMatchObject({
      currentTargetIncorrectAttemptCount: 1,
      incorrectAttemptCount: 1,
      startedAtMs: 65_000,
    });
  });

  it("keeps restart and explicit no-attack progression controls working in Mobile Play", () => {
    start();
    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Restart Measure" }));
    fireEvent.click(screen.getByRole("button", { name: "Restart Piece" }));
    expect(mocks.resetInput).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Exit Mobile Play" })).toBeTruthy();

    act(() => submit([60, 64]));
    act(() => submit([67]));
    expect(screen.getByText("Measure 2 of 3")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next Measure" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next Measure" }));
    expect(screen.getByText("Measure 3 of 3")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Exit Mobile Play" })).toBeTruthy();
  });

  it("distinguishes Mobile Play exit from Piece Practice exit and restores focus", async () => {
    const onExit = vi.fn();
    render(<PiecePracticeSession now={() => 65_000} onExit={onExit} piece={piece()} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Exit Mobile Play" }));
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 0)); });
    expect(onExit).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Mobile Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Exit Piece Practice" }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("remains in Mobile Play through completion and Practice Again", () => {
    start(piece(), 3);
    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    act(() => submit([69]));
    expect(screen.getByRole("heading", { name: "Piece complete" })).toBe(document.activeElement);
    expect(screen.getByRole("button", { name: "Exit Mobile Play" })).toBeTruthy();
    expect(screen.getByText("Completed targets")).toBeTruthy();
    expect(screen.getByText("Mistakes")).toBeTruthy();
    expect(screen.getByText("Elapsed")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Exit Mobile Play" }));
    expect(screen.queryByRole("button", { name: "Exit Mobile Play" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Practice Again" }));
    expect(screen.getByRole("button", { name: "Exit Mobile Play" })).toBeTruthy();
    expect(screen.getByText(/Measure 3 of 3 .* Practicing from Measure 3/)).toBeTruthy();
  });

  it("routes virtual keyboard presses through the single input owner", () => {
    start(piece(), 3);
    expect(mocks.useInputCalls).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Virtual C4" }));
    expect(screen.getByText("Incorrect — try the same target again.")).toBeTruthy();
  });

  it("does not mutate the PiecePracticePiece or invoke persistence/Sequence conversion", () => {
    const source = piece();
    const before = structuredClone(source);
    start(source);
    act(() => submit([60, 64]));
    expect(source).toEqual(before);
  });

  it("runs a realistic validated 6/8 polyphonic and tied piece through retry, completion, and exit", () => {
    const sourceScore = realisticPolyphonicScore();
    const sourceBefore = structuredClone(sourceScore);
    const projection = projectStaffBuilderPieceForPractice(sourceScore);
    expect(projection.ok).toBe(true);
    if (!projection.ok) throw new Error("Expected the realistic score to be eligible.");
    const projectedBefore = structuredClone(projection.piece);
    expect(projection.piece.measures.map(({ targets }) => targets.map(({ startTick, expectedMidiNumbers }) => [startTick, expectedMidiNumbers]))).toEqual([
      [[0, [48, 55, 64]], [480, [60]], [720, [62]], [960, [65]]],
      [[0, [52, 69]]],
    ]);

    const onExit = vi.fn();
    render(<PiecePracticeSession now={() => 65_000} onExit={onExit} piece={projection.piece} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    expect(screen.getByTestId("score-view").dataset.highlights).toBe("bass-chord,sustained-e");
    act(() => submit([48, 55]));
    expect(screen.getByText("Target 1 of 4")).toBeTruthy();
    act(() => submit([64, 55, 48]));
    act(() => submit([60]));
    act(() => submit([62]));
    act(() => submit([65]));
    expect(screen.getByText("Measure 2 of 2")).toBeTruthy();
    expect(screen.getByText("Expected: E3, A4")).toBeTruthy();
    act(() => submit([52, 69]));
    expect(screen.getByRole("heading", { name: "Piece complete" })).toBeTruthy();
    expect(screen.getByText("Mistakes").parentElement?.querySelector("dd")?.textContent).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Exit Piece Practice" }));
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(sourceScore).toEqual(sourceBefore);
    expect(projection.piece).toEqual(projectedBefore);
  });
});
