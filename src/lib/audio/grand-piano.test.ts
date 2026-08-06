import { afterEach, describe, expect, it, vi } from "vitest";
import { playGrandPianoNote } from "./grand-piano";

afterEach(() => vi.unstubAllGlobals());

describe("grand-piano playback handles", () => {
  it("returns a handle that can stop started playback", async () => {
    const playable = {
      currentTime: 4,
      ended: false,
      pause: vi.fn(),
      paused: false,
      play: vi.fn().mockResolvedValue(undefined),
      playbackRate: 1,
      preservesPitch: true,
      volume: 1,
    };
    const rejectedPlayable = {
      ...playable,
      pause: vi.fn(),
      play: vi.fn().mockRejectedValue(new Error("blocked")),
    };
    const sample = {
      cloneNode: vi.fn()
        .mockReturnValueOnce(playable)
        .mockReturnValueOnce(rejectedPlayable),
      preload: "",
    };
    vi.stubGlobal("Audio", function AudioMock() {
      return sample;
    });

    const playback = playGrandPianoNote(72, 500);
    await expect(playback.started).resolves.toBe(true);
    expect(playable.playbackRate).toBe(2);
    playback.stop();
    expect(playable.pause).toHaveBeenCalledTimes(1);
    expect(playable.currentTime).toBe(0);
    await expect(playGrandPianoNote(60).started).resolves.toBe(false);
  });
});
