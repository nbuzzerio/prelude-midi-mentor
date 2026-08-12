import { describe, expect, it, vi } from "vitest";
import { generateMelodyExercise } from "./melody-generator";
import { DEFAULT_MELODY_SETTINGS } from "./melody-types";
import { createMelodyMetronomeSchedule, scheduleMelodyMetronomeClick, type MelodyAudioContextLike } from "./melody-metronome";

function exercise(measureCount: 1 | 2 = 1, tempoBpm: 50 | 60 | 70 | 80 = 60) {
  return generateMelodyExercise({ ...DEFAULT_MELODY_SETTINGS, measureCount, tempoBpm }, "schedule");
}

function audioContext() {
  const oscillators: Array<{ frequency: { setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> }; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; type: OscillatorType }> = [];
  const gains: Array<{ gain: { setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> }; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
  const context = {
    currentTime: 10, state: "running" as AudioContextState, destination: {}, resume: vi.fn(async () => undefined),
    createOscillator: vi.fn(() => {
      const node = { frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), type: "sine" as OscillatorType };
      oscillators.push(node); return node;
    }),
    createGain: vi.fn(() => {
      const node = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
      gains.push(node); return node;
    }),
  } satisfies MelodyAudioContextLike;
  return { context, oscillators, gains };
}

describe("Melody metronome schedule", () => {
  it("creates four count-in quarter beats with only beat one accented", () => {
    const countIn = createMelodyMetronomeSchedule(exercise()).filter(({ phase }) => phase === "count-in");
    expect(countIn).toEqual([
      { phase: "count-in", measureIndex: null, beatIndex: 0, relativeTimeSeconds: 0, accented: true },
      { phase: "count-in", measureIndex: null, beatIndex: 1, relativeTimeSeconds: 1, accented: false },
      { phase: "count-in", measureIndex: null, beatIndex: 2, relativeTimeSeconds: 2, accented: false },
      { phase: "count-in", measureIndex: null, beatIndex: 3, relativeTimeSeconds: 3, accented: false },
    ]);
  });

  it.each([[1, 4], [2, 8]] as const)("creates %i measure performance with %i quarter clicks", (measureCount, clickCount) => {
    const schedule = createMelodyMetronomeSchedule(exercise(measureCount));
    const performance = schedule.filter(({ phase }) => phase === "performance");
    expect(performance).toHaveLength(clickCount);
    expect(performance.filter(({ accented }) => accented).map(({ measureIndex, beatIndex }) => [measureIndex, beatIndex])).toEqual(Array.from({ length: measureCount }, (_, index) => [index, 0]));
    expect(performance.every(({ accented, beatIndex }) => accented === (beatIndex === 0))).toBe(true);
    expect(performance.at(-1)!.relativeTimeSeconds).toBe(measureCount === 1 ? 7 : 11);
    expect(schedule.every(({ relativeTimeSeconds }) => relativeTimeSeconds < (measureCount === 1 ? 8 : 12))).toBe(true);
    expect(Object.isFrozen(schedule)).toBe(true);
  });

  it("scales schedule offsets by BPM without audible subdivisions or tail clicks", () => {
    const schedule = createMelodyMetronomeSchedule(exercise(1, 80));
    expect(schedule.map(({ relativeTimeSeconds }) => relativeTimeSeconds)).toEqual([0, 0.75, 1.5, 2.25, 3, 3.75, 4.5, 5.25]);
  });
});

describe("Melody click synthesis", () => {
  it("schedules deterministic short accent and normal oscillator envelopes", () => {
    const accent = audioContext();
    scheduleMelodyMetronomeClick(accent.context, 12.5, true);
    const normal = audioContext();
    scheduleMelodyMetronomeClick(normal.context, 12.5, false);
    expect(accent.oscillators[0]!.frequency.setValueAtTime).toHaveBeenCalledWith(1320, 12.5);
    expect(normal.oscillators[0]!.frequency.setValueAtTime).toHaveBeenCalledWith(880, 12.5);
    expect(accent.gains[0]!.gain.setValueAtTime).toHaveBeenCalledWith(0.22, 12.5);
    expect(normal.gains[0]!.gain.setValueAtTime).toHaveBeenCalledWith(0.13, 12.5);
    expect(accent.oscillators[0]!.start).toHaveBeenCalledWith(12.5);
    expect(accent.oscillators[0]!.stop).toHaveBeenCalledWith(12.545);
    expect(accent.gains[0]!.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 12.545);
  });

  it("cleans up the current click nodes when scheduling fails before returning them", () => {
    const audio = audioContext();
    const originalFailure = new Error("Oscillator start failed");
    audio.context.createOscillator.mockImplementationOnce(() => {
      const node = {
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(), disconnect: vi.fn(),
        start: vi.fn(() => { throw originalFailure; }), stop: vi.fn(),
        type: "sine" as OscillatorType,
      };
      audio.oscillators.push(node);
      return node;
    });

    expect(() => scheduleMelodyMetronomeClick(audio.context, 12.5, true)).toThrow(originalFailure);
    expect(audio.oscillators[0]!.stop).toHaveBeenCalledTimes(1);
    expect(audio.oscillators[0]!.disconnect).toHaveBeenCalledTimes(1);
    expect(audio.gains[0]!.disconnect).toHaveBeenCalledTimes(1);
  });
});

export { audioContext as createTestMelodyAudioContext };
