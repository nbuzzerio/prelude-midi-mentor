import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { useCallback, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EarTrainingSession from "./ear-training-session";

const mocks = vi.hoisted(() => ({
  cancelPrompt: vi.fn(),
  getResponseTimeMs: vi.fn(() => 1500),
  generateTarget: vi.fn(),
  playPrompt: vi.fn(),
  playIncorrectFeedback: vi.fn(),
  playSuccessChirp: vi.fn(),
  resetPrompt: vi.fn(),
}));

const TARGET = {
  direction: "ascending",
  exerciseType: "melodic-interval",
  interval: "major-third",
  notes: [{ midiNumber: 60, name: "C", octave: 4 }, { midiNumber: 64, name: "E", octave: 4 }],
} as const;

vi.mock("../generate-ear-training-target", () => ({
  generateEarTrainingTarget: () => { mocks.generateTarget(); return TARGET; },
}));
vi.mock("@/lib/audio/feedback", () => ({
  playIncorrectFeedback: mocks.playIncorrectFeedback,
  playSuccessChirp: mocks.playSuccessChirp,
}));
vi.mock("../hooks/use-ear-training-prompt", () => ({
  useEarTrainingPrompt: () => {
    const [state, setState] = useState<"ready" | "heard">("ready");
    const playPrompt = useCallback(async (target: unknown) => {
      mocks.playPrompt(target);
      setState("heard");
      return "completed";
    }, []);
    const resetPrompt = useCallback(() => {
      mocks.resetPrompt();
      setState("ready");
    }, []);
    return {
      cancelPrompt: mocks.cancelPrompt,
      getResponseTimeMs: mocks.getResponseTimeMs,
      playPrompt,
      resetPrompt,
      state,
    };
  },
}));
vi.mock("@/hooks/use-mobile-play", () => ({
  useMobilePlay: () => {
    const [isMobilePlayMode, setActive] = useState(false);
    return { enterMobilePlay: () => setActive(true), exitMobilePlay: () => setActive(false), isMobilePlayMode };
  },
}));
vi.mock("@/components/audio/feedback-volume-control", () => ({ default: () => <div>Feedback volume</div> }));
vi.mock("@/components/audio/instrument-volume-control", () => ({ default: () => <div>Instrument volume</div> }));

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

function playPrompt() {
  fireEvent.click(screen.getByRole("button", { name: "Play Prompt" }));
}

function getStat(label: string): string | null {
  return screen.getByText(label).parentElement?.querySelector("p:last-child")?.textContent ?? null;
}

describe("EarTrainingSession", () => {
  it("starts with a stable unplayed target and replays the same target", () => {
    render(<EarTrainingSession />);
    expect((screen.getByRole("button", { name: "Major third" }) as HTMLButtonElement).disabled).toBe(true);
    playPrompt();
    fireEvent.click(screen.getByRole("button", { name: "Replay Prompt" }));
    expect(mocks.playPrompt).toHaveBeenCalledTimes(2);
    expect(mocks.playPrompt.mock.calls[0]?.[0]).toBe(mocks.playPrompt.mock.calls[1]?.[0]);
    expect(mocks.generateTarget).toHaveBeenCalledTimes(1);
  });

  it("counts only the first wrong selection and withholds streak credit", () => {
    render(<EarTrainingSession />);
    playPrompt();
    fireEvent.click(screen.getByRole("button", { name: "Minor second" }));
    act(() => vi.advanceTimersByTime(250));
    fireEvent.click(screen.getByRole("button", { name: "Major second" }));
    expect(mocks.playIncorrectFeedback).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(250));
    fireEvent.click(screen.getByRole("button", { name: "Major third" }));
    expect(getStat("Accuracy")).toBe("50%");
    expect(getStat("Streak")).toBe("0");
    expect(mocks.playSuccessChirp).toHaveBeenCalledTimes(1);
  });

  it("awards streak for a clean completion and advances without autoplay", () => {
    render(<EarTrainingSession />);
    playPrompt();
    fireEvent.click(screen.getByRole("button", { name: "Major third" }));
    expect(getStat("Accuracy")).toBe("100%");
    expect(getStat("Streak")).toBe("1");
    expect(screen.getByText("Correct: ascending major third.")).toBeTruthy();
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByRole("button", { name: "Play Prompt" })).toBeTruthy();
    expect(mocks.playPrompt).toHaveBeenCalledTimes(1);
  });

  it("regenerates on accepted settings changes, preserves statistics, and reset clears them", () => {
    render(<EarTrainingSession />);
    playPrompt();
    fireEvent.click(screen.getByRole("button", { name: "Major third" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "descending" }));
    expect(getStat("Completed")).toBe("1");
    expect(screen.getByRole("button", { name: "Play Prompt" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset Session" }));
    expect(getStat("Completed")).toBe("0");
    expect(mocks.resetPrompt).toHaveBeenCalled();
  });

  it("preserves target-local and session state through Mobile Play", () => {
    render(<EarTrainingSession />);
    expect(screen.getByText("Prelude · Ear Training")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Ear Training/ })).toBeTruthy();
    playPrompt();
    fireEvent.click(screen.getByRole("button", { name: "Minor second" }));
    const entry = screen.getByRole("button", { name: "Mobile Play" });
    expect(entry.classList.contains("practice-mobile-play-entry")).toBe(true);
    fireEvent.click(entry);
    expect(screen.getByRole("button", { name: "Exit Mobile Play" })).toBeTruthy();
    expect(screen.queryByText(/Rotate your device/i)).toBeNull();
    expect((screen.getByRole("button", { name: "Minor second" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Try again.")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Ear Training settings" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Exit Mobile Play" }));
    expect(screen.getByRole("region", { name: "Ear Training settings" })).toBeTruthy();
  });

  it("cancels prompt and advancement work on unmount", () => {
    const view = render(<EarTrainingSession />);
    playPrompt();
    fireEvent.click(screen.getByRole("button", { name: "Major third" }));
    view.unmount();
    act(() => vi.runAllTimers());
    expect(mocks.cancelPrompt).toHaveBeenCalled();
    expect(mocks.generateTarget).toHaveBeenCalledTimes(1);
  });
});
