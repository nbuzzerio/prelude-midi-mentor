import { describe, expect, it } from "vitest";
import { generateMelodyExercise } from "./melody-generator";
import { DEFAULT_MELODY_SETTINGS } from "./melody-types";
import {
  getMelodyCountInDurationSeconds,
  getMelodyEvaluationTailSeconds,
  getMelodyExerciseDurationSeconds,
  getMelodyPerformancePhase,
  getMelodyQuarterBeatSeconds,
  getMelodyRelativePerformanceTimeMs,
  getMelodyTimedExpectedAttacks,
  melodyTicksToMilliseconds,
  melodyTicksToSeconds,
} from "./melody-timing";

describe("Melody timing", () => {
  it.each([[60, 1], [50, 1.2], [70, 60 / 70], [80, 0.75], [120, 0.5]])("converts %i BPM to %f second quarter beats", (tempo, seconds) => {
    expect(getMelodyQuarterBeatSeconds(tempo)).toBeCloseTo(seconds);
  });

  it("converts ticks to relative seconds and milliseconds", () => {
    expect(melodyTicksToSeconds(240, 60)).toBe(0.5);
    expect(melodyTicksToMilliseconds(480, 60)).toBe(1000);
    expect(melodyTicksToSeconds(960, 60)).toBe(2);
    expect(melodyTicksToSeconds(1920, 60)).toBe(4);
  });

  it("rejects invalid tempo and tick values", () => {
    expect(() => getMelodyQuarterBeatSeconds(0)).toThrow();
    expect(() => melodyTicksToSeconds(-1, 60)).toThrow();
  });

  it("maps expected attacks relative to performance origin without count-in time", () => {
    const exercise = generateMelodyExercise({ ...DEFAULT_MELODY_SETTINGS, measureCount: 2 }, "timed-attacks");
    const timed = getMelodyTimedExpectedAttacks(exercise);
    timed.forEach((attack, index) => {
      expect(attack.expectedTimeSeconds).toBe(exercise.expectedAttacks[index]!.absoluteTick / 480);
      expect(attack.expectedTimeMs).toBe(attack.expectedTimeSeconds * 1000);
    });
    expect(timed[0]!.expectedTimeSeconds).toBe(0);
    expect(timed.find(({ absoluteTick }) => absoluteTick === 1920)?.expectedTimeSeconds).toBe(4);
  });

  it("derives the preparatory lead-in and one/two-measure exercise durations", () => {
    expect(getMelodyCountInDurationSeconds(60)).toBe(2);
    expect(getMelodyExerciseDurationSeconds(generateMelodyExercise(DEFAULT_MELODY_SETTINGS, 1))).toBe(4);
    expect(getMelodyExerciseDurationSeconds(generateMelodyExercise({ ...DEFAULT_MELODY_SETTINGS, measureCount: 2 }, 1))).toBe(8);
  });

  it.each([[50, 0.6], [60, 0.5], [70, 3 / 7], [80, 0.375]])("uses a half-quarter-beat evaluation tail at %i BPM", (tempo, tail) => {
    expect(getMelodyEvaluationTailSeconds(tempo)).toBeCloseTo(tail);
  });

  it("reports relative performance time and all clock phases from audio time", () => {
    const boundaries = { countInStartedAtSeconds: 10.1, performanceStartedAtSeconds: 14.1, performanceEndsAtSeconds: 18.1, evaluationEndsAtSeconds: 18.6 };
    expect(getMelodyRelativePerformanceTimeMs({ ...boundaries, nowSeconds: () => 13.6 })).toBeCloseTo(-500);
    expect(getMelodyRelativePerformanceTimeMs({ ...boundaries, nowSeconds: () => 15.1 })).toBeCloseTo(1000);
    expect(getMelodyPerformancePhase(boundaries, 12)).toBe("count-in");
    expect(getMelodyPerformancePhase(boundaries, 14.1)).toBe("performing");
    expect(getMelodyPerformancePhase(boundaries, 18.1)).toBe("evaluation-tail");
    expect(getMelodyPerformancePhase(boundaries, 18.6)).toBe("complete");
  });
});
