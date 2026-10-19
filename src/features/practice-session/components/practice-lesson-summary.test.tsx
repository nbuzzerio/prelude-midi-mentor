import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { testAttempt, testProgram, testSkip } from "../practice-program-test-fixtures";
import { PracticeProgramExecutor } from "../practice-program-executor";
import { practiceSessionRunReducer, type ActivePracticeSessionRun } from "../practice-session-runtime";
import PracticeLessonSummary, { LessonNativeDetails } from "./practice-lesson-summary";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("shows ordered outcomes and one practical suggestion without a universal score", () => {
  const completed = { ...testAttempt(), closed: true, outcome: "completed" as const, prescribedUnits: 1 };
  const stopped = { ...testAttempt(1, "stopped"), closed: true, outcome: "stopped-early" as const };
  const interrupted = { ...testAttempt(2, "interrupted"), closed: true, outcome: "interrupted" as const };
  const skip = { ...testSkip(), occurrenceId: "skip-occurrence" };
  const records = [completed, stopped, interrupted, skip];
  const executor = new PracticeProgramExecutor(testProgram());
  const state = { ...executor.getSnapshot(), queue: [...records, { occurrenceId: "unperformed", exerciseId: "exercise-8" }], acknowledged: records.map(record => ({ record, report: null })) };
  const { container } = render(<StrictMode><PracticeLessonSummary exercises={testProgram().nativeExercises} pending={false} state={state} /></StrictMode>);
  expect(screen.getByText("1 completed · 1 stopped early · 1 interrupted · 1 deliberately skipped · 1 unperformed")).toBeTruthy();
  expect([...container.querySelectorAll("ol > li")].map(item => item.textContent?.split(" — ")[1])).toEqual(["Completed", "Stopped early", "Interrupted", "Deliberately skipped", "Unperformed"]);
  expect(screen.getByRole("heading", { name: "Next time" })).toBeTruthy();
  expect(container.textContent).not.toMatch(/improved|proficiency|accuracy|XP|streak|mastery/i);
});

it("keeps no-performed-work and pending skip feedback neutral", () => {
  const executor = new PracticeProgramExecutor(testProgram()), initial = executor.getSnapshot();
  const state = { ...initial, queue: [{ occurrenceId: "skip", exerciseId: "exercise-0" }], error: "Skip pending" };
  const view = render(<PracticeLessonSummary exercises={testProgram().nativeExercises} pending state={state} />);
  expect(screen.getByText("No exercises were performed.")).toBeTruthy(); expect(screen.getByText(/— Skip save pending/)).toBeTruthy();
  expect(view.container.textContent).not.toMatch(/saved|completed attempt evidence/i);
  view.rerender(<PracticeLessonSummary exercises={testProgram().nativeExercises} pending={false} state={initial} />);
  expect(screen.getByText("No selections were undertaken.")).toBeTruthy();
});

it("retains native diagnostics and real print controls behind an expandable section", async () => {
  const entry = testProgram().nativeExercises[0]!;
  let run = practiceSessionRunReducer(null, { type: "START_RUN", runId: "report", firstExerciseToken: "report", startedAt: 1, snapshot: { presetId: "p", presetName: "Native lesson", exercises: [entry] } }) as ActivePracticeSessionRun;
  const scope = { runId: run.runId, exerciseToken: run.activeExerciseToken, exerciseId: entry.id };
  run = practiceSessionRunReducer(run, { type: "UNIT_COMPLETED", ...scope, at: 2 }) as ActivePracticeSessionRun;
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  render(<LessonNativeDetails run={run} scopeNote="Today's Piano Lesson · exercise 1 of 3. Single-attempt report only." />);
  expect(screen.queryByRole("button", { name: "Generate Report" })).toBeNull();
  fireEvent.click(screen.getByText("Detailed native report and printing"));
  fireEvent.click(await screen.findByRole("button", { name: "Generate Report" }));
  expect(screen.getByRole("dialog", { name: "Generate Report" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Generate printable report" }));
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  expect(screen.getByLabelText("Native lesson printable Practice Session report")).toBeTruthy();
  const text = screen.getByLabelText("Native lesson printable Practice Session report").textContent;
  expect(text).toContain("exercise 1 of 3. Single-attempt report only.");
  expect(text).toContain("Exercise 1 of 1");
  fireEvent(window, new Event("afterprint"));
});
