// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { useCorrectAnswerSequence } from "./use-correct-answer-sequence";

describe("useCorrectAnswerSequence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("plays success feedback after the configured delay", () => {
    const onAdvance = vi.fn();
    const onSuccessFeedback = vi.fn();

    const { result } = renderHook(() =>
      useCorrectAnswerSequence({
        onAdvance,
        onSuccessFeedback,
      }),
    );

    act(() => {
      result.current.startSequence({
        nextTargetDelayMs: 500,
        successChirpDelayMs: 100,
        waitForMidiRelease: false,
      });
    });

    expect(onSuccessFeedback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(99);
    });

    expect(onSuccessFeedback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(onSuccessFeedback).toHaveBeenCalledTimes(1);
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it("advances after the configured delay when MIDI release is not required", () => {
    const onAdvance = vi.fn();
    const onSuccessFeedback = vi.fn();

    const { result } = renderHook(() =>
      useCorrectAnswerSequence({
        onAdvance,
        onSuccessFeedback,
      }),
    );

    act(() => {
      result.current.startSequence({
        nextTargetDelayMs: 500,
        successChirpDelayMs: 100,
        waitForMidiRelease: false,
      });
    });

    act(() => {
      vi.advanceTimersByTime(499);
    });

    expect(onAdvance).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("waits for held MIDI notes to be released before advancing", () => {
    const onAdvance = vi.fn();
    const onSuccessFeedback = vi.fn();

    const { result } = renderHook(() =>
      useCorrectAnswerSequence({
        onAdvance,
        onSuccessFeedback,
      }),
    );

    act(() => {
      result.current.updateMidiHeldNotes(new Set([60, 64, 67]));

      result.current.startSequence({
        nextTargetDelayMs: 500,
        successChirpDelayMs: 100,
        waitForMidiRelease: true,
      });
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onAdvance).not.toHaveBeenCalled();

    act(() => {
      result.current.updateMidiHeldNotes(new Set());
    });

    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("advances immediately at the delay when no MIDI notes are held", () => {
    const onAdvance = vi.fn();
    const onSuccessFeedback = vi.fn();

    const { result } = renderHook(() =>
      useCorrectAnswerSequence({
        onAdvance,
        onSuccessFeedback,
      }),
    );

    act(() => {
      result.current.updateMidiHeldNotes(new Set());

      result.current.startSequence({
        nextTargetDelayMs: 500,
        successChirpDelayMs: 100,
        waitForMidiRelease: true,
      });
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("does not advance early when MIDI notes are released before the delay", () => {
    const onAdvance = vi.fn();
    const onSuccessFeedback = vi.fn();

    const { result } = renderHook(() =>
      useCorrectAnswerSequence({
        onAdvance,
        onSuccessFeedback,
      }),
    );

    act(() => {
      result.current.updateMidiHeldNotes(new Set([60]));

      result.current.startSequence({
        nextTargetDelayMs: 500,
        successChirpDelayMs: 100,
        waitForMidiRelease: true,
      });

      result.current.updateMidiHeldNotes(new Set());
    });

    expect(onAdvance).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(499);
    });

    expect(onAdvance).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("advances only once after the delay and MIDI release requirements are met", () => {
    const onAdvance = vi.fn();
    const onSuccessFeedback = vi.fn();

    const { result } = renderHook(() =>
      useCorrectAnswerSequence({
        onAdvance,
        onSuccessFeedback,
      }),
    );

    act(() => {
      result.current.updateMidiHeldNotes(new Set([60]));

      result.current.startSequence({
        nextTargetDelayMs: 500,
        successChirpDelayMs: 100,
        waitForMidiRelease: true,
      });
    });

    act(() => {
      vi.advanceTimersByTime(500);
      result.current.updateMidiHeldNotes(new Set());
      result.current.updateMidiHeldNotes(new Set());
    });

    expect(onAdvance).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("clears pending feedback and advancement timers", () => {
    const onAdvance = vi.fn();
    const onSuccessFeedback = vi.fn();

    const { result } = renderHook(() =>
      useCorrectAnswerSequence({
        onAdvance,
        onSuccessFeedback,
      }),
    );

    act(() => {
      result.current.startSequence({
        nextTargetDelayMs: 500,
        successChirpDelayMs: 100,
        waitForMidiRelease: false,
      });

      result.current.clearSequence();
    });

    act(() => {
      vi.runAllTimers();
    });

    expect(onSuccessFeedback).not.toHaveBeenCalled();
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it("replaces an existing sequence when a new sequence starts", () => {
    const onAdvance = vi.fn();
    const onSuccessFeedback = vi.fn();

    const { result } = renderHook(() =>
      useCorrectAnswerSequence({
        onAdvance,
        onSuccessFeedback,
      }),
    );

    act(() => {
      result.current.startSequence({
        nextTargetDelayMs: 1_000,
        successChirpDelayMs: 800,
        waitForMidiRelease: false,
      });

      vi.advanceTimersByTime(200);

      result.current.startSequence({
        nextTargetDelayMs: 300,
        successChirpDelayMs: 100,
        waitForMidiRelease: false,
      });
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onSuccessFeedback).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onAdvance).toHaveBeenCalledTimes(1);

    act(() => {
      vi.runAllTimers();
    });

    expect(onSuccessFeedback).toHaveBeenCalledTimes(1);
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("uses the latest callback values after rerendering", () => {
    const initialOnAdvance = vi.fn();
    const initialOnSuccessFeedback = vi.fn();

    const updatedOnAdvance = vi.fn();
    const updatedOnSuccessFeedback = vi.fn();

    const { result, rerender } = renderHook(
      ({
        onAdvance,
        onSuccessFeedback,
      }: {
        onAdvance: () => void;
        onSuccessFeedback: () => void;
      }) =>
        useCorrectAnswerSequence({
          onAdvance,
          onSuccessFeedback,
        }),
      {
        initialProps: {
          onAdvance: initialOnAdvance,
          onSuccessFeedback: initialOnSuccessFeedback,
        },
      },
    );

    rerender({
      onAdvance: updatedOnAdvance,
      onSuccessFeedback: updatedOnSuccessFeedback,
    });

    act(() => {
      result.current.startSequence({
        nextTargetDelayMs: 500,
        successChirpDelayMs: 100,
        waitForMidiRelease: false,
      });

      vi.runAllTimers();
    });

    expect(initialOnSuccessFeedback).not.toHaveBeenCalled();
    expect(initialOnAdvance).not.toHaveBeenCalled();

    expect(updatedOnSuccessFeedback).toHaveBeenCalledTimes(1);
    expect(updatedOnAdvance).toHaveBeenCalledTimes(1);
  });

  it("clears pending timers when the hook unmounts", () => {
    const onAdvance = vi.fn();
    const onSuccessFeedback = vi.fn();

    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

    const { result, unmount } = renderHook(() =>
      useCorrectAnswerSequence({
        onAdvance,
        onSuccessFeedback,
      }),
    );

    act(() => {
      result.current.startSequence({
        nextTargetDelayMs: 500,
        successChirpDelayMs: 100,
        waitForMidiRelease: false,
      });
    });

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);

    act(() => {
      vi.runAllTimers();
    });

    expect(onSuccessFeedback).not.toHaveBeenCalled();
    expect(onAdvance).not.toHaveBeenCalled();
  });
});