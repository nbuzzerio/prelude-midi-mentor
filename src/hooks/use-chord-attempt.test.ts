// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CHORD_ATTEMPT_GRACE_MS, useChordAttempt } from "./use-chord-attempt";

describe("useChordAttempt", () => {
  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts with the first note and collects unique rolled or block notes", () => {
    const { result } = renderHook(() =>
      useChordAttempt({ gracePeriodMs: CHORD_ATTEMPT_GRACE_MS, onComplete: vi.fn() }),
    );

    act(() => {
      result.current.startAttempt(60);
      result.current.addNoteToAttempt(64);
      result.current.addNoteToAttempt(67);
      result.current.addNoteToAttempt(60);
    });

    expect(result.current.isAttemptActive()).toBe(true);
    expect(result.current.attemptNotes).toEqual(new Set([60, 64, 67]));
  });

  it("completes once at 225 milliseconds and clears visible state", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useChordAttempt({ gracePeriodMs: CHORD_ATTEMPT_GRACE_MS, onComplete }),
    );

    act(() => {
      result.current.startAttempt(67);
      result.current.addNoteToAttempt(60);
      result.current.addNoteToAttempt(64);
      vi.advanceTimersByTime(224);
    });
    expect(onComplete).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(new Set([67, 60, 64]));
    expect(result.current.isAttemptActive()).toBe(false);
    expect(result.current.attemptNotes).toEqual(new Set());
  });

  it("cancels explicitly without delayed completion", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useChordAttempt({ gracePeriodMs: CHORD_ATTEMPT_GRACE_MS, onComplete }),
    );

    act(() => {
      result.current.startAttempt(60);
      result.current.addNoteToAttempt(64);
      result.current.clearAttempt();
      vi.runAllTimers();
    });

    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.attemptNotes).toEqual(new Set());
  });

  it("uses the latest completion callback without restarting the timer", () => {
    const firstComplete = vi.fn();
    const latestComplete = vi.fn();
    const { result, rerender } = renderHook(
      ({ onComplete }) =>
        useChordAttempt({ gracePeriodMs: CHORD_ATTEMPT_GRACE_MS, onComplete }),
      { initialProps: { onComplete: firstComplete } },
    );

    act(() => {
      result.current.startAttempt(60);
      vi.advanceTimersByTime(100);
    });
    rerender({ onComplete: latestComplete });
    act(() => vi.advanceTimersByTime(125));

    expect(firstComplete).not.toHaveBeenCalled();
    expect(latestComplete).toHaveBeenCalledWith(new Set([60]));
  });

  it("keeps independent collector instances isolated", () => {
    const firstComplete = vi.fn();
    const secondComplete = vi.fn();
    const { result } = renderHook(() => ({
      first: useChordAttempt({ gracePeriodMs: 225, onComplete: firstComplete }),
      second: useChordAttempt({ gracePeriodMs: 225, onComplete: secondComplete }),
    }));

    act(() => {
      result.current.first.startAttempt(60);
      result.current.second.startAttempt(67);
      result.current.first.addNoteToAttempt(64);
      vi.advanceTimersByTime(225);
    });

    expect(firstComplete).toHaveBeenCalledWith(new Set([60, 64]));
    expect(secondComplete).toHaveBeenCalledWith(new Set([67]));
  });

  it("cancels safely on unmount", () => {
    const onComplete = vi.fn();
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const { result, unmount } = renderHook(() =>
      useChordAttempt({ gracePeriodMs: 225, onComplete }),
    );

    act(() => result.current.startAttempt(60));
    unmount();
    act(() => vi.runAllTimers());

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
