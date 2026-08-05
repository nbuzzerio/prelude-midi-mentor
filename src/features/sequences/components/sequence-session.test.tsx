import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SequenceSession from "./sequence-session";

const mocks = vi.hoisted(() => ({
  beginNextStep: vi.fn(),
  clearTransition: vi.fn(),
  completeCurrentStep: vi.fn(),
  generateTarget: vi.fn(),
  getCurrentTarget: vi.fn(),
  isSequenceTargetLocked: vi.fn(),
  isWaitingForStep: vi.fn(),
  lockSequenceTarget: vi.fn(),
  midiOptions: vi.fn(),
  resetAttempt: vi.fn(),
  retrySequence: vi.fn(),
  showCorrectFeedback: vi.fn(),
  showIncorrectFeedback: vi.fn(),
  startIncorrectStepTransition: vi.fn(),
  startSequenceCompletionTransition: vi.fn(),
  startStepTransition: vi.fn(),
  targetOptions: vi.fn(),
  transitionOptions: vi.fn(),
  updateMidiHeldNotes: vi.fn(),
  playGrandPianoChord: vi.fn(),
  playGrandPianoNote: vi.fn(),
  pianoProps: vi.fn(),
}));

const SEQUENCE_TARGET = {
  clef: "treble",
  name: {
    primary: "Major third",
    secondary: "Ascending melodic interval",
  },
  steps: [
    {
      notes: [{ midiNumber: 60, name: "C", octave: 4 }],
    },
    {
      notes: [{ midiNumber: 64, name: "E", octave: 4 }],
    },
  ],
} as const;

const PROGRESSION_TARGET = {
  clef: "treble",
  name: { primary: "I–IV–V–I", secondary: "C major" },
  steps: [
    {
      name: { primary: "I", secondary: "C major" },
      notes: [
        { midiNumber: 60, name: "C", octave: 4 },
        { midiNumber: 64, name: "E", octave: 4 },
        { midiNumber: 67, name: "G", octave: 4 },
      ],
    },
    {
      name: { primary: "IV", secondary: "F major" },
      notes: [
        { midiNumber: 60, name: "C", octave: 4 },
        { midiNumber: 65, name: "F", octave: 4 },
        { midiNumber: 69, name: "A", octave: 4 },
      ],
    },
  ],
} as const;

const FOUR_NOTE_TARGET = {
  ...PROGRESSION_TARGET,
  steps: [
    {
      name: { primary: "I7", secondary: "C major seventh" },
      notes: [
        { midiNumber: 60, name: "C", octave: 4 },
        { midiNumber: 64, name: "E", octave: 4 },
        { midiNumber: 67, name: "G", octave: 4 },
        { midiNumber: 71, name: "B", octave: 4 },
      ],
    },
  ],
} as const;

vi.mock("../hooks/use-sequence-target", () => ({
  useSequenceTarget: (options: unknown) => {
    mocks.targetOptions(options);
    const exerciseType = (options as { exerciseType?: string }).exerciseType;
    const target =
      exerciseType === "chord-progressions"
        ? PROGRESSION_TARGET
        : SEQUENCE_TARGET;

    return {
      generateNextTarget: mocks.generateTarget,
      getCurrentTarget: mocks.getCurrentTarget,
      isSequenceTargetLocked: mocks.isSequenceTargetLocked,
      lockSequenceTarget: mocks.lockSequenceTarget,
      sequenceTarget: target,
      startedAt: 0,
    };
  },
}));

vi.mock("../hooks/use-sequence-attempt", () => ({
  useSequenceAttempt: () => ({
    beginNextStep: mocks.beginNextStep,
    completeCurrentStep: mocks.completeCurrentStep,
    currentStepIndex: 0,
    isWaitingForStep: mocks.isWaitingForStep,
    resetAttempt: mocks.resetAttempt,
    retrySequence: mocks.retrySequence,
    showCorrectFeedback: mocks.showCorrectFeedback,
    showIncorrectFeedback: mocks.showIncorrectFeedback,
    state: "waiting-for-step",
  }),
}));

vi.mock("../hooks/use-sequence-transition", () => ({
  useSequenceTransition: (options: unknown) => {
    mocks.transitionOptions(options);

    return {
      clearTransition: mocks.clearTransition,
      startIncorrectStepTransition: mocks.startIncorrectStepTransition,
      startSequenceCompletionTransition:
        mocks.startSequenceCompletionTransition,
      startStepTransition: mocks.startStepTransition,
      updateMidiHeldNotes: mocks.updateMidiHeldNotes,
    };
  },
}));

