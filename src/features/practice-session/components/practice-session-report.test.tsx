import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appendFlashcardCompletedTarget, appendFlashcardIncorrectAttempt, createFlashcardPracticeResult, snapshotFlashcardPracticeTarget } from "@/features/flashcards/flashcard-practice-result";
import { PRACTICE_SESSION_BUILDER_OPTIONS } from "../practice-session-builder-options";
import { practiceSessionRunReducer, type CompletedPracticeSessionRun, type PracticeSessionRunSnapshot, type PracticeSessionRunState } from "../practice-session-runtime";
import type { PracticeExerciseEntry } from "../practice-session-types";
import { PracticeSessionCompletedReport } from "./practice-session-report";

afterEach(cleanup);

function entry(option: number, id: string, count = 1): PracticeExerciseEntry {
  const created = PRACTICE_SESSION_BUILDER_OPTIONS[option]!.createEntry(id);
  return "count" in created.target ? { ...created, target: { ...created.target, count } } as PracticeExerciseEntry : created;
}

function start(exercises: readonly PracticeExerciseEntry[]): PracticeSessionRunState {
  const snapshot: PracticeSessionRunSnapshot = { presetId: "preset", presetName: "Daily", exercises };
  return practiceSessionRunReducer(null, { type: "START_RUN", runId: "run", startedAt: 0, firstExerciseToken: "token", snapshot })!;
}

describe("Practice Session completed report", () => {
  it("keeps authored order, includes never-entered exercises, and uses neutral outcome wording", () => {
    const exercises = [entry(0, "first"), entry(6, "second"), entry(7, "third")];
    const active = start(exercises);
    const completed = practiceSessionRunReducer(active, { type: "END", runId: "run", exerciseToken: "token", exerciseId: "first", endedAt: 10 }) as CompletedPracticeSessionRun;
    render(<PracticeSessionCompletedReport onBack={vi.fn()} run={completed} />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => within(item).getByRole("heading", { level: 3 }).textContent)).toEqual(exercises.map(({ label }) => label));
    expect(screen.getByText("Session ended before target")).toBeTruthy();
    expect(screen.getAllByText("Not reached in this session")).toHaveLength(2);
    expect(screen.getByText("Exercises entered").nextElementSibling?.textContent).toBe("1 of 3");
  });

  it("presents prescribed and Bonus work separately and progressively reveals Flashcard diagnostics", () => {
    const exercise = entry(0, "only");
    let state = start([exercise]);
    const target = snapshotFlashcardPracticeTarget({ clef: "treble", name: { primary: "C" }, notes: [{ midiNumber: 60, name: "C", octave: 4 }] }, 1);
    let result = appendFlashcardIncorrectAttempt(createFlashcardPracticeResult(), { source: "midi", submittedMidiNumbers: [61], target });
    result = appendFlashcardCompletedTarget(result, { responseDurationMs: 1500, source: "midi", submittedMidiNumbers: [60], target });
    state = practiceSessionRunReducer(state, { type: "ENGINE_RESULT_CHANGED", runId: "run", exerciseToken: "token", exerciseId: "only", result })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", runId: "run", exerciseToken: "token", exerciseId: "only", at: 1000 })!;
    state = practiceSessionRunReducer(state, { type: "KEEP_PLAYING", runId: "run", exerciseToken: "token", exerciseId: "only", at: 1000 })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", runId: "run", exerciseToken: "token", exerciseId: "only", at: 2000 })!;
    state = practiceSessionRunReducer(state, { type: "ADVANCE", runId: "run", exerciseToken: "token", exerciseId: "only", endedAt: 2000 })!;
    render(<PracticeSessionCompletedReport onBack={vi.fn()} run={state as CompletedPracticeSessionRun} />);
    expect(screen.getByText("Prescribed work").nextElementSibling?.textContent).toBe("1 unit");
    expect(screen.getByText("Bonus work").nextElementSibling?.textContent).toBe("1 unit");
    const disclosure = screen.getByText("Detailed diagnostics");
    expect(disclosure.closest("details")?.open).toBe(false);
    fireEvent.click(disclosure);
    expect(disclosure.closest("details")?.open).toBe(true);
    expect(screen.queryByRole("heading", { name: "Bonus", level: 4 })).toBeNull();
    expect(screen.getByText("Targets answered").nextElementSibling?.textContent).toBe("1");
    expect(screen.getByText("Answered after 1 incorrect attempt · 2s")).toBeTruthy();
  });

  it("shows engine-native Bonus diagnostics only for evidence appended after the boundary", () => {
    const exercise = entry(0, "only");
    let state = start([exercise]);
    const firstTarget = snapshotFlashcardPracticeTarget({ clef: "treble", name: { primary: "C" }, notes: [{ midiNumber: 60, name: "C", octave: 4 }] }, 1);
    const secondTarget = snapshotFlashcardPracticeTarget({ clef: "treble", name: { primary: "D" }, notes: [{ midiNumber: 62, name: "D", octave: 4 }] }, 2);
    let result = appendFlashcardCompletedTarget(createFlashcardPracticeResult(), { responseDurationMs: 1000, source: "midi", submittedMidiNumbers: [60], target: firstTarget });
    state = practiceSessionRunReducer(state, { type: "ENGINE_RESULT_CHANGED", runId: "run", exerciseToken: "token", exerciseId: "only", result })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", runId: "run", exerciseToken: "token", exerciseId: "only", at: 1000 })!;
    state = practiceSessionRunReducer(state, { type: "KEEP_PLAYING", runId: "run", exerciseToken: "token", exerciseId: "only", at: 1000 })!;
    result = appendFlashcardCompletedTarget(result, { responseDurationMs: 2000, source: "virtual", submittedMidiNumbers: [62], target: secondTarget });
    state = practiceSessionRunReducer(state, { type: "ENGINE_RESULT_CHANGED", runId: "run", exerciseToken: "token", exerciseId: "only", result })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", runId: "run", exerciseToken: "token", exerciseId: "only", at: 3000 })!;
    state = practiceSessionRunReducer(state, { type: "ADVANCE", runId: "run", exerciseToken: "token", exerciseId: "only", endedAt: 3000 })!;
    render(<PracticeSessionCompletedReport onBack={vi.fn()} run={state as CompletedPracticeSessionRun} />);
    fireEvent.click(screen.getByText("Detailed diagnostics"));
    expect(screen.getByRole("heading", { name: "Prescribed", level: 4 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Bonus", level: 4 })).toBeTruthy();
    expect(screen.getByText("C")).toBeTruthy();
    expect(screen.getByText("D")).toBeTruthy();
  });
});
