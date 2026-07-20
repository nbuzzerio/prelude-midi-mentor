import { NOTE_RANGES } from "@/data/note-ranges";
import type {
  Clef,
  PracticeNote,
  PracticeTarget,
  PracticeTriadQuality,
} from "@/types/practice";

type NoteLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";

type RootSpelling = Readonly<{
  letter: NoteLetter;
  name: string;
}>;

type TriadFormula = readonly [root: 0, third: number, fifth: number];

const NOTE_LETTERS: readonly NoteLetter[] = ["C", "D", "E", "F", "G", "A", "B"];

const NATURAL_PITCH_CLASSES: Readonly<Record<NoteLetter, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const ROOT_SPELLINGS_BY_PITCH_CLASS: Readonly<
  Record<number, readonly RootSpelling[]>
> = {
  0: [{ letter: "C", name: "C" }],
  1: [
    { letter: "C", name: "C♯" },
    { letter: "D", name: "D♭" },
  ],
  2: [{ letter: "D", name: "D" }],
  3: [
    { letter: "D", name: "D♯" },
    { letter: "E", name: "E♭" },
  ],
  4: [{ letter: "E", name: "E" }],
  5: [{ letter: "F", name: "F" }],
  6: [
    { letter: "F", name: "F♯" },
    { letter: "G", name: "G♭" },
  ],
  7: [{ letter: "G", name: "G" }],
  8: [
    { letter: "G", name: "G♯" },
    { letter: "A", name: "A♭" },
  ],
  9: [{ letter: "A", name: "A" }],
  10: [
    { letter: "A", name: "A♯" },
    { letter: "B", name: "B♭" },
  ],
  11: [{ letter: "B", name: "B" }],
};

const TRIAD_FORMULAS: Readonly<Record<PracticeTriadQuality, TriadFormula>> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
};

function getPitchClass(midiNumber: number): number {
  return ((midiNumber % 12) + 12) % 12;
}

function getMidiOctave(midiNumber: number): number {
  return Math.floor(midiNumber / 12) - 1;
}

function getRandomItem<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];

  if (item === undefined) {
    throw new Error("Cannot select a random item from an empty array.");
  }

  return item;
}

function getLetterIndex(letter: NoteLetter): number {
  return NOTE_LETTERS.indexOf(letter);
}

function getNoteLetter(
  rootLetter: NoteLetter,
  diatonicOffset: number,
): NoteLetter {
  const rootIndex = getLetterIndex(rootLetter);
  const letter =
    NOTE_LETTERS[(rootIndex + diatonicOffset) % NOTE_LETTERS.length];

  if (letter === undefined) {
    throw new Error(`Unable to determine note letter from ${rootLetter}.`);
  }

  return letter;
}

function getWrittenOctave(
  rootLetter: NoteLetter,
  rootOctave: number,
  diatonicOffset: number,
): number {
  const rootIndex = getLetterIndex(rootLetter);

  return rootOctave + Math.floor((rootIndex + diatonicOffset) / 7);
}

function spellPitchClass(
  letter: NoteLetter,
  targetPitchClass: number,
): string | null {
  const naturalPitchClass = NATURAL_PITCH_CLASSES[letter];
  const difference = (targetPitchClass - naturalPitchClass + 12) % 12;

  if (difference === 0) {
    return letter;
  }

  if (difference === 1) {
    return `${letter}♯`;
  }

  if (difference === 11) {
    return `${letter}♭`;
  }

  return null;
}

function createTriadNotes(
  rootMidiNumber: number,
  rootSpelling: RootSpelling,
  quality: PracticeTriadQuality,
): readonly PracticeNote[] | null {
  const formula = TRIAD_FORMULAS[quality];
  const rootOctave = getMidiOctave(rootMidiNumber);
  const diatonicOffsets = [0, 2, 4] as const;

  const notes: PracticeNote[] = [];

  for (let index = 0; index < formula.length; index += 1) {
    const semitoneOffset = formula[index];
    const diatonicOffset = diatonicOffsets[index];

    if (semitoneOffset === undefined || diatonicOffset === undefined) {
      throw new Error("Invalid triad formula.");
    }

    const midiNumber = rootMidiNumber + semitoneOffset;
    const letter = getNoteLetter(rootSpelling.letter, diatonicOffset);
    const name = spellPitchClass(letter, getPitchClass(midiNumber));

    // Avoid double sharps and double flats for now.
    if (name === null) {
      return null;
    }

    notes.push({
      midiNumber,
      name,
      octave: getWrittenOctave(rootSpelling.letter, rootOctave, diatonicOffset),
    });
  }

  return notes;
}

type TriadCandidate = Readonly<{
  notes: readonly PracticeNote[];
  quality: PracticeTriadQuality;
}>;

function getTriadCandidates(
  clef: Clef,
  enabledQualities: ReadonlySet<PracticeTriadQuality>,
): readonly TriadCandidate[] {
  const range = NOTE_RANGES[clef];
  const candidates: TriadCandidate[] = [];

  for (
    let rootMidiNumber = range.minMidi;
    rootMidiNumber <= range.maxMidi;
    rootMidiNumber += 1
  ) {
    const rootPitchClass = getPitchClass(rootMidiNumber);
    const rootSpellings = ROOT_SPELLINGS_BY_PITCH_CLASS[rootPitchClass] ?? [];

    for (const quality of enabledQualities) {
      const highestInterval = TRIAD_FORMULAS[quality][2];

      if (rootMidiNumber + highestInterval > range.maxMidi) {
        continue;
      }

      for (const rootSpelling of rootSpellings) {
        const notes = createTriadNotes(rootMidiNumber, rootSpelling, quality);

        if (notes === null) {
          continue;
        }

        candidates.push({
          notes,
          quality,
        });
      }
    }
  }

  return candidates;
}

export function generateTriadTarget(
  clef: Clef,
  enabledQualities: ReadonlySet<PracticeTriadQuality>,
): PracticeTarget {
  if (enabledQualities.size === 0) {
    throw new Error("At least one triad quality must be enabled.");
  }

  const candidates = getTriadCandidates(clef, enabledQualities);

  if (candidates.length === 0) {
    throw new Error(`No playable triads are available in the ${clef} range.`);
  }

  const candidate = getRandomItem(candidates);

  return {
    clef,
    notes: candidate.notes,
  };
}
