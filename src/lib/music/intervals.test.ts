import { describe, expect, it } from "vitest";
import {
  MUSICAL_INTERVALS,
  getIntervalDiatonicSteps,
  getIntervalLabel,
  getIntervalSemitones,
} from "./intervals";

describe("musical intervals", () => {
  it("defines the supported minor-second through octave vocabulary", () => {
    expect(MUSICAL_INTERVALS).toHaveLength(11);
    expect(MUSICAL_INTERVALS[0]).toBe("minor-second");
    expect(MUSICAL_INTERVALS.at(-1)).toBe("octave");
  });

  it.each([
    ["minor-second", 1, 1, "Minor second"],
    ["major-third", 4, 2, "Major third"],
    ["perfect-fifth", 7, 4, "Perfect fifth"],
    ["major-seventh", 11, 6, "Major seventh"],
    ["octave", 12, 7, "Octave"],
  ] as const)("defines %s", (interval, semitones, steps, label) => {
    expect(getIntervalSemitones(interval)).toBe(semitones);
    expect(getIntervalDiatonicSteps(interval)).toBe(steps);
    expect(getIntervalLabel(interval)).toBe(label);
  });
});
