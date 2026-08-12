// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FlashcardSession from "./flashcard-session";

const mocks = vi.hoisted(() => ({
  addNoteToMidiAttempt: vi.fn(),
  applyCorrectAttempt: vi.fn(),
  applyIncorrectAttempt: vi.fn(),
  clearCorrectAnswerSequence: vi.fn(),
  clearMidiAttempt: vi.fn(),
  chordAttemptOptions: vi.fn(),
  connectMidi: vi.fn(),
  generateTarget: vi.fn(),
  getCurrentTarget: vi.fn(),
  getTargetMidiNumbers: vi.fn(),
  isFlashcardTargetLocked: vi.fn(),
  isMidiAttemptActive: vi.fn(),
  lockFlashcardTarget: vi.fn(),
  midiOptions: vi.fn(),
  pianoProps: vi.fn(),
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
  targetOptions: vi.fn(),
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

const TRIAD_TARGET = {
  clef: "treble",
  name: { primary: "C Major", secondary: "Root position" },
  notes: [
    { midiNumber: 60, name: "C", octave: 4 },
    { midiNumber: 64, name: "E", octave: 4 },
    { midiNumber: 67, name: "G", octave: 4 },
  ],
} as const;

vi.mock("@/features/flashcards/hooks/use-flashcard-target", () => ({
  useFlashcardTarget: (options: unknown) => {
    mocks.targetOptions(options);

    return {
      generateNextTarget: mocks.generateTarget,
      getCurrentTarget: mocks.getCurrentTarget,
      isFlashcardTargetLocked: mocks.isFlashcardTargetLocked,
      lockFlashcardTarget: mocks.lockFlashcardTarget,
      practiceTarget: PRACTICE_TARGET,
      startedAt: 0,
    };
  },
}));

vi.mock("@/features/flashcards/hooks/use-correct-answer-sequence", () => ({
  useCorrectAnswerSequence: () => ({
    clearSequence: mocks.clearCorrectAnswerSequence,
    startSequence: mocks.startCorrectAnswerSequence,
    updateMidiHeldNotes: mocks.updateCorrectAnswerMidiHeldNotes,
  }),
}));

vi.mock("@/hooks/use-chord-attempt", () => ({
  CHORD_ATTEMPT_GRACE_MS: 225,
  useChordAttempt: (options: unknown) => {
    mocks.chordAttemptOptions(options);

    return {
    addNoteToAttempt: mocks.addNoteToMidiAttempt,
    attemptNotes: new Set<number>(),
    clearAttempt: mocks.clearMidiAttempt,
    isAttemptActive: mocks.isMidiAttemptActive,
    startAttempt: mocks.startMidiAttempt,
    };
  },
}));

vi.mock("@/hooks/use-app-midi-input", () => ({
  useAppMidiInput: (options: unknown) => {
    mocks.midiOptions(options);

    return {
    connectMidi: mocks.connectMidi,
    deviceName: null,
    error: null,
    status: "disconnected",
    };
  },
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
    correct: 0,
    incorrect: 0,
    state: "initial",
    streak: 0,
    totalResponseTimeMs: 0,
  },
  applyCorrectAttempt: mocks.applyCorrectAttempt,
  applyIncorrectAttempt: mocks.applyIncorrectAttempt,
}));

vi.mock("@/components/audio/instrument-volume-control", () => ({
  default: ({
    onReplayCorrectVirtualChordsChange,
  }: {
    onReplayCorrectVirtualChordsChange: (enabled: boolean) => void;
  }) => (
    <div>
      Instrument volume
      <button
        onClick={() => onReplayCorrectVirtualChordsChange(false)}
        type="button"
      >
        Change replay preference
      </button>
    </div>
  ),
}));

vi.mock("@/components/audio/feedback-volume-control", () => ({
  default: () => (
    <div>
      Feedback volume
      <button type="button">Change feedback volume</button>
    </div>
  ),
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

vi.mock("@/features/flashcards/components/flashcard-card", () => ({
  default: ({
    completedCount,
    feedback,
    isFocusMode,
    isMobilePlayMode,
    onEnterMobilePlay,
    onCorrect,
    onIncorrect,
    onToggleFocusMode,
  }: {
    completedCount: number;
    feedback: string;
    isFocusMode: boolean;
    isMobilePlayMode: boolean;
    onEnterMobilePlay: () => void;
    onCorrect: () => void;
    onIncorrect: () => void;
    onToggleFocusMode: () => void;
  }) => (
    <div>
      <span>Feedback: {feedback}</span>
      <span>Completed: {completedCount}</span>
      <span>Mobile active: {String(isMobilePlayMode)}</span>

      {!isFocusMode ? <button onClick={onEnterMobilePlay} type="button">Mobile Play</button> : null}

      <button onClick={onToggleFocusMode} type="button">
        {isFocusMode ? "Exit Focus Staff" : "Focus Staff"}
      </button>

      <button onClick={onCorrect} type="button">
        Simulate correct
      </button>

      <button onClick={onIncorrect} type="button">
        Simulate incorrect
      </button>
    </div>
  ),
}));

vi.mock("@/features/flashcards/components/practice-controls", () => ({
  default: ({
    onExerciseTypeToggle,
    onModeChange,
    onNoteCategoryToggle,
    onReset,
    onShowTargetNameChange,
    onTriadPositionToggle,
    onTriadQualityToggle,
  }: {
    onExerciseTypeToggle: (type: "notes" | "triads") => void;
    onModeChange: (mode: "treble") => void;
    onNoteCategoryToggle: (category: "accidentals") => void;
    onReset: () => void;
    onShowTargetNameChange: (enabled: boolean) => void;
    onTriadPositionToggle: (position: "first") => void;
    onTriadQualityToggle: (quality: "minor") => void;
  }) => (
    <div>
      <button onClick={() => onModeChange("treble")} type="button">
        Use treble
      </button>

      <button onClick={onReset} type="button">
        Reset session
      </button>

      <button onClick={() => onExerciseTypeToggle("notes")} type="button">
        Toggle final exercise
      </button>

      <button onClick={() => onExerciseTypeToggle("triads")} type="button">
        Add triads
      </button>

      <button onClick={() => onNoteCategoryToggle("accidentals")} type="button">
        Add accidentals
      </button>

      <button onClick={() => onTriadQualityToggle("minor")} type="button">
        Add minor
      </button>

      <button onClick={() => onTriadPositionToggle("first")} type="button">
        Add first inversion
      </button>

      <button onClick={() => onShowTargetNameChange(true)} type="button">
        Show target name
      </button>

      <button
        onClick={() => {
          onExerciseTypeToggle("triads");
          onNoteCategoryToggle("accidentals");
        }}
        type="button"
      >
        Change multiple settings
      </button>
    </div>
  ),
}));

vi.mock("@/features/flashcards/components/practice-stats", () => ({
  default: ({ stats }: { stats: Readonly<{ state: string }> }) => (
    <div>Stats: {stats.state}</div>
  ),
}));

vi.mock("@/components/notation/piano-keyboard", () => ({
  default: (props: Record<string, unknown>) => {
    mocks.pianoProps(props);
    return <div>Piano keyboard</div>;
  },
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderFlashcardSession() {
  function TestFlashcardSession() {
    const [isFocusMode, setIsFocusMode] = useState(false);

    return (
      <FlashcardSession
        isFocusMode={isFocusMode}
        onToggleFocusMode={() => {
          setIsFocusMode((currentValue) => !currentValue);
        }}
      />
    );
  }

  return render(<TestFlashcardSession />);
}

describe("FlashcardSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getCurrentTarget.mockReturnValue(PRACTICE_TARGET);
    mocks.getTargetMidiNumbers.mockReturnValue(new Set([48]));

    mocks.isFlashcardTargetLocked.mockReturnValue(false);
    mocks.isMidiAttemptActive.mockReturnValue(false);
    mocks.lockFlashcardTarget.mockReturnValue(true);

    mocks.applyCorrectAttempt.mockReturnValue({
      correct: 1,
      incorrect: 0,
      state: "correct",
      streak: 1,
      totalResponseTimeMs: 0,
    });

    mocks.applyIncorrectAttempt.mockReturnValue({
      correct: 0,
      incorrect: 1,
      state: "incorrect",
      streak: 0,
      totalResponseTimeMs: 0,
    });
  });

  it("renders the initial session state", () => {
    renderFlashcardSession();

    expect(screen.getByText("Prelude: MIDI Mentor")).toBeTruthy();

    expect(screen.getByText("Midi status: disconnected")).toBeTruthy();

    expect(screen.getByText("Feedback: idle")).toBeTruthy();
    expect(screen.getByText("Stats: initial")).toBeTruthy();
    expect(screen.getByText("Completed: 0")).toBeTruthy();
    expect(screen.getByText("Piano keyboard")).toBeTruthy();
    expect(mocks.generateTarget).not.toHaveBeenCalled();
  });

  it("resets the session and generates a new target", () => {
    renderFlashcardSession();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Simulate incorrect",
      }),
    );

    expect(screen.getByText("Stats: incorrect")).toBeTruthy();
    expect(screen.getByText("Completed: 0")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Reset session",
      }),
    );

    expect(mocks.clearCorrectAnswerSequence).toHaveBeenCalledTimes(1);

    expect(mocks.clearMidiAttempt).toHaveBeenCalledTimes(1);
    expect(mocks.generateTarget).toHaveBeenCalledTimes(1);

    expect(screen.getByText("Stats: initial")).toBeTruthy();
    expect(screen.getByText("Completed: 0")).toBeTruthy();
    expect(screen.getByText("Feedback: idle")).toBeTruthy();
  });

  it("exposes successful targets from the existing stats exactly once", () => {
    renderFlashcardSession();
    fireEvent.click(screen.getByRole("button", { name: "Simulate correct" }));
    expect(screen.getByText("Completed: 1")).toBeTruthy();
    expect(screen.getByText("Stats: correct")).toBeTruthy();
    expect(mocks.applyCorrectAttempt).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("Piano keyboard")).toHaveLength(1);
  });

  it("preserves target, feedback, statistics, and graded keyboard semantics in Mobile Play", () => {
    renderFlashcardSession();
    fireEvent.click(screen.getByRole("button", { name: "Simulate incorrect" }));
    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));

    expect(screen.getByText("Mobile active: true")).toBeTruthy();
    expect(screen.queryByText(/Rotate your device/i)).toBeNull();
    expect(screen.getByText("Feedback: incorrect")).toBeTruthy();
    expect(screen.getByText("Stats: incorrect")).toBeTruthy();
    expect(screen.getByText("Completed: 0")).toBeTruthy();
    expect(screen.getByText("Piano keyboard")).toBeTruthy();
    expect(mocks.generateTarget).not.toHaveBeenCalled();
    const props = mocks.pianoProps.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(props.onNoteToggle).toEqual(expect.any(Function));
    expect(props.onNotePress).toBeUndefined();
    expect(props.onNoteRelease).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: "Exit Mobile Play" }));
    expect(screen.getByText("Stats: incorrect")).toBeTruthy();
    expect(mocks.generateTarget).not.toHaveBeenCalled();
  });

  it("keeps one task and keyboard while mobile secondary sections disclose mounted controls", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: true,
      media: "(max-width: 639px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    renderFlashcardSession();

    expect(screen.getAllByText("Piano keyboard")).toHaveLength(1);
    const settings = screen.getByRole("button", { name: "Practice Settings" });
    const sound = screen.getByRole("button", { name: "Sound & Feedback" });
    expect(settings.getAttribute("aria-expanded")).toBe("false");
    expect(sound.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(settings);
    expect(settings.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Reset session" }));
    expect(mocks.generateTarget).toHaveBeenCalledTimes(1);

    fireEvent.click(sound);
    expect(sound.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Feedback volume")).toBeTruthy();
    expect(screen.getByText("Instrument volume")).toBeTruthy();
    expect(screen.getAllByText("Piano keyboard")).toHaveLength(1);
  });

  it("keeps Focus Staff and Mobile Play mutually exclusive without regeneration", () => {
    renderFlashcardSession();
    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Focus Staff" }));

    expect(screen.queryByRole("button", { name: "Exit Mobile Play" })).toBeNull();
    expect(screen.getByRole("button", { name: "Exit Focus Staff" })).toBeTruthy();
    expect(screen.getByText("Completed: 0")).toBeTruthy();
    expect(mocks.generateTarget).not.toHaveBeenCalled();
  });

  it("preserves session state while focus mode hides nonessential regions", () => {
    renderFlashcardSession();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Simulate incorrect",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Focus Staff" }));

    expect(screen.getByText("Stats: incorrect").closest("[hidden]")).toBeTruthy();
    expect(screen.getByText("Piano keyboard").closest("[hidden]")).toBeTruthy();
    expect(screen.getByText("Midi status: disconnected")).toBeTruthy();
    expect(screen.getByText("Feedback: incorrect")).toBeTruthy();
    expect(mocks.generateTarget).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Exit Focus Staff" }),
    );

    expect(screen.getByText("Stats: incorrect").closest("[hidden]")).toBeNull();
    expect(screen.getByText("Piano keyboard").closest("[hidden]")).toBeNull();
    expect(mocks.generateTarget).not.toHaveBeenCalled();
  });

  it("updates the mode and generates a target for that clef", () => {
    renderFlashcardSession();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Use treble",
      }),
    );

    expect(mocks.clearCorrectAnswerSequence).toHaveBeenCalledTimes(1);
    expect(mocks.clearMidiAttempt).toHaveBeenCalled();

    expect(mocks.generateTarget).toHaveBeenCalledTimes(1);
    expect(mocks.generateTarget).toHaveBeenCalledWith(undefined);
    expect(mocks.targetOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: "treble" }),
    );
  });

  it.each([
    ["Add triads", "enabledExerciseTypes", new Set(["notes", "triads"])],
    [
      "Add accidentals",
      "enabledNoteCategories",
      new Set(["naturals", "accidentals"]),
    ],
    ["Add minor", "enabledTriadQualities", new Set(["major", "minor"])],
    [
      "Add first inversion",
      "enabledTriadPositions",
      new Set(["root", "first"]),
    ],
  ])("regenerates once when %s changes", (buttonName, optionName, expected) => {
    renderFlashcardSession();

    fireEvent.click(screen.getByRole("button", { name: "Simulate incorrect" }));
    fireEvent.click(screen.getByRole("button", { name: buttonName }));

    expect(mocks.clearCorrectAnswerSequence).toHaveBeenCalledTimes(1);
    expect(mocks.clearMidiAttempt).toHaveBeenCalledTimes(1);
    expect(mocks.generateTarget).toHaveBeenCalledTimes(1);
    expect(mocks.targetOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ [optionName]: expected }),
    );
    expect(screen.getByText("Stats: incorrect")).toBeTruthy();
    expect(screen.getByText("Feedback: idle")).toBeTruthy();
  });

  it("does not regenerate when the final required setting is rejected", () => {
    renderFlashcardSession();

    fireEvent.click(
      screen.getByRole("button", { name: "Toggle final exercise" }),
    );

    expect(mocks.clearCorrectAnswerSequence).not.toHaveBeenCalled();
    expect(mocks.generateTarget).not.toHaveBeenCalled();
  });

  it("regenerates once for multiple settings changed by one interaction", () => {
    renderFlashcardSession();

    fireEvent.click(
      screen.getByRole("button", { name: "Change multiple settings" }),
    );

    expect(mocks.clearCorrectAnswerSequence).toHaveBeenCalledTimes(1);
    expect(mocks.generateTarget).toHaveBeenCalledTimes(1);
  });

  it("does not regenerate for display, replay, audio, or focus changes", () => {
    renderFlashcardSession();

    fireEvent.click(screen.getByRole("button", { name: "Show target name" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Change replay preference" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Change feedback volume" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Focus Staff" }));

    expect(mocks.clearCorrectAnswerSequence).not.toHaveBeenCalled();
    expect(mocks.generateTarget).not.toHaveBeenCalled();
  });

  it("routes simulated correct and incorrect answers through the session lifecycle", () => {
    renderFlashcardSession();

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

    expect(mocks.lockFlashcardTarget).toHaveBeenCalledTimes(1);

    expect(mocks.applyCorrectAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ state: "incorrect" }),
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

  it("keeps single-note MIDI targets immediate", () => {
    renderFlashcardSession();
    const midiOptions = mocks.midiOptions.mock.calls.at(-1)?.[0] as {
      onNotePlayed: (midiNumber: number) => void;
    };

    midiOptions.onNotePlayed(48);

    expect(mocks.startMidiAttempt).not.toHaveBeenCalled();
    expect(mocks.lockFlashcardTarget).toHaveBeenCalledTimes(1);
  });

  it("keeps physical triads on the shared 225 millisecond collector", () => {
    mocks.getCurrentTarget.mockReturnValue(TRIAD_TARGET);
    mocks.getTargetMidiNumbers.mockReturnValue(new Set([60, 64, 67]));
    renderFlashcardSession();
    const midiOptions = mocks.midiOptions.mock.calls.at(-1)?.[0] as {
      onNotePlayed: (midiNumber: number) => void;
    };

    midiOptions.onNotePlayed(60);
    mocks.isMidiAttemptActive.mockReturnValue(true);
    midiOptions.onNotePlayed(64);
    midiOptions.onNotePlayed(67);

    expect(mocks.startMidiAttempt).toHaveBeenCalledWith(60);
    expect(mocks.addNoteToMidiAttempt).toHaveBeenNthCalledWith(1, 64);
    expect(mocks.addNoteToMidiAttempt).toHaveBeenNthCalledWith(2, 67);
    expect(mocks.chordAttemptOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ gracePeriodMs: 225 }),
    );
  });

  it.each([
    ["correct", new Set([60, 64, 67]), true],
    ["missing", new Set([60, 64]), false],
    ["extra", new Set([60, 61, 64, 67]), false],
  ])("preserves the %s physical-triad outcome", (_label, notes, isCorrect) => {
    mocks.getCurrentTarget.mockReturnValue(TRIAD_TARGET);
    mocks.getTargetMidiNumbers.mockReturnValue(new Set([60, 64, 67]));
    mocks.notesMatchTarget.mockReturnValue(isCorrect);
    renderFlashcardSession();
    const chordOptions = mocks.chordAttemptOptions.mock.calls.at(-1)?.[0] as {
      onComplete: (midiNumbers: ReadonlySet<number>) => void;
    };

    act(() => chordOptions.onComplete(notes));

    expect(mocks.notesMatchTarget).toHaveBeenCalledWith(notes, TRIAD_TARGET);
    if (isCorrect) {
      expect(mocks.lockFlashcardTarget).toHaveBeenCalledTimes(1);
      expect(mocks.applyIncorrectAttempt).not.toHaveBeenCalled();
    } else {
      expect(mocks.applyIncorrectAttempt).toHaveBeenCalledTimes(1);
      expect(mocks.lockFlashcardTarget).not.toHaveBeenCalled();
    }
  });
});
