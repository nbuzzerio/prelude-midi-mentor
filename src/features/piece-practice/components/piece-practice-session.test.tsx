import { resolveStaffBuilderMeasureContext } from "@/features/staff-builder/staff-builder-score";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import { focusPiecePracticeProjection, projectStaffBuilderPieceForPractice } from "../piece-practice-projection";
import { createPiecePracticeSession, getCurrentPiecePracticeTarget, skipCurrentPiecePracticeTarget, submitPiecePracticeAttempt, submitPiecePracticePitch } from "../piece-practice-session";
import { createPiecePracticeRun, parsePiecePracticeRun, type PiecePracticeRunRecordV1, type PiecePracticeRunStore } from "../persistence/piece-practice-runs";
import type { PiecePracticeInputFeedback } from "../hooks/use-piece-practice-input";
import type { PiecePracticePiece, PiecePracticeTarget } from "../piece-practice-types";
import { PiecePracticeSession } from "./piece-practice-session";
import { PiecePracticeResults } from "./piece-practice-results";
import type { PiecePracticeSessionState } from "../piece-practice-session";

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
    const highlights = (props.eventHighlights ?? []) as readonly { eventId: string; status: string }[];
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
      skipCurrentTarget: () => {
        const result = skipCurrentPiecePracticeTarget(options.piece, options.sessionState);
        if (!result.skipped) return false;
        mocks.feedback = { status: "idle", source: null, grade: null };
        mocks.resetInput();
        options.onSessionStateChange(result.state);
        return true;
      },
    };
  },
}));
vi.mock("@/components/notation/piano-keyboard", () => ({ default: ({ onNoteToggle }: { onNoteToggle: (midi: number) => void }) => <div data-testid="piano-keyboard"><button onClick={() => onNoteToggle(60)} type="button">Virtual C4</button></div> }));

function pitch(sourceEventId: string, sourcePitchId: string, midiNumber: number, letter: "C" | "E" | "G" | "A", staff: "treble" | "bass" = "treble") {
  return { sourceEventId, sourcePitchId, staff, midiNumber, letter, accidental: "natural" as const, octave: 4, duration: "quarter" as const, durationTicks: 480, incomingTieIds: [], outgoingTieIds: [] };
}

function target(id: string, measureIndex: number, startTick: number, pitches: ReturnType<typeof pitch>[]): PiecePracticeTarget {
  const base = { id, measureIndex, sourceMeasureId: `m${measureIndex + 1}`, startTick, absoluteStartTick: measureIndex * 1920 + startTick, sourceEventIds: [...new Set(pitches.map(({ sourceEventId }) => sourceEventId))].sort(), expectedMidiNumbers: [...new Set(pitches.map(({ midiNumber }) => midiNumber))].sort(), attackedPitches: pitches };
  return { ...base, checks: [{ id: `${id}:normal`, kind: "normal", sourceEventIds: base.sourceEventIds, expectedMidiNumbers: base.expectedMidiNumbers, attackedPitches: pitches }] };
}

function piece(): PiecePracticePiece {
  const first = target("m1:attack:0", 0, 0, [pitch("treble-event", "c", 60, "C"), pitch("bass-event", "e", 64, "E", "bass")]);
  const second = target("m1:attack:480", 0, 480, [pitch("polyphonic-event", "g", 67, "G")]);
  const last = target("m3:attack:0", 2, 0, [pitch("last-event", "a", 69, "A")]);
  return {
    sourceScoreId: "score", sourceScoreUpdatedAt: "2026-08-10T12:00:00.000Z", title: "Hallelujah", tempoBpm: 90,
    measures: [
      { measureIndex: 0, sourceMeasureId: "m1", absoluteStartTick: 0, capacityTicks: 1920, keySignatureId: "c-major", timeSignature: "4/4", clefs: { treble: "treble", bass: "bass" }, restEventIds: [], targets: [first, second], sourceEvents: [
        { sourceEventId: "treble-event", kind: "notes", staff: "treble", startTick: 0, absoluteStartTick: 0, duration: "quarter", durationTicks: 480, pitches: [{ sourcePitchId: "c", midiNumber: 60, letter: "C", accidental: "natural", octave: 4, incomingTieIds: [], outgoingTieIds: [], requiresAttack: true }] },
        { sourceEventId: "bass-event", kind: "notes", staff: "bass", startTick: 0, absoluteStartTick: 0, duration: "half", durationTicks: 960, pitches: [{ sourcePitchId: "e", midiNumber: 64, letter: "E", accidental: "natural", octave: 4, incomingTieIds: [], outgoingTieIds: [], requiresAttack: true }] },
        { sourceEventId: "polyphonic-event", kind: "notes", staff: "treble", startTick: 480, absoluteStartTick: 480, duration: "quarter", durationTicks: 480, pitches: [{ sourcePitchId: "g", midiNumber: 67, letter: "G", accidental: "natural", octave: 4, incomingTieIds: [], outgoingTieIds: [], requiresAttack: true }] },
      ] },
      { measureIndex: 1, sourceMeasureId: "m2", absoluteStartTick: 1920, capacityTicks: 1920, keySignatureId: "c-major", timeSignature: "4/4", clefs: { treble: "treble", bass: "bass" }, restEventIds: ["rest"], targets: [], sourceEvents: [{ sourceEventId: "rest", kind: "rest", staff: "treble", startTick: 0, absoluteStartTick: 1920, duration: "whole", durationTicks: 1920 }] },
      { measureIndex: 2, sourceMeasureId: "m3", absoluteStartTick: 3840, capacityTicks: 1920, keySignatureId: "c-major", timeSignature: "4/4", clefs: { treble: "treble", bass: "bass" }, restEventIds: [], targets: [last], sourceEvents: [{ sourceEventId: "last-event", kind: "notes", staff: "treble", startTick: 0, absoluteStartTick: 3840, duration: "whole", durationTicks: 1920, pitches: [{ sourcePitchId: "a", midiNumber: 69, letter: "A", accidental: "natural", octave: 4, incomingTieIds: [], outgoingTieIds: [], requiresAttack: true }] }] },
    ],
  };
}

