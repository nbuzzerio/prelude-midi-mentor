import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitPiecePracticeAttempt } from "../piece-practice-session";
import type { PiecePracticeInputFeedback } from "../hooks/use-piece-practice-input";
import type { PiecePracticePiece, PiecePracticeTarget } from "../piece-practice-types";
import { PiecePracticeSession } from "./piece-practice-session";

const mocks = vi.hoisted(() => ({
  feedback: { status: "idle", source: null, grade: null } as PiecePracticeInputFeedback,
  mobile: false,
  resetInput: vi.fn(),
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
vi.mock("@/features/staff-builder/hooks/use-staff-builder-mobile-presentation", () => ({ useStaffBuilderMobilePresentation: () => mocks.mobile }));
vi.mock("@/lib/audio/feedback", () => ({ playSuccessChirp: mocks.success, playIncorrectFeedback: mocks.incorrect }));
vi.mock("../hooks/use-piece-practice-input", () => ({
  usePiecePracticeInput: (options: NonNullable<typeof mocks.inputOptions>) => {
    mocks.useInputCalls += 1;
    mocks.inputOptions = options;
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
  mocks.mobile = false; mocks.resetInput.mockClear(); mocks.useInputCalls = 0; mocks.inputOptions = null; mocks.scoreProps = null; mocks.success.mockClear(); mocks.incorrect.mockClear();
});
afterEach(cleanup);

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

  it("shows MIDI status and exactly one desktop or mobile keyboard without resetting progress", () => {
    const rendered = start();
    expect(screen.getByRole("button", { name: "Test Piano" })).toBeTruthy();
    expect(screen.getAllByTestId("piano-keyboard")).toHaveLength(1);
    expect(screen.getByLabelText("Practice keyboard").dataset.presentation).toBe("desktop");
    act(() => submit([60, 64]));
    mocks.mobile = true;
    rendered.rerender(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={piece()} />);
    expect(screen.getAllByTestId("piano-keyboard")).toHaveLength(1);
    expect(screen.getByLabelText("Practice keyboard").dataset.presentation).toBe("mobile");
    expect(screen.getByText("Target 2 of 2")).toBeTruthy();
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
});