vi.mock("@/hooks/use-midi", () => ({
  useMidi: (options: unknown) => {
    mocks.midiOptions(options);

    return {
      connectMidi: vi.fn(),
      deviceName: null,
      error: null,
      status: "disconnected",
    };
  },
}));

vi.mock("@/components/audio/feedback-volume-control", () => ({
  default: () => <button type="button">Change feedback volume</button>,
}));

vi.mock("@/components/audio/instrument-volume-control", () => ({
  default: () => <div>Instrument volume</div>,
}));

vi.mock("@/components/midi/midi-status", () => ({
  default: () => <div>MIDI status</div>,
}));

vi.mock("@/lib/audio/grand-piano", () => ({
  playGrandPianoChord: mocks.playGrandPianoChord,
  playGrandPianoNote: mocks.playGrandPianoNote,
}));

vi.mock("@/components/notation/piano-keyboard", () => ({
  default: ({
    activeMidiNumbers,
    onNoteToggle,
    ...props
  }: {
    activeMidiNumbers: ReadonlySet<number>;
    onNoteToggle: (midiNumber: number) => void;
  }) => {
    mocks.pianoProps({ ...props, onNoteToggle });

    return (
      <div>
        Piano keyboard
        <span data-testid="active-notes">
          Active: {[...activeMidiNumbers].join(",")}
        </span>
        {[60, 61, 64, 67, 71].map((midiNumber) => (
          <button
            key={midiNumber}
            onClick={() => onNoteToggle(midiNumber)}
            type="button"
          >
            Virtual {midiNumber}
          </button>
        ))}
      </div>
    );
  },
}));

vi.mock("./sequence-card", () => ({
  default: ({
    feedback,
    isFocusMode,
    isMobilePlayMode,
    onEnterMobilePlay,
    onIncorrect,
    onToggleFocusMode,
  }: {
    feedback: string;
    isFocusMode: boolean;
    isMobilePlayMode: boolean;
    onEnterMobilePlay: () => void;
    onIncorrect: () => void;
    onToggleFocusMode: () => void;
  }) => (
    <div>
      <span>Feedback: {feedback}</span>
      <span>Mobile active: {String(isMobilePlayMode)}</span>
      {!isFocusMode ? (
        <button onClick={onEnterMobilePlay} type="button">
          Mobile Play
        </button>
      ) : null}
      <button onClick={onIncorrect} type="button">
        Simulate incorrect
      </button>
      <button onClick={onToggleFocusMode} type="button">
        {isFocusMode ? "Exit Focus Staff" : "Focus Staff"}
      </button>
    </div>
  ),
}));

vi.mock("./sequence-stats", () => ({
  default: ({
    stats,
  }: {
    stats: Readonly<{ completed: number; incorrectAttempts: number }>;
  }) => (
    <div>
      Stats: {stats.completed} completed, {stats.incorrectAttempts} incorrect
    </div>
  ),
}));

