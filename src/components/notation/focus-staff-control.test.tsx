import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import FocusStaffControl from "./focus-staff-control";

describe("FocusStaffControl", () => {
  it("exposes its label, state, shortcuts, and toggle action", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <FocusStaffControl isFocusMode={false} onToggle={onToggle} />,
    );

    const focusButton = screen.getByRole("button", { name: "Focus Staff" });

    expect(focusButton.getAttribute("aria-pressed")).toBe("false");
    expect(focusButton.getAttribute("aria-keyshortcuts")).toBe("F Escape");

    fireEvent.click(focusButton);

    expect(onToggle).toHaveBeenCalledOnce();

    rerender(<FocusStaffControl isFocusMode onToggle={onToggle} />);

    expect(
      screen.getByRole("button", { name: "Exit Focus Staff" }),
    ).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Exit Focus Staff" }),
    );
  });
});
