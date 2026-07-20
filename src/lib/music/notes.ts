import { NOTE_RANGES } from "../../data/note-ranges";
import type {
  Clef,
  PracticeClefMode,
  PracticeExerciseType,
  PracticeNote,
  PracticeNoteCategory,
  PracticeTarget,
} from "../../types/practice";

type AccidentalSpelling = "sharp" | "flat";

const SHARP_NOTE_NAMES = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
] as const;

const FLAT_NOTE_NAMES = [
  "C",
  "D♭",
  "D",
  "E♭",
  "E",
  "F",
  "G♭",
  "G",
  "A♭",
  "A",
  "B♭",
  "B",
] as const;

const NATURAL_PITCH_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]);

type TriadDefinition = Readonly<{
  bassMidiNumbers: readonly [number, number, number];
  trebleMidiNumbers: readonly [number, number, number];
}>;

const C_MAJOR_TRIADS: ReadonlyArray<TriadDefinition> = [
  {
    bassMidiNumbers: [36, 40, 43],
    trebleMidiNumbers: [60, 64, 67],
  },
  {
    bassMidiNumbers: [38, 41, 45],
    trebleMidiNumbers: [62, 65, 69],
  },
  {
    bassMidiNumbers: [40, 43, 47],
    trebleMidiNumbers: [64, 67, 71],
  },
  {
    bassMidiNumbers: [41, 45, 48],
    trebleMidiNumbers: [65, 69, 72],
  },
  {
    bassMidiNumbers: [43, 47, 50],
    trebleMidiNumbers: [67, 71, 74],
  },
  {
    bassMidiNumbers: [45, 48, 52],
    trebleMidiNumbers: [69, 72, 76],
  },
  {
    bassMidiNumbers: [47, 50, 53],
    trebleMidiNumbers: [71, 74, 77],
  },
];

function getPitchClass(midiNumber: number): number {
  return ((midiNumber % 12) + 12) % 12;
}

function isNaturalMidiNumber(midiNumber: number): boolean {
  return NATURAL_PITCH_CLASSES.has(getPitchClass(midiNumber));
}

function getRandomItem<T>(items: ReadonlyArray<T>): T {
  const item = items[Math.floor(Math.random() * items.length)];

  if (item === undefined) {
    throw new Error("Cannot select a random item from an empty array.");
  }

  return item;
}

function getRandomAccidentalSpelling(): AccidentalSpelling {
  return Math.random() < 0.5 ? "sharp" : "flat";
}

export function getNoteName(
  midiNumber: number,
  accidentalSpelling: AccidentalSpelling = "sharp",
): string {
  const noteNames =
    accidentalSpelling === "flat" ? FLAT_NOTE_NAMES : SHARP_NOTE_NAMES;

  return noteNames[getPitchClass(midiNumber)] ?? "";
}

export function getNoteOctave(midiNumber: number): number {
  return Math.floor(midiNumber / 12) - 1;
}

export function getFullNoteName(
  midiNumber: number,
  accidentalSpelling: AccidentalSpelling = "sharp",
): string {
  return `${getNoteName(midiNumber, accidentalSpelling)}${getNoteOctave(
    midiNumber,
  )}`;
}

function getClefForMode(mode: PracticeClefMode): Clef {
  if (mode !== "mixed") {
    return mode;
  }

  return Math.random() < 0.5 ? "bass" : "treble";
}

function getRandomExerciseType(
  enabledExerciseTypes: ReadonlySet<PracticeExerciseType>,
): PracticeExerciseType {
  return getRandomItem(Array.from(enabledExerciseTypes));
}

function createPracticeNote(
  midiNumber: number,
  accidentalSpelling: AccidentalSpelling = "sharp",
): PracticeNote {
  const name = getNoteName(midiNumber, accidentalSpelling);

  if (name === "") {
    throw new Error(`Unable to resolve note name for MIDI ${midiNumber}.`);
  }

  return {
    midiNumber,
    name,
    octave: getNoteOctave(midiNumber),
  };
}

function getEligibleIndividualNoteMidiNumbers(
  clef: Clef,
  enabledNoteCategories: ReadonlySet<PracticeNoteCategory>,
): ReadonlyArray<number> {
  const range = NOTE_RANGES[clef];
  const eligibleMidiNumbers: number[] = [];

  for (
    let midiNumber = range.minMidi;
    midiNumber <= range.maxMidi;
    midiNumber += 1
  ) {
    const category: PracticeNoteCategory = isNaturalMidiNumber(midiNumber)
      ? "naturals"
      : "accidentals";

    if (enabledNoteCategories.has(category)) {
      eligibleMidiNumbers.push(midiNumber);
    }
  }

  return eligibleMidiNumbers;
}

function generateIndividualNoteTarget(
  clef: Clef,
  enabledNoteCategories: ReadonlySet<PracticeNoteCategory>,
): PracticeTarget {
  if (enabledNoteCategories.size === 0) {
    throw new Error("At least one individual note category must be enabled.");
  }

  const eligibleMidiNumbers = getEligibleIndividualNoteMidiNumbers(
    clef,
    enabledNoteCategories,
  );

  const midiNumber = getRandomItem(eligibleMidiNumbers);

  const accidentalSpelling = isNaturalMidiNumber(midiNumber)
    ? "sharp"
    : getRandomAccidentalSpelling();

  return {
    clef,
    notes: [createPracticeNote(midiNumber, accidentalSpelling)],
  };
}

function generateTriadTarget(clef: Clef): PracticeTarget {
  const triad = getRandomItem(C_MAJOR_TRIADS);

  const midiNumbers =
    clef === "bass" ? triad.bassMidiNumbers : triad.trebleMidiNumbers;

  return {
    clef,
    notes: midiNumbers.map((midiNumber) =>
      createPracticeNote(midiNumber, "sharp"),
    ),
  };
}

export function generatePracticeTarget(
  mode: PracticeClefMode,
  enabledExerciseTypes: ReadonlySet<PracticeExerciseType>,
  enabledNoteCategories: ReadonlySet<PracticeNoteCategory>,
): PracticeTarget {
  if (enabledExerciseTypes.size === 0) {
    throw new Error("At least one practice exercise type must be enabled.");
  }

  const clef = getClefForMode(mode);
  const exerciseType = getRandomExerciseType(enabledExerciseTypes);

  if (exerciseType === "triads") {
    return generateTriadTarget(clef);
  }

  return generateIndividualNoteTarget(clef, enabledNoteCategories);
}
