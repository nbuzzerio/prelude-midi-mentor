import { describe, expect, it } from "vitest";

import { isNaturalMidiNumber } from "../note-utils";
import { generateSequenceTarget, getIntervalSemitones } from "./sequences";

const ENABLED_SCALES = new Set(["major"] as const);

describe("getIntervalSemitones", () => {
  it.each([
    ["minor-second", 1],
    ["major-second", 2],
    ["minor-third", 3],
    ["major-third", 4],
    ["perfect-fourth", 5],
    ["perfect-fifth", 7],
    ["minor-sixth", 8],
    ["major-sixth", 9],
    ["minor-seventh", 10],
    ["major-seventh", 11],
    ["octave", 12],
  ] as const)("returns %i semitones for %s", (interval, semitones) => {
    expect(getIntervalSemitones(interval)).toBe(semitones);
  });
});

describe("generateSequenceTarget", () => {
  it("generates an ascending interval with the correct distance", () => {
    const target = generateSequenceTarget({
      exerciseType: "intervals",
      clef: "treble",
      enabledDirections: new Set(["ascending"]),
      enabledIntervals: new Set(["major-third"]),
      enabledNoteCategories: new Set(["naturals", "accidentals"]),
      enabledScales: ENABLED_SCALES,
    });

    expect(target.steps).toHaveLength(2);

    const first = target.steps[0].notes[0].midiNumber;
    const second = target.steps[1].notes[0].midiNumber;

    expect(second - first).toBe(4);
    expect(target.name.primary).toBe("Major third");
    expect(target.name.secondary).toContain("Ascending");
  });

  it("generates a descending interval with the correct distance", () => {
    const target = generateSequenceTarget({
      exerciseType: "intervals",
      clef: "treble",
      enabledDirections: new Set(["descending"]),
      enabledIntervals: new Set(["perfect-fifth"]),
      enabledNoteCategories: new Set(["naturals", "accidentals"]),
      enabledScales: ENABLED_SCALES,
    });

    const first = target.steps[0].notes[0].midiNumber;
    const second = target.steps[1].notes[0].midiNumber;

    expect(first - second).toBe(7);
    expect(target.name.primary).toBe("Perfect fifth");
    expect(target.name.secondary).toContain("Descending");
  });

  it("honors the natural-note filter", () => {
    for (let i = 0; i < 50; i += 1) {
      const target = generateSequenceTarget({
        exerciseType: "intervals",
        clef: "treble",
        enabledDirections: new Set(["ascending"]),
        enabledIntervals: new Set(["major-second"]),
        enabledNoteCategories: new Set(["naturals"]),
        enabledScales: ENABLED_SCALES,
      });

      const first = target.steps[0].notes[0];

      expect(isNaturalMidiNumber(first.midiNumber)).toBe(true);
    }
  });

  it("honors the accidental-note filter", () => {
    for (let i = 0; i < 50; i += 1) {
      const target = generateSequenceTarget({
        exerciseType: "intervals",
        clef: "treble",
        enabledDirections: new Set(["ascending"]),
        enabledIntervals: new Set(["major-second"]),
        enabledNoteCategories: new Set(["accidentals"]),
        enabledScales: ENABLED_SCALES,
      });

      const first = target.steps[0].notes[0];

      expect(isNaturalMidiNumber(first.midiNumber)).toBe(false);
    }
  });

  it("throws when no directions are enabled", () => {
    expect(() =>
      generateSequenceTarget({
        exerciseType: "intervals",
        clef: "treble",
        enabledDirections: new Set(),
        enabledIntervals: new Set(["major-second"]),
        enabledNoteCategories: new Set(["naturals"]),
        enabledScales: ENABLED_SCALES,
      }),
    ).toThrow(/direction/i);
  });

  it("throws when no intervals are enabled", () => {
    expect(() =>
      generateSequenceTarget({
        exerciseType: "intervals",
        clef: "treble",
        enabledDirections: new Set(["ascending"]),
        enabledIntervals: new Set(),
        enabledNoteCategories: new Set(["naturals"]),
        enabledScales: ENABLED_SCALES,
      }),
    ).toThrow(/interval/i);
  });

  it("throws when no note categories are enabled", () => {
    expect(() =>
      generateSequenceTarget({
        exerciseType: "intervals",
        clef: "treble",
        enabledDirections: new Set(["ascending"]),
        enabledIntervals: new Set(["major-second"]),
        enabledNoteCategories: new Set(),
        enabledScales: ENABLED_SCALES,
      }),
    ).toThrow(/note category/i);
  });
});
