import type {
  PracticeNote,
  PracticeTriadQuality,
} from "@/types/practice";

import {
  createTheoryPracticeNote,
  type NoteLetter,
} from "./note-utils";

type TriadFormula = readonly [root: 0, third: number, fifth: number];

const NOTE_LETTERS: ReadonlyArray<NoteLetter> = [
  "C",
  "D",
  "E",
  "F",
  "G",
  "A",
  "B",
];

const TRIAD_FORMULAS: Readonly<Record<PracticeTriadQuality, TriadFormula>> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
};

function getNoteLetter(note: PracticeNote): NoteLetter {
  const letter = NOTE_LETTERS.find((candidate) =>
    note.name.startsWith(candidate),
  );

  if (!letter) {
    throw new Error(`Unable to resolve note letter from ${note.name}.`);
  }

  return letter;
}

function shiftNoteLetter(
  startingLetter: NoteLetter,
  diatonicSteps: number,
): NoteLetter {
  const startingIndex = NOTE_LETTERS.indexOf(startingLetter);
  const shiftedLetter = NOTE_LETTERS[
    (startingIndex + diatonicSteps) % NOTE_LETTERS.length
  ];

  if (!shiftedLetter) {
    throw new Error(
      `Unable to resolve note letter ${diatonicSteps} steps from ${startingLetter}.`,
    );
  }

  return shiftedLetter;
}

/**
 * Constructs a correctly spelled root-position triad.
 *
 * Returns null when a chord tone would require an unsupported double
 * accidental.
 */
export function createRootPositionTriad(
  rootNote: PracticeNote,
  quality: PracticeTriadQuality,
): ReadonlyArray<PracticeNote> | null {
  const formula = TRIAD_FORMULAS[quality];
  const rootLetter = getNoteLetter(rootNote);
  const diatonicOffsets = [0, 2, 4] as const;

  try {
    return formula.map((semitoneOffset, index) => {
      const diatonicOffset = diatonicOffsets[index];

      if (diatonicOffset === undefined) {
        throw new Error("Invalid triad formula.");
      }

      return createTheoryPracticeNote(
        rootNote.midiNumber + semitoneOffset,
        shiftNoteLetter(rootLetter, diatonicOffset),
      );
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("without a double accidental")
    ) {
      return null;
    }

    throw error;
  }
}
