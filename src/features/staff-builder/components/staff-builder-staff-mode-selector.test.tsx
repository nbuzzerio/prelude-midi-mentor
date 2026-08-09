import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffBuilderStaffModeSelector } from "./staff-builder-staff-mode-selector";

afterEach(cleanup);

describe("StaffBuilderStaffModeSelector", () => {
  it("orders Treble, Grand, Bass and dispatches the existing input mode", () => {
    const onChange = vi.fn();
    const { rerender } = render(<StaffBuilderStaffModeSelector inputMode="grand" onChange={onChange} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(["Treble Only input", "Grand Staff input", "Bass Only input"]);
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(buttons[0]!);
    expect(onChange).toHaveBeenCalledWith("treble");
    rerender(<StaffBuilderStaffModeSelector inputMode="treble" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Treble Only input" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("is visibly present but natively disabled outside Capture Notes", () => {
    render(<StaffBuilderStaffModeSelector disabled inputMode="grand" onChange={vi.fn()} />);
    expect(screen.getAllByRole("button").every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });
});
