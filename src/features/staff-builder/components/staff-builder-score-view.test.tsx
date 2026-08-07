import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import { StaffBuilderScoreView } from "./staff-builder-score-view";

const { renderMeasure } = vi.hoisted(() => ({ renderMeasure: vi.fn(() => ({ anchors: { events: new Map(), positions: new Map() }, projection: {}, width: 760, height: 300 })) }));
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
  it("renders measure one with boundary navigation and a semantic summary", () => {
    render(<StaffBuilderScoreView score={score()} />);
    expect(screen.getByRole("heading", { name: "Measure 1 of 2" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Previous Measure" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Next Measure" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/Effective key: C major/)).toBeTruthy();
    expect(screen.getByText(/unresolved rhythm note C4 at tick 0/)).toBeTruthy();
    expect(screen.getByText(/Bass:/).parentElement?.textContent).toContain("No events");
    expect(renderMeasure).toHaveBeenCalledWith(expect.any(HTMLDivElement), expect.objectContaining({ id: "score" }), 0);
  });

  it("navigates to an explicitly changed measure and disables the forward boundary", () => {
    render(<StaffBuilderScoreView score={score()} />);
    fireEvent.click(screen.getByRole("button", { name: "Next Measure" }));
    expect(screen.getByRole("heading", { name: "Measure 2 of 2" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Previous Measure" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Next Measure" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Effective key: G major/)).toBeTruthy();
    expect(screen.getByText(/Effective time signature: 6\/8/)).toBeTruthy();
    expect(screen.getByText(/quarter rest at tick 0/)).toBeTruthy();
    expect(renderMeasure).toHaveBeenLastCalledWith(expect.any(HTMLDivElement), expect.objectContaining({ id: "score" }), 1);
  });
});
