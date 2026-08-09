import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffBuilderEventAnchor } from "../notation/render-staff-builder-measure";
import { StaffBuilderDurationWheel } from "./staff-builder-duration-wheel";

const anchor: StaffBuilderEventAnchor = { eventId: "event", staff: "treble", startTick: 0, onsetX: 100, x: 95, y: 60, width: 20, height: 40 };
afterEach(cleanup);

describe("StaffBuilderDurationWheel", () => {
  it("offers all durations as note glyph radios and marks the current duration", () => {
    const choose = vi.fn();
    render(<StaffBuilderDurationWheel anchor={anchor} coordinateSpace={{ width: 760, height: 300 }} currentDuration="quarter" eventKind="notes" onChoose={choose} onClose={vi.fn()} />);
    expect(screen.getAllByRole("radio")).toHaveLength(8);
    expect(screen.getByRole("radio", { name: "Quarter-note duration" }).getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Quarter-note duration" }));
    expect(screen.getByRole("radiogroup").contains(screen.getByRole("button", { name: "Close duration choices" }))).toBe(false);
    expect(document.querySelectorAll('[data-glyph-family="note"]')).toHaveLength(8);
    fireEvent.click(screen.getByRole("radio", { name: "Half-note duration" }));
    expect(choose).toHaveBeenCalledWith("half");
  });

  it("defaults unresolved events to quarter and moves focus without mutating", () => {
    const choose = vi.fn();
    render(<StaffBuilderDurationWheel anchor={anchor} coordinateSpace={{ width: 760, height: 300 }} eventKind="notes" onChoose={choose} onClose={vi.fn()} />);
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
    render(<StaffBuilderDurationWheel anchor={anchor} coordinateSpace={{ width: 760, height: 300 }} currentDuration="quarter" eventKind="notes" onChoose={choose} onClose={vi.fn()} />);
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(choose).toHaveBeenLastCalledWith("dotted-quarter");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    fireEvent.keyDown(document.activeElement!, { key: " " });
    expect(choose).toHaveBeenLastCalledWith("half");
  });

  it("switches to rest glyphs and closes on Escape", () => {
    const close = vi.fn();
    render(<StaffBuilderDurationWheel anchor={anchor} coordinateSpace={{ width: 760, height: 300 }} eventKind="rest" onChoose={vi.fn()} onClose={close} />);
    expect(document.querySelectorAll('[data-glyph-family="rest"]')).toHaveLength(8);
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
  });

  it("flips and clamps at score boundaries", () => {
    const { rerender } = render(<StaffBuilderDurationWheel anchor={anchor} coordinateSpace={{ width: 760, height: 300 }} eventKind="notes" onChoose={vi.fn()} onClose={vi.fn()} />);
    expect(document.querySelector(".staff-builder-duration-wheel")?.getAttribute("style")).toContain("left: 125px; top: 42px");
    rerender(<StaffBuilderDurationWheel anchor={{ ...anchor, x: 735, y: 290 }} coordinateSpace={{ width: 760, height: 300 }} eventKind="notes" onChoose={vi.fn()} onClose={vi.fn()} />);
    expect(document.querySelector(".staff-builder-duration-wheel")?.getAttribute("style")).toContain("left: 489px; top: 184px");
    rerender(<StaffBuilderDurationWheel anchor={{ ...anchor, x: 0, y: 0 }} coordinateSpace={{ width: 200, height: 100 }} eventKind="notes" onChoose={vi.fn()} onClose={vi.fn()} />);
    expect(document.querySelector(".staff-builder-duration-wheel")?.getAttribute("style")).toContain("left: 0px; top: 0px");
  });

  it("counter-scales to normal CSS size and clamps its displayed footprint", () => {
    const scale = 480 / 760;
    const { rerender } = render(<StaffBuilderDurationWheel anchor={anchor} coordinateSpace={{ width: 760, height: 300 }} eventKind="notes" onChoose={vi.fn()} onClose={vi.fn()} presentationScale={scale} />);
    let wheel = document.querySelector(".staff-builder-duration-wheel") as HTMLElement;
    expect(wheel.style.transform).toBe(`scale(${1 / scale})`);
    expect(wheel.style.transformOrigin).toBe("top left");
    expect(Number.parseFloat(wheel.style.left) * scale).toBeGreaterThanOrEqual(0);
    expect(Number.parseFloat(wheel.style.left) * scale + 236).toBeLessThanOrEqual(480);

    rerender(<StaffBuilderDurationWheel anchor={{ ...anchor, x: 735, y: 290 }} coordinateSpace={{ width: 760, height: 300 }} eventKind="notes" onChoose={vi.fn()} onClose={vi.fn()} presentationScale={scale} />);
    wheel = document.querySelector(".staff-builder-duration-wheel") as HTMLElement;
    expect(Number.parseFloat(wheel.style.left) * scale).toBeGreaterThanOrEqual(0);
    expect(Number.parseFloat(wheel.style.left) * scale + 236).toBeLessThanOrEqual(480);
    expect(Number.parseFloat(wheel.style.top) * scale + 116).toBeLessThanOrEqual(300 * scale);
  });
});
