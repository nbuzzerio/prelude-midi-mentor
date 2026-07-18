import { NOTE_RANGES } from "../../data/note-ranges";
import type {
  Clef,
  PracticeClefMode,
  PracticeExerciseType,
  PracticeNote,
  PracticeTarget,
} from "../../types/practice";

const NOTE_NAMES = [
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

type TriadDefinition = Readonly<{
  bassMidiNumbers: readonly [number, number, number];
  trebleMidiNumbers: readonly [number, number, number];
}>;

const C_MAJOR_TRIADS: ReadonlyArray<TriadDefinition> = [
  {
    bassMidiNumbers: [36, 40, 43], // C2 E2 G2
    trebleMidiNumbers: [60, 64, 67], // C4 E4 G4
  },
  {
    bassMidiNumbers: [38, 41, 45], // D2 F2 A2
    trebleMidiNumbers: [62, 65, 69], // D4 F4 A4
  },
  {
    bassMidiNumbers: [40, 43, 47], // E2 G2 B2
    trebleMidiNumbers: [64, 67, 71], // E4 G4 B4
  },
  {
    bassMidiNumbers: [41, 45, 48], // F2 A2 C3
    trebleMidiNumbers: [65, 69, 72], // F4 A4 C5
  },
  {
    bassMidiNumbers: [43, 47, 50], // G2 B2 D3
    trebleMidiNumbers: [67, 71, 74], // G4 B4 D5
  },
  {
    bassMidiNumbers: [45, 48, 52], // A2 C3 E3
    trebleMidiNumbers: [69, 72, 76], // A4 C5 E5
  },
  {
    bassMidiNumbers: [47, 50, 53], // B2 D3 F3
    trebleMidiNumbers: [71, 74, 77], // B4 D5 F5
  },
];

function getRandomInteger(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomItem<T>(items: ReadonlyArray<T>): T {
  const item = items[Math.floor(Math.random() * items.length)];

  if (item === undefined) {
    throw new Error("Cannot select a random item from an empty array.");
  }

  return item;
}

export function getNoteName(midiNumber: number): string {
  return NOTE_NAMES[midiNumber % 12] ?? "";
}

export function getNoteOctave(midiNumber: number): number {
  return Math.floor(midiNumber / 12) - 1;
}

export function getFullNoteName(midiNumber: number): string {
  return `${getNoteName(midiNumber)}${getNoteOctave(midiNumber)}`;
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

function createPracticeNote(midiNumber: number): PracticeNote {
  const name = NOTE_NAMES[midiNumber % NOTE_NAMES.length];

  if (name === undefined) {
    throw new Error(`Unable to resolve note name for MIDI ${midiNumber}.`);
  }

  return {
    midiNumber,
    name,
    octave: Math.floor(midiNumber / 12) - 1,
  };
}

function generateTriadTarget(mode: PracticeClefMode): PracticeTarget {
  const clef = getClefForMode(mode);
  const triad = getRandomItem(C_MAJOR_TRIADS);

  const midiNumbers =
    clef === "bass" ? triad.bassMidiNumbers : triad.trebleMidiNumbers;

  return {
    clef,
    notes: midiNumbers.map(createPracticeNote),
  };
}

export function generatePracticeTarget(
  mode: PracticeClefMode,
  enabledExerciseTypes: ReadonlySet<PracticeExerciseType>,
): PracticeTarget {
  const clef = getClefForMode(mode);
  const range = NOTE_RANGES[clef];
  const midiNumber = getRandomInteger(range.minMidi, range.maxMidi);
  const exerciseType = getRandomExerciseType(enabledExerciseTypes);

  if (exerciseType === "triads") {
    return generateTriadTarget(mode);
  }

  if (enabledExerciseTypes.size === 0) {
    throw new Error("At least one practice exercise type must be enabled.");
  }

  return {
    clef,
    notes: [
      {
        midiNumber,
        name: getNoteName(midiNumber),
        octave: getNoteOctave(midiNumber),
      },
    ],
  };
}
