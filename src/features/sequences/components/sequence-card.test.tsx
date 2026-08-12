import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SequenceTarget } from "@/types/practice";
import { SEQUENCE_DEFAULT_TIMING } from "@/lib/music/sequence-timing";

import SequenceCard from "./sequence-card";

afterEach(cleanup);

const notationProps = vi.hoisted(() => vi.fn());

vi.mock("@/components/notation/music-staff", () => ({
  default: (props: Record<string, unknown>) => {
    notationProps(props);
    return <div>Music staff</div>;
  },
}));

vi.mock("@/components/notation/focus-staff-control", () => ({
  default: ({ onToggle }: { onToggle: () => void }) => (
    <button onClick={onToggle} type="button">Focus Staff</button>
  ),
}));

vi.mock("@/components/practice-simulation-controls", () => ({
  default: ({ onCorrect }: { onCorrect: () => void }) => (
    <button onClick={onCorrect} type="button">Simulate correct</button>
  ),
}));

const TARGET: SequenceTarget = {
  clef: "treble",
  name: { primary: "I–IV–V–I", secondary: "C major" },
  steps: [
    {
      durationTicks: 480,
      name: { primary: "I", secondary: "C major" },
      notes: [
        { midiNumber: 60, name: "C", octave: 4 },
        { midiNumber: 64, name: "E", octave: 4 },
        { midiNumber: 67, name: "G", octave: 4 },
      ],
    },
    {
      durationTicks: 480,
      name: { primary: "IV", secondary: "F major" },
      notes: [
        { midiNumber: 65, name: "F", octave: 4 },
        { midiNumber: 69, name: "A", octave: 4 },
        { midiNumber: 72, name: "C", octave: 5 },
      ],
    },
  ],
  timing: SEQUENCE_DEFAULT_TIMING,
};

const MULTI_MEASURE_TARGET: SequenceTarget = {
  ...TARGET,
  steps: Array.from({ length: 6 }, (_, index) => ({
    durationTicks: 480,
    name: { primary: `Step ${index + 1}` },
    notes: [{ midiNumber: 60 + index, name: "C", octave: 4 }],
  })),
};

function renderCard(overrides: Partial<Parameters<typeof SequenceCard>[0]> = {}) {
  const props: Parameters<typeof SequenceCard>[0] = {
    currentStepIndex: 0,
    exerciseType: "chord-progressions",
    feedback: "idle",
    isFocusMode: false,
    onCorrect: vi.fn(),
    onIncorrect: vi.fn(),
    onShowWholeSequenceChange: vi.fn(),
    onToggleFocusMode: vi.fn(),
    sequenceTarget: TARGET,
    showWholeSequence: false,
    showTargetName: true,
    ...overrides,
  };

  return { props, ...render(<SequenceCard {...props} />) };
}

