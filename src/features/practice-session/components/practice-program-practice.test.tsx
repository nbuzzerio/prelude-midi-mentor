import { StrictMode, forwardRef, useImperativeHandle } from "react";
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeImprovIndexedDb } from "../../improv/persistence/improv-indexeddb-fake";
import { IndexedDbPracticeAttempts } from "../persistence/practice-attempt-indexeddb";
import { PracticeProgramExecutor } from "../practice-program-executor";
import { testProgram, testOwnership, testConcepts } from "../practice-program-test-fixtures";
import PracticeProgramPractice from "./practice-program-practice";
import { AppMidiContext, type AppMidiContextValue } from "@/components/midi/midi-context";
const observed = vi.hoisted(() => ({ props: [] as { onPracticeUnitCompleted?: () => void; onPracticeTargetReached?: () => void; onScaleRepertoireCompleted?: () => void; initialConfig: unknown }[] }));
type Props = (typeof observed.props)[number];
function Native(props: Props) { observed.props.push(props); return <div data-testid="native" data-config={JSON.stringify(props.initialConfig)}><button onClick={props.onPracticeUnitCompleted}>native unit</button><button onClick={props.onPracticeTargetReached ?? props.onScaleRepertoireCompleted}>native marker</button></div>; }
vi.mock("@/features/flashcards/components/flashcard-session", () => ({ default: (props: Props) => <Native {...props} /> }));
vi.mock("@/features/sequences/components/sequence-session", () => ({ default: (props: Props) => <Native {...props} /> }));
vi.mock("@/features/ear-training/components/ear-training-session", () => ({ default: (props: Props) => <Native {...props} /> }));
vi.mock("@/features/melody/components/melody-session", () => ({ default: forwardRef(function Melody(props: Props, ref) { useImperativeHandle(ref, () => ({ continuePractice: () => true })); return <Native {...props} />; }) }));
let fake: FakeImprovIndexedDb, original: PropertyDescriptor | undefined;
beforeEach(async () => { fake = new FakeImprovIndexedDb(); original = Object.getOwnPropertyDescriptor(globalThis, "indexedDB"); Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: fake.factory }); observed.props.length = 0;
  // The existing fake does not model aborted schema upgrades; real Chrome covers fresh Strict Mode opening.
  const initial = new IndexedDbPracticeAttempts(fake.factory); await initial.list(testProgram().programId); initial.close();
});
afterEach(async () => { cleanup(); await Promise.resolve(); vi.restoreAllMocks(); if (original) Object.defineProperty(globalThis, "indexedDB", original); else Reflect.deleteProperty(globalThis, "indexedDB"); });
const createExecutor = (program: ReturnType<typeof testProgram>) => new PracticeProgramExecutor(program, { ownership: testOwnership() });
async function start(index = 0) { fireEvent.click(screen.getByRole("checkbox", { name: testProgram().program.exercises[index]!.label })); fireEvent.click(screen.getByRole("button", { name: "Prepare selected exercises" })); fireEvent.click(screen.getByRole("button", { name: "Start selected exercise" })); await screen.findByTestId("native"); }
const mount = (active = true) => render(<PracticeProgramPractice active={active} createExecutor={createExecutor} onBusyChange={vi.fn()} onClose={vi.fn()} program={testProgram()} />);
describe("weekly daily selection and native attempts", () => {
  it("retains explicit keyboard choice across native attempts in one manual queue", async () => {
    const value: AppMidiContextValue = { status: "connected", deviceName: "QA piano", error: null, connectedInputs: [], connectMidi: vi.fn(async () => undefined), registerConsumer: vi.fn(() => () => undefined) };
    render(<AppMidiContext.Provider value={value}><PracticeProgramPractice active createExecutor={createExecutor} onBusyChange={vi.fn()} onClose={vi.fn()} program={testProgram()} /></AppMidiContext.Provider>);
    for (const index of [0, 1]) fireEvent.click(screen.getByRole("checkbox", { name: testProgram().program.exercises[index]!.label }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare selected exercises" }));
    fireEvent.click(screen.getByRole("button", { name: "Start selected exercise" }));
    const first = await screen.findByTestId("native");
    fireEvent.click(screen.getByRole("button", { name: "Show Keyboard" }));
    fireEvent.click(screen.getByRole("button", { name: "native unit" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Next Exercise" })).toHaveProperty("disabled", false));
    fireEvent.click(screen.getByRole("button", { name: "Next Exercise" }));
    await waitFor(() => expect(screen.getByTestId("native")).not.toBe(first));
    expect(screen.getByRole("button", { name: "Hide Keyboard" })).toBeTruthy();
  });
  it("keeps three selected exercises and advances once per explicit Next through all three", async () => {
    let executor!: PracticeProgramExecutor;
    const program = testProgram(); render(<PracticeProgramPractice active createExecutor={p => (executor = createExecutor(p))} onBusyChange={vi.fn()} onClose={vi.fn()} program={program} />);
    for (const index of [0, 1, 2]) fireEvent.click(screen.getByRole("checkbox", { name: program.program.exercises[index]!.label }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare selected exercises" }));
    expect(executor.getSnapshot().queue.map(row => row.exerciseId)).toEqual(["exercise-0", "exercise-1", "exercise-2"]);
    fireEvent.click(screen.getByRole("button", { name: "Start selected exercise" })); await screen.findByTestId("native");
    expect(screen.getByText(/Exercise 1 of 3/)).toBeTruthy(); expect(screen.queryByText(/Exercise 1 of 1/)).toBeNull();
    expect(screen.getByText(`Up next: ${program.nativeExercises[1]!.label}`)).toBeTruthy();
    for (const index of [0, 1]) {
      fireEvent.click(screen.getByRole("button", { name: "native unit" }));
      const next = await screen.findByRole("button", { name: "Next Exercise" });
      await waitFor(() => expect((next as HTMLButtonElement).disabled).toBe(false));
      expect(next.textContent).toContain(program.nativeExercises[index + 1]!.label);
      await waitFor(() => expect(document.activeElement).toBe(next));
      const hold = fake.holdNextCommit(); fireEvent.click(next); fireEvent.click(next);
      await waitFor(() => expect(hold.ready()).toBe(true)); expect(screen.queryByTestId("native")).toBeNull();
      await act(async () => hold.release()); await screen.findByTestId("native");
      expect(executor.getSnapshot().index).toBe(index + 1);
      expect(await new IndexedDbPracticeAttempts(fake.factory).list(program.programId)).toHaveLength(index + 2);
    }
    fireEvent.click(screen.getByRole("button", { name: "native unit" }));
    const finish = await screen.findByRole("button", { name: "Finish practice" });
    await waitFor(() => expect((finish as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole("button", { name: "Next Exercise" })).toBeNull(); fireEvent.click(finish);
    await screen.findByText("Manual practice finished");
    expect((await new IndexedDbPracticeAttempts(fake.factory).list(program.programId)).every(row => row.kind === "attempt" && row.closed && row.outcome === "completed")).toBe(true);
  });
  it("holds manual Next on failed terminal evidence and Retry does not silently advance", async () => {
    let executor!: PracticeProgramExecutor; const program = testProgram();
    render(<PracticeProgramPractice active createExecutor={p => (executor = createExecutor(p))} onBusyChange={vi.fn()} onClose={vi.fn()} program={program} />);
    for (const index of [0, 1, 2]) fireEvent.click(screen.getByRole("checkbox", { name: program.program.exercises[index]!.label }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare selected exercises" })); fireEvent.click(screen.getByRole("button", { name: "Start selected exercise" })); await screen.findByTestId("native");
    fireEvent.click(screen.getByRole("button", { name: "native unit" })); await waitFor(() => expect(executor.getSnapshot().saving).toBe(false));
    fake.commitError = "QuotaExceededError"; fireEvent.click(screen.getByRole("button", { name: "Next Exercise" })); await screen.findByRole("alert");
    expect(executor.getSnapshot().index).toBe(0); expect((screen.getByRole("button", { name: "Next Exercise" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry saving" })); await waitFor(() => expect(executor.getSnapshot().durable?.closed).toBe(true));
    expect(executor.getSnapshot().index).toBe(0); fireEvent.click(screen.getByRole("button", { name: "Next Exercise" })); await screen.findByTestId("native"); expect(executor.getSnapshot().index).toBe(1);
  });
  it("offers Finish rather than Next for one selected exercise", async () => {
    mount(); await start(); fireEvent.click(screen.getByRole("button", { name: "native unit" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Finish practice" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole("button", { name: "Next Exercise" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Finish practice" })); await screen.findByText("Manual practice finished");
  });
  it("rejects empty selection and permits ordered off-rotation subsets", async () => {
    mount(); expect((screen.getByRole("button", { name: "Prepare selected exercises" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: testProgram().program.exercises[2]!.label })); fireEvent.click(screen.getByRole("checkbox", { name: testProgram().program.exercises[0]!.label }));
    fireEvent.click(screen.getByRole("button", { name: "Move exercise-0 earlier" })); fireEvent.click(screen.getByRole("button", { name: "Prepare selected exercises" })); expect(screen.getByText(/Selection 1 of 2/).textContent).toContain(testProgram().program.exercises[0]!.label);
    expect(await new IndexedDbPracticeAttempts(fake.factory).list(testProgram().programId)).toEqual([]);
  });
  it("prefills only advisory rotation references and still permits arbitrary changes", () => {
    const today = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][new Date().getDay()] as "monday";
    const source = testProgram(), program = { ...source, program: { ...source.program, suggestedRotation: [{ day: today, exerciseIds: ["exercise-2"] }] } };
    render(<PracticeProgramPractice active createExecutor={createExecutor} onBusyChange={vi.fn()} onClose={vi.fn()} program={program} />);
    fireEvent.click(screen.getByRole("button", { name: "Use today's suggested rotation" })); expect((screen.getByRole("checkbox", { name: source.program.exercises[2]!.label }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: source.program.exercises[0]!.label })); expect((screen.getByRole("checkbox", { name: source.program.exercises[0]!.label }) as HTMLInputElement).checked).toBe(true);
  });
  it.each(testConcepts.map((concept, index) => [concept.type, index] as const))("hosts %s with the exact saved native configuration", async (_, index) => {
    mount(); await start(index); expect(JSON.parse(screen.getByTestId("native").getAttribute("data-config")!)).toEqual(testProgram().nativeExercises[index]!.config);
    fireEvent.click(screen.getByRole("button", { name: "Stop Exercise" })); await screen.findByText(/Saved attempt: stopped-early/);
  });
  it("creates a fresh keyed Repeat while Bonus keeps the same attempt and ignores stale callbacks", async () => {
    mount(); await start(); const first = screen.getByTestId("native"), stale = observed.props.at(-1)!;
    fireEvent.click(screen.getByRole("button", { name: "native unit" })); await waitFor(() => expect((screen.getByRole("button", { name: "Keep Playing" }) as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(screen.getByRole("button", { name: "Keep Playing" })); expect(screen.getByTestId("native")).toBe(first);
    fireEvent.click(screen.getByRole("button", { name: "native unit" })); fireEvent.click(screen.getByRole("button", { name: "Stop Exercise" })); await screen.findByText(/Saved attempt: completed/);
    fireEvent.click(screen.getByRole("button", { name: "Repeat Exercise" })); await screen.findByTestId("native"); expect(screen.getByTestId("native")).not.toBe(first);
    act(() => stale.onPracticeUnitCompleted?.()); expect(screen.queryByRole("dialog", { name: "Practice Complete" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Stop Exercise" })); await screen.findByText(/Saved attempt: stopped-early/);
    const rows = await new IndexedDbPracticeAttempts(fake.factory).list(testProgram().programId); expect(rows).toHaveLength(2); expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "attempt", bonusUnits: 1 })]));
  });
  it("records a deliberate skip separately without creating a performed attempt", async () => {
    mount(); fireEvent.click(screen.getByRole("checkbox", { name: testProgram().program.exercises[0]!.label })); fireEvent.click(screen.getByRole("button", { name: "Prepare selected exercises" })); fireEvent.click(screen.getByRole("button", { name: "Skip this selection" }));
    await waitFor(() => expect(screen.getByText(/Queue finished/)).toBeTruthy()); const rows = await new IndexedDbPracticeAttempts(fake.factory).list(testProgram().programId); expect(rows).toHaveLength(1); expect(rows[0]?.kind).toBe("skip"); expect(screen.queryByTestId("native")).toBeNull();
  });
  it("edits prepared ordering before launch and reports only actual native input activity", async () => {
    const input = vi.fn(); render(<PracticeProgramPractice active createExecutor={createExecutor} onBusyChange={vi.fn()} onInputChange={input} onClose={vi.fn()} program={testProgram()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: testProgram().program.exercises[0]!.label })); fireEvent.click(screen.getByRole("button", { name: "Prepare selected exercises" }));
    expect(input).not.toHaveBeenCalledWith(true); fireEvent.click(screen.getByRole("button", { name: "Edit selection" })); expect((screen.getByRole("checkbox", { name: testProgram().program.exercises[0]!.label }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Prepare selected exercises" })); fireEvent.click(screen.getByRole("button", { name: "Start selected exercise" })); await screen.findByTestId("native"); expect(input).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Stop Exercise" })); await screen.findByText(/Saved attempt: stopped-early/); expect(input).toHaveBeenLastCalledWith(false);
  });
  it("preserves pending failed results across hidden navigation and allows retry", async () => {
    const program = testProgram(), props = { createExecutor, onBusyChange: vi.fn(), onClose: vi.fn(), program }; const view = render(<PracticeProgramPractice active {...props} />); await start();
    fake.commitError = "QuotaExceededError"; fireEvent.click(screen.getByRole("button", { name: "Stop Exercise" })); await screen.findByRole("alert");
    expect((screen.getByRole("button", { name: "Return to exercise pool" }) as HTMLButtonElement).disabled).toBe(true); view.rerender(<PracticeProgramPractice active={false} {...props} />); view.rerender(<PracticeProgramPractice active {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry saving" })); await screen.findByText(/Saved attempt: stopped-early/);
  });
  it("interrupts navigation and Strict Mode/unmount without restarting any native engine", async () => {
    const program = testProgram(), props = { createExecutor, onBusyChange: vi.fn(), onClose: vi.fn(), program }; const view = render(<StrictMode><PracticeProgramPractice active {...props} /></StrictMode>); await start();
    view.rerender(<StrictMode><PracticeProgramPractice active={false} {...props} /></StrictMode>); await screen.findByText(/Saved attempt: interrupted/); expect(screen.queryByTestId("native")).toBeNull();
    view.rerender(<StrictMode><PracticeProgramPractice active {...props} /></StrictMode>); expect(screen.queryByTestId("native")).toBeNull();
  });
});
