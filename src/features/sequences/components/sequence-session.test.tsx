import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  updateMidiHeldNotes: vi.fn(),
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

vi.mock("../hooks/use-sequence-target", () => ({
  useSequenceTarget: (options: unknown) => {
    mocks.targetOptions(options);

    return {
      generateNextTarget: mocks.generateTarget,
      getCurrentTarget: mocks.getCurrentTarget,
      isSequenceTargetLocked: mocks.isSequenceTargetLocked,
      lockSequenceTarget: mocks.lockSequenceTarget,
      sequenceTarget: SEQUENCE_TARGET,
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
  useSequenceTransition: () => ({
    clearTransition: mocks.clearTransition,
    startIncorrectStepTransition: mocks.startIncorrectStepTransition,
    startSequenceCompletionTransition: mocks.startSequenceCompletionTransition,
    startStepTransition: mocks.startStepTransition,
    updateMidiHeldNotes: mocks.updateMidiHeldNotes,
  }),
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

vi.mock("@/components/notation/piano-keyboard", () => ({
  default: () => <div>Piano keyboard</div>,
}));

vi.mock("./sequence-card", () => ({
  default: ({
    feedback,
    isFocusMode,
    onIncorrect,
    onToggleFocusMode,
  }: {
    feedback: string;
    isFocusMode: boolean;
    onIncorrect: () => void;
    onToggleFocusMode: () => void;
  }) => (
    <div>
      <span>Feedback: {feedback}</span>
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
      <button onClick={() => onModeChange("bass")} type="button">Use bass</button>
      <button onClick={() => onExerciseTypeChange("scales")} type="button">Use scales</button>
      <button onClick={() => onExerciseTypeChange("chord-progressions")} type="button">Use progressions</button>
      <button onClick={() => onChordProgressionKeyToggle("g-major")} type="button">Add progression key</button>
      <button onClick={() => onChordProgressionTemplateToggle("major-251")} type="button">Add progression template</button>
      <button onClick={() => onChordProgressionKeyToggle("c-major")} type="button">Toggle final progression key</button>
      <button onClick={() => onChordProgressionTemplateToggle("major-1451")} type="button">Toggle final progression template</button>
      <button onClick={() => onDirectionToggle("descending")} type="button">Add descending</button>
      <button onClick={() => onDirectionToggle("ascending")} type="button">Toggle final direction</button>
      <button onClick={() => onIntervalToggle("perfect-fifth")} type="button">Add interval</button>
      <button onClick={() => onNoteCategoryToggle("accidentals")} type="button">Add accidentals</button>
      <button onClick={() => onScaleToggle("natural-minor")} type="button">Add scale</button>
      <button onClick={() => onScaleDirectionToggle("ascending-descending")} type="button">Add scale direction</button>
      <button onClick={() => onArpeggioToggle("minor")} type="button">Add arpeggio</button>
      <button onClick={() => onShowTargetNameChange(true)} type="button">Show target name</button>
      <button onClick={onReset} type="button">Reset session</button>
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
    mocks.getCurrentTarget.mockReturnValue(SEQUENCE_TARGET);
    mocks.isSequenceTargetLocked.mockReturnValue(false);
    mocks.isWaitingForStep.mockReturnValue(true);
    mocks.showIncorrectFeedback.mockReturnValue(true);
  });

  it("does not generate on initial mount", () => {
    renderSequenceSession();

    expect(mocks.generateTarget).not.toHaveBeenCalled();
  });

  it.each([
    ["Use bass", "mode", "bass"],
    ["Use scales", "exerciseType", "scales"],
    ["Add descending", "enabledDirections", new Set(["ascending", "descending"])],
    ["Add interval", "enabledIntervals", expect.any(Set)],
    ["Add accidentals", "enabledNoteCategories", new Set(["naturals", "accidentals"])],
    ["Add scale", "enabledScales", new Set(["major", "natural-minor"])],
    ["Add scale direction", "enabledScaleDirections", new Set(["ascending", "ascending-descending"])],
    ["Add arpeggio", "enabledArpeggios", new Set(["major", "minor"])],
    ["Add progression key", "enabledChordProgressionKeyIds", new Set(["c-major", "g-major"])],
    ["Add progression template", "enabledChordProgressionTemplateIds", new Set(["major-1451", "major-251"])],
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
    fireEvent.click(screen.getByRole("button", { name: "Add progression key" }));
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

  it.each(["Toggle final progression key", "Toggle final progression template"])(
    "does not regenerate when %s is rejected",
    (buttonName) => {
      renderSequenceSession();

      fireEvent.click(screen.getByRole("button", { name: buttonName }));

      expect(mocks.clearTransition).not.toHaveBeenCalled();
      expect(mocks.generateTarget).not.toHaveBeenCalled();
    },
  );

  it("does not regenerate for display, audio, or focus changes", () => {
    renderSequenceSession();

    fireEvent.click(screen.getByRole("button", { name: "Show target name" }));
    fireEvent.click(screen.getByRole("button", { name: "Change feedback volume" }));
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

  it("hides virtual input and ignores MIDI note-on in progression mode", () => {
    renderSequenceSession();

    fireEvent.click(screen.getByRole("button", { name: "Use progressions" }));
    expect(screen.queryByText("Piano keyboard")).toBeNull();

    const midiOptions = mocks.midiOptions.mock.calls.at(-1)?.[0] as {
      onNotePlayed: (midiNumber: number) => void;
    };
    midiOptions.onNotePlayed(60);

    expect(mocks.showIncorrectFeedback).not.toHaveBeenCalled();
    expect(screen.getByText("Stats: 0 completed, 0 incorrect")).toBeTruthy();
    expect(screen.getByText("MIDI status")).toBeTruthy();
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
