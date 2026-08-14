import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffBuilderScore } from "../staff-builder-types";
import { StaffBuilderStudyView } from "./staff-builder-study-view";
import { ALL_STAFF_BUILDER_ANNOTATION_LAYERS, type StaffBuilderAnnotationLayer } from "../staff-builder-annotation-layers";

const score: StaffBuilderScore = {
  schemaVersion: 2, annotations: [{ id: "ignored", kind: "study-note", anchor: { kind: "measure", measureId: "m0" }, text: "Not in Phase 5A" }], id: "study", title: "Clean Study", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", ties: [],
  measures: Array.from({ length: 4 }, (_value, index) => ({ id: `m${index}`, events: [] })),
};

let resize: ((width: number) => void) | null = null;
let observed: Element | null = null;

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ measureText: (text: string) => ({ width: text.length * 8 }) } as CanvasRenderingContext2D);
  vi.stubGlobal("ResizeObserver", class {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) { this.callback = callback; resize = (width) => this.callback([{ target: observed!, contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
    observe(target: Element) { observed = target; }
    disconnect() { observed = null; }
  });
});
afterEach(() => { cleanup(); resize = null; observed = null; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("StaffBuilderStudyView", () => {
  const viewProps = { visibleAnnotationLayers: ALL_STAFF_BUILDER_ANNOTATION_LAYERS, onLayerVisibilityChange: vi.fn(), onShowAllAnnotationLayers: vi.fn(), onHideAllAnnotationLayers: vi.fn() };
  it("owns responsive layout from its labelled scroll viewport and ignores zero width", () => {
    const before = JSON.stringify(score);
    render(<StaffBuilderStudyView {...viewProps} onExit={vi.fn()} score={score} />);
    const viewport = screen.getByLabelText("Clean Study Study View score, scroll to explore");
    expect(observed).toBe(viewport);
    expect(viewport.getAttribute("tabindex")).toBe("0");
    act(() => resize?.(360));
    const narrowSystems = document.querySelectorAll("[data-staff-builder-system]").length;
    expect(narrowSystems).toBeGreaterThan(1);
    act(() => resize?.(0));
    expect(document.querySelectorAll("[data-staff-builder-system]")).toHaveLength(narrowSystems);
    act(() => resize?.(1100));
    expect(document.querySelectorAll("[data-staff-builder-system]").length).toBeLessThan(narrowSystems);
    expect(JSON.stringify(score)).toBe(before);
  });

  it("is read-only, accessible, and exits by button or Escape", () => {
    const exit = vi.fn();
    const { container } = render(<StaffBuilderStudyView {...viewProps} onExit={exit} score={score} />);
    act(() => resize?.(700));
    expect(screen.getByRole("heading", { name: "Clean Study", level: 1 })).toBeTruthy();
    const button = screen.getByRole("button", { name: "Exit Study View" });
    expect(document.activeElement).toBe(button);
    expect(container.querySelectorAll("[data-staff-builder-score-semantics]")).toHaveLength(1);
    expect([...container.querySelectorAll("svg")].every((svg) => svg.getAttribute("aria-hidden") === "true" && svg.getAttribute("focusable") === "false")).toBe(true);
    expect(screen.getByText("Not in Phase 5A")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /play|annotation|zoom|full screen/i })).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(exit).toHaveBeenCalledOnce();
    fireEvent.click(button);
    expect(exit).toHaveBeenCalledTimes(2);
  });

  it("offers independent annotation layers plus Show All and Hide All without mutating score", () => {
    const before = JSON.stringify(score);
    const change = vi.fn();
    const show = vi.fn();
    const hide = vi.fn();
    render(<StaffBuilderStudyView {...viewProps} onHideAllAnnotationLayers={hide} onLayerVisibilityChange={change} onShowAllAnnotationLayers={show} onExit={vi.fn()} score={score} />);
    act(() => resize?.(700));
    fireEvent.click(screen.getByLabelText("Study Notes"));
    fireEvent.click(screen.getByRole("button", { name: "Show All" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide All" }));
    expect(change).toHaveBeenCalledWith("study-notes", false);
    expect(show).toHaveBeenCalledOnce();
    expect(hide).toHaveBeenCalledOnce();
    expect(containerSemanticTrees()).toBe(1);
    expect(screen.getByRole("heading", { name: "Study annotations" })).toBeTruthy();
    expect(JSON.stringify(score)).toBe(before);
  });

  it("keeps selection when unrelated layers hide and clears it only with its own layer", () => {
    function LayerHarness() {
      const [layers, setLayers] = useState<ReadonlySet<StaffBuilderAnnotationLayer>>(() => new Set(ALL_STAFF_BUILDER_ANNOTATION_LAYERS));
      const change = (layer: StaffBuilderAnnotationLayer, visible: boolean) => setLayers((current) => { const next = new Set(current); if (visible) next.add(layer); else next.delete(layer); return next; });
      return <StaffBuilderStudyView onExit={vi.fn()} onHideAllAnnotationLayers={() => setLayers(new Set())} onLayerVisibilityChange={change} onShowAllAnnotationLayers={() => setLayers(new Set(ALL_STAFF_BUILDER_ANNOTATION_LAYERS))} score={score} visibleAnnotationLayers={layers} />;
    }
    render(<LayerHarness />);
    act(() => resize?.(700));
    const marker = screen.getByRole("button", { name: /Study Note, Measure 1, measure/ });
    fireEvent.click(marker);
    expect(marker.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByLabelText("Bookmarks"));
    expect(marker.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByLabelText("Practice Marks"));
    expect(marker.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByLabelText("Study Notes"));
    expect(screen.queryByRole("button", { name: /Study Note, Measure 1, measure/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show All" }));
    expect(screen.getByRole("button", { name: /Study Note, Measure 1, measure/ }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Hide All" }));
    expect(screen.queryByRole("button", { name: /Study Note, Measure 1, measure/ })).toBeNull();
  });
});

function containerSemanticTrees() {
  return document.querySelectorAll("[data-staff-builder-score-semantics]").length;
}
