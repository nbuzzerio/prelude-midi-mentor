import { afterEach, describe, expect, it, vi } from "vitest";

import type { SequenceArpeggio } from "@/types/practice";

import { isNaturalMidiNumber } from "../note-utils";
import { generateSequenceTarget, getIntervalSemitones } from "./sequences";

const ENABLED_ARPEGGIOS = new Set<SequenceArpeggio>(["major"]);

const ENABLED_SCALES = new Set(["major"] as const);

const ENABLED_SCALE_DIRECTIONS = new Set(["ascending"] as const);

afterEach(() => {
  vi.restoreAllMocks();
});

function getTargetNotes(
  target: ReturnType<typeof generateSequenceTarget>,
): ReadonlyArray<Readonly<{ midiNumber: number; name: string }>> {
  return target.steps.map((step) => step.notes[0]);
}

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
      enabledArpeggios: ENABLED_ARPEGGIOS,
      enabledDirections: new Set(["ascending"]),
      enabledIntervals: new Set(["major-third"]),
      enabledNoteCategories: new Set(["naturals", "accidentals"]),
      enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
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
      enabledArpeggios: ENABLED_ARPEGGIOS,
      enabledDirections: new Set(["descending"]),
      enabledIntervals: new Set(["perfect-fifth"]),
      enabledNoteCategories: new Set(["naturals", "accidentals"]),
      enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
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
        enabledArpeggios: ENABLED_ARPEGGIOS,
        enabledDirections: new Set(["ascending"]),
        enabledIntervals: new Set(["major-second"]),
        enabledNoteCategories: new Set(["naturals"]),
        enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
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
        enabledArpeggios: ENABLED_ARPEGGIOS,
        enabledDirections: new Set(["ascending"]),
        enabledIntervals: new Set(["major-second"]),
        enabledNoteCategories: new Set(["accidentals"]),
        enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
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
        enabledArpeggios: ENABLED_ARPEGGIOS,
        enabledDirections: new Set(),
        enabledIntervals: new Set(["major-second"]),
        enabledNoteCategories: new Set(["naturals"]),
        enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
        enabledScales: ENABLED_SCALES,
      }),
    ).toThrow(/direction/i);
  });

  it("throws when no intervals are enabled", () => {
    expect(() =>
      generateSequenceTarget({
        exerciseType: "intervals",
        clef: "treble",
        enabledArpeggios: ENABLED_ARPEGGIOS,
        enabledDirections: new Set(["ascending"]),
        enabledIntervals: new Set(),
        enabledNoteCategories: new Set(["naturals"]),
        enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
        enabledScales: ENABLED_SCALES,
      }),
    ).toThrow(/interval/i);
  });

  it("throws when no note categories are enabled", () => {
    expect(() =>
      generateSequenceTarget({
        exerciseType: "intervals",
        clef: "treble",
        enabledArpeggios: ENABLED_ARPEGGIOS,
        enabledDirections: new Set(["ascending"]),
        enabledIntervals: new Set(["major-second"]),
        enabledNoteCategories: new Set(),
        enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
        enabledScales: ENABLED_SCALES,
      }),
    ).toThrow(/note category/i);
  });
});

