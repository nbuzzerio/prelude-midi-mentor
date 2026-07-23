// @vitest-environment jsdom

import FlashcardSession from "@/components/flashcards/flashcard-session";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addNoteToMidiAttempt: vi.fn(),
  applyCorrectAttempt: vi.fn(),
  applyIncorrectAttempt: vi.fn(),
  clearCorrectAnswerSequence: vi.fn(),
  clearMidiAttempt: vi.fn(),
  connectMidi: vi.fn(),
  generateTarget: vi.fn(),
  getCurrentTarget: vi.fn(),
  getTargetMidiNumbers: vi.fn(),
  isAnswerLocked: vi.fn(),
  isMidiAttemptActive: vi.fn(),
  lockAnswer: vi.fn(),
  notesMatchTarget: vi.fn(),
  playGrandPianoChord: vi.fn(),
  playGrandPianoNote: vi.fn(),
  playIncorrectFeedback: vi.fn(),
  playSuccessChirp: vi.fn(),
  setMode: vi.fn(),
  setReplayCorrectVirtualChords: vi.fn(),
  setShowTargetName: vi.fn(),
  startCorrectAnswerSequence: vi.fn(),
  startMidiAttempt: vi.fn(),
  toggleExerciseType: vi.fn(),
  toggleNoteCategory: vi.fn(),
  toggleTriadPosition: vi.fn(),
  toggleTriadQuality: vi.fn(),
  updateCorrectAnswerMidiHeldNotes: vi.fn(),
}));

const PRACTICE_TARGET = {
  clef: "bass",
  name: {
    primary: "C3",
    secondary: "Individual note",
  },
  notes: [
    {
      midiNumber: 48,
      name: "C",
      octave: 3,
    },
  ],
} as const;

vi.mock("@/features/flashcards/hooks/use-flashcard-settings", () => ({
  useFlashcardSettings: () => ({
    enabledExerciseTypes: new Set(["notes"]),
    enabledNoteCategories: new Set(["naturals"]),
    enabledTriadPositions: new Set(["root"]),
    enabledTriadQualities: new Set(["major"]),
    mode: "bass",
    replayCorrectVirtualChords: false,
    setMode: mocks.setMode,
    setReplayCorrectVirtualChords: mocks.setReplayCorrectVirtualChords,
    setShowTargetName: mocks.setShowTargetName,
    showTargetName: false,
    toggleExerciseType: mocks.toggleExerciseType,
    toggleNoteCategory: mocks.toggleNoteCategory,
    toggleTriadPosition: mocks.toggleTriadPosition,
    toggleTriadQuality: mocks.toggleTriadQuality,
  }),
}));

vi.mock("@/features/flashcards/hooks/use-flashcard-target", () => ({
  useFlashcardTarget: () => ({
    generateNextTarget: mocks.generateTarget,
    getCurrentTarget: mocks.getCurrentTarget,
    isAnswerLocked: mocks.isAnswerLocked,
    lockAnswer: mocks.lockAnswer,
    practiceTarget: PRACTICE_TARGET,
    startedAt: 0,
  }),
}));

vi.mock("@/features/flashcards/hooks/use-correct-answer-sequence", () => ({
  useCorrectAnswerSequence: () => ({
    clearSequence: mocks.clearCorrectAnswerSequence,
    startSequence: mocks.startCorrectAnswerSequence,
    updateMidiHeldNotes: mocks.updateCorrectAnswerMidiHeldNotes,
  }),
}));

vi.mock("@/features/flashcards/hooks/use-midi-chord-attempt", () => ({
  useMidiChordAttempt: () => ({
    addNoteToAttempt: mocks.addNoteToMidiAttempt,
    attemptNotes: new Set<number>(),
    clearAttempt: mocks.clearMidiAttempt,
    isAttemptActive: mocks.isMidiAttemptActive,
    startAttempt: mocks.startMidiAttempt,
  }),
}));

vi.mock("@/hooks/use-midi", () => ({
  useMidi: () => ({
    connectMidi: mocks.connectMidi,
    deviceName: null,
    error: null,
    status: "disconnected",
  }),
}));

vi.mock("@/lib/audio/feedback", () => ({
  playIncorrectFeedback: mocks.playIncorrectFeedback,
  playSuccessChirp: mocks.playSuccessChirp,
}));

vi.mock("@/lib/audio/grand-piano", () => ({
  playGrandPianoChord: mocks.playGrandPianoChord,
  playGrandPianoNote: mocks.playGrandPianoNote,
}));

vi.mock("@/lib/practice/answer-validation", () => ({
  getTargetMidiNumbers: mocks.getTargetMidiNumbers,
  notesMatchTarget: mocks.notesMatchTarget,
}));

vi.mock("@/lib/practice/session-stats", () => ({
  INITIAL_PRACTICE_STATS: {
    state: "initial",
  },
  applyCorrectAttempt: mocks.applyCorrectAttempt,
  applyIncorrectAttempt: mocks.applyIncorrectAttempt,
}));

