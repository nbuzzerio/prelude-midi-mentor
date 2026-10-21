import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FakeImprovIndexedDb } from "../../improv/persistence/improv-indexeddb-fake";
import { IndexedDbPracticeAttempts } from "../persistence/practice-attempt-indexeddb";
import { PracticeProgramExecutor } from "../practice-program-executor";
import { testProgram, testOwnership } from "../practice-program-test-fixtures";
import { createEntry } from "../../piece-practice/rolodex/rolodex-model";
import { testScore } from "../../piece-practice/continuous/continuous-test-fixtures";
import type { RolodexStore } from "../../piece-practice/rolodex/rolodex-types";
import PracticeProgramPractice from "./practice-program-practice";

vi.mock("@/features/flashcards/components/flashcard-session", () => ({ default: (props: { onPracticeUnitCompleted: () => void }) => <button onClick={props.onPracticeUnitCompleted}>Native unit</button> }));
let fake: FakeImprovIndexedDb, original: PropertyDescriptor | undefined;
beforeEach(async () => {
  fake = new FakeImprovIndexedDb(); original = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: fake.factory });
  const store = new IndexedDbPracticeAttempts(fake.factory); await store.list(testProgram().programId); store.close();
});
afterEach(async () => {
  cleanup(); await Promise.resolve(); vi.restoreAllMocks();
  if (original) Object.defineProperty(globalThis, "indexedDB", original); else Reflect.deleteProperty(globalThis, "indexedDB");
});
function fixture(enabled = true, list: RolodexStore["list"] = async () => ({ entries: [createEntry(testScore(), "piano", 0, 1, 77)], unavailableCount: 0 })) {
  const program = testProgram(), executor = new PracticeProgramExecutor(program, { ownership: testOwnership() });
  const store = { list: vi.fn(list) };
  const tree = (active = true) => <StrictMode><PracticeProgramPractice active={active} program={program} createExecutor={() => executor} onClose={vi.fn()} onBusyChange={vi.fn()} repertoirePreference={{ enabled, instruments: ["piano"], message: "" }} repertoireStore={store} /></StrictMode>;
  const view = render(tree());
  fireEvent.click(screen.getByLabelText(program.program.exercises[0]!.label));
  fireEvent.click(screen.getByText("Prepare selected exercises"));
  return { program, executor, store, view, tree };
}
async function start() { fireEvent.click(screen.getByText("Start selected exercise")); await screen.findByText("Native unit"); }
async function complete() {
  fireEvent.click(screen.getByText("Native unit"));
  const next = await screen.findByRole("button", { name: "Next: Repertoire" });
  await waitFor(() => expect(next).toHaveProperty("disabled", false));
  return next;
}

it("does not read repertoire with the preference OFF and retains normal manual Finish", async () => {
  const f = fixture(false); await start();
  fireEvent.click(screen.getByText("Native unit"));
  const finish = await screen.findByRole("button", { name: "Finish practice" });
  await waitFor(() => expect(finish).toHaveProperty("disabled", false)); fireEvent.click(finish);
  await screen.findByText("Manual practice finished");
  expect(f.store.list).not.toHaveBeenCalled(); expect(f.executor.getSnapshot().acknowledged).toHaveLength(1);
});

it.each(["empty", "incompatible", "unavailable"])("continues fundamentals when the optional Rolodex is %s", async kind => {
  const f = fixture(true, async () => {
    if (kind === "unavailable") throw Error("unavailable");
    return { entries: kind === "empty" ? [] : [createEntry(testScore(), "violin")], unavailableCount: 0 };
  });
  await start(); expect(f.executor.getSnapshot().queue).toHaveLength(1);
  expect(screen.getByText(/fundamentals proceed normally/i)).toBeTruthy();
  fireEvent.click(screen.getByText("Native unit")); await screen.findByRole("button", { name: "Finish practice" });
  expect(screen.queryByText("Next: Repertoire")).toBeNull();
});

