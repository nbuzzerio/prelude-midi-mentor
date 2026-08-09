import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffBuilderMeasureNavigation } from "./staff-builder-measure-navigation";

afterEach(cleanup);

describe("StaffBuilderMeasureNavigation", () => {
  it.each([
    [0, true, false],
    [1, false, false],
    [2, false, true],
  ] as const)("renders boundaries for measure index %i", (measureIndex, previousDisabled, nextDisabled) => {
    render(<StaffBuilderMeasureNavigation measureCount={3} measureIndex={measureIndex} onNavigate={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Previous Measure" }) as HTMLButtonElement).disabled).toBe(previousDisabled);
    expect((screen.getByRole("button", { name: "Next Measure" }) as HTMLButtonElement).disabled).toBe(nextDisabled);
    expect(screen.getByRole("button", { name: `Measure ${measureIndex + 1} of 3` })).toBeTruthy();
  });

  it("opens exactly the existing measures, identifies the current measure, selects, and closes", () => {
    const onNavigate = vi.fn();
    render(<StaffBuilderMeasureNavigation measureCount={3} measureIndex={1} onNavigate={onNavigate} />);
    const trigger = screen.getByRole("button", { name: "Measure 2 of 3" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const options = screen.getAllByRole("button", { name: /^Measure \d$/ });
    expect(options.map(({ textContent }) => textContent)).toEqual(["Measure 1", "Measure 2", "Measure 3"]);
    expect(screen.getByRole("button", { name: "Measure 2" }).getAttribute("aria-current")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Measure 3" }));
    expect(onNavigate).toHaveBeenCalledWith(2);
    expect(screen.queryByLabelText("Choose a measure")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on Escape and disables every ordinary control during validation", () => {
    const { rerender } = render(<StaffBuilderMeasureNavigation measureCount={3} measureIndex={1} onNavigate={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Measure 2 of 3" });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByLabelText("Choose a measure"), { key: "Escape" });
    expect(screen.queryByLabelText("Choose a measure")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    rerender(<StaffBuilderMeasureNavigation disabled measureCount={3} measureIndex={1} onNavigate={vi.fn()} />);
    expect(screen.getAllByRole("button").every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(trigger.title).toContain("Structural correction");
  });

  it("closes an open picker when disabled and opens normally after navigation is re-enabled", () => {
    const onNavigate = vi.fn();
    const { rerender } = render(<StaffBuilderMeasureNavigation measureCount={3} measureIndex={1} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Measure 2 of 3" }));
    expect(screen.getByRole("button", { name: "Measure 3" })).toBeTruthy();
    expect(screen.getByLabelText("Choose a measure")).toBeTruthy();

    rerender(<StaffBuilderMeasureNavigation disabled measureCount={3} measureIndex={1} onNavigate={onNavigate} />);
    expect(screen.queryByLabelText("Choose a measure")).toBeNull();
    expect(screen.queryByRole("button", { name: "Measure 3" })).toBeNull();
    expect(onNavigate).not.toHaveBeenCalled();

    rerender(<StaffBuilderMeasureNavigation measureCount={3} measureIndex={1} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Measure 2 of 3" }));
    expect(screen.getByRole("button", { name: "Measure 3" })).toBeTruthy();
  });

  it("explains when playback temporarily owns the displayed measure", () => {
    const reason = "Measure navigation is unavailable while playback follows the score.";
    render(<StaffBuilderMeasureNavigation disabled disabledReason={reason} measureCount={3} measureIndex={1} onNavigate={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Previous Measure" }).getAttribute("title")).toBe(reason);
    expect(screen.getByRole("button", { name: "Measure 2 of 3" }).getAttribute("title")).toBe(reason);
    expect(screen.getByRole("button", { name: "Next Measure" }).getAttribute("title")).toBe(reason);
  });
});
