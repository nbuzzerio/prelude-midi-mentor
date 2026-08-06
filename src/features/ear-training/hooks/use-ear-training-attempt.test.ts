import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EarTrainingTarget } from "../ear-training-types";
import type { EarTrainingPromptState } from "./use-ear-training-prompt";
import { useEarTrainingAttempt } from "./use-ear-training-attempt";

const feedbackMocks = vi.hoisted(() => ({
  playIncorrectFeedback: vi.fn(),
  playSuccessChirp: vi.fn(),
}));

vi.mock("@/lib/audio/feedback", () => feedbackMocks);

const TARGET: EarTrainingTarget = {
  direction: "ascending",
  exerciseType: "melodic-interval",
  interval: "major-third",
  notes: [
    { midiNumber: 60, name: "C", octave: 4 },
    { midiNumber: 64, name: "E", octave: 4 },
  ],
};

function setup(initialPromptState: EarTrainingPromptState = "heard") {
  let locked = false;
  const dependencies = {
    cancelPrompt: vi.fn(),
    generateNextTarget: vi.fn(() => {
      locked = false;
    }),
    getCurrentTarget: vi.fn(() => TARGET),
    getResponseTimeMs: vi.fn(() => 1500),
    isTargetLocked: vi.fn(() => locked),
    lockTarget: vi.fn(() => {
      if (locked) return false;
      locked = true;
      return true;
    }),
    resetPrompt: vi.fn(),
  };
  const hook = renderHook(
    ({ promptState }: { promptState: EarTrainingPromptState }) =>
      useEarTrainingAttempt({ ...dependencies, promptState }),
    { initialProps: { promptState: initialPromptState } },
  );
  return { ...hook, dependencies };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useEarTrainingAttempt", () => {
  it("ignores answers until prompt playback has completed", () => {
    const { result, dependencies } = setup("ready");

    act(() => result.current.answer("major-third"));

    expect(dependencies.lockTarget).not.toHaveBeenCalled();
    expect(dependencies.getResponseTimeMs).not.toHaveBeenCalled();
    expect(result.current.stats.completed).toBe(0);
  });

  it("records only the first incorrect attempt while retaining distinct wrong answers", () => {
    const { result } = setup();

    act(() => result.current.answer("minor-second"));
    expect(result.current.stats.incorrectAttempts).toBe(1);
    expect(result.current.wrongAnswers).toEqual(new Set(["minor-second"]));
    expect(result.current.feedback).toBe("incorrect");
    expect(feedbackMocks.playIncorrectFeedback).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(250));
    act(() => result.current.answer("major-second"));
    expect(result.current.stats.incorrectAttempts).toBe(1);
    expect(result.current.wrongAnswers).toEqual(
      new Set(["minor-second", "major-second"]),
    );
    expect(feedbackMocks.playIncorrectFeedback).toHaveBeenCalledTimes(2);
  });

  it("ignores repeated selection of the same wrong answer", () => {
    const { result } = setup();

    act(() => result.current.answer("minor-second"));
    act(() => vi.advanceTimersByTime(250));
    act(() => result.current.answer("minor-second"));

    expect(result.current.stats.incorrectAttempts).toBe(1);
    expect(feedbackMocks.playIncorrectFeedback).toHaveBeenCalledTimes(1);
  });

  it("temporarily locks replay and answering during incorrect feedback", () => {
    const { result, dependencies } = setup();

    act(() => result.current.answer("minor-second"));
    expect(result.current.canReplay).toBe(false);
    act(() => result.current.answer("major-third"));
    expect(dependencies.lockTarget).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(249));
    expect(result.current.canReplay).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.canReplay).toBe(true);
  });

  it("completes a clean answer once, reads response time, and advances after the delay", () => {
    const { result, dependencies } = setup();

    act(() => result.current.answer("major-third"));
    act(() => result.current.answer("major-third"));

    expect(dependencies.lockTarget).toHaveBeenCalledTimes(1);
    expect(dependencies.getResponseTimeMs).toHaveBeenCalledTimes(1);
    expect(dependencies.cancelPrompt).toHaveBeenCalledTimes(1);
    expect(result.current.stats).toMatchObject({ completed: 1, streak: 1 });
    expect(result.current.feedback).toBe("correct");
    expect(feedbackMocks.playSuccessChirp).toHaveBeenCalledTimes(1);
    expect(dependencies.generateNextTarget).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(899));
    expect(dependencies.generateNextTarget).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(dependencies.generateNextTarget).toHaveBeenCalledTimes(1);
    expect(dependencies.resetPrompt).toHaveBeenCalledTimes(1);
    expect(result.current.feedback).toBe("idle");
  });

  it("withholds streak credit when a correct answer follows a mistake", () => {
    const { result } = setup();

    act(() => result.current.answer("minor-second"));
    act(() => vi.advanceTimersByTime(250));
    act(() => result.current.answer("major-third"));

    expect(result.current.stats).toMatchObject({
      completed: 1,
      incorrectAttempts: 1,
      streak: 0,
      totalResponseTimeMs: 1500,
    });
  });

  it("prepares a new target while preserving statistics and cancelling incorrect feedback", () => {
    const { result, dependencies } = setup();

    act(() => result.current.answer("minor-second"));
    act(() => result.current.prepareNextTarget());

    expect(result.current.stats.incorrectAttempts).toBe(1);
    expect(result.current.wrongAnswers.size).toBe(0);
    expect(result.current.feedback).toBe("idle");
    expect(result.current.canReplay).toBe(true);
    expect(dependencies.resetPrompt).toHaveBeenCalledTimes(1);
    expect(dependencies.generateNextTarget).toHaveBeenCalledTimes(1);
    act(() => vi.runAllTimers());
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reset clears statistics and prepares a ready target", () => {
    const { result, dependencies } = setup();

    act(() => result.current.answer("major-third"));
    act(() => result.current.resetSession());

    expect(result.current.stats).toMatchObject({
      completed: 0,
      incorrectAttempts: 0,
      streak: 0,
      totalResponseTimeMs: 0,
    });
    expect(dependencies.resetPrompt).toHaveBeenCalledTimes(1);
    expect(dependencies.generateNextTarget).toHaveBeenCalledTimes(1);
  });

  it("cancels advancement and prevents stale target generation after preparation", () => {
    const { result, dependencies } = setup();

    act(() => result.current.answer("major-third"));
    act(() => result.current.prepareNextTarget());
    expect(dependencies.generateNextTarget).toHaveBeenCalledTimes(1);

    act(() => vi.runAllTimers());
    expect(dependencies.generateNextTarget).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels prompt playback and either active timer on unmount", () => {
    const incorrect = setup();
    act(() => incorrect.result.current.answer("minor-second"));
    incorrect.unmount();
    expect(incorrect.dependencies.cancelPrompt).toHaveBeenCalledTimes(1);

    const correct = setup();
    act(() => correct.result.current.answer("major-third"));
    correct.unmount();
    expect(correct.dependencies.cancelPrompt).toHaveBeenCalledTimes(2);

    act(() => vi.runAllTimers());
    expect(incorrect.dependencies.generateNextTarget).not.toHaveBeenCalled();
    expect(correct.dependencies.generateNextTarget).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