vi.mock("@/components/audio/instrument-volume-control", () => ({
  default: () => <div>Instrument volume</div>,
}));

vi.mock("@/components/audio/feedback-volume-control", () => ({
  default: () => <div>Feedback volume</div>,
}));

vi.mock("@/components/midi/midi-status", () => ({
  default: ({
    onConnect,
    status,
  }: {
    onConnect: () => void;
    status: string;
  }) => (
    <div>
      <span>Midi status: {status}</span>

      <button onClick={onConnect} type="button">
        Connect MIDI
      </button>
    </div>
  ),
}));

vi.mock("@/components/flashcards/practice-card", () => ({
  default: ({
    feedback,
    onCorrect,
    onIncorrect,
  }: {
    feedback: string;
    onCorrect: () => void;
    onIncorrect: () => void;
  }) => (
    <div>
      <span>Feedback: {feedback}</span>

      <button onClick={onCorrect} type="button">
        Simulate correct
      </button>

      <button onClick={onIncorrect} type="button">
        Simulate incorrect
      </button>
    </div>
  ),
}));

vi.mock("@/components/flashcards/practice-controls", () => ({
  default: ({
    onModeChange,
    onReset,
  }: {
    onModeChange: (mode: "treble") => void;
    onReset: () => void;
  }) => (
    <div>
      <button onClick={() => onModeChange("treble")} type="button">
        Use treble
      </button>

      <button onClick={onReset} type="button">
        Reset session
      </button>
    </div>
  ),
}));

vi.mock("@/components/flashcards/practice-stats", () => ({
  default: ({ stats }: { stats: Readonly<{ state: string }> }) => (
    <div>Stats: {stats.state}</div>
  ),
}));

vi.mock("@/components/notation/piano-keyboard", () => ({
  default: () => <div>Piano keyboard</div>,
}));

afterEach(() => {
  cleanup();
});

describe("FlashcardSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getCurrentTarget.mockReturnValue(PRACTICE_TARGET);
    mocks.getTargetMidiNumbers.mockReturnValue(new Set([48]));

    mocks.isAnswerLocked.mockReturnValue(false);
    mocks.isMidiAttemptActive.mockReturnValue(false);
    mocks.lockAnswer.mockReturnValue(true);

    mocks.applyCorrectAttempt.mockReturnValue({
      state: "correct",
    });

    mocks.applyIncorrectAttempt.mockReturnValue({
      state: "incorrect",
    });
  });

  it("renders the initial session state", () => {
    render(<FlashcardSession />);

    expect(screen.getByText("Prelude: MIDI Mentor")).toBeTruthy();

    expect(screen.getByText("Midi status: disconnected")).toBeTruthy();

    expect(screen.getByText("Feedback: idle")).toBeTruthy();
    expect(screen.getByText("Stats: initial")).toBeTruthy();
    expect(screen.getByText("Piano keyboard")).toBeTruthy();
  });

  it("resets the session and generates a new target", () => {
    render(<FlashcardSession />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Simulate incorrect",
      }),
    );

    expect(screen.getByText("Stats: incorrect")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Reset session",
      }),
    );

    expect(mocks.clearCorrectAnswerSequence).toHaveBeenCalledTimes(1);

    expect(mocks.clearMidiAttempt).toHaveBeenCalledTimes(1);
    expect(mocks.generateTarget).toHaveBeenCalledTimes(1);

    expect(screen.getByText("Stats: initial")).toBeTruthy();
    expect(screen.getByText("Feedback: idle")).toBeTruthy();
  });

  it("updates the mode and generates a target for that clef", () => {
    render(<FlashcardSession />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Use treble",
      }),
    );

    expect(mocks.clearCorrectAnswerSequence).toHaveBeenCalled();
    expect(mocks.setMode).toHaveBeenCalledWith("treble");
    expect(mocks.clearMidiAttempt).toHaveBeenCalled();

    expect(mocks.generateTarget).toHaveBeenCalledWith("treble");
  });

  it("routes simulated correct and incorrect answers through the session lifecycle", () => {
    render(<FlashcardSession />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Simulate incorrect",
      }),
    );

    expect(mocks.playIncorrectFeedback).toHaveBeenCalledTimes(1);

    expect(mocks.applyIncorrectAttempt).toHaveBeenCalledTimes(1);

    expect(screen.getByText("Feedback: incorrect")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Simulate correct",
      }),
    );

    expect(mocks.lockAnswer).toHaveBeenCalledTimes(1);

    expect(mocks.applyCorrectAttempt).toHaveBeenCalledWith(
      {
        state: "incorrect",
      },
      0,
    );

    expect(mocks.startCorrectAnswerSequence).toHaveBeenCalledWith({
      nextTargetDelayMs: expect.any(Number),
      successChirpDelayMs: expect.any(Number),
      waitForMidiRelease: false,
    });

    expect(screen.getByText("Feedback: correct")).toBeTruthy();
    expect(screen.getByText("Stats: correct")).toBeTruthy();
  });
});
