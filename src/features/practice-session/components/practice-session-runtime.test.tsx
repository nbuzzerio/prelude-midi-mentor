import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { forwardRef, useImperativeHandle, useReducer } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PRACTICE_SESSION_BUILDER_OPTIONS } from "../practice-session-builder-options";
import { practiceSessionRunReducer, type ActivePracticeSessionRun, type PracticeSessionRunSnapshot } from "../practice-session-runtime";
import type { PracticeExerciseEntry } from "../practice-session-types";
import { PracticeSessionRuntime, PracticeSessionSummary } from "./practice-session-runtime";

const observed = vi.hoisted(() => ({ melodyContinue: vi.fn(() => true), props: new Map<string, unknown>() }));

vi.mock("@/features/flashcards/components/flashcard-session", () => ({ default: (props: { onPracticeUnitCompleted?: () => void; initialConfig: unknown; hostedMobilePlay?: { active: boolean } }) => { observed.props.set("flashcards", props); return <div data-config={JSON.stringify(props.initialConfig)} data-hosted-active={String(props.hostedMobilePlay?.active)} data-testid="flashcards"><button onClick={props.onPracticeUnitCompleted}>unit</button></div>; } }));
vi.mock("@/features/sequences/components/sequence-session", () => ({ default: (props: { onPracticeUnitCompleted?: () => void; onScaleRepertoireCompleted?: () => void; initialConfig: unknown; hostedMobilePlay?: { active: boolean } }) => { observed.props.set("sequences", props); return <div data-config={JSON.stringify(props.initialConfig)} data-hosted-active={String(props.hostedMobilePlay?.active)} data-testid="sequences"><button onClick={props.onPracticeUnitCompleted}>unit</button><button onClick={props.onScaleRepertoireCompleted}>repertoire</button></div>; } }));
vi.mock("@/features/ear-training/components/ear-training-session", () => ({ default: (props: { onPracticeUnitCompleted?: () => void; initialConfig: unknown; hostedMobilePlay?: { active: boolean } }) => { observed.props.set("ear-training", props); return <div data-config={JSON.stringify(props.initialConfig)} data-hosted-active={String(props.hostedMobilePlay?.active)} data-testid="ear-training"><button onClick={props.onPracticeUnitCompleted}>unit</button></div>; } }));
vi.mock("@/features/melody/components/melody-session", () => ({ default: forwardRef(function MockMelody(props: { onPracticeTargetReached?: () => void; initialConfig: unknown; hostedMobilePlay?: { active: boolean } }, ref) { observed.props.set("melody", props); useImperativeHandle(ref, () => ({ continuePractice: observed.melodyContinue })); return <div data-config={JSON.stringify(props.initialConfig)} data-hosted-active={String(props.hostedMobilePlay?.active)} data-testid="melody"><button onClick={props.onPracticeTargetReached}>target</button></div>; }) }));

