import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { StaffBuilderMeasure, StaffBuilderScore } from "../staff-builder-types";
import type { StaffBuilderScoreDocumentLayout } from "../notation/staff-builder-system-layout";
import { StaffBuilderMultiSystemScore } from "./staff-builder-multi-system-score";

const measure = (id: string, index: number): StaffBuilderMeasure => ({
  id,
  events: [{
    id: `${id}-event`, kind: "notes", staff: index % 2 === 0 ? "treble" : "bass", startTick: 0,
    rhythm: { status: "final", duration: "quarter" },
    pitches: [{ id: `${id}-pitch`, midiNumber: 60 + index, letter: index % 2 === 0 ? "C" : "D", accidental: "natural", octave: 4 }],
  }],
});

function score(count = 4, title = "Read-only proof"): StaffBuilderScore {
  return {
    schemaVersion: 2, annotations: [], id: "score", title, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", ties: [],
    measures: Array.from({ length: count }, (_value, index) => measure(`m${index + 1}`, index)),
  };
}

function documentLayout(groups: readonly (readonly number[])[], width = 800): StaffBuilderScoreDocumentLayout {
  const systemHeight = 220;
  const gap = 30;
  return {
    width,
    height: groups.length * systemHeight + Math.max(0, groups.length - 1) * gap,
    systems: groups.map((indexes, systemIndex) => ({
      systemIndex, x: 12, y: systemIndex * (systemHeight + gap), width: width - 24, height: systemHeight,
      measures: indexes.map((measureIndex, index) => ({
        measureId: `m${measureIndex + 1}`, measureIndex,
        x: index * ((width - 24) / indexes.length), y: 0, width: (width - 24) / indexes.length, height: systemHeight,
      })),
    })),
  };
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    measureText: (text: string) => ({
      width: text.length * 8, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2,
      actualBoundingBoxLeft: 0, actualBoundingBoxRight: text.length * 8, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2,
    }),
  } as CanvasRenderingContext2D);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("StaffBuilderMultiSystemScore", () => {
  it("composes supplied systems and measures in document order with literal geometry", () => {
    const current = score();
    const layout = documentLayout([[0, 1], [2, 3]]);
    const { container } = render(<StaffBuilderMultiSystemScore score={current} layout={layout} />);
    const document = container.querySelector<HTMLElement>("[data-staff-builder-score-document]")!;
    const systems = [...container.querySelectorAll<HTMLElement>("[data-staff-builder-system]")];
    expect(systems).toHaveLength(2);
    expect(systems.map(({ dataset }) => dataset.staffBuilderSystem)).toEqual(["0", "1"]);
    expect(document.style.width).toBe("800px");
    expect(document.style.height).toBe("470px");
    expect(systems.map(({ style }) => [style.left, style.top, style.width, style.height])).toEqual([
      ["12px", "0px", "776px", "220px"], ["12px", "250px", "776px", "220px"],
    ]);
    expect(systems[0]?.querySelectorAll("svg")).toHaveLength(1);
    expect(systems[1]?.querySelectorAll("svg")).toHaveLength(1);
    expect(systems[0]?.querySelectorAll(".vf-stave")).toHaveLength(4);
  });

  it("exposes exactly one ordered semantic score using existing measure summaries", () => {
    const current = score();
    const { container } = render(<StaffBuilderMultiSystemScore score={current} layout={documentLayout([[0, 1], [2, 3]])} />);
    expect(container.querySelectorAll("[data-staff-builder-score-semantics]")).toHaveLength(1);
    const semantics = container.querySelector("[data-staff-builder-score-semantics]")!;
    expect(semantics.textContent).toContain("Read-only proof");
    expect(semantics.textContent).toContain("System 1");
    expect(semantics.textContent).toContain("System 2");
    expect([...semantics.querySelectorAll("li")].map(({ textContent }) => textContent)).toEqual([
      expect.stringContaining("Measure 1"), expect.stringContaining("Measure 2"),
      expect.stringContaining("Measure 3"), expect.stringContaining("Measure 4"),
    ]);
    expect(semantics.textContent).toContain("Treble:");
    expect(semantics.textContent).toContain("Bass:");
    expect(semantics.textContent).toContain("C4");
    expect(semantics.textContent).toContain("D4");
  });

  it("uses a narrower precomputed layout without calculating system breaks itself", () => {
    const current = score();
    const wide = documentLayout([[0, 1, 2, 3]], 900);
    const narrow = documentLayout([[0], [1], [2], [3]], 360);
    const { container, rerender } = render(<StaffBuilderMultiSystemScore score={current} layout={wide} />);
    expect(container.querySelectorAll("[data-staff-builder-system]")).toHaveLength(1);
    rerender(<StaffBuilderMultiSystemScore score={current} layout={narrow} />);
    expect(container.querySelectorAll("[data-staff-builder-system]")).toHaveLength(4);
  });

  it("keeps visual notation hidden and non-focusable with no duplicate semantic tree", () => {
    const { container } = render(<StaffBuilderMultiSystemScore score={score()} layout={documentLayout([[0, 1], [2, 3]])} />);
    const svgs = [...container.querySelectorAll("svg")];
    expect(svgs).toHaveLength(2);
    expect(svgs.every((svg) => svg.getAttribute("aria-hidden") === "true" && svg.getAttribute("focusable") === "false")).toBe(true);
    expect(container.querySelectorAll("[data-staff-builder-score-semantics]")).toHaveLength(1);
  });

  it("replaces stale systems and SVGs when score and layout change", () => {
    const initial = score(4, "Initial");
    const { container, rerender } = render(<StaffBuilderMultiSystemScore score={initial} layout={documentLayout([[0, 1], [2, 3]])} />);
    rerender(<StaffBuilderMultiSystemScore score={score(2, "Changed")} layout={documentLayout([[0, 1]], 500)} />);
    expect(container.querySelectorAll("[data-staff-builder-system]")).toHaveLength(1);
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Changed" })).toBeDefined();
    expect(container.textContent).not.toContain("Initial");
    expect(container.textContent).not.toContain("Measure 3");
  });

  it("does not expose editor, annotation, playback, or Study View controls", () => {
    render(<StaffBuilderMultiSystemScore score={score()} layout={documentLayout([[0, 1], [2, 3]])} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryByText(/playback|add annotation|study view|fullscreen/i)).toBeNull();
  });
});
