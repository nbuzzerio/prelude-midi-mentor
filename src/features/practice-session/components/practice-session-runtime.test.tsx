import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { forwardRef, useImperativeHandle, useReducer } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PRACTICE_SESSION_BUILDER_OPTIONS } from "../practice-session-builder-options";
import { practiceSessionRunReducer, type ActivePracticeSessionRun, type PracticeSessionRunSnapshot } from "../practice-session-runtime";
import type { PracticeExerciseEntry } from "../practice-session-types";
import { PracticeSessionRuntime } from "./practice-session-runtime";

const melodyContinue = vi.hoisted(() => vi.fn(() => true));

vi.mock("@/features/flashcards/components/flashcard-session", () => ({ default: (props: { onPracticeUnitCompleted?: () => void; initialConfig: unknown }) => <div data-config={JSON.stringify(props.initialConfig)} data-testid="flashcards"><button onClick={props.onPracticeUnitCompleted}>unit</button></div> }));
vi.mock("@/features/sequences/components/sequence-session", () => ({ default: (props: { onPracticeUnitCompleted?: () => void; onScaleRepertoireCompleted?: () => void; initialConfig: unknown }) => <div data-config={JSON.stringify(props.initialConfig)} data-testid="sequences"><button onClick={props.onPracticeUnitCompleted}>unit</button><button onClick={props.onScaleRepertoireCompleted}>repertoire</button></div> }));
vi.mock("@/features/ear-training/components/ear-training-session", () => ({ default: (props: { onPracticeUnitCompleted?: () => void; initialConfig: unknown }) => <div data-config={JSON.stringify(props.initialConfig)} data-testid="ear-training"><button onClick={props.onPracticeUnitCompleted}>unit</button></div> }));
vi.mock("@/features/melody/components/melody-session", () => ({ default: forwardRef(function MockMelody(props: { onPracticeTargetReached?: () => void; initialConfig: unknown }, ref) { useImperativeHandle(ref, () => ({ continuePractice: melodyContinue })); return <div data-config={JSON.stringify(props.initialConfig)} data-testid="melody"><button onClick={props.onPracticeTargetReached}>target</button></div>; }) }));

afterEach(() => { cleanup(); melodyContinue.mockReset(); melodyContinue.mockReturnValue(true); });

function readyEntry(option: number, id: string, count = 1): PracticeExerciseEntry {
  const created = PRACTICE_SESSION_BUILDER_OPTIONS[option]!.createEntry(id);
  return "count" in created.target ? { ...created, target: { ...created.target, count } } as PracticeExerciseEntry : created;
}

function initial(exercises: readonly PracticeExerciseEntry[]): ActivePracticeSessionRun {
  const snapshot: PracticeSessionRunSnapshot = { presetId: "p1", presetName: "Daily", exercises };
  return practiceSessionRunReducer(null, { type: "START_RUN", runId: "run", startedAt: 1, firstExerciseToken: "t1", snapshot }) as ActivePracticeSessionRun;
}

function Harness({ exercises }: Readonly<{ exercises: readonly PracticeExerciseEntry[] }>) {
  const [run, dispatch] = useReducer(practiceSessionRunReducer, initial(exercises));
  return run?.status === "active" ? <PracticeSessionRuntime createExerciseToken={() => "t2"} dispatch={dispatch} now={() => 2} run={run} /> : <p>summary</p>;
}

describe("Practice Session runtime", () => {
  it("mounts only the active engine with its exact config and advances immediately", () => {
    const first = readyEntry(0, "e1"); const second = readyEntry(6, "e2");
    render(<Harness exercises={[first, second]} />);
    expect(screen.getByTestId("flashcards").getAttribute("data-config")).toBe(JSON.stringify(first.config));
    expect(screen.queryByTestId("ear-training")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "unit" }));
    fireEvent.click(screen.getByRole("button", { name: "Next Exercise" }));
    expect(screen.queryByTestId("flashcards")).toBeNull();
    expect(screen.getByTestId("ear-training").getAttribute("data-config")).toBe(JSON.stringify(second.config));
  });

  it("keeps count-based Bonus mounted and uncapped", () => {
    render(<Harness exercises={[readyEntry(0, "e1")]} />);
    const engine = screen.getByTestId("flashcards");
    fireEvent.click(screen.getByRole("button", { name: "unit" }));
    fireEvent.click(screen.getByRole("button", { name: "unit" }));
    expect(screen.getByText("1 / 1 correct")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep Playing" }));
    fireEvent.click(screen.getByRole("button", { name: "unit" }));
    expect(screen.getByTestId("flashcards")).toBe(engine);
    expect(screen.getByText("2 / 1 correct")).toBeTruthy();
    expect(screen.getByText("Target complete · Bonus practice")).toBeTruthy();
  });

  it("uses repertoire completion separately from displayed scale progress", () => {
    const repertoire = { ...PRACTICE_SESSION_BUILDER_OPTIONS[3]!.createEntry("e1"), config: { ...PRACTICE_SESSION_BUILDER_OPTIONS[3]!.createEntry("e1").config, scaleRepertoire: ["c-major"] } } as PracticeExerciseEntry;
    render(<Harness exercises={[repertoire]} />);
    fireEvent.click(screen.getByRole("button", { name: "unit" }));
    expect(screen.queryByText("Practice Complete")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "repertoire" }));
    expect(screen.getByText("1 / 1 scales")).toBeTruthy();
    expect(screen.getByText("Practice Complete")).toBeTruthy();
  });

  it("continues Melody without remounting and handles a refused continuation", () => {
    melodyContinue.mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<Harness exercises={[readyEntry(7, "e1")]} />);
    const engine = screen.getByTestId("melody");
    fireEvent.click(screen.getByRole("button", { name: "target" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep Playing" }));
    expect(screen.getByRole("status").textContent).toContain("not ready");
    fireEvent.click(screen.getByRole("button", { name: "Keep Playing" }));
    expect(screen.getByTestId("melody")).toBe(engine);
    expect(screen.getByText("Target complete · Bonus practice")).toBeTruthy();
  });
});
