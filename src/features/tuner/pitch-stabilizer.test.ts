import { describe, expect, it } from "vitest";
import { createPitchStabilizer } from "./pitch-stabilizer";
import type { PitchObservation } from "./tuner-pitch";

const observation = (frequencyHz = 440, levelDbfs = -20): PitchObservation => ({ frequencyHz, levelDbfs, quality: 0.99, reason: "usable" });
function acquired() {
  const tracker = createPitchStabilizer();
  [0, 40, 80].forEach((ms) => tracker.update(observation(), ms, ms / 1000));
  return tracker;
}
describe("tuner stabilization and freshness", () => {
  it("requires repeated evidence and elapsed acquisition time", () => {
    const tracker = createPitchStabilizer();
    expect(tracker.update(observation(), 0, 0).fresh).toBe(false);
    expect(tracker.update(observation(), 40, 0.04).fresh).toBe(false);
    expect(tracker.update(observation(), 80, 0.08)).toMatchObject({ fresh: true, state: "stable", pitch: { semitone: 69 } });
  });
  it("marks weak or rejected readings uncertain immediately and clears after 400 ms", () => {
    const tracker = acquired();
    expect(tracker.update({ ...observation(), frequencyHz: null, reason: "quiet" }, 100, 0.1)).toMatchObject({ fresh: false, state: "uncertain" });
    expect(tracker.snapshot(480).pitch).not.toBeNull(); expect(tracker.snapshot(481).pitch).toBeNull();
  });
  it("ages reliability without callbacks, then requires fresh acquisition", () => {
    const tracker = acquired(); expect(tracker.snapshot(201).fresh).toBe(false);
    expect(tracker.snapshot(481).pitch).toBeNull();
    expect(tracker.update(observation(), 1000, 1).fresh).toBe(false);
  });
  it("cannot acquire or keep reliability from a frozen audio clock", () => {
    const empty = createPitchStabilizer();
    [0, 40, 80, 120].forEach((at) => expect(empty.update(observation(), at, 0).fresh).toBe(false));
    expect(acquired().update(observation(), 120, 0.08).fresh).toBe(false);
  });
  it("requires reacquisition after quality loss even on the same note", () => {
    const tracker = acquired(); tracker.update({ ...observation(), quality: 0.2 }, 100, 0.1);
    expect(tracker.update(observation(), 120, 0.12).fresh).toBe(false);
    expect(tracker.update(observation(), 160, 0.16).fresh).toBe(false);
    expect(tracker.update(observation(), 200, 0.2).fresh).toBe(true);
  });
  it("rejects isolated octave jumps but permits a sustained real octave", () => {
    const tracker = acquired(); expect(tracker.update(observation(880), 120, 0.12).fresh).toBe(false);
    expect(tracker.update(observation(), 160, 0.16).pitch?.semitone).toBe(69);
    [200, 240, 280].forEach((at) => expect(tracker.update(observation(880), at, at / 1000).fresh).toBe(false));
    expect(tracker.update(observation(880), 320, 0.32)).toMatchObject({ fresh: true, pitch: { semitone: 81 } });
  });
  it("does not acquire a harmonic replacing a decaying signal", () => {
    const tracker = acquired();
    [120, 160, 200, 240, 280].forEach((at, i) => {
      const result = tracker.update(observation(880, -24 - i * 4), at, at / 1000);
      expect(result.fresh).toBe(false); expect(result.pitch?.semitone).toBe(69);
    });
  });
  it("does not acquire even a slow cumulative decay across candidate frames", () => {
    const tracker = createPitchStabilizer();
    [0, 40, 80, 120, 160].forEach((at, i) => expect(tracker.update(observation(440, -20 - i * 2), at, at / 1000).fresh).toBe(false));
  });
  it("can acquire a quieter sustained note once its level settles", () => {
    const tracker = acquired();
    [120, 160, 200, 240, 280, 320].forEach((at) => tracker.update(observation(659.255, -35), at, at / 1000));
    expect(tracker.snapshot(320)).toMatchObject({ fresh: true, pitch: { semitone: 76 } });
  });
  it("retains identity with honest unclamped cents around a midpoint", () => {
    expect(acquired().update(observation(440 * 2 ** (55 / 1200)), 120, 0.12).pitch?.semitone).toBe(69);
  });
  it("discards acquisition across sampling gaps and reversed clocks", () => {
    const tracker = acquired(); expect(tracker.update(observation(), 300, 0.3).fresh).toBe(false);
    expect(tracker.update(observation(), 0, 0).fresh).toBe(false);
    expect(() => tracker.update(observation(), NaN, 0)).toThrow();
  });
  it("reset discards all prior evidence", () => {
    const tracker = acquired(); tracker.reset(); expect(tracker.snapshot(1000).pitch).toBeNull();
  });
});
