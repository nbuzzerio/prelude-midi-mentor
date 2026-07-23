// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMidiChordAttempt } from "./use-midi-chord-attempt";

describe("useMidiChordAttempt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts an attempt with the first played note", () => {
    const onComplete = vi.fn();

    const { result } = renderHook(() => useMidiChordAttempt(225));

    act(() => {
      result.current.startAttempt(60, onComplete);
    });

    expect(result.current.isAttemptActive()).toBe(true);
    expect(result.current.attemptNotes).toEqual(new Set([60]));
  });

  it("adds notes during an active attempt", () => {
    const onComplete = vi.fn();

    const { result } = renderHook(() => useMidiChordAttempt(225));

    act(() => {
      result.current.startAttempt(60, onComplete);
      result.current.addNoteToAttempt(64);
      result.current.addNoteToAttempt(67);
    });

    expect(result.current.attemptNotes).toEqual(new Set([60, 64, 67]));
  });

  it("ignores duplicate notes naturally through the Set", () => {
    const onComplete = vi.fn();

    const { result } = renderHook(() => useMidiChordAttempt(225));

    act(() => {
      result.current.startAttempt(60, onComplete);
      result.current.addNoteToAttempt(60);
      result.current.addNoteToAttempt(60);
    });

    expect(result.current.attemptNotes).toEqual(new Set([60]));
  });

  it("completes the attempt after the grace period", () => {
    const onComplete = vi.fn();

    const { result } = renderHook(() => useMidiChordAttempt(225));

    act(() => {
      result.current.startAttempt(60, onComplete);
      result.current.addNoteToAttempt(64);
      result.current.addNoteToAttempt(67);
    });

    act(() => {
      vi.advanceTimersByTime(224);
    });

    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(new Set([60, 64, 67]));

    expect(result.current.isAttemptActive()).toBe(false);
    expect(result.current.attemptNotes).toEqual(new Set());
  });

  it("clears an active attempt before completion", () => {
    const onComplete = vi.fn();

    const { result } = renderHook(() => useMidiChordAttempt(225));

    act(() => {
      result.current.startAttempt(60, onComplete);
      result.current.addNoteToAttempt(64);
      result.current.clearAttempt();
    });

    expect(result.current.isAttemptActive()).toBe(false);
    expect(result.current.attemptNotes).toEqual(new Set());

    act(() => {
      vi.runAllTimers();
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("uses the current grace period after rerendering", () => {
    const onComplete = vi.fn();

    const { result, rerender } = renderHook(
      ({ gracePeriodMs }) => useMidiChordAttempt(gracePeriodMs),
      {
        initialProps: {
          gracePeriodMs: 225,
        },
      },
    );

    rerender({
      gracePeriodMs: 500,
    });

    act(() => {
      result.current.startAttempt(60, onComplete);
    });

    act(() => {
      vi.advanceTimersByTime(499);
    });

    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("cleans up the pending timer when unmounted", () => {
    const onComplete = vi.fn();

    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

    const { result, unmount } = renderHook(() => useMidiChordAttempt(225));

    act(() => {
      result.current.startAttempt(60, onComplete);
    });

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.runAllTimers();
    });

    expect(onComplete).not.toHaveBeenCalled();
  });
});
