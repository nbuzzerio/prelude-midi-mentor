import { StrictMode, forwardRef, useEffect, useImperativeHandle } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FakeImprovIndexedDb } from "../../improv/persistence/improv-indexeddb-fake";
import { IndexedDbPracticeAttempts } from "../persistence/practice-attempt-indexeddb";
import { PracticeProgramExecutor } from "../practice-program-executor";
import { testProgram, testOwnership } from "../practice-program-test-fixtures";
import PracticeProgramPractice from "./practice-program-practice";
import PracticeProgramLesson from "./practice-program-lesson";
import { appendFlashcardCompletedTarget, createFlashcardPracticeResult } from "@/features/flashcards/flashcard-practice-result";
import type { PracticeSessionEngineResult } from "../practice-session-engine-result";

type Props = { hostedStart?: boolean; onPracticeUnitCompleted?: () => void; onPracticeTargetReached?: () => void; onScaleRepertoireCompleted?: () => void; onPracticeActivityChange?: (available: boolean) => void; onPracticeResultChange?: (result: PracticeSessionEngineResult) => void };
function Native(props: Props) {
  const { onPracticeActivityChange } = props;
  useEffect(() => { onPracticeActivityChange?.(true); return () => onPracticeActivityChange?.(false); }, [onPracticeActivityChange]);
  return <div data-testid="native" data-start={String(props.hostedStart)}><button onClick={props.onPracticeUnitCompleted}>unit</button><button onClick={props.onPracticeTargetReached ?? props.onScaleRepertoireCompleted}>target</button><button onClick={() => props.onPracticeResultChange?.(appendFlashcardCompletedTarget(createFlashcardPracticeResult(), { target: { id: "fixture", kind: "note", clef: "treble", name: { primary: "C" }, expectedPitches: [{ midiNumber: 60, name: "C", octave: 4 }] }, source: "simulation", submittedMidiNumbers: [60], responseDurationMs: 2100 }))}>native evidence</button></div>;
}
vi.mock("@/features/flashcards/components/flashcard-session", () => ({ default: Native }));
vi.mock("@/features/sequences/components/sequence-session", () => ({ default: Native }));
vi.mock("@/features/ear-training/components/ear-training-session", () => ({ default: Native }));
vi.mock("@/features/melody/components/melody-session", () => ({ default: forwardRef(function Melody(props: Props, ref) { useImperativeHandle(ref, () => ({ continuePractice: () => true })); return <Native {...props} />; }) }));
let fake: FakeImprovIndexedDb, original: PropertyDescriptor | undefined, visibility: PropertyDescriptor | undefined;
beforeEach(async () => {
  visibility = Object.getOwnPropertyDescriptor(document, "visibilityState"); Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  fake = new FakeImprovIndexedDb(); original = Object.getOwnPropertyDescriptor(globalThis, "indexedDB"); Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: fake.factory });
  const initial = new IndexedDbPracticeAttempts(fake.factory); await initial.list(testProgram().programId); initial.close();
});
afterEach(async () => { cleanup(); await Promise.resolve(); vi.restoreAllMocks(); vi.useRealTimers(); if (original) Object.defineProperty(globalThis, "indexedDB", original); else Reflect.deleteProperty(globalThis, "indexedDB"); if (visibility) Object.defineProperty(document, "visibilityState", visibility); else Reflect.deleteProperty(document, "visibilityState"); });
function fixture(ids = ["exercise-0", "exercise-2", "exercise-8"], initiallyActive = true, clockNow?: () => number) {
  const program = testProgram(), executor = new PracticeProgramExecutor(program, { ownership: testOwnership(), clockNow }), close = vi.fn();
  const tree = (active = initiallyActive) => <StrictMode><PracticeProgramPractice active={active} createExecutor={() => executor} morningSelection={ids} onBusyChange={vi.fn()} onClose={close} program={program} /></StrictMode>;
  const view = render(tree());
  return { executor, view, tree, close };
}
const rows = () => new IndexedDbPracticeAttempts(fake.factory).list(testProgram().programId);
async function complete() { fireEvent.click(screen.getByRole("button", { name: "unit" })); await waitFor(() => expect((screen.getByRole("button", { name: "Next Exercise" }) as HTMLButtonElement).disabled).toBe(false)); }

