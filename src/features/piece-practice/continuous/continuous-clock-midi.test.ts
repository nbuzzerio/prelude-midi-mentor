import { describe, expect, it, vi } from "vitest";
import { continuousBeats, createContinuousClock } from "./continuous-clock";
import { createContinuousMidiCapture } from "./continuous-midi";
import { projectContinuousPassage } from "./continuous-projection";
import { raw, TEST_INPUT, testScore } from "./continuous-test-fixtures";

export function testAudio() {
  const oscillators: ReturnType<typeof oscillator>[] = [];
  const oscillator = () => ({ frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, type: "sine" as OscillatorType,
    connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() });
  return { currentTime: 0, state: "running" as AudioContextState, destination: {},
    createOscillator: vi.fn(() => { const node = oscillator(); oscillators.push(node); return node; }),
    createGain: vi.fn(() => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() })),
    resume: vi.fn(async () => {}), close: vi.fn(async () => {}), oscillators };
}
describe("meter-aware continuous clock", () => {
  it.each([["3/4", 3, 3000, 1000], ["4/4", 4, 4000, 1000], ["6/8", 2, 3000, 1500]] as const)("counts one %s bar, accents the first pulse and uses exact boundaries", (meter, pulses, barMs, pulseMs) => {
    const p = projectContinuousPassage(testScore(meter), 0, 1, 60);
    const beats = continuousBeats(p);
    expect(beats.filter((b) => b.phase === "count-in")).toHaveLength(pulses);
    expect(beats.map((b) => b.timeMs)).toEqual(Array.from({ length: pulses * 3 }, (_, i) => i * pulseMs));
    expect(beats.filter((b) => b.accented).map((b) => b.timeMs)).toEqual([0, barMs, barMs * 2]);
    const audio = testAudio();
    const clock = createContinuousClock(p, audio);
    expect(clock.performanceSeconds).toBeCloseTo(0.1 + barMs / 1000);
    expect(clock.endSeconds).toBeCloseTo(0.1 + 3 * barMs / 1000 + p.tailMs / 1000);
    expect(audio.oscillators[0]!.frequency.setValueAtTime).toHaveBeenCalledWith(1320, 0.1);
    clock.cancel(); clock.cancel();
    expect(audio.oscillators.every((o) => o.disconnect.mock.calls.length === 1)).toBe(true);
  });
  it("rejects suspended audio without scheduling and cleans a partially failed schedule", () => {
    const p = projectContinuousPassage(testScore(), 0, 0, 60);
    const audio = testAudio(); audio.state = "suspended";
    expect(() => createContinuousClock(p, audio)).toThrow(/Audio/);
    expect(audio.createOscillator).not.toHaveBeenCalled();
    audio.state = "running";
    audio.createOscillator.mockImplementationOnce(() => { throw Error("allocation"); });
    expect(() => createContinuousClock(p, audio)).toThrow("allocation");
  });
});
describe("physical continuous MIDI evidence", () => {
  it("records actual distinct Note On messages with channel, velocity, source and audio-clock coordinates", () => {
    const capture = createContinuousMidiCapture(TEST_INPUT);
    const a = capture({ ...raw(64), bytes: [0x92, 64, 100] }, 5.1, 4.1)!;
    expect(a).toMatchObject({ id: 1, midi: 64, channel: 2, velocity: 100, source: "physical-midi", uncertaintyMs: 5 });
    expect(a.timeMs).toBeCloseTo(1000);
    expect(capture(raw(64), 5.2, 4.1)!.id).toBe(2);
  });
  it("ignores note-off, zero-velocity Note On, pedal, malformed and other-input messages", () => {
    const capture = createContinuousMidiCapture(TEST_INPUT);
    for (const bytes of [[0x80, 60, 40], [0x90, 60, 0], [0xb0, 64, 127], [0x90, 60], [0x90, 60, 80, 0], [0x90, 255, 80]]) {
      expect(capture({ ...raw(), bytes }, 4, 4)).toBeNull();
    }
    expect(capture(raw(60, 80, 1, 1, { id: "other", name: "Other" }), 4, 4)).toBeNull();
  });
  it("accounts for bounded delivery age and marks unreliable timestamps unavailable", () => {
    const capture = createContinuousMidiCapture(TEST_INPUT);
    expect(capture(raw(60, 80, 1000, 1020), 5, 4)).toMatchObject({ timeMs: 980, uncertaintyMs: 20 });
    expect(capture({ ...raw(), sourceTimeStampMs: null }, 5, 4)).toMatchObject({ timeMs: 1000, uncertaintyMs: null });
    expect(capture(raw(60, 80, 0, 1000), 5, 4)).toMatchObject({ timeMs: 1000, uncertaintyMs: null });
  });
});
