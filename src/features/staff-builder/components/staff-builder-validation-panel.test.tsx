import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffBuilderValidationPanel } from "./staff-builder-validation-panel";

afterEach(cleanup);

describe("StaffBuilderValidationPanel", () => {
  it("exposes passive count, guided focus, navigation, and explicit correction names", () => {
    const activate = vi.fn();
    const correction = { kind: "fill-gap-with-rests" as const, staff: "treble" as const, startTick: 0, endTick: 480 };
    const issue = { id: "gap", code: "gap" as const, severity: "error" as const, target: { measureIndex: 0, staff: "treble" as const, positionTicks: 0, endTicks: 480 }, message: "Treble has a gap.", corrections: [correction] };
    const { rerender } = render(<StaffBuilderValidationPanel activeIndex={-1} activeIssue={null} issues={[issue]} onActivate={activate} onClose={vi.fn()} onCorrection={vi.fn()} onNext={vi.fn()} onPrevious={vi.fn()} status={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Validate & Save" }));
    expect(activate).toHaveBeenCalledOnce();
    const apply = vi.fn();
    rerender(<StaffBuilderValidationPanel activeIndex={0} activeIssue={issue} issues={[issue]} onActivate={activate} onClose={vi.fn()} onCorrection={apply} onNext={vi.fn()} onPrevious={vi.fn()} status={null} />);
    expect(document.activeElement).toBe(screen.getByText("Treble has a gap."));
    fireEvent.click(screen.getByRole("button", { name: "Fill treble gap with rests" }));
    expect(apply).toHaveBeenCalledWith(correction);
    expect(screen.getByText("Issue 1 of 1")).toBeTruthy();
  });
});
