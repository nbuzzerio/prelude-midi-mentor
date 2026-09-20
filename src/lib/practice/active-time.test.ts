import { describe, expect, it } from "vitest";
import { createActiveTimeAccumulator, getActiveTimeMs, pauseActiveTime, resumeActiveTime } from "./active-time";

describe("active-time accumulator", () => {
  it("starts, snapshots, pauses, and resumes without counting paused duration", () => {
    const started = createActiveTimeAccumulator(100, true);
    expect(getActiveTimeMs(started, 150)).toBe(50);
    expect(started).toEqual({ accumulatedMs: 0, runningSinceMs: 100 });
    const paused = pauseActiveTime(started, 175);
    expect(getActiveTimeMs(paused, 500)).toBe(75);
    expect(getActiveTimeMs(resumeActiveTime(paused, 500), 540)).toBe(115);
  });

  it("is safe across repeated pause and resume transitions", () => {
    const started = createActiveTimeAccumulator(10, true);
    const paused = pauseActiveTime(started, 20);
    expect(pauseActiveTime(paused, 30)).toBe(paused);
    const resumed = resumeActiveTime(paused, 40);
    expect(resumeActiveTime(resumed, 50)).toBe(resumed);
    expect(getActiveTimeMs(resumed, 60)).toBe(30);
  });

  it("can begin paused and rejects invalid timestamps", () => {
    expect(getActiveTimeMs(createActiveTimeAccumulator(10, false), 50)).toBe(0);
    expect(() => createActiveTimeAccumulator(Number.NaN, true)).toThrow(/finite non-negative/);
  });
});
