import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import { StaffBuilderScoreView } from "./staff-builder-score-view";

const { renderMeasure } = vi.hoisted(() => ({ renderMeasure: vi.fn((container: unknown, renderedScore: unknown, measureIndex: number) => {
  void container;
  void renderedScore;
  void measureIndex;
  return { anchors: { events: new Map([["treble-note", { eventId: "treble-note", staff: "treble", startTick: 0, onsetX: 160, x: 155, y: 60, width: 20, height: 40 }]]), positions: new Map([
  [0, { tick: 0, x: 150, y: 40, width: 30, height: 220 }],
  [120, { tick: 120, x: 180, y: 40, width: 30, height: 220 }],
  [240, { tick: 240, x: 210, y: 40, width: 30, height: 220 }],
  [360, { tick: 360, x: 240, y: 40, width: 30, height: 220 }],
  ]) }, projection: {}, width: 760, height: 300 };
}) }));
vi.mock("../notation/render-staff-builder-measure", () => ({ renderStaffBuilderMeasure: renderMeasure }));

function score(): StaffBuilderScoreV1 {
  return {
    schemaVersion: 1, id: "score", title: "Navigation", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", ties: [], measures: [
      { id: "m1", events: [{ id: "treble-note", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "unresolved" }, pitches: [{ id: "pitch", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 }] }] },
      { id: "m2", keySignatureChange: "g-major", timeSignatureChange: "6/8", events: [{ id: "bass-rest", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "quarter" } }] },
    ],
  };
}

afterEach(() => { cleanup(); renderMeasure.mockClear(); });

