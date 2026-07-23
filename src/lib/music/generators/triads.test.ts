import { afterEach, describe, expect, it, vi } from "vitest";

import { NOTE_RANGES } from "@/data/note-ranges";
import type {
  PracticeTriadPosition,
  PracticeTriadQuality,
} from "@/types/practice";

import { generateTriadTarget, getTriadMidiNumbers } from "./triads";

type TriadTestCase = Readonly<{
  expected: readonly [number, number, number];
  position: PracticeTriadPosition;
  quality: PracticeTriadQuality;
}>;

type GeneratedTriadTestCase = Readonly<{
  position: PracticeTriadPosition;
  positionLabel: string;
  quality: PracticeTriadQuality;
  qualityLabel: string;
}>;

const C4_MIDI_NUMBER = 60;

const TRIAD_TEST_CASES: readonly TriadTestCase[] = [
  {
    quality: "major",
    position: "root",
    expected: [60, 64, 67],
  },
  {
    quality: "major",
    position: "first",
    expected: [64, 67, 72],
  },
  {
    quality: "major",
    position: "second",
    expected: [67, 72, 76],
  },

  {
    quality: "minor",
    position: "root",
    expected: [60, 63, 67],
  },
  {
    quality: "minor",
    position: "first",
    expected: [63, 67, 72],
  },
  {
    quality: "minor",
    position: "second",
    expected: [67, 72, 75],
  },

  {
    quality: "diminished",
    position: "root",
    expected: [60, 63, 66],
  },
  {
    quality: "diminished",
    position: "first",
    expected: [63, 66, 72],
  },
  {
    quality: "diminished",
    position: "second",
    expected: [66, 72, 75],
  },

  {
    quality: "augmented",
    position: "root",
    expected: [60, 64, 68],
  },
  {
    quality: "augmented",
    position: "first",
    expected: [64, 68, 72],
  },
  {
    quality: "augmented",
    position: "second",
    expected: [68, 72, 76],
  },
];

const GENERATED_TRIAD_TEST_CASES: readonly GeneratedTriadTestCase[] = [
  {
    quality: "major",
    qualityLabel: "Major",
    position: "root",
    positionLabel: "Root position",
  },
  {
    quality: "major",
    qualityLabel: "Major",
    position: "first",
    positionLabel: "First inversion",
  },
  {
    quality: "major",
    qualityLabel: "Major",
    position: "second",
    positionLabel: "Second inversion",
  },
  {
    quality: "minor",
    qualityLabel: "Minor",
    position: "root",
    positionLabel: "Root position",
  },
  {
    quality: "minor",
    qualityLabel: "Minor",
    position: "first",
    positionLabel: "First inversion",
  },
  {
    quality: "minor",
    qualityLabel: "Minor",
    position: "second",
    positionLabel: "Second inversion",
  },
  {
    quality: "diminished",
    qualityLabel: "Diminished",
    position: "root",
    positionLabel: "Root position",
  },
  {
    quality: "diminished",
    qualityLabel: "Diminished",
    position: "first",
    positionLabel: "First inversion",
  },
  {
    quality: "diminished",
    qualityLabel: "Diminished",
    position: "second",
    positionLabel: "Second inversion",
  },
  {
    quality: "augmented",
    qualityLabel: "Augmented",
    position: "root",
    positionLabel: "Root position",
  },
  {
    quality: "augmented",
    qualityLabel: "Augmented",
    position: "first",
    positionLabel: "First inversion",
  },
  {
    quality: "augmented",
    qualityLabel: "Augmented",
    position: "second",
    positionLabel: "Second inversion",
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getTriadMidiNumbers", () => {
  it.each(TRIAD_TEST_CASES)(
    "generates a $quality triad in $position position",
    ({ expected, position, quality }) => {
      expect(getTriadMidiNumbers(C4_MIDI_NUMBER, quality, position)).toEqual(
        expected,
      );
    },
  );

  it("applies the same interval formula from a different root note", () => {
    expect(getTriadMidiNumbers(62, "major", "root")).toEqual([62, 66, 69]);
  });

  it("transposes the complete triad when the root moves by an octave", () => {
    const originalTriad = getTriadMidiNumbers(60, "minor", "second");
    const transposedTriad = getTriadMidiNumbers(72, "minor", "second");

    expect(transposedTriad).toEqual(
      originalTriad.map((midiNumber) => midiNumber + 12),
    );
  });
});

