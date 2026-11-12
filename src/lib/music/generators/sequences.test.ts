import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  SequenceArpeggio,
  SequenceArpeggioDirection,
} from "@/types/practice";
import {
  CHORD_PROGRESSION_TEMPLATES,
  SUPPORTED_CHORD_PROGRESSION_KEYS,
} from "../chord-progressions";
import type {
  ChordProgressionKeyId,
  ChordProgressionTemplateId,
} from "../chord-progressions";

import { isNaturalMidiNumber } from "../note-utils";
import { NOTE_RANGES } from "@/data/note-ranges";
import {
  SEQUENCE_DEFAULT_STEP_DURATION_TICKS,
  SEQUENCE_DEFAULT_TIMING,
} from "../sequence-timing";
import {
  generateSequenceTarget,
  getIntervalSemitones,
  type GenerateSequenceTargetOptions,
} from "./sequences";

const ENABLED_ARPEGGIOS = new Set<SequenceArpeggio>(["major"]);

const ENABLED_SCALES = new Set(["major"] as const);

const ENABLED_SCALE_DIRECTIONS = new Set(["ascending"] as const);

const ALL_CHORD_PROGRESSION_KEY_IDS = new Set<ChordProgressionKeyId>(
  SUPPORTED_CHORD_PROGRESSION_KEYS.map((key) => key.id),
);

const ALL_CHORD_PROGRESSION_TEMPLATE_IDS =
  new Set<ChordProgressionTemplateId>(
    CHORD_PROGRESSION_TEMPLATES.map((template) => template.id),
  );

type ExistingSequenceTargetOptions = Omit<
  GenerateSequenceTargetOptions,
  | "enabledArpeggioDirections"
  | "enabledChordProgressionKeyIds"
  | "enabledChordProgressionTemplateIds"
> &
  Readonly<{
    enabledArpeggioDirections?: ReadonlySet<SequenceArpeggioDirection>;
  }>;

