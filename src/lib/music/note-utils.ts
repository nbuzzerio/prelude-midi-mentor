import type { Clef, PracticeClefMode, PracticeNote } from "@/types/practice";

export type AccidentalSpelling = "sharp" | "flat";

export type NoteLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";

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

const NATURAL_PITCH_CLASS_BY_LETTER: Readonly<Record<NoteLetter, number>> = {
  A: 9,
  B: 11,
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
};

const NATURAL_NOTE_LETTER_BY_PITCH_CLASS: Readonly<
  Partial<Record<number, NoteLetter>>
> = {
  0: "C",
  2: "D",
  4: "E",
  5: "F",
  7: "G",
  9: "A",
  11: "B",
};

const ACCIDENTAL_NOTE_LETTER_CANDIDATES: Readonly<
  Partial<Record<number, ReadonlyArray<NoteLetter>>>
> = {
  1: ["C", "D"],
  3: ["D", "E"],
  6: ["F", "G"],
  8: ["G", "A"],
  10: ["A", "B"],
};

export function getPitchClass(midiNumber: number): number {
  return ((midiNumber % 12) + 12) % 12;
}

export function isNaturalMidiNumber(midiNumber: number): boolean {
  return NATURAL_PITCH_CLASSES.has(getPitchClass(midiNumber));
}

export function getRandomItem<T>(items: ReadonlyArray<T>): T {
  const item = items[Math.floor(Math.random() * items.length)];

  if (item === undefined) {
    throw new Error("Cannot select a random item from an empty array.");
  }

  return item;
}

export function getRandomAccidentalSpelling(): AccidentalSpelling {
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
  return `${getNoteName(
    midiNumber,
    accidentalSpelling,
  )}${getNoteOctave(midiNumber)}`;
}

export function getClefForMode(mode: PracticeClefMode): Clef {
  if (mode !== "mixed") {
    return mode;
  }

  return Math.random() < 0.5 ? "bass" : "treble";
}

export function createPracticeNote(
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

export function getTheoryRootLetterCandidates(
  midiNumber: number,
): ReadonlyArray<NoteLetter> {
  const pitchClass = getPitchClass(midiNumber);

  const naturalLetter = NATURAL_NOTE_LETTER_BY_PITCH_CLASS[pitchClass];

  if (naturalLetter !== undefined) {
    return [naturalLetter];
  }

  const accidentalCandidates = ACCIDENTAL_NOTE_LETTER_CANDIDATES[pitchClass];

  if (accidentalCandidates === undefined) {
    throw new Error(
      `Unable to resolve theory spelling candidates for MIDI ${midiNumber}.`,
    );
  }

  return accidentalCandidates;
}

/**
 * Creates a PracticeNote using a required musical letter name.
 *
 * Unlike createPracticeNote(), this function preserves correct
 * music-theory spelling for intervals, scales, and arpeggios.
 *
 * Double accidentals are intentionally rejected because Prelude
 * does not yet support displaying them.
 */
export function createTheoryPracticeNote(
  midiNumber: number,
  letter: NoteLetter,
): PracticeNote {
  const targetPitchClass = getPitchClass(midiNumber);
  const naturalPitchClass = NATURAL_PITCH_CLASS_BY_LETTER[letter];

  const pitchClassDifference = (targetPitchClass - naturalPitchClass + 12) % 12;

  let accidentalSymbol = "";
  let accidentalOffset = 0;

  if (pitchClassDifference === 1) {
    accidentalSymbol = "♯";
    accidentalOffset = 1;
  } else if (pitchClassDifference === 11) {
    accidentalSymbol = "♭";
    accidentalOffset = -1;
  } else if (pitchClassDifference !== 0) {
    throw new Error(
      `MIDI ${midiNumber} cannot be spelled as ${letter} without a double accidental.`,
    );
  }

  const octave = (midiNumber - naturalPitchClass - accidentalOffset) / 12 - 1;

  if (!Number.isInteger(octave)) {
    throw new Error(
      `Unable to resolve the written octave for MIDI ${midiNumber} as ${letter}.`,
    );
  }

  return {
    midiNumber,
    name: `${letter}${accidentalSymbol}`,
    octave,
  };
}
