import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffBuilderScore } from "../staff-builder-types";
import { StaffBuilderTieControls } from "./staff-builder-tie-controls";

const chord = (id: string, startTick: number, suffix: string) => ({ id, kind: "notes" as const, staff: "treble" as const, startTick, rhythm: { status: "final" as const, duration: "quarter" as const }, pitches: [
  { id: `d-${suffix}`, midiNumber: 74, letter: "D" as const, accidental: "natural" as const, octave: 5 },
  { id: `f-${suffix}`, midiNumber: 77, letter: "F" as const, accidental: "natural" as const, octave: 5 },
  { id: `a-${suffix}`, midiNumber: 81, letter: "A" as const, accidental: "natural" as const, octave: 5 },
] });

afterEach(cleanup);

describe("Staff Builder tie controls", () => {
  it("keeps unavailable tie directions visible with adjacent-note guidance", () => {
    const source = { ...chord("source", 0, "1"), pitches: chord("source", 0, "1").pitches.slice(0, 1) };
    const score: StaffBuilderScore = { schemaVersion: 4, annotations: [], id: "score", title: "Single note", createdAt: "x", updatedAt: "x", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", measures: [{ id: "m1", events: [source] }], ties: [] };
    const create = vi.fn();
    render(<StaffBuilderTieControls event={source} measureIndex={0} onCreateTies={create} onRemoveTie={vi.fn()} onSplitAndTie={vi.fn()} score={score} />);
    const tieIn = screen.getByRole("button", { name: "Tie In D5 (MIDI 74)" });
    const tieOut = screen.getByRole("button", { name: "Tie Out D5 (MIDI 74)" });
    expect((tieIn as HTMLButtonElement).disabled).toBe(true);
    expect((tieOut as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/No compatible adjacent note is available/)).toBeTruthy();
    expect(screen.getByText(/same pitch and staff, and have assigned durations/)).toBeTruthy();
    fireEvent.click(tieIn); fireEvent.click(tieOut);
    expect(create).not.toHaveBeenCalled();
  });

  it("retains ordinary cross-measure Tie Out and separate barline splitting", () => {
    const first = chord("first", 1440, "1");
    const next = chord("next", 0, "2");
    const score: StaffBuilderScore = { schemaVersion: 4, annotations: [], id: "score", title: "Across a barline", createdAt: "x", updatedAt: "x", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", measures: [{ id: "m1", events: [first] }, { id: "m2", events: [next] }], ties: [] };
    const create = vi.fn(); const split = vi.fn();
    render(<StaffBuilderTieControls event={first} measureIndex={0} onCreateTies={create} onRemoveTie={vi.fn()} onSplitAndTie={split} score={score} />);
    fireEvent.click(screen.getByLabelText("D5 (MIDI 74)"));
    fireEvent.click(screen.getByRole("button", { name: "Tie Out D5 (MIDI 74)" }));
    expect(create).toHaveBeenCalledWith("first", "next", ["d-1"]);
    expect(split).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Split across a barline"));
    fireEvent.change(screen.getByLabelText("Cross-bar target duration"), { target: { value: "half" } });
    fireEvent.click(screen.getByRole("button", { name: "Split and use selected continuation" }));
    expect(split).toHaveBeenCalledWith("first", "half", ["d-1"], "next");
  });

  it("offers independent Tie In and Tie Out actions per checked chord pitch", () => {
    const first = chord("first", 0, "1");
    const middle = chord("middle", 480, "2");
    const last = chord("last", 960, "3");
    const score: StaffBuilderScore = { schemaVersion: 4, annotations: [], id: "score", title: "Bells", createdAt: "x", updatedAt: "x", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", measures: [{ id: "m1", events: [first, middle, last] }], ties: [] };
    const create = vi.fn();
    render(<StaffBuilderTieControls event={middle} measureIndex={0} onCreateTies={create} onRemoveTie={vi.fn()} onSplitAndTie={vi.fn()} score={score} />);
    fireEvent.click(screen.getByLabelText("D5 (MIDI 74)"));
    fireEvent.click(screen.getByRole("button", { name: "Tie In D5 (MIDI 74)" }));
    fireEvent.click(screen.getByRole("button", { name: "Tie Out D5 (MIDI 74)" }));
    expect(create).toHaveBeenNthCalledWith(1, "first", "middle", ["d-1"]);
    expect(create).toHaveBeenNthCalledWith(2, "middle", "last", ["d-2"]);
    expect(create.mock.calls.flat()).not.toContain("f-2");
    expect(create.mock.calls.flat()).not.toContain("a-2");
  });

  it("shows both directional states on a middle node and removes only the chosen edge", () => {
    const first = chord("first", 0, "1");
    const middle = chord("middle", 480, "2");
    const last = chord("last", 960, "3");
    const score: StaffBuilderScore = { schemaVersion: 4, annotations: [], id: "score", title: "Chain", createdAt: "x", updatedAt: "x", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", measures: [{ id: "m1", events: [first, middle, last] }], ties: [
      { id: "tie-in", fromEventId: "first", fromPitchId: "d-1", toEventId: "middle", toPitchId: "d-2" },
      { id: "tie-out", fromEventId: "middle", fromPitchId: "d-2", toEventId: "last", toPitchId: "d-3" },
    ] };
    const remove = vi.fn();
    render(<StaffBuilderTieControls event={middle} measureIndex={0} onCreateTies={vi.fn()} onRemoveTie={remove} onSplitAndTie={vi.fn()} score={score} />);
    fireEvent.click(screen.getByLabelText("D5 (MIDI 74)"));
    expect(screen.getByRole("button", { name: "Remove Tie In for D5 (MIDI 74)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove Tie Out for D5 (MIDI 74)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove Tie In for D5 (MIDI 74)" }));
    expect(remove).toHaveBeenCalledWith("tie-in");
  });
});
