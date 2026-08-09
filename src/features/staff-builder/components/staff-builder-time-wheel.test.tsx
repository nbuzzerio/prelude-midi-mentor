import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffBuilderTimeWheel } from "./staff-builder-time-wheel";

afterEach(cleanup);
const anchor = { x: 100, y: 100, width: 20, height: 50 };
const bounds = { left: 0, top: 0, width: 600, height: 600 };

describe("StaffBuilderTimeWheel", () => {
  it("renders exactly the four supported meters and marks the effective meter", () => {
    render(<StaffBuilderTimeWheel anchor={anchor} bounds={bounds} currentTime="6/8" onChoose={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByRole("radio").map((option) => option.getAttribute("data-time"))).toEqual(["2/4", "3/4", "4/4", "6/8"]);
    expect(screen.getByRole("radio", { name: "Time signature 6/8" }).getAttribute("aria-checked")).toBe("true");
  });

  it("guards pointer opening, accepts a new gesture, and closes on Escape before arming", () => {
    const choose = vi.fn(); const close = vi.fn();
    render(<StaffBuilderTimeWheel anchor={anchor} bounds={bounds} currentTime="4/4" openedByPointer onChoose={choose} onClose={close} />);
    const meter = screen.getByRole("radio", { name: "Time signature 3/4" });
    fireEvent.click(meter, { detail: 1 }); expect(choose).not.toHaveBeenCalled();
    fireEvent.pointerDown(meter, { pointerId: 4 }); fireEvent.click(meter, { detail: 1 }); expect(choose).toHaveBeenCalledWith("3/4");
    fireEvent.keyDown(meter, { key: "Escape" }); expect(close).toHaveBeenCalledOnce();
  });
});
