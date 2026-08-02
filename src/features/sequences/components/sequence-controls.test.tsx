import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SequenceControls from "./sequence-controls";

const BASE_PROPS = {
  enabledArpeggios: new Set(["major"] as const),
  enabledDirections: new Set(["ascending"] as const),
  enabledIntervals: new Set(["major-third"] as const),
  enabledNoteCategories: new Set(["naturals"] as const),
  enabledScaleDirections: new Set(["ascending"] as const),
  enabledScales: new Set(["major"] as const),
  mode: "treble" as const,
  onArpeggioToggle: vi.fn(),
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
  it("shows ascending and descending practice only for scales", () => {
    const { rerender } = render(
      <SequenceControls {...BASE_PROPS} exerciseType="intervals" />,
    );

    expect(
      screen.queryByRole("button", { name: "Ascending + Descending" }),
    ).toBeNull();

    rerender(<SequenceControls {...BASE_PROPS} exerciseType="arpeggios" />);

    expect(
      screen.queryByRole("button", { name: "Ascending + Descending" }),
    ).toBeNull();

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
});
