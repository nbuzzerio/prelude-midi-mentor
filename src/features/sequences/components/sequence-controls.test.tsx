import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SequenceControls from "./sequence-controls";

afterEach(cleanup);

const BASE_PROPS = {
  enabledArpeggios: new Set(["major"] as const),
  enabledArpeggioDirections: new Set(["ascending-descending"] as const),
  enabledChordProgressionKeyIds: new Set(["c-major"] as const),
  enabledChordProgressionTemplateIds: new Set(["major-1451"] as const),
  enabledDirections: new Set(["ascending"] as const),
  enabledIntervals: new Set(["major-third"] as const),
  enabledNoteCategories: new Set(["naturals"] as const),
  enabledScaleDirections: new Set(["ascending"] as const),
  enabledScales: new Set(["major"] as const),
  mode: "treble" as const,
  onArpeggioToggle: vi.fn(),
  onArpeggioDirectionToggle: vi.fn(),
  onChordProgressionKeyToggle: vi.fn(),
  onChordProgressionTemplateToggle: vi.fn(),
  onDirectionToggle: vi.fn(),
  onExerciseTypeChange: vi.fn(),
  onIntervalToggle: vi.fn(),
  onModeChange: vi.fn(),
  onNoteCategoryToggle: vi.fn(),
  onReset: vi.fn(),
  onScaleDirectionToggle: vi.fn(),
  onScaleToggle: vi.fn(),
  onShowTargetNameChange: vi.fn(),
  showTargetName: false,
};

describe("SequenceControls", () => {
  it("shows chord progressions as the fourth exercise", () => {
    render(<SequenceControls {...BASE_PROPS} exerciseType="intervals" />);

    const exercises = screen.getByRole("group", { name: "Exercise" });
    const buttons = exercises.querySelectorAll("button");

    expect([...buttons].map((button) => button.textContent)).toEqual([
      "Intervals",
      "Scales",
      "Arpeggios",
      "Chord progressions",
    ]);
  });

  it("keeps interval direction separate and exposes round trips for scales and arpeggios", () => {
    const { rerender } = render(
      <SequenceControls {...BASE_PROPS} exerciseType="intervals" />,
    );

    expect(
      screen.queryByRole("button", { name: "Ascending + Descending" }),
    ).toBeNull();

    rerender(<SequenceControls {...BASE_PROPS} exerciseType="arpeggios" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Ascending + Descending" }),
    );
    expect(BASE_PROPS.onArpeggioDirectionToggle).toHaveBeenCalledWith(
      "ascending-descending",
    );
    expect(BASE_PROPS.onDirectionToggle).not.toHaveBeenCalled();

    rerender(<SequenceControls {...BASE_PROPS} exerciseType="scales" />);

    const directionButton = screen.getByRole("button", {
      name: "Ascending + Descending",
    });

    fireEvent.click(directionButton);

    expect(BASE_PROPS.onScaleDirectionToggle).toHaveBeenCalledWith(
      "ascending-descending",
    );
    expect(BASE_PROPS.onDirectionToggle).not.toHaveBeenCalled();
  });

  it("shows grouped progression settings and hides melodic settings", () => {
    render(
      <SequenceControls {...BASE_PROPS} exerciseType="chord-progressions" />,
    );

    expect(screen.getByRole("group", { name: "Clef" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Major keys" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Minor keys" })).toBeTruthy();
    expect(
      screen.getByRole("group", { name: "Major progressions" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("group", { name: "Minor progressions" }),
    ).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Direction" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Starting notes" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Arpeggios" })).toBeNull();
    expect(screen.getByText("Show chord names")).toBeTruthy();

    expect(
      screen
        .getByRole("group", { name: "Major keys" })
        .querySelectorAll("button"),
    ).toHaveLength(6);
    expect(
      screen
        .getByRole("group", { name: "Minor keys" })
        .querySelectorAll("button"),
    ).toHaveLength(6);
  });

  it("uses meaningful accessible labels and forwards progression toggles", () => {
    render(
      <SequenceControls {...BASE_PROPS} exerciseType="chord-progressions" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "B flat major" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "two diminished, five, one in minor",
      }),
    );

    expect(BASE_PROPS.onChordProgressionKeyToggle).toHaveBeenCalledWith(
      "b-flat-major",
    );
    expect(BASE_PROPS.onChordProgressionTemplateToggle).toHaveBeenCalledWith(
      "minor-251",
    );
    expect(screen.getByText("B♭ major")).toBeTruthy();
    expect(screen.getByText("ii°–V–i")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "C major" }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
  });
});

it("can render and edit settings without a runtime reset action or MIDI provider", () => {
  render(<SequenceControls {...BASE_PROPS} exerciseType="scales" onReset={undefined} />);
  expect(screen.queryByRole("button", { name: /reset session/i })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Ascending + Descending" }));
  expect(BASE_PROPS.onScaleDirectionToggle).toHaveBeenCalledWith("ascending-descending");
});