afterEach(() => { cleanup(); observed.melodyContinue.mockReset(); observed.melodyContinue.mockReturnValue(true); observed.props.clear(); vi.restoreAllMocks(); Reflect.deleteProperty(document.documentElement, "requestFullscreen"); Reflect.deleteProperty(document, "exitFullscreen"); Reflect.deleteProperty(document, "fullscreenElement"); Reflect.deleteProperty(window.screen, "orientation"); });

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
  return run?.status === "active" ? <PracticeSessionRuntime createExerciseToken={() => "t2"} dispatch={dispatch} now={() => 2} run={run} /> : run?.status === "summary" ? <PracticeSessionSummary onBack={() => dispatch({ type: "CLEAR_RUN" })} run={run} /> : <p>builder</p>;
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
    observed.melodyContinue.mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<Harness exercises={[readyEntry(7, "e1")]} />);
    const engine = screen.getByTestId("melody");
    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    fireEvent.click(screen.getByRole("button", { name: "target" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep Playing" }));
    expect(screen.getByRole("status").textContent).toContain("not ready");
    fireEvent.click(screen.getByRole("button", { name: "Keep Playing" }));
    expect(screen.getByTestId("melody")).toBe(engine);
    expect(screen.getByLabelText("Active Practice Session").classList.contains("mobile-play-mode")).toBe(true);
    expect(screen.getByText("Target complete · Bonus practice")).toBeTruthy();
  });

  it("keeps hosted Mobile Play and reachable controls through Skip", () => {
    render(<Harness exercises={[readyEntry(0, "e1"), readyEntry(6, "e2")]} />);
    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip for Today" }));
    expect(screen.getByTestId("ear-training").dataset.hostedActive).toBe("true");
    expect(screen.getByRole("button", { name: "Skip for Today" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "End Session" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Exit Mobile Play" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: /Exercise 2 of 2/ }));
  });

  it("owns one Mobile Play lifecycle across all four engine transitions", async () => {
    let fullscreenElement: Element | null = null;
    const requestFullscreen = vi.fn(async () => { fullscreenElement = document.documentElement; });
    const exitFullscreen = vi.fn(async () => { fullscreenElement = null; });
    const lock = vi.fn(async () => undefined); const unlock = vi.fn();
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement });
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: requestFullscreen });
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exitFullscreen });
    Object.defineProperty(window.screen, "orientation", { configurable: true, value: { lock, unlock } });
    render(<Harness exercises={[readyEntry(0, "f"), readyEntry(2, "s"), readyEntry(6, "e"), readyEntry(7, "m"), readyEntry(0, "f2")]} />);
    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    await waitFor(() => expect(lock).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Active Practice Session").classList.contains("mobile-play-mode")).toBe(true);
    for (const testId of ["flashcards", "sequences", "ear-training"]) {
      expect(screen.getByTestId(testId).dataset.hostedActive).toBe("true");
      fireEvent.click(screen.getByRole("button", { name: "unit" }));
      fireEvent.click(screen.getByRole("button", { name: "Next Exercise" }));
    }
    expect(screen.getByTestId("melody").dataset.hostedActive).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "target" }));
    fireEvent.click(screen.getByRole("button", { name: "Next Exercise" }));
    expect(screen.getByTestId("flashcards").dataset.hostedActive).toBe("true");
    expect(requestFullscreen).toHaveBeenCalledTimes(1); expect(lock).toHaveBeenCalledTimes(1);
    expect(exitFullscreen).not.toHaveBeenCalled(); expect(unlock).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: "Exit Mobile Play" })).toHaveLength(1);
  });

  it("exits hosted Mobile Play without remounting and restores entry focus", async () => {
    render(<Harness exercises={[readyEntry(0, "e1")]} />);
    const engine = screen.getByTestId("flashcards");
    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Exit Mobile Play" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Mobile Play" })));
    expect(screen.getByTestId("flashcards")).toBe(engine);
    expect(screen.getByLabelText("Active Practice Session").classList.contains("mobile-play-mode")).toBe(false);
  });

  it.each(["End Session", "Finish Session", "Skip for Today"])("cleans up hosted Mobile Play and focuses summary after %s", async (action) => {
    let fullscreenElement: Element | null = null;
    const exitFullscreen = vi.fn(async () => { fullscreenElement = null; }); const unlock = vi.fn();
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement });
    Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: vi.fn(async () => { fullscreenElement = document.documentElement; }) });
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exitFullscreen });
    const lock = vi.fn(async () => undefined);
    Object.defineProperty(window.screen, "orientation", { configurable: true, value: { lock, unlock } });
    render(<Harness exercises={[readyEntry(0, "e1")]} />);
    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    await waitFor(() => expect(lock).toHaveBeenCalledTimes(1));
    if (action === "Finish Session") fireEvent.click(screen.getByRole("button", { name: "unit" }));
    fireEvent.click(screen.getByRole("button", { name: action }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Practice session complete" })));
    expect(screen.queryByLabelText("Active Practice Session")).toBeNull();
    expect(unlock).toHaveBeenCalledTimes(1); expect(exitFullscreen).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Back to Practice Sessions" }));
    expect(screen.getByText("builder")).toBeTruthy();
  });
});
