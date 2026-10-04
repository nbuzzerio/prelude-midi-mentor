import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStaffBuilderScore } from "@/features/staff-builder/staff-builder-score";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import { projectStaffBuilderPieceForPractice } from "../piece-practice-projection";
import { createPiecePracticeSession, skipCurrentPiecePracticeTarget } from "../piece-practice-session";
import { PiecePracticeImprove } from "./piece-practice-improve";

vi.mock("@/features/staff-builder/components/staff-builder-score-view", () => ({
  StaffBuilderScoreView: ({ measureIndex, ghostedStaff }: { measureIndex: number; ghostedStaff?: string }) => <div aria-label={`Score measure ${measureIndex + 1}`} data-ghosted-staff={ghostedStaff} />,
}));
afterEach(cleanup);

function fixture() {
  const score: StaffBuilderScore = { ...createStaffBuilderScore({ title: "Study", tempoBpm: 90, initialKeySignatureId: "c-major", initialTimeSignature: "4/4" }),
    measures: [0, 1].map((index) => ({ id: `m${index}`, events: [
      { id: `note${index}`, kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "whole" }, pitches: [{ id: `p${index}`, midiNumber: 60, letter: "C", accidental: "natural", octave: 4 }] },
      { id: `rest${index}`, kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "whole" } },
    ] })),
  };
  const projection = projectStaffBuilderPieceForPractice(score);
  if (!projection.ok) throw new Error("Invalid fixture");
  const created = createPiecePracticeSession(projection.piece, { startMeasureIndex: 0, endMeasureIndex: 1, startedAtMs: 0 });
  if (!created.ok) throw new Error("Invalid range");
  const state = skipCurrentPiecePracticeTarget(projection.piece, skipCurrentPiecePracticeTarget(projection.piece, created.state, 1).state, 2).state;
  return { score, state };
}

describe("completed-run Improve interface", () => {
  it("retains recorded reasons but disables unavailable snapshot measures instead of rendering invalid notation", () => {
    const { score, state } = fixture(); const onPractice = vi.fn();
    render(<PiecePracticeImprove onPractice={onPractice} score={{ ...score, measures: [] }} state={state} />);
    expect(screen.getAllByText(/This measure is unavailable in the score snapshot/)).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Practice measure 1" }));
    expect(onPractice).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /View notation/ })).toBeNull();
    expect(screen.getAllByText("Recorded in the original run: 1 skipped target.")).toHaveLength(2);
  });

  it("explains real evidence and provisional ordering without an ability score", () => {
    const { score, state } = fixture();
    render(<PiecePracticeImprove score={score} state={state} />);
    expect(screen.getByRole("region", { name: "Improve" })).toBeTruthy();
    expect(screen.getAllByText("Recorded in the original run: 1 skipped target.")).toHaveLength(2);
    expect(screen.getByText(/Higher mistake counts come first/)).toBeTruthy();
    expect(screen.getByText(/not difficulty or ability scores/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Practice measure/ })).toBeNull();
  });

  it("opens notation on demand with semantic staff ghosting and keyboard-operable controls", () => {
    const { score, state } = fixture();
    render(<PiecePracticeImprove score={score} state={{ ...state, assessmentFocus: "lower" }} />);
    expect(screen.queryByLabelText("Score measure 1")).toBeNull();
    const view = screen.getByRole("button", { name: "View notation for measure 1" });
    expect(view.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(view);
    expect(view.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("Score measure 1").getAttribute("data-ghosted-staff")).toBe("treble");
    expect(screen.getByRole("region", { name: "Measure 1 notation" }).tabIndex).toBe(0);
    expect(document.getElementById(view.getAttribute("aria-controls")!)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide notation for measure 1" }));
    expect(screen.queryByLabelText("Score measure 1")).toBeNull();
  });

  it("launches the exact original measure and disables launch while navigation waits", () => {
    const { score, state } = fixture(); const onPractice = vi.fn();
    const view = render(<PiecePracticeImprove onPractice={onPractice} score={score} state={state} />);
    fireEvent.click(screen.getByRole("button", { name: "Practice measure 2" }));
    expect(onPractice).toHaveBeenCalledExactlyOnceWith(1);
    view.rerender(<PiecePracticeImprove disabled onPractice={onPractice} score={score} state={state} />);
    fireEvent.click(screen.getByRole("button", { name: "Practice measure 1" }));
    expect(onPractice).toHaveBeenCalledTimes(1);
  });

  it("has honest clean and incomplete states with no practice controls", () => {
    const { score, state } = fixture();
    const view = render(<PiecePracticeImprove onPractice={vi.fn()} score={score} state={{ ...state, skipEvidence: [] }} />);
    expect(screen.getByText(/No measures to recommend/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Practice measure/ })).toBeNull();
    view.rerender(<PiecePracticeImprove score={score} state={{ ...state, status: "practicing" }} />);
    expect(screen.getByText("Complete this Piece Practice run to see measures to revisit.")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("compares native counts only for an available compatible completed focused result", () => {
    const { score, state } = fixture();
    const focused = { ...state, startMeasureIndex: 1, endMeasureIndex: 1, skipEvidence: [] };
    const view = render(<PiecePracticeImprove latestResults={[focused]} score={score} state={state} />);
    const comparison = screen.getByRole("region", { name: "Measure 2 practice comparison" });
    expect(within(comparison).getByRole("heading", { name: "Original run" })).toBeTruthy();
    expect(within(comparison).getByRole("heading", { name: "Latest completed focused run" })).toBeTruthy();
    expect(within(comparison).getByText(/zero mistakes alone does not mean every target was played/)).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Measure 1 practice comparison" })).toBeNull();
    view.rerender(<PiecePracticeImprove latestResults={[{ ...focused, assessmentFocus: "lower" }]} score={score} state={state} />);
    expect(screen.queryByRole("region", { name: /practice comparison/ })).toBeNull();
  });
});
