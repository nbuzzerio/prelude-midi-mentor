import { describe, expect, it } from "vitest";
import { centsBetween, describeTunerPitch, equalTemperedFrequency } from "./tuner-pitch";

describe("tuner musical presentation", () => {
  it("uses A440 and signed equal-temperament cents", () => {
    expect(describeTunerPitch(440)).toMatchObject({ name: "A", octave: 4, semitone: 69, cents: 0 });
    expect(centsBetween(442, 440)).toBeGreaterThan(0);
    expect(centsBetween(438, 440)).toBeLessThan(0);
  });
  it("spells all twelve pitch classes with the existing no-key convention", () => {
    const names = Array.from({ length: 12 }, (_, i) => describeTunerPitch(equalTemperedFrequency(60 + i))?.name);
    expect(names).toEqual(["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"]);
  });
  it("uses scientific octave numbering across B4/C5", () => {
    expect(describeTunerPitch(equalTemperedFrequency(71))?.octave).toBe(4);
    expect(describeTunerPitch(equalTemperedFrequency(72))?.octave).toBe(5);
  });
  it("preserves stabilized identity and true cents across a semitone midpoint", () => {
    const pitch = describeTunerPitch(440 * 2 ** (55 / 1200), 69);
    expect(pitch?.name).toBe("A"); expect(pitch?.cents).toBeCloseTo(55);
  });
  it("rejects invalid or unspellable frequencies", () => {
    for (const hz of [0, -1, NaN, Infinity, 1e20]) expect(describeTunerPitch(hz)).toBeNull();
  });
});
