import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testScore } from "./continuous-test-fixtures";
import { ContinuousScore } from "./continuous-score";

const { draw } = vi.hoisted(() => ({ draw: vi.fn(() => ({ width: 760, height: 300,
  projection: { keySignatureName: "C major", timeSignature: "4/4", summary: { treble: "C4 quarter note", bass: "whole rest" } },
  anchors: { timeline: { rhythmicStartX: 100, rhythmicEndX: 740, y: 40, height: 210, capacityTicks: 1920 }, authoritativeEvents: new Map() },
})) }));
vi.mock("@/features/staff-builder/notation/render-staff-builder-measure", () => ({ renderStaffBuilderMeasure: draw }));
afterEach(() => { cleanup(); draw.mockClear(); });
describe("continuous grand-staff presentation", () => {
  it("uses the canonical frozen music and preserves full staff spacing at a fixed readable scale", () => {
    const source = testScore(); render(<ContinuousScore score={source} measureIndex={0} offsetTicks={0} />);
    expect(draw.mock.calls[0]).toEqual([expect.any(HTMLDivElement), source, 0]);
    expect(screen.getByRole("figure").textContent).toContain("Upper staff: C4 quarter note");
    const canvas = screen.getByTestId("continuous-playhead").parentElement!;
    expect(canvas.style.transform).toBe("scale(1.6)");
    expect(canvas.style.height).toBe("300px");
  });
  it("moves the playhead and horizontal following without regenerating notation or altering music", () => {
    const source = testScore(); const view = render(<ContinuousScore score={source} measureIndex={0} offsetTicks={0} />);
    const initial = screen.getByTestId("continuous-playhead").style.left;
    const scroll = screen.getByRole("region");
    Object.defineProperty(scroll, "clientWidth", { value: 320 });
    view.rerender(<ContinuousScore score={source} measureIndex={0} offsetTicks={1440} />);
    expect(screen.getByTestId("continuous-playhead").style.left).not.toBe(initial);
    expect(scroll.scrollLeft).toBeGreaterThan(0);
    expect(draw).toHaveBeenCalledTimes(1);
    view.rerender(<ContinuousScore score={source} measureIndex={1} offsetTicks={0} />);
    expect(draw).toHaveBeenCalledTimes(2);
  });
  it("provides independent accessible measure descriptions and focusable scroll regions", () => {
    render(<><ContinuousScore score={testScore()} measureIndex={0} /><ContinuousScore score={testScore()} measureIndex={1} /></>);
    const figures = screen.getAllByRole("figure");
    expect(figures[0]!.getAttribute("aria-labelledby")).not.toBe(figures[1]!.getAttribute("aria-labelledby"));
    expect(screen.getAllByRole("region").every((e) => e.tabIndex === 0)).toBe(true);
  });
});