describe("generateTriadTarget", () => {
  it("throws when no triad qualities are enabled", () => {
    expect(() =>
      generateTriadTarget("bass", new Set(), new Set(["root"])),
    ).toThrow("At least one triad quality must be enabled.");
  });

  it("throws when no triad positions are enabled", () => {
    expect(() =>
      generateTriadTarget("bass", new Set(["major"]), new Set()),
    ).toThrow("At least one triad position must be enabled.");
  });

  it("generates the first playable bass-clef candidate when randomness selects the first item", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const target = generateTriadTarget(
      "bass",
      new Set(["major"]),
      new Set(["root"]),
    );

    expect(target).toEqual({
      clef: "bass",
      name: {
        primary: "C Major",
        secondary: "Root position",
      },
      notes: [
        {
          midiNumber: 36,
          name: "C",
          octave: 2,
        },
        {
          midiNumber: 40,
          name: "E",
          octave: 2,
        },
        {
          midiNumber: 43,
          name: "G",
          octave: 2,
        },
      ],
    });
  });

  it("generates the first playable treble-clef candidate when randomness selects the first item", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const target = generateTriadTarget(
      "treble",
      new Set(["major"]),
      new Set(["root"]),
    );

    expect(target).toEqual({
      clef: "treble",
      name: {
        primary: "C Major",
        secondary: "Root position",
      },
      notes: [
        {
          midiNumber: 60,
          name: "C",
          octave: 4,
        },
        {
          midiNumber: 64,
          name: "E",
          octave: 4,
        },
        {
          midiNumber: 67,
          name: "G",
          octave: 4,
        },
      ],
    });
  });

  it("applies the selected quality and inversion to the generated target", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const target = generateTriadTarget(
      "bass",
      new Set(["minor"]),
      new Set(["first"]),
    );

    expect(target).toEqual({
      clef: "bass",
      name: {
        primary: "C Minor",
        secondary: "First inversion",
      },
      notes: [
        {
          midiNumber: 39,
          name: "E♭",
          octave: 2,
        },
        {
          midiNumber: 43,
          name: "G",
          octave: 2,
        },
        {
          midiNumber: 48,
          name: "C",
          octave: 3,
        },
      ],
    });
  });

  it("raises the correct notes for a second-inversion triad", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const target = generateTriadTarget(
      "bass",
      new Set(["augmented"]),
      new Set(["second"]),
    );

    expect(target).toEqual({
      clef: "bass",
      name: {
        primary: "C Augmented",
        secondary: "Second inversion",
      },
      notes: [
        {
          midiNumber: 44,
          name: "G♯",
          octave: 2,
        },
        {
          midiNumber: 48,
          name: "C",
          octave: 3,
        },
        {
          midiNumber: 52,
          name: "E",
          octave: 3,
        },
      ],
    });
  });

  it.each(["bass", "treble"] as const)(
    "keeps every generated note inside the %s-clef range",
    (clef) => {
      vi.spyOn(Math, "random").mockReturnValue(0.999999);

      const target = generateTriadTarget(
        clef,
        new Set(["major", "minor", "diminished", "augmented"]),
        new Set(["root", "first", "second"]),
      );

      const range = NOTE_RANGES[clef];

      expect(target.notes).toHaveLength(3);

      for (const note of target.notes) {
        expect(note.midiNumber).toBeGreaterThanOrEqual(range.minMidi);
        expect(note.midiNumber).toBeLessThanOrEqual(range.maxMidi);
      }
    },
  );

  it.each(GENERATED_TRIAD_TEST_CASES)(
    "honors the $quality quality and $position position selections",
    ({ position, positionLabel, quality, qualityLabel }) => {
      vi.spyOn(Math, "random").mockReturnValue(0);

      const target = generateTriadTarget(
        "bass",
        new Set([quality]),
        new Set([position]),
      );

      expect(target.name.primary.endsWith(` ${qualityLabel}`)).toBe(true);
      expect(target.name.secondary).toBe(positionLabel);
      expect(target.notes).toHaveLength(3);
    },
  );

  it.each([0, 0.25, 0.5, 0.75, 0.999999])(
    "avoids unsupported double-accidental spellings at random value %s",
    (randomValue) => {
      vi.spyOn(Math, "random").mockReturnValue(randomValue);

      const target = generateTriadTarget(
        "treble",
        new Set(["major", "minor", "diminished", "augmented"]),
        new Set(["root", "first", "second"]),
      );

      for (const note of target.notes) {
        expect(note.name).not.toContain("♯♯");
        expect(note.name).not.toContain("♭♭");
      }

      expect(target.name.primary).not.toContain("♯♯");
      expect(target.name.primary).not.toContain("♭♭");
    },
  );

  it("returns three notes in ascending MIDI order", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const target = generateTriadTarget(
      "treble",
      new Set(["major", "minor", "diminished", "augmented"]),
      new Set(["root", "first", "second"]),
    );

    const midiNumbers = target.notes.map((note) => note.midiNumber);

    expect(midiNumbers).toEqual([...midiNumbers].sort((a, b) => a - b));
  });
});
