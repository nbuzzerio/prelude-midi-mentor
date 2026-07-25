// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSequenceTransition } from "./use-sequence-transition";

describe("useSequenceTransition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("advances to the next step after the delay", () => {
    const onAdvanceStep = vi.fn(() => true);

    const { result } = renderHook(() =>
      useSequenceTransition({
        onAdvanceSequence: vi.fn(),
        onAdvanceStep,
        onRetrySequence: vi.fn(),
        onSuccessFeedback: vi.fn(),
      }),
    );

    act(() => {
      result.current.startStepTransition({
        stepDelayMs: 100,
        waitForMidiRelease: false,
      });
    });

    expect(onAdvanceStep).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onAdvanceStep).toHaveBeenCalledTimes(1);
  });

  it("waits for MIDI release before advancing the step", () => {
    const onAdvanceStep = vi.fn(() => true);

    const { result } = renderHook(() =>
      useSequenceTransition({
        onAdvanceSequence: vi.fn(),
        onAdvanceStep,
        onRetrySequence: vi.fn(),
        onSuccessFeedback: vi.fn(),
      }),
    );

    act(() => {
      result.current.updateMidiHeldNotes(new Set([60]));

      result.current.startStepTransition({
        stepDelayMs: 100,
        waitForMidiRelease: true,
      });

      vi.advanceTimersByTime(100);
    });

    expect(onAdvanceStep).not.toHaveBeenCalled();

    act(() => {
      result.current.updateMidiHeldNotes(new Set());
    });

    expect(onAdvanceStep).toHaveBeenCalledTimes(1);
  });

  it("retries the sequence after incorrect feedback", () => {
    const onRetrySequence = vi.fn(() => true);

    const { result } = renderHook(() =>
      useSequenceTransition({
        onAdvanceSequence: vi.fn(),
        onAdvanceStep: vi.fn(() => true),
        onRetrySequence,
        onSuccessFeedback: vi.fn(),
      }),
    );

    act(() => {
      result.current.startIncorrectStepTransition({
        incorrectFeedbackMs: 75,
        waitForMidiRelease: false,
      });

      vi.advanceTimersByTime(75);
    });

    expect(onRetrySequence).toHaveBeenCalledTimes(1);
  });

  it("waits for MIDI release before retrying", () => {
    const onRetrySequence = vi.fn(() => true);

    const { result } = renderHook(() =>
      useSequenceTransition({
        onAdvanceSequence: vi.fn(),
        onAdvanceStep: vi.fn(() => true),
        onRetrySequence,
        onSuccessFeedback: vi.fn(),
      }),
    );

    act(() => {
      result.current.updateMidiHeldNotes(new Set([60]));

      result.current.startIncorrectStepTransition({
        incorrectFeedbackMs: 75,
        waitForMidiRelease: true,
      });

      vi.advanceTimersByTime(75);
    });

    expect(onRetrySequence).not.toHaveBeenCalled();

    act(() => {
      result.current.updateMidiHeldNotes(new Set());
    });

    expect(onRetrySequence).toHaveBeenCalledTimes(1);
  });

  it("plays the success feedback before advancing the sequence", () => {
    const onAdvanceSequence = vi.fn();
    const onSuccessFeedback = vi.fn();

    const { result } = renderHook(() =>
      useSequenceTransition({
        onAdvanceSequence,
        onAdvanceStep: vi.fn(() => true),
        onRetrySequence: vi.fn(() => true),
        onSuccessFeedback,
      }),
    );

    act(() => {
      result.current.startSequenceCompletionTransition({
        successChirpDelayMs: 50,
        nextSequenceDelayMs: 100,
        waitForMidiRelease: false,
      });
    });

    act(() => {
      vi.advanceTimersByTime(49);
    });

    expect(onSuccessFeedback).not.toHaveBeenCalled();
    expect(onAdvanceSequence).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(onSuccessFeedback).toHaveBeenCalledTimes(1);
    expect(onAdvanceSequence).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(onAdvanceSequence).toHaveBeenCalledTimes(1);
  });

  it("waits for MIDI release before advancing the sequence", () => {
    const onAdvanceSequence = vi.fn();

    const { result } = renderHook(() =>
      useSequenceTransition({
        onAdvanceSequence,
        onAdvanceStep: vi.fn(() => true),
        onRetrySequence: vi.fn(() => true),
        onSuccessFeedback: vi.fn(),
      }),
    );

    act(() => {
      result.current.updateMidiHeldNotes(new Set([60]));

      result.current.startSequenceCompletionTransition({
        successChirpDelayMs: 50,
        nextSequenceDelayMs: 100,
        waitForMidiRelease: true,
      });

      vi.advanceTimersByTime(100);
    });

    expect(onAdvanceSequence).not.toHaveBeenCalled();

    act(() => {
      result.current.updateMidiHeldNotes(new Set());
    });

    expect(onAdvanceSequence).toHaveBeenCalledTimes(1);
  });

  it("clears pending transitions", () => {
    const onAdvanceStep = vi.fn(() => true);

    const { result } = renderHook(() =>
      useSequenceTransition({
        onAdvanceSequence: vi.fn(),
        onAdvanceStep,
        onRetrySequence: vi.fn(() => true),
        onSuccessFeedback: vi.fn(),
      }),
    );

    act(() => {
      result.current.startStepTransition({
        stepDelayMs: 100,
        waitForMidiRelease: false,
      });

      result.current.clearTransition();

      vi.advanceTimersByTime(100);
    });

    expect(onAdvanceStep).not.toHaveBeenCalled();
  });

  it("cleans up timers on unmount", () => {
    const onAdvanceStep = vi.fn(() => true);

    const { result, unmount } = renderHook(() =>
      useSequenceTransition({
        onAdvanceSequence: vi.fn(),
        onAdvanceStep,
        onRetrySequence: vi.fn(() => true),
        onSuccessFeedback: vi.fn(),
      }),
    );

    act(() => {
      result.current.startStepTransition({
        stepDelayMs: 100,
        waitForMidiRelease: false,
      });
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onAdvanceStep).not.toHaveBeenCalled();
  });
});
