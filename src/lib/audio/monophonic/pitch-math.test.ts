import { describe, expect, it } from "vitest";
import { centsBetween, describeFrequency, equalTemperedFrequency } from "./pitch-math";

describe("shared acoustic pitch coordinates", () => {
  it("uses A440 and all supported equal-tempered centers without naming pitches", () => {
    for (let semitone = 48; semitone <= 96; semitone++) {
      const hz = equalTemperedFrequency(semitone);
      expect(describeFrequency(hz)?.semitone).toBe(semitone);
      expect(centsBetween(hz, hz)).toBe(0);
    }
    expect(equalTemperedFrequency(69)).toBe(440);
  });
  it.each([0, -1, NaN, Infinity, 1e20])("rejects invalid or unsupported coordinate %s", (hz) => {
    expect(describeFrequency(hz)).toBeNull();
  });
});