function realisticPolyphonicScore(): StaffBuilderScore {
  const note = (id: string, staff: "treble" | "bass", startTick: number, duration: "dotted-half" | "dotted-quarter" | "quarter" | "eighth", pitches: readonly { id: string; midiNumber: number; letter: "A" | "C" | "D" | "E" | "F" | "G"; octave: number }[]) => ({
    id, kind: "notes" as const, staff, startTick, rhythm: { status: "final" as const, duration },
    pitches: pitches.map((source) => ({ ...source, accidental: "natural" as const })),
  });
  return {
    schemaVersion: 4, annotations: [], id: "realistic-6-8", title: "Six-Eight Practice Study", createdAt: "2026-08-10T12:00:00.000Z", updatedAt: "2026-08-10T12:00:00.000Z",
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

function runStore(): PiecePracticeRunStore & { records: PiecePracticeRunRecordV1[] } {
  const records: PiecePracticeRunRecordV1[] = [];
  return { records, async list() { return [...records]; }, async save(record) { records.push(record); }, async discard() {} };
}

function heldCompletionStore() {
  let resolveCompletion!: () => void;
  let rejectCompletion!: (error: Error) => void;
  const completion = new Promise<void>((resolve, reject) => { resolveCompletion = resolve; rejectCompletion = reject; });
  const store: PiecePracticeRunStore & { records: PiecePracticeRunRecordV1[] } = {
    records: [], async list() { return [...this.records]; },
    save(record) {
      if (record.status === "completed") return completion.then(() => { this.records.push(record); });
      this.records.push(record);
      return Promise.resolve();
    },
    async discard() {},
  };
  return { store, resolveCompletion, rejectCompletion };
}

function unloadIsProtected() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

function controlledRunStore() {
  const writes: { record: PiecePracticeRunRecordV1; resolve: () => void; reject: (error: Error) => void }[] = [];
  const store: PiecePracticeRunStore = {
    async list() { return []; },
    save(record) {
      return new Promise<void>((resolve, reject) => { writes.push({ record, resolve, reject }); });
    },
    async discard() {},
  };
  return { store, writes };
}

function completeBySkipping() {
  for (let i = 0; i < 30 && mocks.inputOptions?.sessionState.status !== "piece-complete"; i += 1) {
    const next = screen.queryByRole("button", { name: "Next Measure" });
    fireEvent.click(next ?? screen.getByRole("button", { name: "Skip Target" }));
  }
  expect(mocks.inputOptions?.sessionState.status).toBe("piece-complete");
}

function completedSavedRun() {
  const score = realisticPolyphonicScore();
  const projected = projectStaffBuilderPieceForPractice(score);
  if (!projected.ok) throw new Error("Invalid fixture");
  const created = createPiecePracticeSession(projected.piece, { startMeasureIndex: 0, startedAtMs: 0 });
  if (!created.ok) throw new Error("Invalid range");
  let state = created.state;
  for (let i = 0; i < 20 && state.status !== "piece-complete"; i += 1) state = skipCurrentPiecePracticeTarget(projected.piece, state, i + 1).state;
  if (state.status !== "piece-complete") throw new Error("Fixture did not complete");
  return { score, piece: projected.piece, record: createPiecePracticeRun(score, state, 50) };
}

function start(source = piece(), measure = 1, endMeasure: number | null = null) {
  const rendered = render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={source} runStore={runStore()} />);
  if (measure !== 1) fireEvent.change(screen.getByLabelText("Start Measure"), { target: { value: String(measure - 1) } });
  if (endMeasure !== null) fireEvent.change(screen.getByLabelText(/End Measure/), { target: { value: String(endMeasure - 1) } });
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
  it.each(["resolve", "reject"] as const)("ignores a late original checkpoint %s while focused completion is pending and restores original durability", async (settle) => {
    const { store, writes } = controlledRunStore();
    render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={piece()} runStore={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    const earlierOriginal = writes[0];
    completeBySkipping();
    const originalState = mocks.inputOptions!.sessionState;
    const original = writes.at(-1)!;
    await act(async () => { original.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Practice measure 3" }));
    act(() => submit([69]));
    const focusedState = mocks.inputOptions!.sessionState;
    const focused = writes.at(-1)!;
    expect(focused.record.runId).not.toBe(original.record.runId);
    await act(async () => { earlierOriginal[settle](new Error("Late checkpoint failure")); });
    expect(mocks.inputOptions!.sessionState).toBe(focusedState);
    expect(screen.queryByText("Completed practice saved.")).toBeNull();
    expect(screen.getByText(/Saving the completed practice result/)).toBeTruthy();
    expect(screen.getByText(/Focused result is not safely stored/)).toBeTruthy();
    expect(unloadIsProtected()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Return to Improve" }));
    await act(async () => { focused.resolve(); });
    expect(mocks.inputOptions!.sessionState).toBe(originalState);
    expect(screen.getByText("Completed practice saved.")).toBeTruthy();
    expect(screen.queryByText(/Focused result is not safely stored/)).toBeNull();
    expect(unloadIsProtected()).toBe(false);
  });

  it.each(["resolve", "reject"] as const)("isolates a late abandoned focused checkpoint %s from another passage's pending result", async (settle) => {
    const original = completedSavedRun();
    const { store, writes } = controlledRunStore();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    try {
      render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={original.piece} recoveredRun={original.record} runStore={store} />);
      fireEvent.click(screen.getByRole("button", { name: "Practice measure 1" }));
      const abandoned = writes.at(-1)!;
      fireEvent.click(screen.getByRole("button", { name: "Return to Improve" }));
      const restored = mocks.inputOptions!.sessionState;
      expect(restored.skipEvidence).toEqual(original.record.checkpoint.skipEvidence);
      expect(unloadIsProtected()).toBe(false);
      fireEvent.click(screen.getByRole("button", { name: "Practice measure 2" }));
      completeBySkipping();
      const pending = writes.at(-1)!;
      const pendingState = mocks.inputOptions!.sessionState;
      await act(async () => { abandoned[settle](new Error("Late abandoned failure")); });
      expect(mocks.inputOptions!.sessionState).toBe(pendingState);
      expect(screen.queryByText("Completed practice saved.")).toBeNull();
      expect(screen.getByText(/Saving the completed practice result/)).toBeTruthy();
      expect(unloadIsProtected()).toBe(true);
      expect(screen.queryByRole("region", { name: "Measure 1 practice comparison" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Return to Improve" }));
      await act(async () => { pending.resolve(); });
      expect(mocks.inputOptions!.sessionState).toBe(restored);
      expect(screen.getByRole("region", { name: "Measure 2 practice comparison" })).toBeTruthy();
      expect(unloadIsProtected()).toBe(false);
    } finally { confirm.mockRestore(); }
  });

  it.each(["resolve", "reject"] as const)("ignores a late pre-restart checkpoint %s during the replacement focused completion", async (settle) => {
    const original = completedSavedRun();
    const { store, writes } = controlledRunStore();
    render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={original.piece} recoveredRun={original.record} runStore={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Practice measure 2" }));
    const old = writes.at(-1)!;
    fireEvent.click(screen.getByRole("button", { name: "Restart Piece" }));
    const restarted = writes.at(-1)!;
    expect(restarted.record.runId).not.toBe(old.record.runId);
    expect(restarted.record.configuration).toEqual(old.record.configuration);
    expect(restarted.record.sourceScore).toEqual(original.record.sourceScore);
    expect(restarted.record.checkpoint.mistakeEvidence).toEqual([]);
    completeBySkipping();
    const completed = writes.at(-1)!;
    await act(async () => { old[settle](new Error("Late restart failure")); });
    expect(screen.queryByText("Completed practice saved.")).toBeNull();
    expect(unloadIsProtected()).toBe(true);
    await act(async () => { completed.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Return to Improve" }));
    expect(mocks.inputOptions!.sessionState.skipEvidence).toEqual(original.record.checkpoint.skipEvidence);
    expect(screen.queryByText(/Focused result is not safely stored/)).toBeNull();
    expect(unloadIsProtected()).toBe(false);
  });

  it("keeps a failed completed comparison explicitly unsaved across an unfinished repetition", async () => {
    const original = completedSavedRun();
    const { store, writes } = controlledRunStore();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    try {
      render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={original.piece} recoveredRun={original.record} runStore={store} />);
      fireEvent.click(screen.getByRole("button", { name: "Practice measure 2" }));
      completeBySkipping();
      const failed = writes.at(-1)!;
      await act(async () => { failed.reject(new Error("Storage full")); });
      fireEvent.click(screen.getByRole("button", { name: "Practice Again" }));
      await screen.findByRole("button", { name: "Restart Piece" });
      expect(confirm).toHaveBeenCalledWith("The completed practice result is not safely stored. Start a new run anyway?");
      fireEvent.click(screen.getByRole("button", { name: "Return to Improve" }));
      const comparison = screen.getByRole("region", { name: "Measure 2 practice comparison" });
      expect(within(comparison).getByText(/Focused result is not safely stored/)).toBeTruthy();
      expect(screen.getByText("Completed practice saved.")).toBeTruthy();
      expect(unloadIsProtected()).toBe(false);
      fireEvent.click(screen.getByRole("button", { name: "Practice measure 2" }));
      completeBySkipping();
      await act(async () => { writes.at(-1)!.resolve(); });
      fireEvent.click(screen.getByRole("button", { name: "Return to Improve" }));
      expect(screen.queryByText(/Focused result is not safely stored/)).toBeNull();
    } finally { confirm.mockRestore(); }
  });

  it("restores an acknowledged unsaved original run's failed status and unload protection", async () => {
    const { store, writes } = controlledRunStore();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    try {
      render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={piece()} runStore={store} />);
      fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
      completeBySkipping();
      const originalState = mocks.inputOptions!.sessionState;
      const original = writes.at(-1)!;
      await act(async () => { original.reject(new Error("Original failed")); });
      fireEvent.click(screen.getByRole("button", { name: "Practice measure 3" }));
      await screen.findByRole("button", { name: "Return to Improve" });
      act(() => submit([69]));
      await act(async () => { writes.at(-1)!.resolve(); });
      expect(screen.getByText("Completed practice saved.")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Return to Improve" }));
      expect(mocks.inputOptions!.sessionState).toBe(originalState);
      expect(screen.queryByText("Completed practice saved.")).toBeNull();
      expect(screen.getByText(/not safely stored for crash or reload recovery/)).toBeTruthy();
      expect(screen.queryByText(/Focused result is not safely stored/)).toBeNull();
      expect(unloadIsProtected()).toBe(true);
    } finally { confirm.mockRestore(); }
  });

  it("recovers a focused attempt through the existing V1 parser paused, without inventing a persisted Improve relationship", () => {
    const original = completedSavedRun(); const store = runStore();
    const rendered = render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={original.piece} recoveredRun={original.record} runStore={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Practice measure 2" }));
    const focused = store.records.at(-1)!;
    const parsed = parsePiecePracticeRun(focused);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("Focused record did not parse");
    rendered.unmount();
    render(<PiecePracticeSession now={() => 100_000} onExit={vi.fn()} piece={parsed.piece} recoveredRun={parsed.record} runStore={store} />);
    expect(screen.getByText("Recovered practice session")).toBeTruthy();
    expect(mocks.inputOptions?.sessionState).toMatchObject({ startMeasureIndex: 1, endMeasureIndex: 1, assessmentFocus: "both", clockPaused: true });
    expect(screen.queryByRole("button", { name: "Return to Improve" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Resume Practice" }));
    expect(mocks.inputOptions?.sessionState.clockPaused).toBe(false);
  });

  it("keeps Mobile Play and one input tree across launch, completion and return", async () => {
    const { container } = start(piece()); completeBySkipping(); await screen.findByText("Completed practice saved.");
    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Practice measure 3" }));
    expect(container.querySelectorAll(".mobile-play-mode")).toHaveLength(1);
    expect(screen.getAllByTestId("piano-keyboard")).toHaveLength(1);
    act(() => submit([69])); await screen.findByText("Completed practice saved.");
    fireEvent.click(screen.getByRole("button", { name: "Return to Improve" }));
    expect(container.querySelectorAll(".mobile-play-mode")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Exit Mobile Play" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Practice measure 3" }));
    expect(mocks.inputMounts).toBe(1); expect(mocks.inputUnmounts).toBe(0);
  });

  it("allows a restart-only targetless measure to be revisited with existing explicit Next Measure progression", async () => {
    start(piece());
    fireEvent.click(screen.getByRole("button", { name: "Skip Target" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip Target" }));
    fireEvent.click(screen.getByRole("button", { name: "Restart Measure" }));
    fireEvent.click(screen.getByRole("button", { name: "Next Measure" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip Target" }));
    await screen.findByText("Completed practice saved.");
    expect(screen.getByText("Recorded in the original run: 1 measure restart.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Practice measure 2" }));
    expect(screen.getByRole("button", { name: "Next Measure" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Skip Target" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next Measure" }));
    expect(mocks.inputOptions?.sessionState.status).toBe("piece-complete");
    expect(mocks.inputOptions?.sessionState.currentMeasureIndex).toBe(1);
    expect(screen.getByRole("region", { name: "Measure 2 practice comparison" })).toBeTruthy();
  });

  it("returns to original evidence and replaces only the latest completed comparison for a repeated passage", async () => {
    const store = runStore();
    render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={piece()} runStore={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    completeBySkipping();
    await screen.findByText("Completed practice saved.");
    const originalState = mocks.inputOptions!.sessionState;
    fireEvent.click(screen.getByRole("button", { name: "Practice measure 3" }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Hallelujah" }));
    act(() => submit([69]));
    await screen.findByText("Completed practice saved.");
    let comparison = screen.getByRole("region", { name: "Measure 3 practice comparison" });
    expect(within(comparison).getAllByText("Skipped targets").map((dt) => dt.nextElementSibling?.textContent)).toEqual(["1", "0"]);
    fireEvent.click(screen.getByRole("button", { name: "Return to Improve" }));
    expect(mocks.inputOptions?.sessionState).toBe(originalState);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Practice measure 3" }));
    expect(screen.getByText(/Original results restored/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Practice measure 3" }));
    act(() => submit([60])); act(() => submit([69]));
    await screen.findByText("Completed practice saved.");
    fireEvent.click(screen.getByRole("button", { name: "Return to Improve" }));
    comparison = screen.getByRole("region", { name: "Measure 3 practice comparison" });
    expect(within(comparison).getAllByText("Mistakes").map((dt) => dt.nextElementSibling?.textContent)).toEqual(["0", "1"]);
    expect(screen.getAllByRole("region", { name: /practice comparison/ })).toHaveLength(1);
    expect(mocks.inputOptions?.sessionState).toBe(originalState);
    expect(new Set(store.records.map(({ runId }) => runId)).size).toBe(3);
    expect(mocks.inputMounts).toBe(1);
  });

  it("waits for the focused completed save before return and restores recommendation focus afterward", async () => {
    const original = completedSavedRun();
    const { store, resolveCompletion } = heldCompletionStore();
    render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={original.piece} recoveredRun={original.record} runStore={store} sourceScore={original.score} />);
    fireEvent.click(screen.getByRole("button", { name: "Practice measure 2" }));
    completeBySkipping();
    fireEvent.click(screen.getByRole("button", { name: "Return to Improve" }));
    expect(screen.getByText("Waiting for the completed result to finish saving.")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Improve" })).toBeNull();
    expect(unloadIsProtected()).toBe(true);
    await act(async () => { resolveCompletion(); });
    await screen.findByRole("region", { name: "Improve" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Practice measure 2" }));
    expect(unloadIsProtected()).toBe(false);
    expect(screen.getByRole("region", { name: "Measure 2 practice comparison" })).toBeTruthy();
  });

  it("keeps failed focused results available until return is acknowledged without transferring failure to the original", async () => {
    const original = completedSavedRun();
    const { store, rejectCompletion } = heldCompletionStore();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={original.piece} recoveredRun={original.record} runStore={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Practice measure 2" }));
    completeBySkipping();
    await act(async () => { rejectCompletion(new Error("Storage unavailable")); });
    fireEvent.click(screen.getByRole("button", { name: "Return to Improve" }));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith("The completed practice result is not safely stored. Return to Improve anyway?"));
    expect(screen.getByRole("region", { name: "Measure 2 practice comparison" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Improve" })).toBeNull();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Return to Improve" }));
    await screen.findByRole("region", { name: "Improve" });
    expect(screen.getByText("Completed practice saved.")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Measure 2 practice comparison" })).getByText(/Focused result is not safely stored/)).toBeTruthy();
    expect(unloadIsProtected()).toBe(false);
    expect(mocks.inputOptions?.sessionState.skipEvidence).toEqual(original.record.checkpoint.skipEvidence);
    confirm.mockRestore();
  });

  it("uses the reopened run snapshot and preserves incoming ties at the focused boundary", () => {
    const original = completedSavedRun(); const store = runStore();
    render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={original.piece} recoveredRun={original.record} runStore={store}
      sourceScore={{ ...original.score, title: "Later library revision", ties: [] }} />);
    fireEvent.click(screen.getByRole("button", { name: "Practice measure 2" }));
    expect(store.records.at(-1)?.sourceScore).toEqual(original.record.sourceScore);
    const options = mocks.inputOptions!;
    expect(getCurrentPiecePracticeTarget(options.piece, options.sessionState)?.expectedMidiNumbers).toEqual([52, 65, 69]);
    expect((mocks.scoreProps?.score as StaffBuilderScore).ties).toEqual(original.score.ties);
  });

  it("retains the latest completed comparison when a subsequent focused repetition ends unfinished", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    start(piece()); completeBySkipping(); await screen.findByText("Completed practice saved.");
    fireEvent.click(screen.getByRole("button", { name: "Practice measure 3" }));
    act(() => submit([69])); await screen.findByText("Completed practice saved.");
    fireEvent.click(screen.getByRole("button", { name: "Practice Again" }));
    expect(mocks.inputOptions?.sessionState.startMeasureIndex).toBe(2);
    expect(mocks.inputOptions?.sessionState.endMeasureIndex).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Return to Improve" }));
    expect(screen.getByText(/ended before completion; no completed comparison was added/)).toBeTruthy();
    expect(screen.getByRole("region", { name: "Measure 3 practice comparison" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Practice Again" }));
    expect(mocks.inputOptions?.sessionState.startMeasureIndex).toBe(0);
    expect(screen.queryByRole("button", { name: "Return to Improve" })).toBeNull();
    completeBySkipping();
    expect(screen.queryByRole("region", { name: /practice comparison/ })).toBeNull();
    confirm.mockRestore();
  });

  it("launches a recommended original measure as a fresh run with the same snapshot and one input owner", async () => {
    const score = realisticPolyphonicScore();
    const projected = projectStaffBuilderPieceForPractice(score);
    if (!projected.ok) throw new Error("Invalid fixture");
    const store = runStore();
    render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={projected.piece} runStore={store} sourceScore={score} />);
    fireEvent.click(screen.getByLabelText("Lower Staff"));
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    completeBySkipping();
    await screen.findByText("Completed practice saved.");
    const original = store.records.at(-1)!;
    const originalCopy = structuredClone(original);
    fireEvent.click(screen.getByRole("button", { name: "Practice measure 2" }));
    const focused = store.records.at(-1)!;
    expect(focused.runId).not.toBe(original.runId);
    expect(focused.configuration).toEqual({ startMeasureIndex: 1, endMeasureIndex: 1, assessmentFocus: "lower" });
    expect(focused.sourceScore).toEqual(original.sourceScore);
    expect(focused.checkpoint.skipEvidence).toEqual([]);
    expect(focused.checkpoint.mistakeEvidence).toEqual([]);
    expect(focused.checkpoint.restartEvidence).toEqual([]);
    expect(mocks.inputOptions?.sessionState.firstTargetTimingPending).toBe(true);
    expect(mocks.inputOptions?.piece.measures).toHaveLength(2);
    expect(mocks.inputMounts).toBe(1);
    expect(mocks.inputUnmounts).toBe(0);
    expect(screen.getAllByTestId("piano-keyboard")).toHaveLength(1);
    expect(original).toEqual(originalCopy);
    expect(unloadIsProtected()).toBe(true);
    expect(screen.getByRole("button", { name: "Return to Improve" })).toBeTruthy();
  });

  it("waits for the original completed revision before launching Improve and rejects duplicate launch clicks", async () => {
    const { store, resolveCompletion } = heldCompletionStore();
    render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={piece()} runStore={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    completeBySkipping();
    const originalId = store.records[0].runId;
    const launch = screen.getByRole("button", { name: "Practice measure 1" });
    fireEvent.click(launch); fireEvent.click(launch);
    expect(screen.getByText("Waiting for the completed result to finish saving.")).toBeTruthy();
    expect(store.records.every(({ runId }) => runId === originalId)).toBe(true);
    await act(async () => { resolveCompletion(); });
    await screen.findByRole("button", { name: "Return to Improve" });
    expect(new Set(store.records.map(({ runId }) => runId)).size).toBe(2);
  });

  it("requires explicit acknowledgement after a failed original save before starting Improve", async () => {
    const { store, rejectCompletion } = heldCompletionStore();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={piece()} runStore={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    completeBySkipping();
    await act(async () => { rejectCompletion(new Error("Full")); });
    fireEvent.click(screen.getByRole("button", { name: "Practice measure 1" }));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith("The completed practice result is not safely stored. Start focused practice anyway?"));
    expect(screen.queryByRole("button", { name: "Return to Improve" })).toBeNull();
    expect(unloadIsProtected()).toBe(true);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Practice measure 1" }));
    await screen.findByRole("button", { name: "Return to Improve" });
    confirm.mockRestore();
  });

  it("cancels unfinished return without resetting input, then restores the original completed evidence when confirmed", async () => {
    const store = runStore(); const onExit = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<PiecePracticeSession now={() => 65_000} onExit={onExit} piece={piece()} runStore={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    completeBySkipping();
    await screen.findByText("Completed practice saved.");
    const originalState = mocks.inputOptions!.sessionState;
    fireEvent.click(screen.getByRole("button", { name: "Practice measure 3" }));
    mocks.resetInput.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Return to Improve" }));
    expect(mocks.resetInput).not.toHaveBeenCalled();
    expect(mocks.inputOptions?.sessionState.status).toBe("practicing");
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Return to Improve" }));
    expect(mocks.inputOptions?.sessionState).toBe(originalState);
    expect(store.records.at(-1)?.status).toBe("ended-incomplete");
    expect(onExit).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Improve" })).toBeTruthy();
    expect(mocks.inputMounts).toBe(1);
    confirm.mockRestore();
  });

  it("writes an initial active record and checkpoints wrong input and restart within the run", async () => {
    const store = runStore();
    render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={piece()} runStore={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    await waitFor(() => expect(store.records).toHaveLength(1));
    expect(store.records[0].checkpoint.firstTargetTimingPending).toBe(true);
    act(() => submit([61]));
    await waitFor(() => expect(store.records.length).toBeGreaterThan(1));
    expect(store.records.at(-1)?.checkpoint.mistakeEvidence).toHaveLength(1);
    const runId = store.records[0].runId;
    fireEvent.click(screen.getByRole("button", { name: "Restart Measure" }));
    expect(store.records.at(-1)?.runId).toBe(runId);
    expect(store.records.at(-1)?.revision).toBeGreaterThan(2);
  });

  it("keeps a run active on cancelled Exit and terminalizes it on accepted Exit", () => {
    const store = runStore();
    const onExit = vi.fn();
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal("confirm", confirm);
    render(<PiecePracticeSession now={() => 65_000} onExit={onExit} piece={piece()} runStore={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    fireEvent.click(screen.getByRole("button", { name: "Exit Piece Practice" }));
    expect(onExit).not.toHaveBeenCalled();
    expect(store.records.at(-1)?.status).toBe("active");
    fireEvent.click(screen.getByRole("button", { name: "Exit Piece Practice" }));
    expect(onExit).toHaveBeenCalledOnce();
    expect(store.records.at(-1)?.status).toBe("ended-incomplete");
  });

  it("creates a new run for Restart Piece and leaves the previous evidence terminal", () => {
    const store = runStore();
    render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={piece()} runStore={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    const originalId = store.records[0].runId;
    fireEvent.click(screen.getByRole("button", { name: "Restart Piece" }));
    expect(store.records.at(-2)?.runId).toBe(originalId);
    expect(store.records.at(-2)?.status).toBe("ended-incomplete");
    expect(store.records.at(-1)?.runId).not.toBe(originalId);
    expect(store.records.at(-1)?.status).toBe("active");
  });

  it("leaves an unfinished run recoverable on unmount and warns on browser unload", () => {
    const store = runStore();
    const discard = vi.spyOn(store, "discard");
    const rendered = render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={piece()} runStore={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    const unloading = new Event("beforeunload", { cancelable: true });
    act(() => { window.dispatchEvent(unloading); });
    expect(unloading.defaultPrevented).toBe(true);
    rendered.unmount();
    expect(store.records.at(-1)?.status).toBe("active");
    expect(discard).not.toHaveBeenCalled();
    const afterUnmount = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterUnmount);
    expect(afterUnmount.defaultPrevented).toBe(false);
  });

  it("persists completion, skips the unload warning, and gives Practice Again a new run ID", async () => {
    const store = runStore();
    render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={piece()} runStore={store} />);
    fireEvent.change(screen.getByLabelText("Start Measure"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    const firstRunId = store.records[0].runId;
    act(() => submit([69]));
    expect(store.records.at(-1)?.status).toBe("completed");
    expect(store.records.at(-1)?.completedAt).toBeTruthy();
    await screen.findByText("Completed practice saved.");
    const unloading = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unloading);
    expect(unloading.defaultPrevented).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Practice Again" }));
    expect(store.records.at(-1)?.runId).not.toBe(firstRunId);
    expect(store.records.at(-1)?.status).toBe("active");
  });

  it("protects a newly completed report until its final revision commits and waits on Exit", async () => {
    const { store, resolveCompletion } = heldCompletionStore();
    const onExit = vi.fn();
    render(<PiecePracticeSession now={() => 65_000} onExit={onExit} piece={piece()} runStore={store} />);
    fireEvent.change(screen.getByLabelText("Start Measure"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    act(() => submit([69]));
    expect(screen.getByRole("heading", { name: "Piece complete" })).toBeTruthy();
    expect(screen.getByText(/Saving the completed practice result/)).toBeTruthy();
    expect(unloadIsProtected()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Exit Piece Practice" }));
    expect(onExit).not.toHaveBeenCalled();
    expect(screen.getByText("Waiting for the completed result to finish saving.")).toBeTruthy();
    await act(async () => { resolveCompletion(); });
    expect(store.records.at(-1)?.status).toBe("completed");
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("acknowledges the exact completed revision before removing unload protection", async () => {
    const { store, resolveCompletion } = heldCompletionStore();
    render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={piece()} runStore={store} />);
    fireEvent.change(screen.getByLabelText("Start Measure"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    act(() => submit([69]));
    expect(unloadIsProtected()).toBe(true);
    await act(async () => { resolveCompletion(); });
    expect(screen.getByText("Completed practice saved.")).toBeTruthy();
    expect(store.records.at(-1)?.revision).toBe(2);
    expect(unloadIsProtected()).toBe(false);
  });

  it("keeps a failed completed report visible and protected until Exit is explicitly accepted", async () => {
    const { store, rejectCompletion } = heldCompletionStore();
    const onExit = vi.fn();
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal("confirm", confirm);
    render(<PiecePracticeSession now={() => 65_000} onExit={onExit} piece={piece()} runStore={store} />);
    fireEvent.change(screen.getByLabelText("Start Measure"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    act(() => submit([69]));
    await act(async () => { rejectCompletion(new Error("quota")); });
    expect(screen.getByRole("heading", { name: "Piece complete" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/not safely stored/);
    expect(unloadIsProtected()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Exit Piece Practice" }));
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
    expect(onExit).not.toHaveBeenCalled();
    expect(confirm.mock.calls[0]?.[0]).toMatch(/not safely stored/);
    fireEvent.click(screen.getByRole("button", { name: "Exit Piece Practice" }));
    await waitFor(() => expect(onExit).toHaveBeenCalledOnce());
  });

  it("shows a nonblocking warning after persistence failure", async () => {
    const store: PiecePracticeRunStore = { async list() { return []; }, async save() { throw new Error("quota"); }, async discard() {} };
    render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={piece()} runStore={store} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/recovery is currently unavailable/);
    expect(screen.getByText("Hallelujah")).toBeTruthy();
  });

  it("recovers a focused run paused with fresh input state and a separate Resume action", () => {
    const score = realisticPolyphonicScore();
    const projected = projectStaffBuilderPieceForPractice(score);
    if (!projected.ok) throw new Error("Expected valid score.");
    const focused = { ...projected.piece, assessmentFocus: "lower" as const };
    const created = createPiecePracticeSession(focused, { startMeasureIndex: 0, startedAtMs: 100 });
    if (!created.ok) throw new Error("Expected session.");
    const recoveredRun = createPiecePracticeRun(score, created.state, 100);
    render(<PiecePracticeSession now={() => 50_000} onExit={vi.fn()} piece={projected.piece} recoveredRun={recoveredRun} runStore={runStore()} sourceScore={score} />);
    expect(screen.getByText("Recovered practice session")).toBeTruthy();
    expect(screen.getByText("Assessing: Lower Staff")).toBeTruthy();
    expect(mocks.inputOptions?.sessionState.clockPaused).toBe(true);
    expect(mocks.scoreProps?.ghostedStaff).toBe("treble");
    fireEvent.click(screen.getByRole("button", { name: "Resume Practice" }));
    expect(mocks.inputOptions?.sessionState.clockPaused).toBe(false);
  });

  it.each([false, true])("persists repaired legacy completion with storageFailure=%s before acknowledging durability", async (storageFailure) => {
    const date = "2026-09-30T12:00:00.000Z";
    const pitches = [
      { id: "c", midiNumber: 60, letter: "C" as const, accidental: "natural" as const, octave: 4 },
      { id: "e", midiNumber: 64, letter: "E" as const, accidental: "natural" as const, octave: 4 },
    ];
    const source: StaffBuilderScore = {
      schemaVersion: 4, id: "legacy-roll", title: "Tied roll", createdAt: date, updatedAt: date,
      tempoBpm: 120, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", annotations: [],
      measures: [{ id: "m1", events: [
        { id: "origin", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "half" }, pitches, arpeggiation: "up" },
        { id: "continuation", kind: "notes", staff: "treble", startTick: 960, rhythm: { status: "final", duration: "half" }, pitches, arpeggiation: "up" },
        { id: "rest", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "half" } },
        { id: "parallel", kind: "notes", staff: "bass", startTick: 960, rhythm: { status: "final", duration: "half" },
          pitches: [{ id: "g", midiNumber: 55, letter: "G", accidental: "natural", octave: 3 }] },
      ] }],
      ties: pitches.map(({ id }) => ({ id: `${id}-tie`, fromEventId: "origin", fromPitchId: id, toEventId: "continuation", toPitchId: id })),
    };
    const projected = projectStaffBuilderPieceForPractice(source);
    if (!projected.ok) throw new Error("Expected legacy roll projection.");
    const created = createPiecePracticeSession(projected.piece, { startMeasureIndex: 0, startedAtMs: 0 });
    if (!created.ok) throw new Error(created.reason);
    let state = created.state;
    for (const midiNumber of [60, 64]) state = submitPiecePracticePitch(projected.piece, state, {
      targetId: getCurrentPiecePracticeTarget(projected.piece, state)!.id, midiNumber, atMs: 10,
    }).state;
    state = { ...state, currentCheckProgress: state.currentCheckProgress.map((progress, index) => ({ ...progress, completed: index === 0 })) };
    const legacy = createPiecePracticeRun(source, state, 40);
    const { store, resolveCompletion, rejectCompletion } = heldCompletionStore();
    const onExit = vi.fn();
    render(<PiecePracticeSession now={() => 50_000} onExit={onExit} piece={projected.piece} recoveredRun={legacy} runStore={store} sourceScore={source} />);
    expect(screen.getByRole("heading", { name: "Piece complete" })).toBeTruthy();
    expect(screen.getByText(/Saving the completed practice result/)).toBeTruthy();
    expect(screen.queryByText("Completed practice saved.")).toBeNull();
    expect(unloadIsProtected()).toBe(true);
    if (storageFailure) {
      await act(async () => { rejectCompletion(new Error("quota")); });
      expect(screen.getByRole("alert").textContent).toContain("not safely stored for crash or reload recovery");
      expect(unloadIsProtected()).toBe(true);
      expect(store.records).toHaveLength(0);
    } else {
      fireEvent.click(screen.getByRole("button", { name: "Exit Piece Practice" }));
      expect(onExit).not.toHaveBeenCalled();
      await act(async () => { resolveCompletion(); });
      expect(onExit).toHaveBeenCalledOnce();
      expect(store.records).toHaveLength(1);
      expect(store.records[0]).toMatchObject({ runId: legacy.runId, revision: legacy.revision + 1, status: "completed", checkpoint: { completedTargetCount: 2, mistakeEvidence: [] } });
      expect(screen.getByText("Completed practice saved.")).toBeTruthy();
      expect(unloadIsProtected()).toBe(false);
    }
    expect(legacy.status).toBe("active");
  });

  it("reopens completed results and printable report from the stored score alone", () => {
    const source = realisticPolyphonicScore();
    const projected = projectStaffBuilderPieceForPractice(source);
    if (!projected.ok) throw new Error("Expected valid score.");
    const focused = focusPiecePracticeProjection(projected.piece, "lower");
    const created = createPiecePracticeSession(focused, { startMeasureIndex: 0, startedAtMs: 100 });
    if (!created.ok) throw new Error("Expected session.");
    let state = created.state;
    for (let index = 0; index < 20 && state.status !== "piece-complete"; index += 1) {
      const skipped = skipCurrentPiecePracticeTarget(focused, state, 110 + index);
      if (!skipped.skipped) throw new Error("Expected target to skip.");
      state = skipped.state;
    }
    expect(state.status).toBe("piece-complete");
    const completed = createPiecePracticeRun(source, state, 200);
    render(<PiecePracticeSession now={() => 50_000} onExit={vi.fn()} piece={projected.piece} recoveredRun={completed} runStore={runStore()} sourceScore={source} />);
    expect(screen.getByRole("heading", { name: "Piece complete" })).toBeTruthy();
    expect(screen.getByText("Completed practice saved.")).toBeTruthy();
    expect(unloadIsProtected()).toBe(false);
    expect(screen.getByText("Assessment: Lower Staff")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Show MIDI details"));
    fireEvent.click(screen.getByLabelText("Include MIDI attack strength"));
    fireEvent.click(screen.getByRole("button", { name: "Generate Report" }));
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));
    expect(screen.getByRole("region", { name: "Six-Eight Practice Study practice report" })).toBeTruthy();
  });
  it("starts in strict Both Staves mode without staff ghosting", () => {
    start();
    expect(mocks.inputOptions?.sessionState.assessmentFocus).toBe("both");
    expect(mocks.scoreProps?.ghostedStaff).toBeUndefined();
    expect(screen.getByText("Assessing: Both Staves")).toBeTruthy();
  });

  it("defaults to Both Staves and fixes semantic focus for the active run and restarts", () => {
    render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={piece()} runStore={runStore()} />);
    expect((screen.getByRole("radio", { name: "Both Staves" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Lower Staff" }));
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    expect(screen.getByText("Assessing: Lower Staff")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "Upper Staff" })).toBeNull();
    expect(mocks.inputOptions?.sessionState.assessmentFocus).toBe("lower");
    expect(mocks.inputOptions?.piece.measures[0]!.targets[0]!.expectedMidiNumbers).toEqual([64]);
    expect(mocks.scoreProps?.ghostedStaff).toBe("treble");
    fireEvent.click(screen.getByRole("button", { name: "Restart Measure" }));
    expect(mocks.inputOptions?.sessionState.assessmentFocus).toBe("lower");
    fireEvent.click(screen.getByRole("button", { name: "Restart Piece" }));
    expect(mocks.inputOptions?.sessionState.assessmentFocus).toBe("lower");
  });

  it("retains assessment focus through completion and Practice Again", async () => {
    render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={piece()} runStore={runStore()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Lower Staff" }));
    fireEvent.change(screen.getByLabelText(/End Measure/), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    act(() => submit([64]));
    expect(screen.getByRole("heading", { name: "Piece complete" })).toBeTruthy();
    expect(screen.getAllByText("Assessment: Lower Staff").length).toBeGreaterThan(0);
    await screen.findByText("Completed practice saved.");
    fireEvent.click(screen.getByRole("button", { name: "Practice Again" }));
    expect(screen.getByText("Assessing: Lower Staff")).toBeTruthy();
    expect(mocks.inputOptions?.sessionState.assessmentFocus).toBe("lower");
  });

  it("uses F5, A5, and D6 for played, extra, and held live feedback", () => {
    start();
    const grade = { correct: false, expectedMidiNumbers: [60, 64], receivedMidiNumbers: [77, 81, 86], missingMidiNumbers: [60, 64], extraMidiNumbers: [77, 81, 86], unexpectedHeldMidiNumbers: [77, 81, 86], expectedWrittenPitches: piece().measures[0]!.targets[0]!.attackedPitches };
    mocks.feedback = { status: "incorrect", source: "midi", grade };
    act(() => mocks.inputOptions!.onSessionStateChange({ ...mocks.inputOptions!.sessionState }));
    expect(screen.getByText("Played: F5, A5, D6")).toBeTruthy();
    expect(screen.getByText("Extra: F5, A5, D6")).toBeTruthy();
    expect(screen.getByText("Other notes still held: F5, A5, D6")).toBeTruthy();
    expect(screen.queryByText(/MIDI 77/)).toBeNull();
  });
  it("classifies result rows by existing diagnostics and exposes the compact textual key", () => {
    const mistake = (measureIndex: number, sequence: number) => ({
      kind: "normal-attempt" as const, sequence, measureIndex, sourceMeasureId: `m${measureIndex + 1}`, targetId: `t${measureIndex}`, checkId: `c${measureIndex}`, occurredAtActiveMs: 100,
      expectedPitches: [], receivedMidiNumbers: [61], missingMidiNumbers: [], extraMidiNumbers: [61], unexpectedHeldMidiNumbers: [],
    });
    const hesitation = (measureIndex: number, sequence: number) => ({
      sequence, measureIndex, sourceMeasureId: `m${measureIndex + 1}`, targetId: `t${measureIndex}`, sourceEventIds: [], expectedPitches: [], timingBasis: "target-activation" as const, activatedAtActiveMs: 0,
      completedAtActiveMs: 3_000, responseDurationMs: 3_000, expectedWindowMs: 500, hesitationThresholdMs: 2_500, isHesitation: true, outcome: "completed" as const,
    });
    const state = {
      measureTimings: Array.from({ length: 5 }, (_, measureIndex) => ({ measureIndex, sourceMeasureId: `m${measureIndex + 1}`, activeDurationMs: 1_000 })),
      mistakeEvidence: [mistake(1, 0), mistake(3, 1)], targetTimings: [hesitation(2, 0), hesitation(3, 1)],
      skipEvidence: [{ sequence: 0, measureIndex: 4, sourceMeasureId: "m5", targetId: "t4", occurredAtActiveMs: 500 }],
      activeElapsedMs: 5_000, completedAtActiveMs: 5_000,
    } as unknown as PiecePracticeSessionState;
    render(<PiecePracticeResults displayScore={{} as StaffBuilderScore} rangeText="Measures 1–5" state={state} title="Test" />);
    expect(within(screen.getByLabelText("Measure result color key")).getByText("Mistake")).toBeTruthy();
    expect(within(screen.getByLabelText("Measure result color key")).getByText("Hesitation")).toBeTruthy();
    expect(within(screen.getByLabelText("Measure result color key")).getByText("Both")).toBeTruthy();
    const rows = screen.getByLabelText("Measure-by-measure results").querySelectorAll(".piece-practice-measure-result");
    expect([...rows].map((row) => row.getAttribute("data-result-presentation"))).toEqual(["clean", "mistake", "hesitation", "both", "skip-only"]);
    expect(screen.getByLabelText("Pitch problem evidence: 1 mistake in measure 2").textContent).toBe("Pitch ×1");
    expect(screen.getByLabelText("1 tempo-aware slow response in measure 3").textContent).toBe("Hesitation ×1");
    expect(screen.getByLabelText("1 target was skipped in measure 5").textContent).toBe("Skipped ×1");
    fireEvent.click(screen.getByLabelText("Show problem measures only"));
    expect(screen.getByLabelText("Measure-by-measure results").children).toHaveLength(4);
  });
  it("passes authored lyric cues through the shared read-only score view", () => {
    const source = piece();
    const annotated = { ...source, annotations: [{ id: "lyric", kind: "lyric-cue" as const, anchor: { kind: "event" as const, eventId: "sustained-e" }, text: "Bells" }] };
    start(annotated);
    expect(mocks.scoreProps?.score).toMatchObject({ annotations: [{ kind: "lyric-cue", text: "Bells", anchor: { eventId: "sustained-e" } }] });
  });
  it("offers an accessible Start at Measure setup and initializes the selected range", () => {
    start(piece(), 3);
    expect(screen.getByText("Measure 3 of 3 · Practicing Measure 3 through end")).toBeTruthy();
    expect(screen.getByText("Target 1 of 1")).toBeTruthy();
  });

  it("offers an optional inclusive End Measure and clamps it when Start moves beyond it", () => {
    render(<PiecePracticeSession now={() => 65_000} onExit={vi.fn()} piece={piece()} />);
    const end = screen.getByLabelText(/End Measure/) as HTMLSelectElement;
    expect(end.value).toBe("");
    expect(within(end).getByRole("option", { name: "Through end" })).toBeTruthy();
    fireEvent.change(end, { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Start Measure"), { target: { value: "2" } });
    expect(end.value).toBe("2");
    expect(within(end).queryByRole("option", { name: "Measure 2" })).toBeNull();
  });

  it("completes at an explicit inclusive end without entering the following measure", () => {
    start(piece(), 1, 1);
    act(() => submit([60, 64]));
    act(() => submit([67]));
    expect(screen.getByRole("heading", { name: "Piece complete" })).toBeTruthy();
    expect(screen.getByText((_content, element) => element?.tagName === "P" && element.textContent === "You completed Measure 1 for Hallelujah.")).toBeTruthy();
    expect(screen.queryByText("No notes to play in this measure.")).toBeNull();
  });

  it("renders the current authored measure read-only with every cross-staff/polyphonic source highlight", () => {
    start();
    expect(screen.getByTestId("score-view").dataset.highlights).toBe("bass-event,treble-event");
    expect(mocks.scoreProps).toMatchObject({ measureIndex: 0 });
    expect(mocks.scoreProps).not.toHaveProperty("onEventSelect");
    expect(screen.queryByText(/Capture Notes|Rhythm Correction/)).toBeNull();
    expect(screen.getByText("Expected: C4, E4")).toBeTruthy();
  });

  it("shows compact normal and rolled-check progress without a live per-note announcement", () => {
    const source = piece();
    const first = source.measures[0]!.targets[0]!;
    const normalPitch = first.attackedPitches[0]!;
    const rolledPitches = [first.attackedPitches[1]!, pitch("bass-event", "g", 67, "G", "bass")];
    const checks = [
      { id: `${first.id}:normal`, kind: "normal" as const, sourceEventIds: [normalPitch.sourceEventId], expectedMidiNumbers: [normalPitch.midiNumber], attackedPitches: [normalPitch] },
      { id: `${first.id}:rolled:bass-event`, kind: "rolled-chord" as const, direction: "up" as const, sourceEventIds: ["bass-event"], expectedMidiNumbers: rolledPitches.map(({ midiNumber }) => midiNumber), attackedPitches: rolledPitches },
    ];
    start({ ...source, measures: [{ ...source.measures[0]!, targets: [{ ...first, checks }, ...source.measures[0]!.targets.slice(1)] }, ...source.measures.slice(1)] });
    const progress = screen.getByLabelText("Current target checks");
    expect(within(progress).getByText("Normal C4 — pending")).toBeTruthy();
    expect(within(progress).getByText("Rolled upward:")).toBeTruthy();
    expect(within(progress).getByText("E4 pending")).toBeTruthy();
    expect(progress.getAttribute("aria-live")).toBeNull();
  });

  it("shows beginner-readable incorrect details, stays blocked, and announces once", () => {
    start();
    act(() => submit([60, 65]));
    expect(screen.getByText("Incorrect — try the same target again.")).toBeTruthy();
    expect(screen.getByText("Missing: E4")).toBeTruthy();
    expect(screen.getByText("Extra: F4")).toBeTruthy();
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
    expect(screen.getByText(/Measure 2 of 3 · Practicing/)).toBeTruthy();
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
    expect(screen.queryByRole("button", { name: "Skip Target" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next Measure" }));
    expect(screen.getByText(/Measure 2 of 3 · Practicing/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next Measure" })).toBeTruthy();
  });

  it("offers Skip Target only for authored attacks and reports neutral skip completion", () => {
    start(piece(), 3);
    fireEvent.click(screen.getByRole("button", { name: "Skip Target" }));
    expect(screen.getByRole("heading", { name: "Piece complete" })).toBeTruthy();
    expect(screen.getByText("Completed targets").parentElement?.querySelector("dd")?.textContent).toBe("0");
    expect(screen.getByText("Skipped targets").parentElement?.querySelector("dd")?.textContent).toBe("1");
    expect(mocks.resetInput).toHaveBeenCalledTimes(1);
  });

  it("resets transient input for Restart Measure and Restart Piece, including the same target", () => {
    start();
    fireEvent.click(screen.getByRole("button", { name: "Restart Measure" }));
    fireEvent.click(screen.getByRole("button", { name: "Restart Piece" }));
    expect(mocks.resetInput).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Target 1 of 2")).toBeTruthy();
  });

  it("shows completion, approved statistics, focuses its heading, and supports Practice Again", async () => {
    start(piece(), 3);
    act(() => submit([68]));
    act(() => submit([69]));
    const heading = screen.getByRole("heading", { name: "Piece complete" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("Measures practiced").parentElement?.querySelector("dd")?.textContent).toBe("1");
    expect(screen.getByText("Mistakes").parentElement?.querySelector("dd")?.textContent).toBe("1");
    const results = screen.getByLabelText("Measure-by-measure results");
    expect(within(results).getByText("Measure 3")).toBeTruthy();
    expect(within(results).getByText(/1 mistake/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Show problem measures only"));
    expect(results.children).toHaveLength(1);
    fireEvent.click(within(results).getByText("Measure 3").closest("summary")!);
    fireEvent.click(within(results).getByText("Show mistakes"));
    expect(within(results).getByText("Expected: A4")).toBeTruthy();
    expect(within(results).getByText(/Played: A♭4/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Generate Report" }));
    expect(screen.getByRole("dialog", { name: "Generate Report" })).toBeTruthy();
    expect((screen.getByLabelText("Problem measures only") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await screen.findByText("Completed practice saved.");
    fireEvent.click(screen.getByRole("button", { name: "Practice Again" }));
    expect(screen.getByText("Measure 3 of 3 · Practicing Measure 3 through end")).toBeTruthy();
    expect(mocks.resetInput).toHaveBeenCalledTimes(1);
  });

  it("reports clean and problem measures in authored order and Practice Again retains the explicit excerpt", async () => {
    start(piece(), 1, 2);
    act(() => submit([60, 64]));
    act(() => submit([67]));
    fireEvent.click(screen.getByRole("button", { name: "Next Measure" }));
    const results = screen.getByLabelText("Measure-by-measure results");
    const rows = within(results).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual(["Measure 1No mistakes · 0.0s", "Measure 2No mistakes · 0.0s"]);
    fireEvent.click(screen.getByLabelText("Show problem measures only"));
    expect(screen.getByText("No problem measures in this attempt.")).toBeTruthy();
    await screen.findByText("Completed practice saved.");
    fireEvent.click(screen.getByRole("button", { name: "Practice Again" }));
    expect(screen.getByText("Measure 1 of 3 · Practicing Measures 1–2")).toBeTruthy();
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
      mistakeEvidence: [expect.any(Object)],
      startedAtMs: 65_000,
    });

    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Exit Mobile Play" }));

    expect(screen.getByText("Target 1 of 2")).toBeTruthy();
    expect(screen.getByText(/Incorrect .* try the same target again\./)).toBeTruthy();
    expect(mocks.inputOptions?.sessionState).toMatchObject({
      mistakeEvidence: [expect.any(Object)],
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
    expect(screen.getByText(/Measure 2 of 3 · Practicing/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next Measure" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next Measure" }));
    expect(screen.getByText(/Measure 3 of 3 · Practicing/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Exit Mobile Play" })).toBeTruthy();
  });

  it("distinguishes Mobile Play exit from Piece Practice exit and restores focus", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
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

  it("remains in Mobile Play through completion and Practice Again", async () => {
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
    await screen.findByText("Completed practice saved.");
    fireEvent.click(screen.getByRole("button", { name: "Practice Again" }));
    expect(screen.getByRole("button", { name: "Exit Mobile Play" })).toBeTruthy();
    expect(screen.getByText(/Measure 3 of 3 .* Practicing Measure 3 through end/)).toBeTruthy();
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

  it("runs a realistic validated 6/8 polyphonic and tied piece through retry, completion, and exit", async () => {
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
    render(<PiecePracticeSession now={() => 65_000} onExit={onExit} piece={projection.piece} runStore={runStore()} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    expect(screen.getByTestId("score-view").dataset.highlights).toBe("bass-chord,sustained-e");
    act(() => submit([48, 55]));
    expect(screen.getByText("Target 1 of 4")).toBeTruthy();
    act(() => submit([64, 55, 48]));
    act(() => submit([60]));
    act(() => submit([62]));
    act(() => submit([65]));
    expect(screen.getByText(/Measure 2 of 2 · Practicing/)).toBeTruthy();
    expect(screen.getByText("Expected: E3, A4")).toBeTruthy();
    act(() => submit([52, 69]));
    expect(screen.getByRole("heading", { name: "Piece complete" })).toBeTruthy();
    expect(screen.getByText("Mistakes").parentElement?.querySelector("dd")?.textContent).toBe("1");
    await screen.findByText("Completed practice saved.");
    fireEvent.click(screen.getByRole("button", { name: "Exit Piece Practice" }));
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(sourceScore).toEqual(sourceBefore);
    expect(projection.piece).toEqual(projectedBefore);
  });
});

it("passes inherited clefs to active and diagnostic notation without changing expected MIDI targets", () => {
  const original = piece();
  const changed: PiecePracticePiece = { ...original, measures: original.measures.map((measure, i) => ({ ...measure, clefs: i === 0 ? { treble: "bass", bass: "treble" } : { treble: "treble", bass: "treble" } })) };
  start(changed, 3);
  const display = mocks.scoreProps!.score as StaffBuilderScore;
  expect(resolveStaffBuilderMeasureContext(display, 2).clefs).toEqual({ treble: "treble", bass: "treble" });
  expect(mocks.inputOptions!.piece.measures.map(({ targets }) => targets)).toEqual(original.measures.map(({ targets }) => targets));
  act(() => submit([99]));
  act(() => submit(original.measures[2]!.targets[0]!.expectedMidiNumbers));
  expect(screen.getByRole("heading", { name: "Piece complete" })).toBeTruthy();
  const detail = screen.getByLabelText("Measure-by-measure results").querySelector("details");
  if (detail) detail.open = true;
  expect(resolveStaffBuilderMeasureContext(mocks.scoreProps!.score as StaffBuilderScore, 2).clefs).toEqual({ treble: "treble", bass: "treble" });
});
