import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffBuilderSystemRenderResult } from "../notation/render-staff-builder-system";
import type { StaffBuilderScoreDocumentLayout } from "../notation/staff-builder-system-layout";
import type { StaffBuilderScore } from "../staff-builder-types";
import { ALL_STAFF_BUILDER_ANNOTATION_LAYERS } from "../staff-builder-annotation-layers";
import { StaffBuilderStudyView } from "./staff-builder-study-view";

const renders: Array<{ layout: StaffBuilderScoreDocumentLayout; complete: (results: readonly StaffBuilderSystemRenderResult[]) => void }> = [];
vi.mock("./staff-builder-multi-system-score", () => ({ StaffBuilderMultiSystemScore: ({ layout, onRenderResultsChange }: { layout: StaffBuilderScoreDocumentLayout; onRenderResultsChange: (results: readonly StaffBuilderSystemRenderResult[]) => void }) => {
  renders.push({ layout, complete: onRenderResultsChange });
  return <div data-staff-builder-score-semantics />;
} }));

const score: StaffBuilderScore = { schemaVersion: 3, id: "s", title: "Geometry", createdAt: "x", updatedAt: "x", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", ties: [], measures: Array.from({ length: 4 }, (_value, index) => ({ id: `m${index}`, events: [] })), annotations: [{ id: "note", kind: "study-note", anchor: { kind: "measure", measureId: "m0" }, text: "Always readable" }] };
let resize: ((width: number) => void) | null = null;
let observed: Element | null = null;

function resultFor(layout: StaffBuilderScoreDocumentLayout): StaffBuilderSystemRenderResult[] {
  return layout.systems.map((system) => ({ coordinateSpace: { width: system.width, height: system.height }, system: { systemIndex: system.systemIndex, bounds: { x: 0, y: 0, width: system.width, height: system.height } }, measures: system.measures.map((measure) => ({ measureId: measure.measureId, measureIndex: measure.measureIndex, bounds: { x: measure.x, y: measure.y, width: measure.width, height: measure.height }, events: new Map(), positions: new Map(), timeline: { rhythmicStartX: measure.x, rhythmicEndX: measure.x + measure.width, y: measure.y, height: measure.height, capacityTicks: 1920 } })), events: new Map() }));
}

beforeEach(() => {
  renders.length = 0;
  vi.stubGlobal("ResizeObserver", class {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) { this.callback = callback; resize = (width) => this.callback([{ target: observed!, contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
    observe(target: Element) { observed = target; }
    disconnect() {}
  });
});
afterEach(() => { cleanup(); resize = null; observed = null; vi.unstubAllGlobals(); });

describe("StaffBuilderStudyView geometry generations", () => {
  it("withholds old markers after repacking while retaining the list, then accepts new geometry", () => {
    function Harness() {
      const [layers, setLayers] = useState(() => new Set(ALL_STAFF_BUILDER_ANNOTATION_LAYERS));
      return <StaffBuilderStudyView onExit={vi.fn()} onHideAllAnnotationLayers={() => setLayers(new Set())} onLayerVisibilityChange={(layer, visible) => setLayers((current) => { const next = new Set(current); if (visible) next.add(layer); else next.delete(layer); return next; })} onShowAllAnnotationLayers={() => setLayers(new Set(ALL_STAFF_BUILDER_ANNOTATION_LAYERS))} score={score} visibleAnnotationLayers={layers} />;
    }
    render(<Harness />);
    act(() => resize?.(1100));
    const wide = renders.at(-1)!;
    act(() => wide.complete(resultFor(wide.layout)));
    const wideMarker = screen.getByRole("button", { name: /Study Note, Measure 1, measure/ });
    fireEvent.click(wideMarker);
    expect(wideMarker.getAttribute("aria-pressed")).toBe("true");

    act(() => resize?.(360));
    const narrow = renders.at(-1)!;
    expect(narrow.layout).not.toBe(wide.layout);
    expect(screen.queryByRole("button", { name: /Study Note, Measure 1, measure/ })).toBeNull();
    expect(screen.getByText("Always readable")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Study Notes"));
    fireEvent.click(screen.getByRole("button", { name: "Show All" }));

    act(() => narrow.complete(resultFor(narrow.layout)));
    const marker = screen.getByRole("button", { name: /Study Note, Measure 1, measure/ });
    expect(marker).toBeTruthy();
    expect(marker.getAttribute("aria-pressed")).toBe("false");
    expect((marker as HTMLElement).style.left).not.toBe("");
  });
});
