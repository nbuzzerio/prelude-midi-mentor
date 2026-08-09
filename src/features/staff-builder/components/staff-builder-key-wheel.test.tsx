import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffBuilderKeyWheel } from "./staff-builder-key-wheel";
import { STAFF_BUILDER_KEY_WHEEL_ORDER } from "./staff-builder-key-wheel-options";

afterEach(cleanup);
const anchor = { x: 100, y: 100, width: 20, height: 50 };
const bounds = { left: 0, top: 0, width: 800, height: 700 };

describe("StaffBuilderKeyWheel", () => {
  it("renders the stable relative-pair order with full identities and current selection", () => {
    render(<StaffBuilderKeyWheel anchor={anchor} bounds={bounds} currentKey="b-flat-major" onChoose={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByRole("radio").map((option) => option.getAttribute("data-key-id"))).toEqual(STAFF_BUILDER_KEY_WHEEL_ORDER);
    expect(screen.getAllByRole("radio")).toHaveLength(12);
    expect(screen.getByRole("radio", { name: "B♭ major" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "A minor" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "B♭ major" }));
  });

  it("guards the opening pointer gesture, then accepts a fresh pointer or keyboard action", () => {
    const choose = vi.fn(); const close = vi.fn();
    render(<StaffBuilderKeyWheel anchor={anchor} bounds={bounds} currentKey="c-major" openedByPointer onChoose={choose} onClose={close} />);
    const g = screen.getByRole("radio", { name: "G major" });
    fireEvent.click(g, { detail: 1 }); fireEvent.click(screen.getByRole("button", { name: "Close key signature choices" }), { detail: 1 });
    expect(choose).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
    fireEvent.pointerDown(g, { pointerId: 3 }); fireEvent.click(g, { detail: 1 });
    expect(choose).toHaveBeenCalledWith("g-major");
    fireEvent.click(screen.getByRole("radio", { name: "A minor" }), { detail: 0 });
    expect(choose).toHaveBeenCalledWith("a-minor");
  });
});
