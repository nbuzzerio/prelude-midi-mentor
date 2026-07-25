import type { Clef, PracticeClefMode, PracticeNote } from "@/types/practice";

export type AccidentalSpelling = "sharp" | "flat";

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
