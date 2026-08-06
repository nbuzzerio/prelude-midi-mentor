import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PianoPlaybackHandle } from "./grand-piano";
import { createMusicalEventPlayer } from "./musical-event-player";

function handle(started = true): PianoPlaybackHandle {
  return { started: Promise.resolve(started), stop: vi.fn() };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("musical event player", () => {
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
});
