import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffBuilderScore } from "../staff-builder-types";
import { STAFF_BUILDER_PRINT_MEASURE_LABEL_LANE_HEIGHT, StaffBuilderPrintScore } from "./staff-builder-print-score";
import { STAFF_BUILDER_PRINT_CANVAS_WIDTH_PX, STAFF_BUILDER_PRINT_CONTENT_WIDTH_PX, STAFF_BUILDER_PRINT_HORIZONTAL_SAFETY_INSET_PX } from "../staff-builder-print-layout";

function score(measureCount: number): StaffBuilderScore {
  return {
    schemaVersion: 3, annotations: [], id: "print", title: "Complete print", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", ties: [],
    measures: Array.from({ length: measureCount }, (_value, index) => ({ id: `m${index + 1}`, events: [] })),
  };
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ measureText: (text: string) => ({ width: text.length * 8 }) } as CanvasRenderingContext2D);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("StaffBuilderPrintScore", () => {
  it("renders every selected measure across every normal-flow print system", () => {
    const current = score(50);
    const { container } = render(<StaffBuilderPrintScore measureIndexes={current.measures.map((_measure, index) => index)} measuresPerLine={4} score={current} />);
    const systems = [...container.querySelectorAll(".staff-builder-print-system")];
    const labels = [...container.querySelectorAll<HTMLElement>("[data-measure-number-lane=bottom]")];
    expect(systems).toHaveLength(13);
    expect([...container.querySelectorAll(".staff-builder-print-page")].map((page) => page.querySelectorAll(".staff-builder-print-system").length)).toEqual([4, 4, 3, 2]);
    expect(labels).toHaveLength(50);
    expect(labels.at(-1)?.textContent).toBe("Measure 50");
    expect(container.querySelector(".staff-builder-print-document")?.parentElement).toBe(container);
  });

  it("honors five measures per line and forces disconnected ranges onto separate systems", () => {
    const current = score(20);
    const contiguous = render(<StaffBuilderPrintScore measureIndexes={Array.from({ length: 10 }, (_value, index) => index)} measuresPerLine={5} score={current} />);
    expect(contiguous.container.querySelectorAll(".staff-builder-print-system")).toHaveLength(2);
    contiguous.unmount();
    const disconnected = render(<StaffBuilderPrintScore measureIndexes={[4, 5, 6, 7, 8, 9, 14, 15]} measuresPerLine={5} score={current} />);
    expect(disconnected.container.querySelectorAll(".staff-builder-print-system")).toHaveLength(3);
    expect(disconnected.container.querySelectorAll('[data-disconnected="true"]')).toHaveLength(1);
    expect([...disconnected.container.querySelectorAll<HTMLElement>("[data-measure-number-lane=bottom]")].map(({ textContent }) => textContent)).toEqual(["Measure 5", "Measure 6", "Measure 7", "Measure 8", "Measure 9", "Measure 10", "Measure 15", "Measure 16"]);
  });

  it("fits notation inside symmetric print safety insets while keeping the outer canvas width", () => {
    const current = score(5);
    const { container } = render(<StaffBuilderPrintScore measureIndexes={[0, 1, 2, 3, 4]} measuresPerLine={5} score={current} />);
    const document = container.querySelector<HTMLElement>("[data-staff-builder-score-document]")!;
    const system = container.querySelector<HTMLElement>("[data-staff-builder-system]")!;
    const svg = system.querySelector("svg")!;
    expect(document.style.width).toBe(`${STAFF_BUILDER_PRINT_CANVAS_WIDTH_PX}px`);
    expect(system.style.left).toBe(`${STAFF_BUILDER_PRINT_HORIZONTAL_SAFETY_INSET_PX}px`);
    expect(system.style.width).toBe(`${STAFF_BUILDER_PRINT_CONTENT_WIDTH_PX}px`);
    expect(svg.getAttribute("width")).toBe(String(STAFF_BUILDER_PRINT_CONTENT_WIDTH_PX));
    expect(STAFF_BUILDER_PRINT_HORIZONTAL_SAFETY_INSET_PX + Number.parseFloat(system.style.width)).toBe(STAFF_BUILDER_PRINT_CANVAS_WIDTH_PX - STAFF_BUILDER_PRINT_HORIZONTAL_SAFETY_INSET_PX);
    expect(Number.parseFloat(container.querySelector<HTMLElement>("[data-measure-number-lane=bottom]")!.style.left)).toBeGreaterThanOrEqual(STAFF_BUILDER_PRINT_HORIZONTAL_SAFETY_INSET_PX);
  });

  it("reserves the measure label lane below dynamic low-note geometry without using lyric space", () => {
    const ordinary = render(<StaffBuilderPrintScore measureIndexes={[0]} measuresPerLine={4} score={score(1)} />);
    const ordinaryLabelTop = Number.parseFloat(ordinary.container.querySelector<HTMLElement>("[data-measure-number-lane=bottom]")!.style.top);
    ordinary.unmount();
    const base = score(1);
    const lowScore: StaffBuilderScore = { ...base, measures: [{ ...base.measures[0]!, events: [{ id: "low", kind: "notes", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "whole" }, pitches: [{ id: "low-pitch", midiNumber: 26, letter: "D", accidental: "natural", octave: 1 }] }] }] };
    const { container } = render(<StaffBuilderPrintScore measureIndexes={[0]} measuresPerLine={4} score={lowScore} />);
    const document = container.querySelector<HTMLElement>("[data-staff-builder-score-document]")!;
    const label = container.querySelector<HTMLElement>("[data-measure-number-lane=bottom]")!;
    expect(Number.parseFloat(label.style.top)).toBeGreaterThan(ordinaryLabelTop);
    expect(Number.parseFloat(document.style.height) - Number.parseFloat(label.style.top)).toBe(STAFF_BUILDER_PRINT_MEASURE_LABEL_LANE_HEIGHT);
  });
});