describe("SequenceCard", () => {
  it("shows temporal measure progress and defaults to the current window", () => {
    renderCard();

    expect(screen.getByText("Measure 1 of 1")).toBeTruthy();
    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
    expect(
      (screen.getByRole("checkbox", {
        name: "Show whole sequence",
      }) as HTMLInputElement).checked,
    ).toBe(false);
    expect(notationProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        currentStepIndex: 0,
        firstVisibleStepIndex: 0,
        lastVisibleStepIndex: 1,
        showWholeSequence: false,
      }),
    );
  });

  it("renders the complete target with the global highlight when requested", () => {
    const onShowWholeSequenceChange = vi.fn();
    renderCard({
      currentStepIndex: 4,
      sequenceTarget: MULTI_MEASURE_TARGET,
      showWholeSequence: true,
      onShowWholeSequenceChange,
    });

    expect(screen.getByText("Measure 2 of 2")).toBeTruthy();
    const toggle = screen.getByRole("checkbox", {
      name: "Show whole sequence",
    });
    expect((toggle as HTMLInputElement).checked).toBe(true);
    fireEvent.click(toggle);
    expect(onShowWholeSequenceChange).toHaveBeenCalledWith(false);
    expect(notationProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        currentStepIndex: 4,
        firstVisibleStepIndex: 0,
        lastVisibleStepIndex: 5,
        showWholeSequence: true,
      }),
    );
  });

  it("maps a global barline step to the next temporal measure window", () => {
    renderCard({
      currentStepIndex: 4,
      sequenceTarget: MULTI_MEASURE_TARGET,
    });

    expect(screen.getByText("Measure 2 of 2")).toBeTruthy();
    expect(screen.getByText("Step 5 of 6")).toBeTruthy();
    expect(screen.getByText("Step 5")).toBeTruthy();
    expect(notationProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        currentStepIndex: 4,
        firstVisibleStepIndex: 4,
        lastVisibleStepIndex: 5,
        showWholeSequence: false,
      }),
    );
  });

  it("keeps authoritative progression metadata while showing the whole target", () => {
    renderCard({
      currentStepIndex: 1,
      showWholeSequence: true,
    });

    expect(screen.getByText("IV")).toBeTruthy();
    expect(screen.getByText("F major")).toBeTruthy();
    expect(notationProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentStepIndex: 1 }),
    );
  });

  it("shows progression instructions, progress, and revealed metadata", () => {
    renderCard();

    expect(screen.getByText("Play the highlighted chord.")).toBeTruthy();
    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
    expect(screen.getByText("I–IV–V–I")).toBeTruthy();
    expect(screen.getAllByText("C major")).toHaveLength(2);
    expect(screen.getByText("I")).toBeTruthy();
  });

  it("updates current-step metadata", () => {
    renderCard({ currentStepIndex: 1 });

    expect(screen.getByText("IV")).toBeTruthy();
    expect(screen.getByText("F major")).toBeTruthy();
    expect(screen.getByText("Step 2 of 2")).toBeTruthy();
  });

  it("omits all answer-revealing metadata when hidden", () => {
    renderCard({ showTargetName: false });

    for (const answer of ["I–IV–V–I", "C major", "I"]) {
      expect(screen.queryByText(answer)).toBeNull();
    }
  });

  it("preserves note instructions for existing exercises", () => {
    renderCard({ exerciseType: "intervals" });

    expect(screen.getByText("Play the highlighted note.")).toBeTruthy();
  });

  it("keeps simulation and Focus Staff controls working", () => {
    const { props } = renderCard();

    fireEvent.click(screen.getByRole("button", { name: "Simulate correct" }));
    fireEvent.click(screen.getByRole("button", { name: "Focus Staff" }));

    expect(props.onCorrect).toHaveBeenCalledTimes(1);
    expect(props.onToggleFocusMode).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Music staff")).toBeTruthy();
  });

  it("hides simulation controls in Focus Staff mode", () => {
    renderCard({ isFocusMode: true });

    expect(
      screen.queryByRole("button", { name: "Simulate correct" }),
    ).toBeNull();
    expect(screen.getByText("Music staff")).toBeTruthy();
    expect(screen.getByText("I–IV–V–I")).toBeTruthy();
  });

  it("offers Mobile Play outside Focus Staff", () => {
    const onEnterMobilePlay = vi.fn();
    const { container } = renderCard({ onEnterMobilePlay });
    const entry = screen.getByRole("button", { name: "Mobile Play" });
    expect(entry.classList.contains("practice-mobile-play-entry")).toBe(true);
    expect(container.querySelectorAll(".sequence-task-actions")).toHaveLength(1);
    fireEvent.click(entry);
    expect(onEnterMobilePlay).toHaveBeenCalledTimes(1);
  });

  it("keeps progress, feedback, and revealed labels while hiding simulation controls", () => {
    renderCard({ feedback: "incorrect", isMobilePlayMode: true });
    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
    expect(screen.getByText("Try again.")).toBeTruthy();
    expect(screen.getByText("I–IV–V–I")).toBeTruthy();
    expect(screen.getByText("I")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Simulate correct" })).toBeNull();
    expect(screen.getByText("Music staff")).toBeTruthy();
  });

  it("continues honoring hidden target and current-step labels in Mobile Play", () => {
    renderCard({ isMobilePlayMode: true, showTargetName: false });
    expect(screen.queryByText("I–IV–V–I")).toBeNull();
    expect(screen.queryByText("I")).toBeNull();
  });
});