it("presents acknowledged native feedback at target completion and retains it after moving on", async () => {
  fixture(); await screen.findByTestId("native"); fireEvent.click(screen.getByRole("button", { name: "native evidence" })); await complete();
  const feedback = screen.getByLabelText("Exercise teaching feedback");
  expect(within(feedback).getByText("1 of 1 completed targets were correct on the first attempt.")).toBeTruthy();
  expect(within(feedback).getByText("Average completed-target response: 2.1 seconds.")).toBeTruthy();
  expect(within(feedback).getByText("Recorded answer sources: simulation.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Next Exercise" })); await screen.findByText(/Exercise 2 of 3/);
  fireEvent.click(screen.getByRole("button", { name: "Finish Lesson early" })); await screen.findByText("Lesson finished");
  const summary = screen.getByLabelText("Lesson teaching summary");
  expect(within(summary).getByText("1 completed · 1 stopped early · 1 unperformed")).toBeTruthy();
  expect(within(summary).getByText("Note Recognition (prescribed target): 1 of 1 completed targets were correct on the first attempt.")).toBeTruthy();
  fireEvent.click(screen.getByText("Exercise results and native reports"));
  expect(within(summary).getByText("1 of 1 completed targets were correct on the first attempt.")).toBeTruthy();
});

it("retains failed skip evidence as pending until Retry acknowledges the explicit skip", async () => {
  const f = fixture(); await screen.findByTestId("native"); await complete();
  act(() => f.executor.stop()); await screen.findByText("Saved attempt: completed.");
  fake.commitError = "QuotaExceededError"; fireEvent.click(screen.getByRole("button", { name: /^Skip Exercise:/ }));
  await screen.findByRole("alert");
  expect(f.executor.getSnapshot().acknowledged.some(entry => entry.record.kind === "skip")).toBe(false);
  expect((screen.getByRole("button", { name: "Return" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Retry saving" }));
  await waitFor(() => expect(screen.getByText(/Exercise 3 of 3/)).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Finish Lesson early" })); await screen.findByText("Lesson finished");
  expect(screen.getByText("1 completed · 1 deliberately skipped · 1 unperformed")).toBeTruthy();
});

it("retains an inactive initial launch until activation and starts once under Strict Mode", async () => {
  const f = fixture(undefined, false); expect(await rows()).toEqual([]); expect(screen.queryByTestId("native")).toBeNull();
  f.view.rerender(f.tree(true)); await screen.findByTestId("native"); expect(await rows()).toHaveLength(1);
  expect(screen.getByText(/Exercise 1 of 3/)).toBeTruthy(); expect(screen.queryByText(/Exercise 1 of 1/)).toBeNull();
});
it("uses one Next per authored selection, hosted starts on each engine and a deliberate final Finish", async () => {
  const f = fixture(); await screen.findByTestId("native"); await complete();
  fireEvent.click(screen.getByRole("button", { name: "Next Exercise" })); await waitFor(() => expect(screen.getByText(/Exercise 2 of 3/)).toBeTruthy());
  expect(screen.queryByRole("button", { name: "Start selected exercise" })).toBeNull();
  await complete();
  fireEvent.click(screen.getByRole("button", { name: "Next Exercise" })); await waitFor(() => expect(screen.getByText(/Exercise 3 of 3/)).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "target" }));
  await waitFor(() => expect(f.executor.getSnapshot().saving).toBe(false));
  fireEvent.click(screen.getAllByRole("button", { name: "Finish Lesson" })[0]!); await screen.findByText("Lesson finished");
  expect((await rows()).map(row => row.exerciseId).sort()).toEqual(["exercise-0", "exercise-2", "exercise-8"]);
  expect((await rows()).every(row => row.kind === "attempt" && row.closed && row.outcome === "completed")).toBe(true);
});
it("holds progression until terminal acknowledgement, fencing rapid Next and pending starts", async () => {
  const f = fixture(); await screen.findByTestId("native"); await complete();
  const hold = fake.holdNextCommit(), next = screen.getByRole("button", { name: "Next Exercise" });
  fireEvent.click(next); fireEvent.click(next); await waitFor(() => expect(hold.ready()).toBe(true));
  expect(screen.queryByTestId("native")).toBeNull(); expect(f.executor.getSnapshot().index).toBe(0);
  await act(async () => hold.release()); await screen.findByTestId("native"); expect(await rows()).toHaveLength(2);
});
it("retains failed saves until explicit Retry without starting the next engine", async () => {
  const f = fixture(); await screen.findByTestId("native"); await complete(); fake.commitError = "QuotaExceededError";
  fireEvent.click(screen.getByRole("button", { name: "Next Exercise" })); await screen.findByRole("alert"); expect(f.executor.getSnapshot().index).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "Retry saving" })); await screen.findByText(/Saved attempt: completed/);
  expect(screen.queryByTestId("native")).toBeNull(); fireEvent.click(screen.getByRole("button", { name: "Next Exercise" })); await screen.findByTestId("native");
  expect(await rows()).toHaveLength(2);
});
it("Finish stops a performed attempt without marking remaining selections skipped or failed", async () => {
  fixture(); await screen.findByTestId("native"); fireEvent.click(screen.getByRole("button", { name: "Finish Lesson early" }));
  await screen.findByText("Lesson finished"); expect(await rows()).toEqual([expect.objectContaining({ exerciseId: "exercise-0", outcome: "stopped-early", closed: true })]);
});
it("Finish during an unacknowledged start never mounts an engine or loses the acknowledged start", async () => {
  const hold = fake.holdNextCommit(), f = fixture(); await waitFor(() => expect(hold.ready()).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: "Finish Lesson early" })); expect(screen.queryByTestId("native")).toBeNull();
  expect(screen.getByText("Finishing lesson")).toBeTruthy(); expect(screen.queryByText("Lesson finished")).toBeNull();
  expect(screen.queryByText(/Saved attempt:|Your acknowledged attempts are saved/)).toBeNull();
  const back = screen.getByRole("button", { name: "Return" }) as HTMLButtonElement;
  expect(back.disabled).toBe(true); fireEvent.click(back); expect(f.close).not.toHaveBeenCalled();
  await act(async () => hold.release()); await screen.findByText("Lesson finished"); expect(screen.queryByTestId("native")).toBeNull();
  expect(screen.getByText("Unperformed exercises remain unperformed.")).toBeTruthy();
  expect(screen.queryByText("Your acknowledged attempts are saved. Unperformed exercises remain unperformed.")).toBeNull();
  expect(await rows()).toEqual([expect.objectContaining({ closed: true, outcome: "interrupted", prescribedUnits: 0 })]);
});
it("keeps Finish pending after a failed terminal save and returns only after successful Retry", async () => {
  const f = fixture(); await screen.findByTestId("native"); const attemptId = f.executor.getSnapshot().record!.attemptId;
  fake.commitError = "QuotaExceededError"; fireEvent.click(screen.getByRole("button", { name: "Finish Lesson early" }));
  await screen.findByRole("alert");
  expect(screen.getByText("Finishing lesson")).toBeTruthy(); expect(screen.queryByText("Lesson finished")).toBeNull();
  expect(screen.queryByText(/Saved attempt:|Your acknowledged attempts are saved/)).toBeNull();
  const back = screen.getByRole("button", { name: "Return" }) as HTMLButtonElement;
  expect(back.disabled).toBe(true); fireEvent.click(back); expect(f.close).not.toHaveBeenCalled();
  expect(f.executor.getSnapshot().record?.attemptId).toBe(attemptId); expect(f.executor.getSnapshot().durable?.closed).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Retry saving" })); await screen.findByText("Lesson finished");
  expect(screen.getByText("Saved attempt: stopped-early.")).toBeTruthy(); expect(screen.queryByRole("alert")).toBeNull();
  expect(await rows()).toEqual([expect.objectContaining({ attemptId, closed: true, outcome: "stopped-early" })]);
  expect((screen.getByRole("button", { name: "Return" }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Return" })); expect(f.close).toHaveBeenCalledTimes(1);
});
it("does not announce successful Finish or enable Return while a terminal acknowledgement is pending", async () => {
  const f = fixture(); await screen.findByTestId("native"); const hold = fake.holdNextCommit();
  fireEvent.click(screen.getByRole("button", { name: "Finish Lesson early" })); await waitFor(() => expect(hold.ready()).toBe(true));
  expect(screen.getByText("Finishing lesson")).toBeTruthy(); expect(screen.queryByText("Lesson finished")).toBeNull();
  expect(screen.queryByText(/Saved attempt:|Your acknowledged attempts are saved/)).toBeNull();
  expect((screen.getByRole("button", { name: "Return" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Return" })); expect(f.close).not.toHaveBeenCalled();
  expect(f.executor.getSnapshot().durable?.closed).toBe(false);
  await act(async () => hold.release()); await screen.findByText("Lesson finished");
  expect(screen.getByText("Saved attempt: stopped-early.")).toBeTruthy(); expect(f.executor.getSnapshot().durable?.closed).toBe(true);
});
it("uses neutral Finish wording when no exercise has been performed", async () => {
  fixture([]); fireEvent.click(screen.getByRole("button", { name: "Finish Lesson early" }));
  await screen.findByText("Lesson finished"); expect(screen.getByText("Unperformed exercises remain unperformed.")).toBeTruthy();
  expect(screen.queryByText(/Saved attempt:|Your acknowledged attempts are saved/)).toBeNull(); expect(await rows()).toEqual([]);
});
it("retains Finish intent and Retry when the pending start acknowledgement fails", async () => {
  const hold = fake.holdNextCommit(), f = fixture(); await waitFor(() => expect(hold.ready()).toBe(true));
  const attemptId = f.executor.getSnapshot().record!.attemptId;
  fireEvent.click(screen.getByRole("button", { name: "Finish Lesson early" })); fake.commitError = "QuotaExceededError";
  await act(async () => hold.release()); await screen.findByRole("alert");
  expect(screen.getByText("Finishing lesson")).toBeTruthy(); expect(screen.queryByText("Lesson finished")).toBeNull();
  expect(screen.queryByText(/Saved attempt:|Your acknowledged attempts are saved/)).toBeNull(); expect(screen.queryByTestId("native")).toBeNull();
  expect((screen.getByRole("button", { name: "Return" }) as HTMLButtonElement).disabled).toBe(true);
  expect(f.executor.getSnapshot().durable).toBeNull(); fireEvent.click(screen.getByRole("button", { name: "Retry saving" }));
  await screen.findByText("Lesson finished"); expect(screen.queryByTestId("native")).toBeNull();
  expect(await rows()).toEqual([expect.objectContaining({ attemptId, closed: true, prescribedUnits: 0 })]); expect(f.close).not.toHaveBeenCalled();
});
it.each(["error", "write", "evidence"] as const)("keeps an exhausted selection view truthful with unresolved %s", async pending => {
  const program = testProgram(), executor = new PracticeProgramExecutor(program, { ownership: testOwnership() });
  executor.select(["exercise-0"]); await executor.start(); executor.stop();
  await waitFor(() => expect(executor.getSnapshot().durable?.closed).toBe(true));
  const saved = executor.getSnapshot(), close = vi.fn();
  const state = { ...saved, index: saved.queue.length, ...(pending === "error" ? { error: "Pending evidence" } : pending === "write" ? { saving: true } : { durable: null }) };
  render(<PracticeProgramLesson active executor={executor} onClose={close} program={program} state={state} />);
  expect(screen.getByText("Finishing lesson")).toBeTruthy(); expect(screen.queryByText("Lesson finished")).toBeNull();
  expect(screen.queryByText(/Saved attempt:|Your acknowledged attempts are saved/)).toBeNull();
  expect((screen.getByRole("button", { name: "Return" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Return" })); expect(close).not.toHaveBeenCalled(); expect(executor.getSnapshot().queue).toHaveLength(1);
});
it("Finish cancels a pending Next after preserving the previous terminal acknowledgement", async () => {
  fixture(); await screen.findByTestId("native"); await complete(); const hold = fake.holdNextCommit();
  fireEvent.click(screen.getByRole("button", { name: "Next Exercise" })); await waitFor(() => expect(hold.ready()).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: "Finish Lesson early" })); await act(async () => hold.release());
  await screen.findByText("Lesson finished"); expect(await rows()).toEqual([expect.objectContaining({ exerciseId: "exercise-0", outcome: "completed", closed: true })]);
});
it("keeps Bonus in place and creates only one Repeat occurrence from rapid clicks", async () => {
  fixture(); await screen.findByTestId("native"); const first = screen.getByTestId("native"); await complete();
  fireEvent.click(screen.getByRole("button", { name: "Keep Playing" })); expect(screen.getByTestId("native")).toBe(first);
  fireEvent.click(screen.getByRole("button", { name: "unit" })); await waitFor(() => expect((screen.getByRole("button", { name: "Repeat Exercise" }) as HTMLButtonElement).disabled).toBe(false));
  const repeat = screen.getByRole("button", { name: "Repeat Exercise" }); fireEvent.click(repeat); fireEvent.click(repeat);
  await waitFor(() => expect(screen.getByText(/Exercise 2 of 4/)).toBeTruthy()); expect(screen.getByTestId("native")).not.toBe(first);
  const records = await rows(); expect(records).toHaveLength(2); expect(records).toEqual(expect.arrayContaining([expect.objectContaining({ bonusUnits: 1, closed: true })]));
});
it("records a deliberate preview Skip, with no attempt for the skipped selection", async () => {
  fixture(); await screen.findByTestId("native"); await complete();
  fireEvent.click(screen.getByRole("button", { name: /^Skip Exercise:/ }));
  await waitFor(() => expect(screen.getByText(/Exercise 3 of 3/)).toBeTruthy()); expect(screen.queryByTestId("native")).toBeNull();
  expect(await rows()).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "skip", exerciseId: "exercise-2" })]));
  fireEvent.click(screen.getByRole("button", { name: "Finish Lesson early" })); await screen.findByText("Lesson finished"); expect(await rows()).toHaveLength(2);
});
it("offers a soft ten-minute message without stopping or completing the current attempt", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  let clock = 0; const f = fixture(undefined, true, () => clock); await screen.findByTestId("native");
  await act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });
  act(() => { clock = 600001; vi.advanceTimersByTime(1000); });
  expect(screen.getByText("You've reached today's planned practice time. Finish when ready.")).toBeTruthy();
  expect(f.executor.getSnapshot().run?.status).toBe("active"); expect(f.executor.getSnapshot().record?.closed).toBe(false);
  expect(screen.getByRole("button", { name: "Stop Exercise" })).toBeTruthy();
});