it("freezes at Start, preserves the authored queue and waits for terminal commit before A1 Ready", async () => {
  const entry = structuredClone(createEntry(testScore(), "piano", 0, 1, 77));
  const f = fixture(true, async () => ({ entries: [entry], unavailableCount: 0 }));
  expect(f.store.list).not.toHaveBeenCalled();
  await start();
  // Simulate an external source object changing after the acknowledged read.
  Object.assign(entry, { bpm: 89, nickname: "Changed after Start" });
  const next = await complete(), hold = fake.holdNextCommit();
  fireEvent.click(next); fireEvent.click(next);
  await waitFor(() => expect(hold.ready()).toBe(true));
  expect(screen.queryByText("Skip Repertoire")).toBeNull();
  await act(async () => hold.release());
  await screen.findByText("Skip Repertoire");
  expect(screen.getByText(/77 quarter BPM/)).toBeTruthy(); expect(screen.queryByText(/Changed after Start/)).toBeNull();
  expect(f.executor.getSnapshot().queue.map(value => value.exerciseId)).toEqual(["exercise-0"]);
  expect(f.executor.getSnapshot().durable).toBeNull();
  expect(f.store.list).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByText("Skip Repertoire"));
  await screen.findByText("Manual practice finished"); expect(screen.getByText("Deliberately skipped — no performance.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Print Practice Summary" })).toHaveProperty("disabled", false);
});

it("retains the frozen occurrence through failed fundamental closure and explicit Retry", async () => {
  const f = fixture(); await start(); const next = await complete();
  fake.commitError = "QuotaExceededError"; fireEvent.click(next); await screen.findByRole("alert");
  expect(screen.queryByText("Skip Repertoire")).toBeNull();
  fireEvent.click(screen.getByText("Retry saving"));
  await waitFor(() => expect(f.executor.getSnapshot().durable?.closed).toBe(true));
  expect(screen.queryByText("Skip Repertoire")).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Next: Repertoire" }));
  fireEvent.click(screen.getByRole("button", { name: "Next: Repertoire" })); await screen.findByText("Skip Repertoire");
  expect(f.store.list).toHaveBeenCalledOnce();
});

it("leaves repertoire unperformed when finishing fundamentals early", async () => {
  fixture(); await start(); fireEvent.click(screen.getByRole("button", { name: "Finish practice early" }));
  await screen.findByText("Manual practice finished"); expect(screen.getByText("Not performed.")).toBeTruthy();
  expect(screen.queryByText("Skip Repertoire")).toBeNull();
});

it("cancels a pending lookup on departure and ignores its stale result", async () => {
  let resolve!: (value: Awaited<ReturnType<RolodexStore["list"]>>) => void;
  const f = fixture(true, () => new Promise(done => { resolve = done; }));
  fireEvent.click(screen.getByText("Start selected exercise"));
  f.view.rerender(f.tree(false));
  await act(async () => resolve({ entries: [createEntry(testScore(), "piano")], unavailableCount: 0 }));
  expect(f.executor.getSnapshot().record).toBeNull(); expect(screen.queryByText("Native unit")).toBeNull();
});

it("does not steal entry focus when a deliberate interaction overtakes Start acknowledgement", async () => {
  fixture(false); const hold = fake.holdNextCommit(); fireEvent.click(screen.getByText("Start selected exercise"));
  await waitFor(() => expect(hold.ready()).toBe(true));
  const history = screen.getByText("History and saved weekly progress"); history.focus(); fireEvent.keyDown(history, { key: "Tab" });
  await act(async () => hold.release()); await screen.findByText("Native unit"); expect(document.activeElement).toBe(history);
});

it("focuses the new exercise once and respects intervening keyboard input while target save is pending", async () => {
  const f = fixture(); await start();
  expect(document.activeElement).toBe(screen.getByRole("heading", { name: /Exercise 1 of 1/ }));
  const hold = fake.holdNextCommit(); fireEvent.click(screen.getByText("Native unit"));
  await waitFor(() => expect(hold.ready()).toBe(true));
  const history = screen.getByText("History and saved weekly progress"); history.focus(); fireEvent.keyDown(history, { key: "Enter" });
  await act(async () => hold.release());
  await waitFor(() => expect(f.executor.getSnapshot().saving).toBe(false)); expect(document.activeElement).toBe(history);
});
