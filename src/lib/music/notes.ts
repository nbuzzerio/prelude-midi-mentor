import { NOTE_RANGES } from "../../data/note-ranges";
import type { Clef, PracticeMode, TargetNote } from "../../types/practice";

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

function getRandomInteger(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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

function getClefForMode(mode: PracticeMode): Clef {
  if (mode !== "mixed") {
    return mode;
  }

  return Math.random() < 0.5 ? "bass" : "treble";
}

export function generateTargetNote(mode: PracticeMode): TargetNote {
  const clef = getClefForMode(mode);
  const range = NOTE_RANGES[clef];
  const midiNumber = getRandomInteger(range.minMidi, range.maxMidi);

  return {
    clef,
    midiNumber,
    name: getNoteName(midiNumber),
    octave: getNoteOctave(midiNumber),
  };
}
