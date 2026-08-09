import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PianoPlaybackHandle } from "./grand-piano";
import { createMusicalEventPlayer } from "./musical-event-player";

function handle(started = true): PianoPlaybackHandle {
  return { started: Promise.resolve(started), stop: vi.fn() };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("musical event player", () => {
  it("exposes the monotonic scheduler origin", () => {
    vi.spyOn(performance, "now").mockReturnValue(1234.5);
    const playback = createMusicalEventPlayer(() => handle()).play([]);
    expect(playback.startedAtMs).toBe(1234.5);
  });

  it("plays zero-offset notes immediately, chords simultaneously, and later events in order", () => {
    const playNotes = vi.fn(() => handle());
    const player = createMusicalEventPlayer(playNotes);
    player.play([
      { notes: [60, 64, 67], startTimeMs: 0, durationMs: 400 },
      { notes: [72], startTimeMs: 500, durationMs: 300 },
    ]);
    expect(playNotes).toHaveBeenCalledWith([60, 64, 67], 400);
    act(() => vi.advanceTimersByTime(500));
    expect(playNotes).toHaveBeenLastCalledWith([72], 300);
  });

  it("completes at the final event end", async () => {
    const playback = createMusicalEventPlayer(() => handle()).play([
      { notes: [60], startTimeMs: 100, durationMs: 250 },
    ]);
    act(() => vi.advanceTimersByTime(349));
    let settled = false;
    void playback.completion.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    await expect(playback.completion).resolves.toBe("completed");
  });

  it("cancels pending and currently sounding events", async () => {
    const sounding = handle();
    const playNotes = vi.fn(() => sounding);
    const playback = createMusicalEventPlayer(playNotes).play([
      { notes: [60], startTimeMs: 0, durationMs: 500 },
      { notes: [64], startTimeMs: 250, durationMs: 500 },
    ]);
    playback.cancel();
    act(() => vi.runAllTimers());
    expect(sounding.stop).toHaveBeenCalledTimes(1);
    expect(playNotes).toHaveBeenCalledTimes(1);
    await expect(playback.completion).resolves.toBe("cancelled");
  });

  it("replacement cancels stale completion and does not leak timers", async () => {
    const player = createMusicalEventPlayer(() => handle());
    const first = player.play([{ notes: [60], startTimeMs: 100, durationMs: 500 }]);
    const second = player.play([{ notes: [67], startTimeMs: 0, durationMs: 100 }]);
    await expect(first.completion).resolves.toBe("cancelled");
    act(() => vi.runAllTimers());
    await expect(second.completion).resolves.toBe("completed");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports browser playback rejection without throwing or stale completion", async () => {
    const playback = createMusicalEventPlayer(() => handle(false)).play([
      { notes: [60], startTimeMs: 0, durationMs: 500 },
    ]);
    await expect(playback.completion).resolves.toBe("failed");
    act(() => vi.runAllTimers());
    await expect(playback.completion).resolves.toBe("failed");
  });

  it("supports repeated playback without timer leakage", async () => {
    const player = createMusicalEventPlayer(() => handle());
    for (let index = 0; index < 5; index += 1) {
      const playback = player.play([{ notes: [60 + index], startTimeMs: 0, durationMs: 10 }]);
      act(() => vi.runAllTimers());
      await expect(playback.completion).resolves.toBe("completed");
    }
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses a minimum duration for empty playback and trailing silence", async () => {
    const player = createMusicalEventPlayer(() => handle());
    const empty = player.play([], { minimumDurationMs: 500 });
    act(() => vi.advanceTimersByTime(499));
    let settled = false;
    void empty.completion.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    await expect(empty.completion).resolves.toBe("completed");

    const trailing = player.play([{ notes: [60], startTimeMs: 0, durationMs: 100 }], { minimumDurationMs: 300 });
    act(() => vi.advanceTimersByTime(299));
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    act(() => vi.advanceTimersByTime(1));
    await expect(trailing.completion).resolves.toBe("completed");
  });

  it("lets longer audible events exceed the minimum and cancels minimum-duration playback", async () => {
    const player = createMusicalEventPlayer(() => handle());
    const longer = player.play([{ notes: [60], startTimeMs: 0, durationMs: 400 }], { minimumDurationMs: 100 });
    act(() => vi.advanceTimersByTime(399));
    let settled = false;
    void longer.completion.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    await expect(longer.completion).resolves.toBe("completed");

    const cancelled = player.play([], { minimumDurationMs: 1000 });
    cancelled.cancel();
    await expect(cancelled.completion).resolves.toBe("cancelled");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves replacement, failure, and no-option behavior with minimum-duration support", async () => {
    const player = createMusicalEventPlayer(() => handle());
    const first = player.play([], { minimumDurationMs: 1000 });
    const second = player.play([{ notes: [60], startTimeMs: 0, durationMs: 10 }]);
    await expect(first.completion).resolves.toBe("cancelled");
    act(() => vi.runAllTimers());
    await expect(second.completion).resolves.toBe("completed");

    const failed = createMusicalEventPlayer(() => handle(false)).play([{ notes: [60], startTimeMs: 0, durationMs: 100 }], { minimumDurationMs: 500 });
    await expect(failed.completion).resolves.toBe("failed");
    expect(vi.getTimerCount()).toBe(0);
    await expect(player.play([]).completion).resolves.toBe("completed");
  });
});
