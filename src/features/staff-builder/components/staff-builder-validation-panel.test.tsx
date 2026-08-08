import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffBuilderValidationPanel } from "./staff-builder-validation-panel";

afterEach(cleanup);

describe("StaffBuilderValidationPanel", () => {
  it("exposes passive count, guided focus, navigation, and explicit correction names", () => {
    const activate = vi.fn();
    const correction = { kind: "fill-gap-with-rests" as const, staff: "treble" as const, startTick: 0, endTick: 480 };
    const issue = { id: "gap", code: "gap" as const, severity: "error" as const, target: { measureIndex: 0, staff: "treble" as const, positionTicks: 0, endTicks: 480 }, message: "Treble has a gap.", corrections: [correction] };
    const { rerender } = render(<StaffBuilderValidationPanel activeIndex={-1} activeIssue={null} issues={[issue]} onActivate={activate} onClose={vi.fn()} onCorrection={vi.fn()} onFillAllGaps={vi.fn()} onNext={vi.fn()} onPrevious={vi.fn()} status={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(activate).toHaveBeenCalledOnce();
    const apply = vi.fn();
    rerender(<StaffBuilderValidationPanel activeIndex={0} activeIssue={issue} issues={[issue]} onActivate={activate} onClose={vi.fn()} onCorrection={apply} onFillAllGaps={vi.fn()} onNext={vi.fn()} onPrevious={vi.fn()} status={null} />);
    expect(document.activeElement).toBe(screen.getByText("Treble has a gap."));
    fireEvent.click(screen.getByRole("button", { name: "Add Rest" }));
    expect(apply).toHaveBeenCalledWith(correction);
    expect(screen.getByText("Issue 1 of 1")).toBeTruthy();
  });

  it("offers an exact fitting duration in beginner-facing language", () => {
    const correction = { kind: "set-duration" as const, eventId: "late", duration: "dotted-eighth" as const };
    const issue = { id: "overflow", code: "event-overflow" as const, severity: "error" as const, target: { measureIndex: 0, staff: "treble" as const, positionTicks: 1560, eventId: "late" }, message: "This quarter note extends past the end of measure 1.", corrections: [correction] };
    const apply = vi.fn();
    render(<StaffBuilderValidationPanel activeIndex={0} activeIssue={issue} issues={[issue]} onActivate={vi.fn()} onClose={vi.fn()} onCorrection={apply} onFillAllGaps={vi.fn()} onNext={vi.fn()} onPrevious={vi.fn()} status={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Change to dotted eighth" }));
    expect(apply).toHaveBeenCalledWith(correction);
    expect(screen.getByText("This quarter note extends past the end of measure 1.")).toBeTruthy();
    expect(screen.getByText("Change it to a dotted eighth note so it ends at the barline.")).toBeTruthy();
  });

  it("offers Fill All only when multiple safe gaps are available", () => {
    const fillAll = vi.fn();
    const correction = { kind: "fill-gap-with-rests" as const, staff: "treble" as const, startTick: 0, endTick: 480 };
    const issue = { id: "gap-1", code: "gap" as const, severity: "error" as const, target: { measureIndex: 0, staff: "treble" as const, positionTicks: 0, endTicks: 480 }, message: "This treble staff has empty beats in measure 1.", corrections: [correction] };
    const second = { ...issue, id: "gap-2", target: { ...issue.target, staff: "bass" as const }, corrections: [{ ...correction, staff: "bass" as const }] };
    const { rerender } = render(<StaffBuilderValidationPanel activeIndex={0} activeIssue={issue} issues={[issue]} onActivate={vi.fn()} onClose={vi.fn()} onCorrection={vi.fn()} onFillAllGaps={fillAll} onNext={vi.fn()} onPrevious={vi.fn()} status={null} />);
    expect(screen.queryByRole("button", { name: "Fill All Empty Beats With Rests" })).toBeNull();
    rerender(<StaffBuilderValidationPanel activeIndex={0} activeIssue={issue} issues={[issue, second]} onActivate={vi.fn()} onClose={vi.fn()} onCorrection={vi.fn()} onFillAllGaps={fillAll} onNext={vi.fn()} onPrevious={vi.fn()} status={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Fill All Empty Beats With Rests" }));
    expect(fillAll).toHaveBeenCalledOnce();
    expect(screen.queryByText(/tick/)).toBeNull();
  });
});