describe("theory spelling", () => {
  it("generates an ascending major scale", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const target = generateSequenceTarget({
      exerciseType: "scales",
      clef: "treble",
      enabledArpeggios: ENABLED_ARPEGGIOS,
      enabledDirections: new Set(["descending"]),
      enabledIntervals: new Set(["major-second"]),
      enabledNoteCategories: new Set(["naturals"]),
      enabledScaleDirections: new Set(["ascending"]),
      enabledScales: ENABLED_SCALES,
    });

    expect(getTargetNotes(target).map((note) => note.midiNumber)).toEqual([
      60, 62, 64, 65, 67, 69, 71, 72,
    ]);
    expect(target.name.secondary).toBe("Ascending one-octave scale");
  });

  it("generates a descending major scale as the reverse of its ascent", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const target = generateSequenceTarget({
      exerciseType: "scales",
      clef: "treble",
      enabledArpeggios: ENABLED_ARPEGGIOS,
      enabledDirections: new Set(["ascending"]),
      enabledIntervals: new Set(["major-second"]),
      enabledNoteCategories: new Set(["naturals"]),
      enabledScaleDirections: new Set(["descending"]),
      enabledScales: ENABLED_SCALES,
    });

    expect(getTargetNotes(target).map((note) => note.midiNumber)).toEqual([
      72, 71, 69, 67, 65, 64, 62, 60,
    ]);
    expect(getTargetNotes(target).map((note) => note.name)).toEqual([
      "C",
      "B",
      "A",
      "G",
      "F",
      "E",
      "D",
      "C",
    ]);
    expect(target.name.secondary).toBe("Descending one-octave scale");
  });

  it("generates an ascending and descending scale without repeating the upper tonic", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const target = generateSequenceTarget({
      exerciseType: "scales",
      clef: "treble",
      enabledArpeggios: ENABLED_ARPEGGIOS,
      enabledDirections: new Set(["descending"]),
      enabledIntervals: new Set(["major-second"]),
      enabledNoteCategories: new Set(["naturals"]),
      enabledScaleDirections: new Set(["ascending-descending"]),
      enabledScales: ENABLED_SCALES,
    });

    expect(getTargetNotes(target).map((note) => note.midiNumber)).toEqual([
      60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60,
    ]);
    expect(target.name.secondary).toBe(
      "Ascending and descending one-octave scale",
    );
  });

  it("uses natural minor for a descending melodic minor scale", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const target = generateSequenceTarget({
      exerciseType: "scales",
      clef: "treble",
      enabledArpeggios: ENABLED_ARPEGGIOS,
      enabledDirections: new Set(["ascending"]),
      enabledIntervals: new Set(["major-second"]),
      enabledNoteCategories: new Set(["naturals"]),
      enabledScaleDirections: new Set(["descending"]),
      enabledScales: new Set(["melodic-minor"]),
    });

    expect(getTargetNotes(target).map((note) => note.midiNumber)).toEqual([
      72, 70, 68, 67, 65, 63, 62, 60,
    ]);
    expect(getTargetNotes(target).map((note) => note.name)).toEqual([
      "C",
      "B♭",
      "A♭",
      "G",
      "F",
      "E♭",
      "D",
      "C",
    ]);
  });

  it("uses melodic minor ascending and natural minor descending in a round trip", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const target = generateSequenceTarget({
      exerciseType: "scales",
      clef: "treble",
      enabledArpeggios: ENABLED_ARPEGGIOS,
      enabledDirections: new Set(["descending"]),
      enabledIntervals: new Set(["major-second"]),
      enabledNoteCategories: new Set(["naturals"]),
      enabledScaleDirections: new Set(["ascending-descending"]),
      enabledScales: new Set(["melodic-minor"]),
    });

    expect(getTargetNotes(target).map((note) => note.midiNumber)).toEqual([
      60, 62, 63, 65, 67, 69, 71, 72, 70, 68, 67, 65, 63, 62, 60,
    ]);
    expect(getTargetNotes(target).map((note) => note.name)).toEqual([
      "C",
      "D",
      "E♭",
      "F",
      "G",
      "A",
      "B",
      "C",
      "B♭",
      "A♭",
      "G",
      "F",
      "E♭",
      "D",
      "C",
    ]);
  });

  it("spells an ascending minor second using the correct letter name", () => {
    for (let i = 0; i < 100; i += 1) {
      const target = generateSequenceTarget({
        exerciseType: "intervals",
        clef: "treble",
        enabledArpeggios: ENABLED_ARPEGGIOS,
        enabledDirections: new Set(["ascending"]),
        enabledIntervals: new Set(["minor-second"]),
        enabledNoteCategories: new Set(["naturals", "accidentals"]),
        enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
        enabledScales: ENABLED_SCALES,
      });

      const first = target.steps[0].notes[0];
      const second = target.steps[1].notes[0];

      expect(second.midiNumber - first.midiNumber).toBe(1);

      expect(second.name[0]).not.toBe(first.name[0]);
    }
  });

  it("spells an ascending major third using the correct letter name", () => {
    for (let i = 0; i < 100; i += 1) {
      const target = generateSequenceTarget({
        exerciseType: "intervals",
        clef: "treble",
        enabledArpeggios: ENABLED_ARPEGGIOS,
        enabledDirections: new Set(["ascending"]),
        enabledIntervals: new Set(["major-third"]),
        enabledNoteCategories: new Set(["naturals", "accidentals"]),
        enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
        enabledScales: ENABLED_SCALES,
      });

      const first = target.steps[0].notes[0];
      const second = target.steps[1].notes[0];

      expect(second.midiNumber - first.midiNumber).toBe(4);

      expect(second.name[0]).not.toBe(first.name[0]);
    }
  });

  it("never throws while generating random major scales", () => {
    expect(() => {
      for (let i = 0; i < 250; i += 1) {
        generateSequenceTarget({
          exerciseType: "scales",
          clef: "treble",
          enabledArpeggios: ENABLED_ARPEGGIOS,
          enabledDirections: new Set(["ascending"]),
          enabledIntervals: new Set(["major-second"]),
          enabledNoteCategories: new Set(["naturals", "accidentals"]),
          enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
          enabledScales: ENABLED_SCALES,
        });
      }
    }).not.toThrow();
  });

  it("never throws while generating random major arpeggios", () => {
    expect(() => {
      for (let i = 0; i < 250; i += 1) {
        generateSequenceTarget({
          exerciseType: "arpeggios",
          clef: "treble",
          enabledArpeggios: ENABLED_ARPEGGIOS,
          enabledDirections: new Set(["ascending"]),
          enabledIntervals: new Set(["major-second"]),
          enabledNoteCategories: new Set(["naturals", "accidentals"]),
          enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
          enabledScales: ENABLED_SCALES,
        });
      }
    }).not.toThrow();
  });
});
