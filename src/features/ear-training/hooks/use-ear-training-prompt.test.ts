import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicalEventPlaybackResult } from "@/lib/audio/musical-event-player";
import type { EarTrainingTarget } from "../ear-training-types";
import { useEarTrainingPrompt } from "./use-ear-training-prompt";

const mocks = vi.hoisted(() => ({ cancel: vi.fn(), play: vi.fn(), preload: vi.fn() }));
vi.mock("@/lib/audio/musical-event-player", () => ({
  createMusicalEventPlayer: () => ({ cancel: mocks.cancel, play: mocks.play }),
}));
vi.mock("@/lib/audio/grand-piano", () => ({ preloadGrandPianoSamples: mocks.preload }));

const target: EarTrainingTarget = {
  direction: "ascending",
  exerciseType: "melodic-interval",
  interval: "major-third",
  notes: [{ midiNumber: 60, name: "C", octave: 4 }, { midiNumber: 64, name: "E", octave: 4 }],
};

function deferred() {
  let resolve!: (result: MusicalEventPlaybackResult) => void;
  const completion = new Promise<MusicalEventPlaybackResult>((done) => { resolve = done; });
  return { completion, resolve };
}

beforeEach(() => vi.clearAllMocks());

describe("useEarTrainingPrompt", () => {
  it("translates a stable target to shared events and enables answers only after completion", async () => {
    const playback = deferred();
    mocks.play.mockReturnValue({ cancel: vi.fn(), completion: playback.completion });
    const { result } = renderHook(() => useEarTrainingPrompt());
    expect(result.current.state).toBe("ready");
    act(() => { void result.current.playPrompt(target); });
    expect(result.current.state).toBe("playing");
    expect(mocks.play).toHaveBeenCalledWith([
      { notes: [60], startTimeMs: 0, durationMs: 600 },
      { notes: [64], startTimeMs: 700, durationMs: 600 },
    ]);
    act(() => playback.resolve("completed"));
    await waitFor(() => expect(result.current.state).toBe("heard"));
  });

  it("does not mark a rejected prompt as heard or start response timing", async () => {
    mocks.play.mockReturnValue({ cancel: vi.fn(), completion: Promise.resolve("failed") });
    const { result } = renderHook(() => useEarTrainingPrompt());
    await act(async () => { await result.current.playPrompt(target); });
    expect(result.current.state).toBe("failed");
    expect(result.current.getResponseTimeMs()).toBe(0);
  });

  it("keeps initial response timing across replay", async () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValue(2000);
    mocks.play.mockReturnValue({ cancel: vi.fn(), completion: Promise.resolve("completed") });
    const { result } = renderHook(() => useEarTrainingPrompt());
    await act(async () => { await result.current.playPrompt(target); });
    await act(async () => { await result.current.playPrompt(target); });
    expect(result.current.getResponseTimeMs()).toBe(1000);
    vi.restoreAllMocks();
  });

  it("cancels replacement, reset, and unmount work without stale state", async () => {
    const first = deferred();
    mocks.play.mockReturnValue({ cancel: vi.fn(), completion: first.completion });
    const { result, unmount } = renderHook(() => useEarTrainingPrompt());
    act(() => { void result.current.playPrompt(target); result.current.resetPrompt(); });
    act(() => first.resolve("completed"));
    await Promise.resolve();
    expect(result.current.state).toBe("ready");
    unmount();
    expect(mocks.cancel).toHaveBeenCalled();
  });
});
