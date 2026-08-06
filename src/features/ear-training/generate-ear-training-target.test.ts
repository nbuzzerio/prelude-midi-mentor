import { afterEach, describe, expect, it, vi } from "vitest";
import { getIntervalDiatonicSteps, getIntervalSemitones, MUSICAL_INTERVALS } from "@/lib/music/intervals";
import { generateEarTrainingTarget } from "./generate-ear-training-target";

afterEach(() => vi.restoreAllMocks());

describe("generateEarTrainingTarget", () => {
  it.each(["ascending", "descending"] as const)(
    "generates correctly spelled %s intervals inside C4-C6",
    (direction) => {
      for (const interval of MUSICAL_INTERVALS) {
        for (let index = 0; index < 20; index += 1) {
          const target = generateEarTrainingTarget({
            enabledDirections: new Set([direction]),
            enabledIntervals: new Set([interval]),
          });
          const [first, second] = target.notes;
          const multiplier = direction === "ascending" ? 1 : -1;
          expect(second.midiNumber - first.midiNumber).toBe(
            getIntervalSemitones(interval) * multiplier,
          );
          expect(target.notes.every((note) => note.midiNumber >= 60 && note.midiNumber <= 84)).toBe(true);
          const letters = "CDEFGAB";
          const firstIndex = letters.indexOf(first.name[0] ?? "");
          const secondIndex = letters.indexOf(second.name[0] ?? "");
          expect(
            ((secondIndex - firstIndex) * multiplier + 70) % 7,
          ).toBe(getIntervalDiatonicSteps(interval) % 7);
        }
      }
    },
  );

  it("is deterministic for mocked randomness", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const options = {
      enabledDirections: new Set(["ascending"] as const),
      enabledIntervals: new Set(["major-third"] as const),
    };
    expect(generateEarTrainingTarget(options)).toEqual(generateEarTrainingTarget(options));
  });

  it("rejects empty settings", () => {
    expect(() => generateEarTrainingTarget({ enabledDirections: new Set(["ascending"]), enabledIntervals: new Set() })).toThrow(/interval/);
    expect(() => generateEarTrainingTarget({ enabledDirections: new Set(), enabledIntervals: new Set(["major-third"]) })).toThrow(/direction/);
  });
});
