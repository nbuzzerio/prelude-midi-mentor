import { describe, expect, it, vi } from "vitest";
import { generateMelodyExercise } from "./melody-generator";
import { DEFAULT_MELODY_SETTINGS } from "./melody-types";
import { createMelodyPerformanceClock } from "./melody-clock";
import type { MelodyAudioContextLike } from "./melody-metronome";

function fakeContext(state: AudioContextState = "running", currentTime = 20) {
  const oscillators: Array<{ frequency: { setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> }; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; type: OscillatorType }> = [];
  const gains: Array<{ gain: { setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> }; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
  const context = {
    currentTime, state, destination: {}, resume: vi.fn(async () => undefined),
    createOscillator: vi.fn(() => { const node = { frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), type: "sine" as OscillatorType }; oscillators.push(node); return node; }),
    createGain: vi.fn(() => { const node = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() }; gains.push(node); return node; }),
  } satisfies MelodyAudioContextLike;
  return { context, oscillators, gains };
}

function exercise(measureCount: 1 | 2 = 1, tempoBpm: 50 | 60 | 70 | 80 = 60) {
  return generateMelodyExercise({ ...DEFAULT_MELODY_SETTINGS, measureCount, tempoBpm }, "clock");
}

describe("Melody performance clock", () => {
  it("defines count-in, exact performance origin, written end, and evaluation tail from audio time", async () => {
    const audio = fakeContext("running", 10);
    const clock = await createMelodyPerformanceClock(exercise(2), audio.context);
    expect(clock).toMatchObject({ quarterBeatSeconds: 1, countInDurationSeconds: 4, exerciseDurationSeconds: 8, evaluationTailSeconds: 0.5, countInStartedAtSeconds: 10.1, performanceStartedAtSeconds: 14.1, performanceEndsAtSeconds: 22.1, evaluationEndsAtSeconds: 22.6 });
    expect(clock.nowSeconds()).toBe(10);
    expect(audio.oscillators.map(({ start }) => start.mock.calls[0]![0])).toEqual([10.1, 11.1, 12.1, 13.1, 14.1, 15.1, 16.1, 17.1, 18.1, 19.1, 20.1, 21.1]);
    expect(audio.oscillators.every(({ start }) => start.mock.calls[0]![0] < clock.performanceEndsAtSeconds)).toBe(true);
  });

  it("uses an explicit nonnegative lead override", async () => {
    const audio = fakeContext("running", 5);
    const clock = await createMelodyPerformanceClock(exercise(), audio.context, { startLeadSeconds: 0.25 });
    expect(clock.countInStartedAtSeconds).toBe(5.25);
    await expect(createMelodyPerformanceClock(exercise(), fakeContext().context, { startLeadSeconds: -1 })).rejects.toThrow();
  });

  it("resumes a suspended context before reading time and scheduling", async () => {
    const audio = fakeContext("suspended", 3);
    audio.context.resume.mockImplementation(async () => { Object.assign(audio.context, { state: "running", currentTime: 4 }); });
    const clock = await createMelodyPerformanceClock(exercise(), audio.context);
    expect(audio.context.resume).toHaveBeenCalledTimes(1);
    expect(clock.countInStartedAtSeconds).toBe(4.1);
  });

  it("does not resume a running context", async () => {
    const audio = fakeContext();
    await createMelodyPerformanceClock(exercise(), audio.context);
    expect(audio.context.resume).not.toHaveBeenCalled();
  });

  it("schedules nothing when resume fails", async () => {
    const audio = fakeContext("suspended");
    audio.context.resume.mockRejectedValue(new Error("Audio blocked"));
    await expect(createMelodyPerformanceClock(exercise(), audio.context)).rejects.toThrow("Audio blocked");
    expect(audio.context.createOscillator).not.toHaveBeenCalled();
    expect(audio.context.createGain).not.toHaveBeenCalled();
  });

  it("rolls back every previously scheduled click when a later click fails during startup", async () => {
    const audio = fakeContext();
    const originalFailure = new Error("Later oscillator creation failed");
    audio.context.createOscillator.mockImplementationOnce(() => {
      const node = { frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), type: "sine" as OscillatorType };
      audio.oscillators.push(node);
      return node;
    }).mockImplementationOnce(() => {
      const node = { frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), type: "sine" as OscillatorType };
      audio.oscillators.push(node);
      return node;
    }).mockImplementationOnce(() => { throw originalFailure; });

    let returnedClock: Awaited<ReturnType<typeof createMelodyPerformanceClock>> | undefined;
    try {
      returnedClock = await createMelodyPerformanceClock(exercise(), audio.context);
    } catch (error) {
      expect(error).toBe(originalFailure);
    }

    expect(returnedClock).toBeUndefined();
    expect(audio.oscillators).toHaveLength(2);
    expect(audio.gains).toHaveLength(2);
    for (const oscillator of audio.oscillators) {
      expect(oscillator.start).toHaveBeenCalledTimes(1);
      expect(oscillator.stop).toHaveBeenCalledTimes(2);
      expect(oscillator.disconnect).toHaveBeenCalledTimes(1);
    }
    for (const gain of audio.gains) expect(gain.disconnect).toHaveBeenCalledTimes(1);
  });

  it("cancels and disconnects every scheduled click idempotently", async () => {
    const audio = fakeContext();
    const clock = await createMelodyPerformanceClock(exercise(), audio.context);
    clock.cancel();
    clock.cancel();
    for (const oscillator of audio.oscillators) { expect(oscillator.stop).toHaveBeenCalledTimes(2); expect(oscillator.disconnect).toHaveBeenCalledTimes(1); }
    for (const gain of audio.gains) expect(gain.disconnect).toHaveBeenCalledTimes(1);
  });

  it("keeps separate clocks and cancellation state independent", async () => {
    const firstAudio = fakeContext();
    const secondAudio = fakeContext();
    const first = await createMelodyPerformanceClock(exercise(), firstAudio.context);
    await createMelodyPerformanceClock(exercise(), secondAudio.context);
    first.cancel();
    expect(firstAudio.oscillators[0]!.disconnect).toHaveBeenCalled();
    expect(secondAudio.oscillators[0]!.disconnect).not.toHaveBeenCalled();
  });

  it("does not mutate the exercise or shared meter facts", async () => {
    const source = exercise(2, 80);
    const before = structuredClone(source);
    await createMelodyPerformanceClock(source, fakeContext().context);
    expect(source).toEqual(before);
  });
});