vi.mock("./sequence-controls", () => ({
  default: ({
    onArpeggioToggle,
    onChordProgressionKeyToggle,
    onChordProgressionTemplateToggle,
    onDirectionToggle,
    onExerciseTypeChange,
    onIntervalToggle,
    onModeChange,
    onNoteCategoryToggle,
    onReset,
    onScaleDirectionToggle,
    onScaleToggle,
    onShowTargetNameChange,
  }: {
    onArpeggioToggle: (value: "minor") => void;
    onDirectionToggle: (value: "ascending" | "descending") => void;
    onExerciseTypeChange: (value: "scales" | "chord-progressions") => void;
    onChordProgressionKeyToggle: (value: "g-major" | "c-major") => void;
    onChordProgressionTemplateToggle: (
      value: "major-251" | "major-1451",
    ) => void;
    onIntervalToggle: (value: "perfect-fifth") => void;
    onModeChange: (value: "bass") => void;
    onNoteCategoryToggle: (value: "accidentals") => void;
    onReset: () => void;
    onScaleDirectionToggle: (value: "ascending-descending") => void;
    onScaleToggle: (value: "natural-minor") => void;
    onShowTargetNameChange: (enabled: boolean) => void;
  }) => (
    <div>
      <button onClick={() => onModeChange("bass")} type="button">
        Use bass
      </button>
      <button onClick={() => onExerciseTypeChange("scales")} type="button">
        Use scales
      </button>
      <button
        onClick={() => onExerciseTypeChange("chord-progressions")}
        type="button"
      >
        Use progressions
      </button>
      <button
        onClick={() => onChordProgressionKeyToggle("g-major")}
        type="button"
      >
        Add progression key
      </button>
      <button
        onClick={() => onChordProgressionTemplateToggle("major-251")}
        type="button"
      >
        Add progression template
      </button>
      <button
        onClick={() => onChordProgressionKeyToggle("c-major")}
        type="button"
      >
        Toggle final progression key
      </button>
      <button
        onClick={() => onChordProgressionTemplateToggle("major-1451")}
        type="button"
      >
        Toggle final progression template
      </button>
      <button onClick={() => onDirectionToggle("descending")} type="button">
        Add descending
      </button>
      <button onClick={() => onDirectionToggle("ascending")} type="button">
        Toggle final direction
      </button>
      <button onClick={() => onIntervalToggle("perfect-fifth")} type="button">
        Add interval
      </button>
      <button onClick={() => onNoteCategoryToggle("accidentals")} type="button">
        Add accidentals
      </button>
      <button onClick={() => onScaleToggle("natural-minor")} type="button">
        Add scale
      </button>
      <button
        onClick={() => onScaleDirectionToggle("ascending-descending")}
        type="button"
      >
        Add scale direction
      </button>
      <button onClick={() => onArpeggioToggle("minor")} type="button">
        Add arpeggio
      </button>
      <button onClick={() => onShowTargetNameChange(true)} type="button">
        Show target name
      </button>
      <button onClick={onReset} type="button">
        Reset session
      </button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
});

function renderSequenceSession() {
  function TestSequenceSession() {
    const [isFocusMode, setIsFocusMode] = useState(false);

    return (
      <SequenceSession
        isFocusMode={isFocusMode}
        onToggleFocusMode={() => setIsFocusMode((current) => !current)}
      />
    );
  }

  return render(<TestSequenceSession />);
}

describe("SequenceSession settings regeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentTarget.mockImplementation(() => {
      const options = mocks.targetOptions.mock.calls.at(-1)?.[0] as {
        exerciseType?: string;
      };

      return options?.exerciseType === "chord-progressions"
        ? PROGRESSION_TARGET
        : SEQUENCE_TARGET;
    });
    mocks.isSequenceTargetLocked.mockReturnValue(false);
    mocks.isWaitingForStep.mockReturnValue(true);
    mocks.showIncorrectFeedback.mockReturnValue(true);
  });

  it("does not generate on initial mount", () => {
    renderSequenceSession();

    expect(mocks.generateTarget).not.toHaveBeenCalled();
  });

  it("preserves step, feedback, statistics, and graded keyboard semantics in Mobile Play", () => {
    renderSequenceSession();
    fireEvent.click(screen.getByRole("button", { name: "Simulate incorrect" }));
    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));

    expect(screen.getByText("Mobile active: true")).toBeTruthy();
    expect(screen.getByText("Feedback: incorrect")).toBeTruthy();
    expect(screen.getByText("Stats: 0 completed, 1 incorrect")).toBeTruthy();
    expect(screen.getByText("Piano keyboard")).toBeTruthy();
    expect(mocks.generateTarget).not.toHaveBeenCalled();
    expect(mocks.resetAttempt).not.toHaveBeenCalled();
    const props = mocks.pianoProps.mock.calls.at(-1)?.[0] as Record<
      string,
      unknown
    >;
    expect(props.onNoteToggle).toEqual(expect.any(Function));
    expect(props.onNotePress).toBeUndefined();
    expect(props.onNoteRelease).toBeUndefined();
  });

  it("keeps Focus Staff and Mobile Play mutually exclusive without regeneration", () => {
    renderSequenceSession();
    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Focus Staff" }));

    expect(
      screen.queryByRole("button", { name: "Exit Mobile Play" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Exit Focus Staff" }),
    ).toBeTruthy();
    expect(mocks.generateTarget).not.toHaveBeenCalled();
  });

  it.each([
    ["Use bass", "mode", "bass"],
    ["Use scales", "exerciseType", "scales"],
    [
      "Add descending",
      "enabledDirections",
      new Set(["ascending", "descending"]),
    ],
    ["Add interval", "enabledIntervals", expect.any(Set)],
    [
      "Add accidentals",
      "enabledNoteCategories",
      new Set(["naturals", "accidentals"]),
    ],
    ["Add scale", "enabledScales", new Set(["major", "natural-minor"])],
    [
      "Add scale direction",
      "enabledScaleDirections",
      new Set(["ascending", "ascending-descending"]),
    ],
    ["Add arpeggio", "enabledArpeggios", new Set(["major", "minor"])],
    [
      "Add progression key",
      "enabledChordProgressionKeyIds",
      new Set(["c-major", "g-major"]),
    ],
    [
      "Add progression template",
      "enabledChordProgressionTemplateIds",
      new Set(["major-1451", "major-251"]),
    ],
  ])("regenerates once when %s changes", (buttonName, optionName, expected) => {
    renderSequenceSession();

    fireEvent.click(screen.getByRole("button", { name: buttonName }));

    expect(mocks.clearTransition).toHaveBeenCalledTimes(1);
    expect(mocks.resetAttempt).toHaveBeenCalledTimes(1);
    expect(mocks.generateTarget).toHaveBeenCalledTimes(1);
    expect(mocks.targetOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ [optionName]: expected }),
    );
    expect(screen.getByText("Feedback: idle")).toBeTruthy();
  });

  it("preserves statistics and clears feedback when settings change", () => {
    renderSequenceSession();

    fireEvent.click(screen.getByRole("button", { name: "Simulate incorrect" }));

    expect(screen.getByText("Stats: 0 completed, 1 incorrect")).toBeTruthy();
    expect(screen.getByText("Feedback: incorrect")).toBeTruthy();

    mocks.clearTransition.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Add scale" }));

    expect(screen.getByText("Stats: 0 completed, 1 incorrect")).toBeTruthy();
    expect(screen.getByText("Feedback: idle")).toBeTruthy();
    expect(mocks.clearTransition).toHaveBeenCalledTimes(1);
  });

  it("preserves statistics when progression selections change", () => {
    renderSequenceSession();

    fireEvent.click(screen.getByRole("button", { name: "Simulate incorrect" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Add progression key" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Add progression template" }),
    );

    expect(screen.getByText("Stats: 0 completed, 1 incorrect")).toBeTruthy();
    expect(mocks.generateTarget).toHaveBeenCalledTimes(2);
  });

  it("does not regenerate when a final required setting is rejected", () => {
    renderSequenceSession();

    fireEvent.click(
      screen.getByRole("button", { name: "Toggle final direction" }),
    );

    expect(mocks.clearTransition).not.toHaveBeenCalled();
    expect(mocks.generateTarget).not.toHaveBeenCalled();
  });

  it.each([
    "Toggle final progression key",
    "Toggle final progression template",
  ])("does not regenerate when %s is rejected", (buttonName) => {
    renderSequenceSession();

    fireEvent.click(screen.getByRole("button", { name: buttonName }));

    expect(mocks.clearTransition).not.toHaveBeenCalled();
    expect(mocks.generateTarget).not.toHaveBeenCalled();
  });

  it("does not regenerate for display, audio, or focus changes", () => {
    renderSequenceSession();

    fireEvent.click(screen.getByRole("button", { name: "Show target name" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Change feedback volume" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Focus Staff" }));

    expect(mocks.clearTransition).not.toHaveBeenCalled();
    expect(mocks.generateTarget).not.toHaveBeenCalled();
  });

  it("keeps Reset Session behavior to one reset and generation", () => {
    renderSequenceSession();

    fireEvent.click(screen.getByRole("button", { name: "Simulate incorrect" }));
    mocks.clearTransition.mockClear();
    mocks.resetAttempt.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Reset session" }));

    expect(screen.getByText("Stats: 0 completed, 0 incorrect")).toBeTruthy();
    expect(mocks.clearTransition).toHaveBeenCalledTimes(1);
    expect(mocks.resetAttempt).toHaveBeenCalledTimes(1);
    expect(mocks.generateTarget).toHaveBeenCalledTimes(1);
  });

  it("collects rolled MIDI chords and restores progression virtual input", () => {
    vi.useFakeTimers();
    mocks.showCorrectFeedback.mockReturnValue(true);
    mocks.completeCurrentStep.mockReturnValue({ sequenceComplete: false });
    renderSequenceSession();

    fireEvent.click(screen.getByRole("button", { name: "Use progressions" }));
    expect(screen.getByText("Piano keyboard")).toBeTruthy();

    const midiOptions = mocks.midiOptions.mock.calls.at(-1)?.[0] as {
      onNotePlayed: (midiNumber: number) => void;
    };
    midiOptions.onNotePlayed(60);
    midiOptions.onNotePlayed(67);
    midiOptions.onNotePlayed(64);

    expect(mocks.showCorrectFeedback).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(225));

    expect(mocks.showCorrectFeedback).toHaveBeenCalledTimes(1);
    expect(mocks.completeCurrentStep).toHaveBeenCalledTimes(1);
    expect(screen.getByText("MIDI status")).toBeTruthy();
    cleanup();
    vi.useRealTimers();
  });

  it("grades missing, extra, and duplicate MIDI chord notes once", () => {
    vi.useFakeTimers();
    renderSequenceSession();
    fireEvent.click(screen.getByRole("button", { name: "Use progressions" }));

    const midiOptions = mocks.midiOptions.mock.calls.at(-1)?.[0] as {
      onNotePlayed: (midiNumber: number) => void;
    };

    midiOptions.onNotePlayed(60);
    midiOptions.onNotePlayed(60);
    midiOptions.onNotePlayed(64);
    act(() => vi.advanceTimersByTime(225));
    expect(mocks.showIncorrectFeedback).toHaveBeenCalledTimes(1);

    mocks.showIncorrectFeedback.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Use progressions" }));
    midiOptions.onNotePlayed(60);
    midiOptions.onNotePlayed(64);
    midiOptions.onNotePlayed(67);
    midiOptions.onNotePlayed(61);
    act(() => vi.advanceTimersByTime(225));
    expect(mocks.showIncorrectFeedback).toHaveBeenCalledTimes(2);
    cleanup();
    vi.useRealTimers();
  });

  it("keeps released notes and merges currently held MIDI tones", () => {
    vi.useFakeTimers();
    mocks.showCorrectFeedback.mockReturnValue(true);
    mocks.completeCurrentStep.mockReturnValue({ sequenceComplete: false });
    renderSequenceSession();
    fireEvent.click(screen.getByRole("button", { name: "Use progressions" }));

    const midiOptions = mocks.midiOptions.mock.calls.at(-1)?.[0] as {
      onHeldNotesChanged: (notes: ReadonlySet<number>) => void;
      onNotePlayed: (midiNumber: number) => void;
    };
    midiOptions.onHeldNotesChanged(new Set([60]));
    midiOptions.onNotePlayed(64);
    midiOptions.onHeldNotesChanged(new Set([60, 67]));
    midiOptions.onNotePlayed(67);
    midiOptions.onHeldNotesChanged(new Set([60]));
    act(() => vi.advanceTimersByTime(225));

    expect(mocks.showCorrectFeedback).toHaveBeenCalledTimes(1);
    cleanup();
    vi.useRealTimers();
  });

  it("keeps virtual selections beyond 225 milliseconds and toggles them", () => {
    vi.useFakeTimers();
    renderSequenceSession();
    fireEvent.click(screen.getByRole("button", { name: "Use progressions" }));

    fireEvent.click(screen.getByRole("button", { name: "Virtual 67" }));
    fireEvent.click(screen.getByRole("button", { name: "Virtual 60" }));

    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText("Active: 67,60")).toBeTruthy();
    expect(mocks.showCorrectFeedback).not.toHaveBeenCalled();
    expect(mocks.showIncorrectFeedback).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Virtual 67" }));
    expect(screen.getByText("Active: 60")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Virtual 67" }));
    expect(screen.getByText("Active: 60,67")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /clear selection/i }),
    ).toBeNull();
    cleanup();
    vi.useRealTimers();
  });

  it("snapshots, plays, and grades a completed virtual chord exactly once", () => {
    mocks.showCorrectFeedback.mockReturnValue(true);
    mocks.completeCurrentStep.mockReturnValue({ sequenceComplete: false });
    renderSequenceSession();
    fireEvent.click(screen.getByRole("button", { name: "Use progressions" }));

    for (const midiNumber of [67, 60, 64]) {
      fireEvent.click(
        screen.getByRole("button", { name: `Virtual ${midiNumber}` }),
      );
    }

    expect(mocks.playGrandPianoChord).toHaveBeenCalledTimes(1);
    const completedSnapshot = mocks.playGrandPianoChord.mock.calls[0]?.[0];
    expect(completedSnapshot).toEqual(new Set([67, 60, 64]));
    expect(mocks.playGrandPianoChord).toHaveBeenCalledWith(
      completedSnapshot,
      850,
    );
    expect(mocks.showCorrectFeedback).toHaveBeenCalledTimes(1);
    expect(mocks.completeCurrentStep).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("active-notes").textContent).toBe("Active: ");
  });

  it("grades one wrong virtual chord and clears its selection", () => {
    renderSequenceSession();
    fireEvent.click(screen.getByRole("button", { name: "Use progressions" }));

    for (const midiNumber of [60, 64, 61]) {
      fireEvent.click(
        screen.getByRole("button", { name: `Virtual ${midiNumber}` }),
      );
    }

    expect(mocks.showIncorrectFeedback).toHaveBeenCalledTimes(1);
    expect(mocks.playGrandPianoChord).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Stats: 0 completed, 1 incorrect")).toBeTruthy();
    expect(screen.getByTestId("active-notes").textContent).toBe("Active: ");
  });

  it("uses the current step size for four-note virtual chords", () => {
    mocks.getCurrentTarget.mockReturnValue(FOUR_NOTE_TARGET);
    mocks.showCorrectFeedback.mockReturnValue(true);
    mocks.completeCurrentStep.mockReturnValue({ sequenceComplete: false });
    renderSequenceSession();
    fireEvent.click(screen.getByRole("button", { name: "Use progressions" }));

    for (const midiNumber of [60, 64, 67]) {
      fireEvent.click(
        screen.getByRole("button", { name: `Virtual ${midiNumber}` }),
      );
    }
    fireEvent.click(screen.getByRole("button", { name: "Virtual 67" }));
    fireEvent.click(screen.getByRole("button", { name: "Virtual 67" }));

    expect(mocks.showCorrectFeedback).not.toHaveBeenCalled();
    expect(screen.getByText("Active: 60,64,67")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Virtual 71" }));
    expect(mocks.showCorrectFeedback).toHaveBeenCalledTimes(1);
    expect(mocks.playGrandPianoChord).toHaveBeenCalledWith(
      new Set([60, 64, 67, 71]),
      850,
    );
  });

  it.each([
    ["Reset session"],
    ["Add progression key"],
    ["Add progression template"],
    ["Use bass"],
    ["Use scales"],
  ])(
    "clears a pending virtual selection when %s changes lifecycle state",
    (buttonName) => {
      renderSequenceSession();
      fireEvent.click(screen.getByRole("button", { name: "Use progressions" }));
      fireEvent.click(screen.getByRole("button", { name: "Virtual 60" }));
      fireEvent.click(screen.getByRole("button", { name: "Virtual 64" }));
      fireEvent.click(screen.getByRole("button", { name: buttonName }));

      expect(screen.getByTestId("active-notes").textContent).toBe("Active: ");
      expect(mocks.showCorrectFeedback).not.toHaveBeenCalled();
      expect(mocks.showIncorrectFeedback).not.toHaveBeenCalled();
    },
  );

  it("clears virtual selection for retry preparation", () => {
    renderSequenceSession();
    fireEvent.click(screen.getByRole("button", { name: "Use progressions" }));
    fireEvent.click(screen.getByRole("button", { name: "Virtual 60" }));

    const transitionOptions = mocks.transitionOptions.mock.calls.at(
      -1,
    )?.[0] as {
      onRetrySequence: () => boolean;
    };
    act(() => transitionOptions.onRetrySequence());

    expect(mocks.retrySequence).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("active-notes").textContent).toBe("Active: ");
  });

  it("does not carry an old target selection into a regenerated target", () => {
    renderSequenceSession();
    fireEvent.click(screen.getByRole("button", { name: "Use progressions" }));
    fireEvent.click(screen.getByRole("button", { name: "Virtual 60" }));
    fireEvent.click(screen.getByRole("button", { name: "Virtual 64" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset session" }));
    fireEvent.click(screen.getByRole("button", { name: "Virtual 67" }));

    expect(screen.getByText("Active: 67")).toBeTruthy();
    expect(mocks.showCorrectFeedback).not.toHaveBeenCalled();
    expect(mocks.showIncorrectFeedback).not.toHaveBeenCalled();
  });

  it("cannot grade a pending virtual selection after unmount", () => {
    vi.useFakeTimers();
    const view = renderSequenceSession();
    fireEvent.click(screen.getByRole("button", { name: "Use progressions" }));
    fireEvent.click(screen.getByRole("button", { name: "Virtual 60" }));
    fireEvent.click(screen.getByRole("button", { name: "Virtual 64" }));

    view.unmount();
    act(() => vi.runAllTimers());

    expect(mocks.showCorrectFeedback).not.toHaveBeenCalled();
    expect(mocks.showIncorrectFeedback).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("clears virtual selection on Focus Staff entry and exits empty", () => {
    renderSequenceSession();
    fireEvent.click(screen.getByRole("button", { name: "Use progressions" }));
    fireEvent.click(screen.getByRole("button", { name: "Virtual 60" }));
    fireEvent.click(screen.getByRole("button", { name: "Focus Staff" }));
    expect(screen.getByTestId("active-notes").textContent).toBe("Active: ");
    fireEvent.click(screen.getByRole("button", { name: "Exit Focus Staff" }));
    expect(screen.getByTestId("active-notes").textContent).toBe("Active: ");
    expect(mocks.generateTarget).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Stats: 0 completed, 0 incorrect")).toBeTruthy();
  });

  it("never combines MIDI and virtual chord attempts", () => {
    vi.useFakeTimers();
    renderSequenceSession();
    fireEvent.click(screen.getByRole("button", { name: "Use progressions" }));

    fireEvent.click(screen.getByRole("button", { name: "Virtual 60" }));
    fireEvent.click(screen.getByRole("button", { name: "Virtual 64" }));

    const midiOptions = mocks.midiOptions.mock.calls.at(-1)?.[0] as {
      onNotePlayed: (midiNumber: number) => void;
    };
    act(() => midiOptions.onNotePlayed(67));
    expect(screen.getByTestId("active-notes").textContent).toBe("Active: 67");
    act(() => vi.advanceTimersByTime(225));

    expect(mocks.showCorrectFeedback).not.toHaveBeenCalled();
    expect(mocks.showIncorrectFeedback).toHaveBeenCalledTimes(1);
    cleanup();
    vi.useRealTimers();
  });

  it("completes a progression exactly once and updates statistics", () => {
    vi.useFakeTimers();
    mocks.showCorrectFeedback.mockReturnValue(true);
    mocks.completeCurrentStep.mockReturnValue({ sequenceComplete: true });
    mocks.lockSequenceTarget.mockReturnValue(true);
    renderSequenceSession();
    fireEvent.click(screen.getByRole("button", { name: "Use progressions" }));

    for (const midiNumber of [60, 64, 67]) {
      fireEvent.click(
        screen.getByRole("button", { name: `Virtual ${midiNumber}` }),
      );
    }
    expect(mocks.completeCurrentStep).toHaveBeenCalledTimes(1);
    expect(mocks.lockSequenceTarget).toHaveBeenCalledTimes(1);
    expect(mocks.startSequenceCompletionTransition).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Stats: 1 completed, 0 incorrect")).toBeTruthy();
    expect(screen.getByTestId("active-notes").textContent).toBe("Active: ");
    cleanup();
    vi.useRealTimers();
  });

  it("keeps single-note virtual input immediate", () => {
    mocks.showCorrectFeedback.mockReturnValue(true);
    mocks.completeCurrentStep.mockReturnValue({ sequenceComplete: false });
    renderSequenceSession();

    fireEvent.click(screen.getByRole("button", { name: "Virtual 60" }));

    expect(mocks.playGrandPianoNote).toHaveBeenCalledWith(60, 850);
    expect(mocks.playGrandPianoChord).not.toHaveBeenCalled();
    expect(mocks.showCorrectFeedback).toHaveBeenCalledTimes(1);
    expect(mocks.completeCurrentStep).toHaveBeenCalledTimes(1);
  });

  it("continues grading MIDI note-on input for existing exercises", () => {
    renderSequenceSession();

    const midiOptions = mocks.midiOptions.mock.calls.at(-1)?.[0] as {
      onNotePlayed: (midiNumber: number) => void;
    };
    midiOptions.onNotePlayed(60);

    expect(mocks.showCorrectFeedback).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Piano keyboard")).toBeTruthy();
  });
});
