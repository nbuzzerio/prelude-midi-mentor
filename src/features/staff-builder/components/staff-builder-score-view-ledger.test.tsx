import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffBuilderMeasureRenderResult } from "../notation/render-staff-builder-measure";
import type { StaffBuilderScore } from "../staff-builder-types";
import { getStaffBuilderInternalTouchSize } from "./staff-builder-interaction-geometry";
import { StaffBuilderScoreView, type StaffBuilderEventHighlight } from "./staff-builder-score-view";

const css = readFileSync("src/index.css", "utf8").replace('@import "tailwindcss";', "");

function score(): StaffBuilderScore {
  return {
    schemaVersion: 4, annotations: [], id: "ledger-score", title: "Ledger readability",
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", ties: [],
    measures: [{ id: "m", events: [
      { id: "c6", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "sixteenth" }, pitches: [{ id: "c", midiNumber: 84, letter: "C", octave: 6, accidental: "natural" }] },
      { id: "a6-chord", kind: "notes", staff: "treble", startTick: 120, rhythm: { status: "final", duration: "sixteenth" }, pitches: [
        { id: "g", midiNumber: 91, letter: "G", octave: 6, accidental: "natural" },
        { id: "a", midiNumber: 93, letter: "A", octave: 6, accidental: "natural" },
      ] },
      { id: "low", kind: "notes", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "quarter" }, pitches: [
        { id: "lc", midiNumber: 36, letter: "C", octave: 2, accidental: "natural" },
        { id: "ld", midiNumber: 38, letter: "D", octave: 2, accidental: "natural" },
      ] },
    ] }],
  };
}

