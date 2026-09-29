import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import { PiecePracticeResults } from "./components/piece-practice-results";
import { formatPiecePracticeReport } from "./piece-practice-report";
import { createPiecePracticeSession, recordPiecePracticeMidiAttack, restartPiecePractice, submitPiecePracticeAttempt, type PiecePracticeSessionState } from "./piece-practice-session";
import type { PiecePracticePiece } from "./piece-practice-types";

vi.mock("@/hooks/use-browser-print", () => ({ useBrowserPrint: vi.fn() }));
vi.mock("@/features/staff-builder/components/staff-builder-print-score", () => ({ StaffBuilderPrintScore: () => <div /> }));
vi.mock("@/features/staff-builder/components/staff-builder-score-view", () => ({ StaffBuilderScoreView: () => <div /> }));

const piece: PiecePracticePiece = {
  sourceScoreId: "score", sourceScoreUpdatedAt: "now", title: "Study", tempoBpm: 96,
  measures: [{ measureIndex: 0, sourceMeasureId: "m1", absoluteStartTick: 0, capacityTicks: 1920,
    keySignatureId: "c-major", timeSignature: "4/4", clefs: { treble: "treble", bass: "bass" }, sourceEvents: [], restEventIds: [],
    targets: [{ id: "target", measureIndex: 0, sourceMeasureId: "m1", startTick: 0, absoluteStartTick: 0,
      sourceEventIds: [], expectedMidiNumbers: [60], attackedPitches: [],
      checks: [{ id: "check", kind: "normal", sourceEventIds: [], expectedMidiNumbers: [60], attackedPitches: [] }] }],
  }],
};

function initial() {
  const result = createPiecePracticeSession(piece, { startMeasureIndex: 0, startedAtMs: 0 });
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}
function completed() {
  const withEvidence = recordPiecePracticeMidiAttack(piece, initial(), 60, 91, 100);
  return submitPiecePracticeAttempt(piece, withEvidence, { targetId: "target", attempt: { attackMidiNumbers: [60] }, atMs: 200 }).state;
}
const report = (state: PiecePracticeSessionState, includeAttackStrength = false) => formatPiecePracticeReport({ title: "Study", rangeText: "Measure 1", state, includeAttackStrength });
const view = (state = completed()) => <PiecePracticeResults displayScore={{} as StaffBuilderScore} rangeText="Measure 1" state={state} title="Study" />;
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Piece Practice report attack strength", () => {
  it("keeps the OFF report identical with or without velocity evidence", () => {
    const state = completed(); const without = { ...state }; delete without.attackEvidence;
    expect(report(state)).toBe(report(without));
    expect(report(state)).not.toMatch(/velocity|attack strength/i);
    expect(report(state)).toContain("Mistakes: 0");
  });
  it("includes exact per-attack evidence and range deterministically only when enabled", () => {
    let state = recordPiecePracticeMidiAttack(piece, initial(), 60, 54, 100);
    state = recordPiecePracticeMidiAttack(piece, state, 60, 107, 150);
    state = submitPiecePracticeAttempt(piece, state, { targetId: "target", attempt: { attackMidiNumbers: [60] }, atMs: 200 }).state;
    const before = JSON.stringify(state);
    expect(report(state, true)).toContain("0.100s: MIDI 60 (C4), velocity 54");
    expect(report(state, true)).toContain("0.150s: MIDI 60 (C4), velocity 107");
    expect(report(state, true)).toContain("Range: 54-107");
    expect(report(state, true)).toBe(report(state, true));
    expect(JSON.stringify(state)).toBe(before);
  });
  it.each([undefined, 0, 128, -1, 1.5, NaN])("never fabricates evidence for unavailable/invalid velocity %s", (velocity) => {
    const state = initial();
    expect(recordPiecePracticeMidiAttack(piece, state, 60, velocity, 100)).toBe(state);
    expect(report(state, true)).toContain("No MIDI attack velocity evidence available.");
    expect(report(state, true)).not.toContain("Range:");
  });
  it("ignores attacks outside active practice and resets evidence on restart", () => {
    const state = initial();
    expect(recordPiecePracticeMidiAttack(piece, { ...state, clockPaused: true }, 60, 91, 100).attackEvidence).toBeUndefined();
    expect(recordPiecePracticeMidiAttack(piece, completed(), 60, 91, 300)).toEqual(completed());
    expect(restartPiecePractice(piece, completed(), 300).attackEvidence).toBeUndefined();
  });
  it("defaults OFF and copies the exact selected report without mutating the session", async () => {
    const writeText = vi.fn(async () => undefined); vi.stubGlobal("navigator", { clipboard: { writeText } });
    const state = completed(); const before = JSON.stringify(state); render(view(state));
    expect((screen.getByLabelText("Include MIDI attack strength") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Copy Report" }));
    await screen.findByText("Report copied."); expect(writeText).toHaveBeenLastCalledWith(report(state));
    fireEvent.click(screen.getByLabelText("Include MIDI attack strength"));
    fireEvent.click(screen.getByRole("button", { name: "Copy Report" }));
    await screen.findByText("Report copied."); expect(writeText).toHaveBeenLastCalledWith(report(state, true));
    expect(JSON.stringify(state)).toBe(before);
  });
  it("freezes exact failed-copy text, selects it, and retries using current state/options", async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error("blocked")).mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const state = completed(); const rendered = render(view(state));
    fireEvent.click(screen.getByRole("button", { name: "Copy Report" }));
    const textarea = await screen.findByLabelText("Piece Practice report") as HTMLTextAreaElement;
    expect(textarea.value).toBe(report(state)); expect(textarea.readOnly).toBe(true);
    expect(document.activeElement).toBe(textarea); expect(textarea.selectionEnd).toBe(textarea.value.length);
    const changed = { ...state, activeElapsedMs: 500, completedAtActiveMs: 500 };
    rendered.rerender(view(changed)); fireEvent.click(screen.getByLabelText("Include MIDI attack strength"));
    expect(textarea.value).toBe(report(state));
    fireEvent.click(screen.getByRole("button", { name: "Copy Report" }));
    await screen.findByText("Report copied."); expect(writeText).toHaveBeenLastCalledWith(report(changed, true));
    expect(screen.queryByLabelText("Piece Practice report")).toBeNull();
  });
  it("adds velocities to print/PDF only when the report toggle is ON", () => {
    render(view()); fireEvent.click(screen.getByLabelText("Include MIDI attack strength"));
    fireEvent.click(screen.getByRole("button", { name: "Generate Report" }));
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));
    expect(screen.getByLabelText("Study practice report").textContent).toContain("velocity 91");
  });
});