function generateExistingSequenceTarget(options: ExistingSequenceTargetOptions) {
  return generateSequenceTarget({
    enabledArpeggioDirections: new Set(["ascending-descending"]),
    ...options,
    enabledChordProgressionKeyIds: ALL_CHORD_PROGRESSION_KEY_IDS,
    enabledChordProgressionTemplateIds: ALL_CHORD_PROGRESSION_TEMPLATE_IDS,
  });
}

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
  it.each([
    ["intervals", "ascending"],
    ["scales", "ascending"],
    ["scales", "descending"],
    ["scales", "ascending-descending"],
    ["arpeggios", "ascending"],
  ] as const)(
    "assigns the default timing convention to %s (%s)",
    (exerciseType, direction) => {
      const target = generateExistingSequenceTarget({
        exerciseType,
        clef: "treble",
        enabledArpeggios: ENABLED_ARPEGGIOS,
        enabledDirections: new Set([direction === "ascending-descending" ? "ascending" : direction]),
        enabledIntervals: new Set(["major-third"]),
        enabledNoteCategories: new Set(["naturals", "accidentals"]),
        enabledScaleDirections: new Set([direction]),
        enabledScales: ENABLED_SCALES,
      });

      expect(target.timing).toEqual(SEQUENCE_DEFAULT_TIMING);
      expect(
        target.steps.every(
          ({ durationTicks }) =>
            durationTicks === SEQUENCE_DEFAULT_STEP_DURATION_TICKS,
        ),
      ).toBe(true);
    },
  );

  it("generates an ascending interval with the correct distance", () => {
    const target = generateExistingSequenceTarget({
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
    const target = generateExistingSequenceTarget({
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
      const target = generateExistingSequenceTarget({
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
      const target = generateExistingSequenceTarget({
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
      generateExistingSequenceTarget({
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
      generateExistingSequenceTarget({
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
      generateExistingSequenceTarget({
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

function generateProgressionTarget({
  clef,
  keyIds,
  templateIds,
}: Readonly<{
  clef: "bass" | "treble";
  keyIds: ReadonlySet<ChordProgressionKeyId>;
  templateIds: ReadonlySet<ChordProgressionTemplateId>;
}>) {
  return generateSequenceTarget({
    exerciseType: "chord-progressions",
    clef,
    enabledArpeggios: ENABLED_ARPEGGIOS,
    enabledArpeggioDirections: new Set(["ascending-descending"]),
    enabledChordProgressionKeyIds: keyIds,
    enabledChordProgressionTemplateIds: templateIds,
    enabledDirections: new Set(["ascending"]),
    enabledIntervals: new Set(["major-second"]),
    enabledNoteCategories: new Set(["naturals"]),
    enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
    enabledScales: ENABLED_SCALES,
  });
}

describe("chord progression sequence targets", () => {
  it("assigns one default duration to each simultaneous chord attack", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const target = generateProgressionTarget({
      clef: "treble",
      keyIds: new Set(["c-major"]),
      templateIds: new Set(["major-1451"]),
    });

    expect(target.timing).toEqual(SEQUENCE_DEFAULT_TIMING);
    expect(target.steps.some(({ notes }) => notes.length > 1)).toBe(true);
    expect(
      target.steps.every(
        ({ durationTicks }) =>
          durationTicks === SEQUENCE_DEFAULT_STEP_DURATION_TICKS,
      ),
    ).toBe(true);
  });

  it("maps a realized progression to target and step metadata", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const target = generateProgressionTarget({
      clef: "treble",
      keyIds: new Set(["c-major"]),
      templateIds: new Set(["major-1451"]),
    });

    expect(target.name).toEqual({
      primary: "I–IV–V–I",
      secondary: "C major",
    });
    expect(target.steps).toEqual([
      {
        durationTicks: 480,
        name: { primary: "I", secondary: "C major" },
        notes: [
          { midiNumber: 60, name: "C", octave: 4 },
          { midiNumber: 64, name: "E", octave: 4 },
          { midiNumber: 67, name: "G", octave: 4 },
        ],
      },
      {
        durationTicks: 480,
        name: { primary: "IV", secondary: "F major" },
        notes: [
          { midiNumber: 65, name: "F", octave: 4 },
          { midiNumber: 69, name: "A", octave: 4 },
          { midiNumber: 72, name: "C", octave: 5 },
        ],
      },
      {
        durationTicks: 480,
        name: { primary: "V", secondary: "G major" },
        notes: [
          { midiNumber: 67, name: "G", octave: 4 },
          { midiNumber: 71, name: "B", octave: 4 },
          { midiNumber: 74, name: "D", octave: 5 },
        ],
      },
      {
        durationTicks: 480,
        name: { primary: "I", secondary: "C major" },
        notes: [
          { midiNumber: 60, name: "C", octave: 4 },
          { midiNumber: 64, name: "E", octave: 4 },
          { midiNumber: 67, name: "G", octave: 4 },
        ],
      },
    ]);
  });

  it("preserves sharp spelling in D major ii–V–I", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const target = generateProgressionTarget({
      clef: "treble",
      keyIds: new Set(["d-major"]),
      templateIds: new Set(["major-251"]),
    });

    expect(target.steps.map((step) => step.notes.map((note) => note.name))).toEqual([
      ["E", "G", "B"],
      ["A", "C♯", "E"],
      ["D", "F♯", "A"],
    ]);
  });

  it("preserves flat spelling and minor-key dominant behavior", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const flatTarget = generateProgressionTarget({
      clef: "bass",
      keyIds: new Set(["b-flat-major"]),
      templateIds: new Set(["major-1451"]),
    });
    const minorTarget = generateProgressionTarget({
      clef: "bass",
      keyIds: new Set(["a-minor"]),
      templateIds: new Set(["minor-1451"]),
    });

    expect(flatTarget.steps[0]?.notes.map((note) => note.name)).toEqual([
      "B♭",
      "D",
      "F",
    ]);
    expect(minorTarget.steps[2]?.notes.map((note) => note.name)).toEqual([
      "E",
      "G♯",
      "B",
    ]);
  });

  it("rejects invalid progression configurations clearly", () => {
    expect(() =>
      generateProgressionTarget({
        clef: "bass",
        keyIds: new Set(),
        templateIds: new Set(["major-1451"]),
      }),
    ).toThrow("At least one chord progression key must be enabled.");

    expect(() =>
      generateProgressionTarget({
        clef: "bass",
        keyIds: new Set(["c-major"]),
        templateIds: new Set(),
      }),
    ).toThrow("At least one chord progression template must be enabled.");

    expect(() =>
      generateProgressionTarget({
        clef: "bass",
        keyIds: new Set(["c-major"]),
        templateIds: new Set(["minor-1451"]),
      }),
    ).toThrow("must have matching modes");
  });

  it("realizes every compatible approved pair in both progression clef ranges", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const ranges = {
      bass: { minMidi: 36, maxMidi: 64 },
      treble: { minMidi: 60, maxMidi: 88 },
    } as const;
    let checkedPairs = 0;

    for (const key of SUPPORTED_CHORD_PROGRESSION_KEYS) {
      for (const template of CHORD_PROGRESSION_TEMPLATES) {
        if (key.mode !== template.mode) {
          continue;
        }

        for (const clef of ["bass", "treble"] as const) {
          const target = generateProgressionTarget({
            clef,
            keyIds: new Set([key.id]),
            templateIds: new Set([template.id]),
          });

          expect(target.steps).toHaveLength(template.chords.length);

          for (const step of target.steps) {
            expect(step.notes).toHaveLength(3);

            for (const note of step.notes) {
              expect(note.midiNumber).toBeGreaterThanOrEqual(
                ranges[clef].minMidi,
              );
              expect(note.midiNumber).toBeLessThanOrEqual(
                ranges[clef].maxMidi,
              );
            }
          }

          checkedPairs += 1;
        }
      }
    }

    expect(checkedPairs).toBe(108);
  });

  it("uses the wider maxima only for chord progressions", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const bassProgression = generateProgressionTarget({
      clef: "bass",
      keyIds: new Set(["b-minor"]),
      templateIds: new Set(["minor-1637"]),
    });
    const trebleProgression = generateProgressionTarget({
      clef: "treble",
      keyIds: new Set(["b-minor"]),
      templateIds: new Set(["minor-1637"]),
    });

    expect(
      Math.max(...bassProgression.steps.flatMap((step) => step.notes.map((note) => note.midiNumber))),
    ).toBe(64);
    expect(
      Math.max(...trebleProgression.steps.flatMap((step) => step.notes.map((note) => note.midiNumber))),
    ).toBe(88);

    vi.spyOn(Math, "random").mockReturnValue(0.999999);

    const bassInterval = generateExistingSequenceTarget({
      exerciseType: "intervals",
      clef: "bass",
      enabledArpeggios: ENABLED_ARPEGGIOS,
      enabledDirections: new Set(["ascending"]),
      enabledIntervals: new Set(["octave"]),
      enabledNoteCategories: new Set(["naturals", "accidentals"]),
      enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
      enabledScales: ENABLED_SCALES,
    });
    const trebleInterval = generateExistingSequenceTarget({
      exerciseType: "intervals",
      clef: "treble",
      enabledArpeggios: ENABLED_ARPEGGIOS,
      enabledDirections: new Set(["ascending"]),
      enabledIntervals: new Set(["octave"]),
      enabledNoteCategories: new Set(["naturals", "accidentals"]),
      enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
      enabledScales: ENABLED_SCALES,
    });

    expect(Math.max(...bassInterval.steps.flatMap((step) => step.notes.map((note) => note.midiNumber)))).toBe(60);
    expect(Math.max(...trebleInterval.steps.flatMap((step) => step.notes.map((note) => note.midiNumber)))).toBe(84);
    expect(bassInterval.steps.every((step) => step.name === undefined)).toBe(true);
    expect(trebleInterval.steps.every((step) => step.name === undefined)).toBe(true);
  });
});

describe("theory spelling", () => {
  function generateCArpeggio(
    arpeggio: SequenceArpeggio,
    direction: SequenceArpeggioDirection,
  ) {
    vi.spyOn(Math, "random").mockReturnValue(0);

    return generateExistingSequenceTarget({
      exerciseType: "arpeggios",
      clef: "treble",
      enabledArpeggios: new Set([arpeggio]),
      enabledArpeggioDirections: new Set([direction]),
      enabledDirections: new Set(["descending"]),
      enabledIntervals: new Set(["major-second"]),
      enabledNoteCategories: new Set(["naturals"]),
      enabledScaleDirections: new Set(["ascending"]),
      enabledScales: ENABLED_SCALES,
    });
  }

  it.each([
    ["ascending", [60, 64, 67, 72]],
    ["descending", [72, 67, 64, 60]],
    ["ascending-descending", [60, 64, 67, 72, 67, 64, 60]],
  ] as const)("generates a conventional major arpeggio traversal for %s", (direction, midiNumbers) => {
    const target = generateCArpeggio("major", direction);

    expect(getTargetNotes(target).map(({ midiNumber }) => midiNumber)).toEqual(
      midiNumbers,
    );
    expect(target.steps.every(({ durationTicks }) => durationTicks === 480)).toBe(
      true,
    );
  });

  it.each([
    ["minor", ["C", "E♭", "G", "C", "G", "E♭", "C"]],
    ["diminished", ["C", "E♭", "G♭", "C", "G♭", "E♭", "C"]],
    ["augmented", ["C", "E", "G♯", "C", "G♯", "E", "C"]],
  ] as const)("preserves theoretical spelling for a %s round trip", (arpeggio, names) => {
    expect(
      getTargetNotes(generateCArpeggio(arpeggio, "ascending-descending")).map(
        ({ name }) => name,
      ),
    ).toEqual(names);
  });

  it.each([
    ["dominant-seventh", ["C", "E", "G", "B♭", "C"]],
    ["major-seventh", ["C", "E", "G", "B", "C"]],
    ["minor-seventh", ["C", "E♭", "G", "B♭", "C"]],
  ] as const)("includes the upper root in an ascending %s", (arpeggio, names) => {
    expect(
      getTargetNotes(generateCArpeggio(arpeggio, "ascending")).map(
        ({ name }) => name,
      ),
    ).toEqual(names);
  });

  it("reverses the complete dominant seventh ascent and omits a duplicate apex", () => {
    expect(
      getTargetNotes(
        generateCArpeggio("dominant-seventh", "descending"),
      ).map(({ name }) => name),
    ).toEqual(["C", "B♭", "G", "E", "C"]);
    const roundTrip = generateCArpeggio(
      "dominant-seventh",
      "ascending-descending",
    );
    expect(
      getTargetNotes(roundTrip).map(({ midiNumber }) => midiNumber),
    ).toEqual([60, 64, 67, 70, 72, 70, 67, 64, 60]);
    expect(roundTrip.steps).toHaveLength(9);
  });

  it("generates an ascending major scale", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const target = generateExistingSequenceTarget({
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

    const target = generateExistingSequenceTarget({
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

    const target = generateExistingSequenceTarget({
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

    const target = generateExistingSequenceTarget({
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

    const target = generateExistingSequenceTarget({
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
      const target = generateExistingSequenceTarget({
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
      const target = generateExistingSequenceTarget({
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
        generateExistingSequenceTarget({
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
        generateExistingSequenceTarget({
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

// Independent spelling oracle: only natural roots or the two ordinary accidental
// spellings may be selected, and every chord tone must use its required letter.
const ARPEGGIO_CASES = [
  ["major", [0, 4, 7, 12]],
  ["minor", [0, 3, 7, 12]],
  ["diminished", [0, 3, 6, 12]],
  ["augmented", [0, 4, 8, 12]],
  ["dominant-seventh", [0, 4, 7, 10, 12]],
  ["major-seventh", [0, 4, 7, 11, 12]],
  ["minor-seventh", [0, 3, 7, 10, 12]],
] as const;
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL_PITCHES = [0, 2, 4, 5, 7, 9, 11];
function expectedSpellings(root: number, pattern: readonly number[]) {
  const naturalIndex = NATURAL_PITCHES.indexOf(root % 12);
  const rootLetters = naturalIndex >= 0 ? [naturalIndex] : NATURAL_PITCHES
    .flatMap((pitch, index) => [1, 11].includes((root - pitch + 12) % 12) ? [index] : []);
  const degrees = pattern.length === 4 ? [0, 2, 4, 7] : [0, 2, 4, 6, 7];
  return rootLetters.flatMap((letter) => {
    const notes = pattern.map((offset, index) => {
      const letterIndex = (letter + degrees[index]) % 7;
      const midiNumber = root + offset;
      const difference = (midiNumber - NATURAL_PITCHES[letterIndex] + 12) % 12;
      if (![0, 1, 11].includes(difference)) return null;
      const accidental = difference === 11 ? -1 : difference;
      return {
        midiNumber,
        name: LETTERS[letterIndex] + (accidental === 1 ? "♯" : accidental === -1 ? "♭" : ""),
        octave: (midiNumber - NATURAL_PITCHES[letterIndex] - accidental) / 12 - 1,
      };
    });
    return notes.every((note) => note !== null) ? [notes] : [];
  });
}

const CLEFS = ["treble", "bass"] as const;
const ARPEGGIO_DIRECTIONS = ["ascending", "descending", "ascending-descending"] as const;
function arpeggioOptions(clef: typeof CLEFS[number], quality: SequenceArpeggio,
  direction: SequenceArpeggioDirection, categories: readonly ("naturals" | "accidentals")[]): ExistingSequenceTargetOptions {
  return {
    exerciseType: "arpeggios", clef,
    enabledArpeggios: new Set([quality]), enabledArpeggioDirections: new Set([direction]),
    enabledNoteCategories: new Set(categories), enabledDirections: new Set(["ascending"]),
    enabledIntervals: new Set(["major-third"]), enabledScales: ENABLED_SCALES,
    enabledScaleDirections: ENABLED_SCALE_DIRECTIONS,
  };
}

describe("arpeggio root eligibility regression", () => {
  it.each(CLEFS.flatMap((clef) => ARPEGGIO_DIRECTIONS.map((direction) => [clef, direction] as const)))(
    "excludes unsupported B augmented before selection: %s %s", (clef, direction) => {
      // Previously the seventh of eight natural candidates was B (MIDI 71/47).
      vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0)
        .mockReturnValueOnce(6.5 / 8).mockReturnValue(0);
      const target = generateExistingSequenceTarget(arpeggioOptions(clef, "augmented", direction, ["naturals"]));
      expect(target.steps.flatMap((step) => step.notes).every((note) => note.name !== "B")).toBe(true);
      expect(target.name.primary).toBe("Augmented arpeggio");
    },
  );

  it.each(CLEFS.flatMap((clef) => ARPEGGIO_CASES.flatMap(([quality, pattern]) =>
    ARPEGGIO_DIRECTIONS.flatMap((direction) =>
      ([["naturals"], ["accidentals"], ["naturals", "accidentals"]] as const)
        .map((categories) => ({ clef, quality, pattern, direction, categories }))))))(
    "enumerates every eligible root and spelling: $clef $quality $direction $categories",
    ({ clef, quality, pattern, direction, categories }) => {
      const { minMidi, maxMidi } = NOTE_RANGES[clef];
      const candidates = Array.from({ length: maxMidi - minMidi - 11 }, (_, i) => minMidi + i)
        .filter((root) => categories.some((category) => category === (NATURAL_PITCHES.includes(root % 12) ? "naturals" : "accidentals")));
      const eligible = candidates.filter((root) => expectedSpellings(root, pattern).length > 0);
      expect(eligible.length).toBeGreaterThan(0); // No supported empty selection needs recovery.
      expect(candidates.filter((root) => !eligible.includes(root))).toEqual(
        quality === "augmented" ? candidates.filter((root) => root % 12 === 11) : [],
      );
      const random = vi.spyOn(Math, "random");
      eligible.forEach((root, rootIndex) => {
        expectedSpellings(root, pattern).forEach((ascending, spellingIndex, spellings) => {
          random.mockReset().mockReturnValueOnce(0).mockReturnValueOnce(0)
            .mockReturnValueOnce((rootIndex + 0.5) / eligible.length)
            .mockReturnValue((spellingIndex + 0.5) / spellings.length);
          const target = generateExistingSequenceTarget(arpeggioOptions(clef, quality, direction, categories));
          const descending = [...ascending].reverse();
          const expected = direction === "ascending" ? ascending : direction === "descending"
            ? descending : [...ascending, ...descending.slice(1)];
          expect(target.clef).toBe(clef);
          expect(target.steps.map((step) => step.notes)).toEqual(expected.map((note) => [note]));
          expect(target.steps.every((step) => step.durationTicks === SEQUENCE_DEFAULT_STEP_DURATION_TICKS)).toBe(true);
          expect(target.timing).toEqual(SEQUENCE_DEFAULT_TIMING);
          expect(target.steps.flatMap((step) => step.notes).every((note) => note.midiNumber >= minMidi && note.midiNumber <= maxMidi)).toBe(true);
        });
      });
    },
  );
});