let style: HTMLStyleElement;
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    measureText: (text: string) => ({ width: text.length * 8, actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2, actualBoundingBoxLeft: 0, actualBoundingBoxRight: text.length * 8,
      fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }),
  } as CanvasRenderingContext2D);
  style = document.createElement("style");
  style.textContent = "*, ::before, ::after { box-sizing: border-box; }" + css;
  document.head.append(style);
});
afterEach(() => { cleanup(); style.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function rectangle(element: HTMLElement) {
  return { x: parseFloat(element.style.left), y: parseFloat(element.style.top),
    width: parseFloat(element.style.width), height: parseFloat(element.style.height) };
}

describe("ledger-aware score highlights with the real renderer", () => {
  it.each(["current", "correct", "incorrect", "complete", "missed", "wrong-pitch"] as const)("keeps %s indicators clear of upper and lower ledger strokes", (status) => {
    const rendered = vi.fn<(result: StaffBuilderMeasureRenderResult) => void>();
    const current = score();
    const highlights: StaffBuilderEventHighlight[] = current.measures[0]!.events.map(({ id }) => ({ eventId: id, status }));
    const { container, rerender } = render(<StaffBuilderScoreView eventHighlights={highlights} measureIndex={0} onRender={rendered} score={current} />);
    const result = rendered.mock.calls.at(-1)![0];
    const canvas = container.querySelector(".staff-builder-notation-canvas")!;
    const foreground = screen.getByTestId("staff-builder-notation-foreground");
    const notation = foreground.innerHTML.replace(/id="vf-auto\d+"/g, "");
    for (const marker of screen.getAllByTestId("staff-builder-event-highlight")) {
      const bounds = result.anchors.events.get(marker.dataset.eventId!)!.highlightBounds!;
      const rect = rectangle(marker);
      expect(rect).toEqual({ x: bounds.x - 6, y: bounds.y - 6, width: bounds.width + 12, height: bounds.height + 12 });
      expect(marker.parentElement).toBe(canvas);
      expect(Number(getComputedStyle(marker).zIndex)).toBeLessThan(Number(getComputedStyle(foreground).zIndex));
      const border = parseFloat(getComputedStyle(marker).borderTopWidth);
      // The border and 2px outer white halo cannot reach the enclosed ledger strokes.
      expect(bounds.y - (rect.y + border)).toBeGreaterThan(2);
      expect(rect.y + rect.height - border - (bounds.y + bounds.height)).toBeGreaterThan(2);
    }
    rerender(<StaffBuilderScoreView measureIndex={0} onRender={rendered} score={current} />);
    expect(screen.queryByTestId("staff-builder-event-highlight")).toBeNull();
    expect(foreground.innerHTML.replace(/id="vf-auto\d+"/g, "")).toBe(notation);
  });

  it.each([480, 570, 760])("scales marker clearance and preserves editor selection/editing at %dpx", (availableWidth) => {
    let resize: (() => void) | undefined;
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { resize = callback; }
      observe() {}
      disconnect() {}
    });
    const select = vi.fn(() => true);
    const assign = vi.fn(() => true);
    const rendered = vi.fn<(result: StaffBuilderMeasureRenderResult) => void>();
    const current = score();
    const highlights: StaffBuilderEventHighlight[] = [{ eventId: "c6", status: "current" }, { eventId: "a6-chord", status: "current" }];
    const { container, rerender } = render(<StaffBuilderScoreView eventHighlights={highlights} measureIndex={0} onAssignDuration={assign} onEventSelect={select} onRender={rendered} score={current} selectedEventId="c6" />);
    const scroll = container.querySelector(".staff-builder-notation-scroll")!;
    Object.defineProperty(scroll, "clientWidth", { configurable: true, value: availableWidth });
    act(() => resize!());
    const result = rendered.mock.calls.at(-1)![0];
    const canvas = container.querySelector<HTMLDivElement>(".staff-builder-notation-canvas")!;
    const scale = availableWidth / result.width;
    expect(canvas.style.transform).toBe(`scale(${scale})`);
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, x: 0, y: 0, width: result.width * scale, height: result.height * scale,
      right: result.width * scale, bottom: result.height * scale, toJSON: () => ({}) });
    const targets = [...container.querySelectorAll<HTMLButtonElement>(".staff-builder-event-target")];
    const before = targets.map((target) => rectangle(target));
    for (const target of targets) {
      const anchor = result.anchors.events.get(target.dataset.eventId!)!;
      const width = getStaffBuilderInternalTouchSize(anchor.width, scale);
      const height = getStaffBuilderInternalTouchSize(anchor.height, scale);
      expect(rectangle(target)).toEqual({ x: anchor.x + anchor.width / 2 - width / 2,
        y: anchor.y + anchor.height / 2 - height / 2, width, height });
      // Adjacent high notes and a chord must retain their original pointer ownership.
      fireEvent.pointerDown(target, { pointerId: 1, clientX: (anchor.x + anchor.width / 2) * scale, clientY: (anchor.y + anchor.height / 2) * scale });
      fireEvent.pointerUp(target, { pointerId: 1, clientX: (anchor.x + anchor.width / 2) * scale, clientY: (anchor.y + anchor.height / 2) * scale });
      expect(select).toHaveBeenLastCalledWith({ measureIndex: 0, eventId: target.dataset.eventId });
      const dialog = screen.queryByRole("dialog", { name: "Duration choices" });
      if (dialog) fireEvent.keyDown(dialog, { key: "Escape" });
    }
    const anchor = result.anchors.events.get("c6")!;
    expect(rectangle(screen.getByTestId("staff-builder-selection-outline"))).toEqual({
      x: anchor.x - 5, y: anchor.y - 5, width: anchor.width + 10, height: anchor.height + 10,
    });
    const marker = screen.getAllByTestId("staff-builder-event-highlight")[0]!;
    const rect = rectangle(marker);
    const bounds = anchor.highlightBounds!;
    expect((bounds.y - rect.y - 3) * scale).toBeCloseTo(3 * scale);
    expect((rect.y + rect.height - 3 - bounds.y - bounds.height) * scale).toBeCloseTo(3 * scale);
    rerender(<StaffBuilderScoreView measureIndex={0} onAssignDuration={assign} onEventSelect={select} onRender={rendered} score={current} selectedEventId="a6-chord" />);
    expect(targets.map((target) => rectangle(target))).toEqual(before);
    fireEvent.click(targets[1]!);
    fireEvent.click(screen.getByRole("radio", { name: "Eighth-note duration" }));
    expect(assign).toHaveBeenCalledWith("eighth");
  });
});
