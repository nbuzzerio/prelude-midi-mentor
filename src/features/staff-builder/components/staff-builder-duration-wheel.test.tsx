import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffBuilderEventAnchor } from "../notation/render-staff-builder-measure";
import { StaffBuilderDurationWheel } from "./staff-builder-duration-wheel";
import { getStaffBuilderDurationRingPosition, STAFF_BUILDER_DURATION_WHEEL_SIZE } from "./staff-builder-duration-wheel-geometry";

const anchor: StaffBuilderEventAnchor = { eventId: "event", staff: "treble", startTick: 0, onsetX: 100, x: 95, y: 60, width: 20, height: 40 };
const bounds = { left: 8, top: 8, width: 744, height: 584 };
afterEach(cleanup);

describe("StaffBuilderDurationWheel", () => {
  it("offers all durations as note glyph radios and marks the current duration", () => {
    const choose = vi.fn();
    render(<StaffBuilderDurationWheel anchor={anchor} bounds={bounds} currentDuration="quarter" eventKind="notes" onChoose={choose} onClose={vi.fn()} />);
    expect(screen.getAllByRole("radio")).toHaveLength(8);
    expect(screen.getByRole("radio", { name: "Quarter-note duration" }).getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Quarter-note duration" }));
    expect(screen.getByRole("radiogroup").contains(screen.getByRole("button", { name: "Close duration choices" }))).toBe(false);
    expect(document.querySelectorAll('[data-glyph-family="note"]')).toHaveLength(8);
    expect(document.querySelectorAll('[data-glyph-family="rest"]')).toHaveLength(1);
    fireEvent.click(screen.getByRole("radio", { name: "Half-note duration" }));
    expect(choose).toHaveBeenCalledWith("half");
  });

  it("defaults unresolved events to quarter and moves focus without mutating", () => {
    const choose = vi.fn();
    render(<StaffBuilderDurationWheel anchor={anchor} bounds={bounds} eventKind="notes" onChoose={choose} onClose={vi.fn()} />);
    const quarter = screen.getByRole("radio", { name: "Quarter-note duration" });
    expect(document.activeElement).toBe(quarter);
    fireEvent.keyDown(quarter, { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Dotted eighth-note duration" }));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(quarter);
    fireEvent.keyDown(quarter, { key: "Home" });
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Whole-note duration" }));
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Sixteenth-note duration" }));
    expect(choose).not.toHaveBeenCalled();
  });

  it("applies the focused duration with Enter or Space", () => {
    const choose = vi.fn();
    render(<StaffBuilderDurationWheel anchor={anchor} bounds={bounds} currentDuration="quarter" eventKind="notes" onChoose={choose} onClose={vi.fn()} />);
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(choose).toHaveBeenLastCalledWith("dotted-quarter");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    fireEvent.keyDown(document.activeElement!, { key: " " });
    expect(choose).toHaveBeenLastCalledWith("half");
  });

  it("switches to rest glyphs and closes on Escape", () => {
    const close = vi.fn();
    render(<StaffBuilderDurationWheel anchor={anchor} bounds={bounds} eventKind="rest" onChoose={vi.fn()} onClose={close} />);
    expect(document.querySelectorAll('[data-glyph-family="rest"]')).toHaveLength(8);
    expect(document.querySelectorAll('[data-glyph-family="note"]')).toHaveLength(1);
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
  });

  it("flips and clamps at score boundaries", () => {
    const { rerender } = render(<StaffBuilderDurationWheel anchor={anchor} bounds={bounds} eventKind="notes" onChoose={vi.fn()} onClose={vi.fn()} />);
    expect(document.querySelector(".staff-builder-duration-wheel")?.getAttribute("style")).toContain("left: 8px; top: 8px");
    rerender(<StaffBuilderDurationWheel anchor={{ ...anchor, x: 735, y: 590 }} bounds={bounds} eventKind="notes" onChoose={vi.fn()} onClose={vi.fn()} />);
    expect(document.querySelector(".staff-builder-duration-wheel")?.getAttribute("style")).toContain("left: 484px; top: 324px");
    rerender(<StaffBuilderDurationWheel anchor={{ ...anchor, x: 300, y: 300 }} bounds={bounds} eventKind="notes" onChoose={vi.fn()} onClose={vi.fn()} />);
    expect(document.querySelector(".staff-builder-duration-wheel")?.getAttribute("style")).toContain("left: 176px; top: 186px");
  });

  it("stays full CSS size inside mobile viewport bounds without any scale transform", () => {
    render(<StaffBuilderDurationWheel anchor={{ x: 450, y: 170, width: 12, height: 25 }} bounds={{ left: 0, top: 0, width: 480, height: 640 }} eventKind="notes" onChoose={vi.fn()} onClose={vi.fn()} />);
    const wheel = document.querySelector(".staff-builder-duration-wheel") as HTMLElement;
    expect(wheel.style.transform).toBe("");
    expect(Number.parseFloat(wheel.style.left)).toBeGreaterThanOrEqual(0);
    expect(Number.parseFloat(wheel.style.left) + STAFF_BUILDER_DURATION_WHEEL_SIZE).toBeLessThanOrEqual(480);
    expect(Number.parseFloat(wheel.style.top)).toBeGreaterThanOrEqual(0);
    expect(Number.parseFloat(wheel.style.top) + STAFF_BUILDER_DURATION_WHEEL_SIZE).toBeLessThanOrEqual(640);
  });

  it("uses stable clockwise radial geometry and exposes matching-duration center conversion", () => {
    const toggle = vi.fn();
    const { rerender } = render(<StaffBuilderDurationWheel anchor={anchor} bounds={bounds} currentDuration="dotted-quarter" eventKind="notes" onChoose={vi.fn()} onClose={vi.fn()} onToggleEventType={toggle} />);
    const radios = screen.getAllByRole("radio");
    expect(radios.map(({ dataset }) => dataset.duration)).toEqual(["whole", "dotted-half", "half", "dotted-quarter", "quarter", "dotted-eighth", "eighth", "sixteenth"]);
    radios.forEach((radio, index) => {
      const expected = getStaffBuilderDurationRingPosition(index);
      expect((radio as HTMLElement).style.left).toBe(`${expected.left}px`);
      expect((radio as HTMLElement).style.top).toBe(`${expected.top}px`);
      expect((radio as HTMLElement).style.width).toBe("48px");
      expect((radio as HTMLElement).style.height).toBe("48px");
    });
    const center = screen.getByRole("button", { name: "Convert note or chord to rest" });
    expect(center.querySelector('[data-glyph-family="rest"][data-glyph-kind="dotted-quarter"]')).toBeTruthy();
    fireEvent.click(center);
    expect(toggle).toHaveBeenCalledOnce();
    rerender(<StaffBuilderDurationWheel anchor={anchor} bounds={bounds} currentDuration="half" eventKind="rest" onChoose={vi.fn()} onClose={vi.fn()} onToggleEventType={toggle} />);
    expect(screen.getByRole("button", { name: "Replace rest with notes" }).querySelector('[data-glyph-family="note"][data-glyph-kind="half"]')).toBeTruthy();
  });
});
