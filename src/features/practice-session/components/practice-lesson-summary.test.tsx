import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  expect(screen.queryByRole("button", { name: "Print Exercise Details" })).toBeNull();
  fireEvent.click(screen.getByText("Detailed native report and printing"));
  fireEvent.click(await screen.findByRole("button", { name: "Print Exercise Details" }));
  expect(screen.getByRole("dialog", { name: "Generate Report" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Generate printable report" }));
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  expect(screen.getByLabelText("Native lesson printable Practice Session report")).toBeTruthy();
  const text = screen.getByLabelText("Native lesson printable Practice Session report").textContent;
  expect(text).toContain("exercise 1 of 3. Single-attempt report only.");
  expect(text).toContain("Exercise 1 of 1");
  expect(text).toContain("Target reached — attempt still open at export");
  fireEvent(window, new Event("afterprint"));
});

it("prints only acknowledged exact queue occurrences, in order, with truthful mixed outcomes and scope", async () => {
  const completed = { ...testAttempt(), closed: true, outcome: "completed" as const, prescribedUnits: 1, bonusUnits: 2, bonusDurationMs: 2000 };
  const stopped = { ...testAttempt(1, "stopped"), closed: true, outcome: "stopped-early" as const };
  const interrupted = { ...testAttempt(2, "interrupted"), closed: true, outcome: "interrupted" as const };
  const skip = { ...testSkip(), occurrenceId: "skip-occurrence" };
  const records = [completed, stopped, interrupted, skip];
  const foreign = { ...testAttempt(0, "foreign"), closed: true, exercise: { ...completed.exercise, label: "Foreign attempt must not print" } };
  const executor = new PracticeProgramExecutor(testProgram());
  const state = { ...executor.getSnapshot(), queue: [...records, { occurrenceId: "unperformed", exerciseId: "exercise-8" }], acknowledged: [...records, foreign].map(record => ({ record, report: null })) };
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  render(<PracticeLessonSummary exercises={testProgram().nativeExercises} pending={false} programName="Exact lesson" state={state} />);
  fireEvent.click(screen.getByLabelText("Include native exercise diagnostics"));
  fireEvent.click(screen.getByRole("button", { name: "Print Lesson Summary" }));
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  const report = screen.getByLabelText("Exact lesson printable lesson summary");
  expect(report.parentElement).toBe(document.body);
  expect(within(report).getAllByRole("article")).toHaveLength(5);
  expect(report.textContent).toContain("1 completed · 1 stopped early · 1 interrupted · 1 deliberately skipped · 1 unperformed");
  expect(report.textContent).not.toContain("Foreign attempt must not print");
  expect(report.textContent).toContain("Recorded evidence (all recorded work)");
  expect(report.textContent).toContain("Bonus: 2 completed units");
  expect(report.textContent).toContain("Full native diagnostics are unavailable");
  expect(report.textContent).toContain(completed.attemptId);
  fireEvent(window, new Event("afterprint"));
  expect(screen.queryByLabelText("Exact lesson printable lesson summary")).toBeNull();
});

it("blocks summary printing during pending, failed, and unclosed evidence, then supports manual practice", () => {
  const executor = new PracticeProgramExecutor(testProgram());
  const attempt = testAttempt();
  const state = { ...executor.getSnapshot(), queue: [attempt], acknowledged: [{ record: attempt, report: null }] };
  const view = render(<PracticeLessonSummary exercises={testProgram().nativeExercises} pending state={state} />);
  expect(screen.getByRole("button", { name: "Print Lesson Summary" })).toHaveProperty("disabled", true);
  view.rerender(<PracticeLessonSummary exercises={testProgram().nativeExercises} pending={false} state={{ ...state, error: "save failed" }} />);
  expect(screen.getByRole("button", { name: "Print Lesson Summary" })).toHaveProperty("disabled", true);
  view.rerender(<PracticeLessonSummary exercises={testProgram().nativeExercises} pending={false} state={state} />);
  expect(screen.getByRole("button", { name: "Print Lesson Summary" })).toHaveProperty("disabled", true);
  view.rerender(<PracticeLessonSummary exercises={testProgram().nativeExercises} pending={false} state={{ ...state, acknowledged: [{ record: { ...attempt, closed: true }, report: null }] }} workflowLabel="Manual V2 practice" />);
  expect(screen.getByRole("button", { name: "Print Practice Summary" })).toHaveProperty("disabled", false);
  expect(screen.getByText(/After reload, only individual attempt history is available/)).toBeTruthy();
});