describe("StaffBuilderScoreView", () => {
  it("renders a controlled measure with a semantic summary", () => {
    render(<StaffBuilderScoreView measureIndex={0} score={score()} />);
    expect(screen.getByRole("heading", { name: "Measure 1 of 2" })).toBeTruthy();
    expect(screen.getByText(/Effective key: C major/)).toBeTruthy();
    expect(screen.getByText(/unresolved rhythm note C4 at tick 0/)).toBeTruthy();
    expect(screen.getByText(/Bass:/).parentElement?.textContent).toContain("No events");
    expect(renderMeasure).toHaveBeenCalledWith(expect.any(HTMLDivElement), expect.objectContaining({ id: "score" }), 0);
  });

  it("renders the requested changed measure", () => {
    render(<StaffBuilderScoreView measureIndex={1} score={score()} />);
    expect(screen.getByRole("heading", { name: "Measure 2 of 2" })).toBeTruthy();
    expect(screen.getByText(/Effective key: G major/)).toBeTruthy();
    expect(screen.getByText(/Effective time signature: 6\/8/)).toBeTruthy();
    expect(screen.getByText(/quarter rest at tick 0/)).toBeTruthy();
    expect(renderMeasure).toHaveBeenLastCalledWith(expect.any(HTMLDivElement), expect.objectContaining({ id: "score" }), 1);
  });

  it("uses formatted anchors for cursor position, duration width, and boundary clipping", () => {
    const { rerender } = render(<StaffBuilderScoreView cursor={{ offsetTicks: 0, stepDuration: "quarter" }} measureIndex={0} score={score()} />);
    const cursor = screen.getByTestId("staff-builder-capture-cursor");
    expect(cursor.style.left).toBe("150px");
    expect(cursor.style.width).toBe("120px");
    expect(cursor.style.height).toBe("220px");
    rerender(<StaffBuilderScoreView cursor={{ offsetTicks: 360, stepDuration: "quarter" }} measureIndex={0} score={score()} />);
    expect(screen.getByTestId("staff-builder-capture-cursor").style.width).toBe("30px");
  });

  it("renders treble and bass pending previews while keeping committed semantic output separate", () => {
    render(<StaffBuilderScoreView cursor={{ offsetTicks: 0, stepDuration: "quarter" }} measureIndex={0} pendingPreview={{ treble: [64], bass: [48, 52] }} score={score()} />);
    const renderScore = renderMeasure.mock.calls.at(-1)?.[1] as StaffBuilderScoreV1;
    const events = renderScore.measures[0]?.events ?? [];
    expect(events.find(({ staff }) => staff === "treble")).toMatchObject({ id: expect.stringContaining("__staff-builder-preview"), startTick: 0, rhythm: { status: "final", duration: "quarter" }, pitches: [{ midiNumber: 64 }] });
    expect(events.find(({ staff }) => staff === "bass")).toMatchObject({ startTick: 0, rhythm: { status: "final", duration: "quarter" }, pitches: [{ midiNumber: 48 }, { midiNumber: 52 }] });
    expect(events.some(({ id }) => id === "treble-note")).toBe(false);
    expect(screen.getByText(/unresolved rhythm note C4 at tick 0/)).toBeTruthy();
    expect(screen.getByText(/Pending treble preview: note E4 at tick 0/)).toBeTruthy();
    expect(screen.getByText(/Pending bass preview: chord C3, E3 at tick 0/)).toBeTruthy();
  });

  it("updates and removes pending preview immediately without mutating the source score", () => {
    const current = score();
    const before = JSON.stringify(current);
    const { rerender } = render(<StaffBuilderScoreView cursor={{ offsetTicks: 240, stepDuration: "eighth" }} measureIndex={0} pendingPreview={{ treble: [66], bass: [] }} score={current} />);
    expect((renderMeasure.mock.calls.at(-1)?.[1] as StaffBuilderScoreV1).measures[0]?.events.find(({ id }) => id.includes("preview"))).toMatchObject({ startTick: 240, pitches: [{ midiNumber: 66 }] });
    rerender(<StaffBuilderScoreView cursor={{ offsetTicks: 240, stepDuration: "eighth" }} measureIndex={0} pendingPreview={{ treble: [], bass: [] }} score={current} />);
    expect((renderMeasure.mock.calls.at(-1)?.[1] as StaffBuilderScoreV1).measures[0]?.events.some(({ id }) => id.includes("preview"))).toBe(false);
    expect(screen.getByText("Pending treble preview: none.")).toBeTruthy();
    expect(JSON.stringify(current)).toBe(before);
  });

  it.each(["quarter", "eighth", "sixteenth"] as const)("keeps pending notation at quarter duration with %s cursor movement", (stepDuration) => {
    render(<StaffBuilderScoreView cursor={{ offsetTicks: 0, stepDuration }} measureIndex={0} pendingPreview={{ treble: [60], bass: [] }} score={score()} />);
    const renderScore = renderMeasure.mock.calls.at(-1)?.[1] as StaffBuilderScoreV1;
    expect(renderScore.measures[0]?.events.find(({ id }) => id.includes("preview"))?.rhythm).toEqual({ status: "final", duration: "quarter" });
  });

  it("draws a padded selection outline from the public event anchor without a capture cursor", () => {
    render(<StaffBuilderScoreView measureIndex={0} score={score()} selectedEventId="treble-note" />);
    const outline = screen.getByTestId("staff-builder-selection-outline");
    expect(outline.style.left).toBe("150px");
    expect(outline.style.top).toBe("55px");
    expect(outline.style.width).toBe("30px");
    expect(outline.style.height).toBe("50px");
    expect(screen.queryByTestId("staff-builder-capture-cursor")).toBeNull();
  });

  it("draws a non-color-only issue overlay from public anchors", () => {
    render(<StaffBuilderScoreView issue={{ id: "issue", code: "unresolved-rhythm", severity: "error", target: { measureIndex: 0, staff: "treble", eventId: "treble-note", positionTicks: 0 }, message: "Needs rhythm", corrections: [] }} measureIndex={0} score={score()} />);
    expect(screen.getByTestId("staff-builder-issue-outline").textContent).toBe("!");
  });
});
