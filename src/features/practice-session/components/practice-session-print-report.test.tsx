import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appendFlashcardCompletedTarget, createFlashcardPracticeResult, snapshotFlashcardPracticeTarget } from "@/features/flashcards/flashcard-practice-result";
import { createMelodyContinuousDiagnosticTrial } from "@/features/melody/melody-continuous-practice";
import { createMelodyPracticeResult } from "@/features/melody/melody-practice-result";
import type { MelodyAttemptResult } from "@/features/melody/melody-scoring";
import type { MelodyExercise } from "@/features/melody/melody-types";
import { PRACTICE_SESSION_BUILDER_OPTIONS } from "../practice-session-builder-options";
import type { PracticeSessionExerciseReport, PracticeSessionReport } from "../practice-session-report";
import type { PracticeExerciseEntry } from "../practice-session-types";
import { DEFAULT_PRACTICE_SESSION_PRINT_OPTIONS } from "../practice-session-print-options";
import { PracticeSessionPrintableReport, PracticeSessionPrintControls } from "./practice-session-print-report";

const entry = (option: number, id: string): PracticeExerciseEntry => {
  const value = PRACTICE_SESSION_BUILDER_OPTIONS[option]!.createEntry(id);
  return "count" in value.target ? { ...value, target: { ...value.target, count: 1 } } as PracticeExerciseEntry : value;
};
const firstEntry = entry(0, "first");
const target1 = snapshotFlashcardPracticeTarget({ clef: "treble", name: { primary: "C" }, notes: [{ midiNumber: 60, name: "C", octave: 4 }] }, 1);
const target2 = snapshotFlashcardPracticeTarget({ clef: "treble", name: { primary: "D" }, notes: [{ midiNumber: 62, name: "D", octave: 4 }] }, 2);
const boundary = appendFlashcardCompletedTarget(createFlashcardPracticeResult(), { responseDurationMs: 500, source: "midi", submittedMidiNumbers: [60], target: target1 });
const final = appendFlashcardCompletedTarget(boundary, { responseDurationMs: 700, source: "midi", submittedMidiNumbers: [62], target: target2 });
function exercise(prescription: PracticeExerciseEntry, index: number, outcome: PracticeSessionExerciseReport["outcome"]): PracticeSessionExerciseReport {
  return { exerciseIndex: index, exerciseId: prescription.id, label: prescription.label, engine: prescription.engine, prescription, entered: outcome !== "never-entered", outcome,
    prescribedUnitsCompleted: index === 0 ? 1 : 0, bonusUnitsCompleted: index === 0 ? 1 : 0, prescribedActiveDurationMs: 1000, bonusActiveDurationMs: index === 0 ? 500 : 0,
    totalActiveDurationMs: index === 0 ? 1500 : 1000, targetReached: index === 0, bonusUsed: index === 0,
    targetBoundaryEngineResult: index === 0 ? boundary : null, finalEngineResult: index === 0 ? final : null };
}
const report: PracticeSessionReport = { runId: "run", presetId: "preset", presetName: "Daily Practice", totalActiveDurationMs: 2500, enteredExerciseCount: 2, targetReachedCount: 1, skippedCount: 1, endedBeforeTargetCount: 0, neverEnteredCount: 1, bonusExerciseCount: 1,
  exercises: [exercise(firstEntry, 0, "completed"), exercise(entry(6, "second"), 1, "skipped"), exercise(entry(7, "third"), 2, "never-entered")] };

beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("print", vi.fn()); });
afterEach(() => { cleanup(); vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Practice Session printable report", () => {
  it("defaults all six options on, toggles each, cancels, escapes, traps focus, and restores focus", () => {
    render(<PracticeSessionPrintControls report={report} />);
    const generate = screen.getByRole("button", { name: "Generate Report" });
    fireEvent.click(generate);
    const dialog = screen.getByRole("dialog", { name: "Generate Report" });
    const checks = within(dialog).getAllByRole("checkbox") as HTMLInputElement[];
    expect(checks).toHaveLength(6); expect(checks.every(({ checked }) => checked)).toBe(true);
    checks.forEach((check) => fireEvent.click(check)); expect(checks.every(({ checked }) => !checked)).toBe(true);
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    cancel.focus(); fireEvent.keyDown(dialog, { key: "Tab" }); expect(document.activeElement).toBe(checks[0]);
    checks[0]!.focus(); fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true }); expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(dialog, { key: "Escape" }); expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(generate); expect(window.print).not.toHaveBeenCalled();
    fireEvent.click(generate); fireEvent.click(screen.getByRole("button", { name: "Cancel" })); expect(document.activeElement).toBe(generate);
  });

  it("filters and independently controls summary, summaries, details, timing, and diagnostics while retaining authored numbering", () => {
    const options = { ...DEFAULT_PRACTICE_SESSION_PRINT_OPTIONS, sessionSummary: false, exerciseDetails: false, timing: false, engineDiagnostics: false, includeSkippedAndNotEntered: false };
    const { rerender } = render(<PracticeSessionPrintableReport options={options} report={report} />);
    expect(screen.queryByText("Session summary")).toBeNull(); expect(screen.getByText("Exercise summary")).toBeTruthy(); expect(screen.queryByText("Exercise details")).toBeNull(); expect(screen.queryByText("Active exercise time")).toBeNull(); expect(screen.queryByText("Engine diagnostics")).toBeNull();
    expect(screen.getByText(/Exercise 1 of 3/)).toBeTruthy(); expect(screen.queryByText(/Exercise 2 of 3/)).toBeNull(); expect(screen.queryByText(/Exercise 3 of 3/)).toBeNull();
    rerender(<PracticeSessionPrintableReport options={{ ...options, exerciseSummaries: false }} report={report} />); expect(screen.queryByText("Exercises")).toBeNull();
    rerender(<PracticeSessionPrintableReport options={DEFAULT_PRACTICE_SESSION_PRINT_OPTIONS} report={report} />);
    expect(screen.getByText("Session summary")).toBeTruthy(); expect(screen.getAllByText("Exercise summary")).toHaveLength(3); expect(screen.getAllByText("Exercise details")).toHaveLength(3); expect(screen.getAllByText("Active exercise time")).toHaveLength(3); expect(screen.getByText(/Exercise 2 of 3/)).toBeTruthy(); expect(screen.getByText(/Exercise 3 of 3/)).toBeTruthy();
  });

  it("uses compact existing Melody semantics without duplicating notation detail", () => {
    const melodyEntry = entry(7, "melody");
    const melodyExercise = { id: "melody-exercise", seed: "seed" } as MelodyExercise;
    const attempt = { attacks: [], exerciseId: melodyExercise.id, extraAttackCount: 0, extras: [], missedAttackCount: 0, movementScorePercent: null, movements: [], pitchScorePercent: 82, timingScorePercent: 76 } as MelodyAttemptResult;
    const melodyResult = createMelodyPracticeResult([createMelodyContinuousDiagnosticTrial(1, melodyExercise, attempt)]);
    const melodyReport = { ...report, exercises: [{ ...exercise(melodyEntry, 0, "completed"), targetBoundaryEngineResult: melodyResult, finalEngineResult: melodyResult }] };
    render(<PracticeSessionPrintableReport options={DEFAULT_PRACTICE_SESSION_PRINT_OPTIONS} report={melodyReport} />);
    expect(screen.getByText("Original Pitch average").nextElementSibling?.textContent).toBe("82%");
    expect(screen.getByText(/Trial 1: Needs review/)).toBeTruthy();
    expect(screen.queryByLabelText("Melody pitch result score")).toBeNull();
  });

  it("prints prescribed and Bonus engine diagnostics from Phase 3 selectors", () => {
    const { rerender } = render(<PracticeSessionPrintableReport options={DEFAULT_PRACTICE_SESSION_PRINT_OPTIONS} report={report} />);
    expect(screen.getByRole("heading", { name: "Prescribed", level: 4 })).toBeTruthy(); expect(screen.getByRole("heading", { name: "Bonus", level: 4 })).toBeTruthy();
    expect(screen.getByText("C")).toBeTruthy(); expect(screen.getByText("D")).toBeTruthy(); expect(screen.queryByText(/generic score/i)).toBeNull();
    const unsplit = { ...report, exercises: [{ ...report.exercises[0]!, targetBoundaryEngineResult: null, finalEngineResult: final }] };
    rerender(<PracticeSessionPrintableReport options={DEFAULT_PRACTICE_SESSION_PRINT_OPTIONS} report={unsplit} />);
    expect(screen.getByRole("heading", { name: "Recorded evidence", level: 4 })).toBeTruthy(); expect(screen.queryByRole("heading", { name: "Bonus", level: 4 })).toBeNull();
  });

  it("mounts before print, cleans on afterprint or fallback, repeats, and removes work on unmount", () => {
    const view = render(<PracticeSessionPrintControls report={report} />);
    const start = () => { fireEvent.click(screen.getByRole("button", { name: "Generate Report" })); fireEvent.click(screen.getByRole("button", { name: "Generate printable report" })); };
    start(); expect(document.querySelector(".practice-session-print-document")).toBeTruthy(); expect(window.print).not.toHaveBeenCalled(); act(() => vi.advanceTimersByTime(0)); expect(window.print).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new Event("afterprint"))); expect(document.querySelector(".practice-session-print-document")).toBeNull(); expect(document.activeElement).toBe(screen.getByRole("button", { name: "Generate Report" }));
    start(); act(() => vi.advanceTimersByTime(1_000)); expect(window.print).toHaveBeenCalledTimes(2); expect(document.querySelector(".practice-session-print-document")).toBeNull();
    start(); view.unmount(); act(() => vi.runOnlyPendingTimers()); expect(window.print).toHaveBeenCalledTimes(2);
  });
});
