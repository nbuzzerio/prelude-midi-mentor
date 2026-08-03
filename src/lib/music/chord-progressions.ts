import type { PracticeNote, PracticeTriadQuality } from "@/types/practice";

import { createRootPositionTriad } from "./chords";
import {
  createTheoryPracticeNote,
  getPitchClass,
  type NoteLetter,
} from "./note-utils";

export type ChordProgressionKeyMode = "major" | "minor";

export type ChordProgressionKeyId =
  | "c-major"
  | "g-major"
  | "d-major"
  | "f-major"
  | "b-flat-major"
  | "e-flat-major"
  | "a-minor"
  | "e-minor"
  | "b-minor"
  | "d-minor"
  | "g-minor"
  | "c-minor";

export type ChordProgressionTemplateId =
  | "major-1451"
  | "major-251"
  | "major-1645"
  | "major-1564"
  | "major-6415"
  | "minor-1451"
  | "minor-1637"
  | "minor-1767"
  | "minor-251";

export type ScaleDegree = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ChordProgressionKey = Readonly<{
  id: ChordProgressionKeyId;
  mode: ChordProgressionKeyMode;
  name: string;
  tonicLetter: NoteLetter;
  tonicName: string;
  tonicPitchClass: number;
}>;

export type ProgressionChordSpecification = Readonly<{
  degree: ScaleDegree;
  quality: PracticeTriadQuality;
  romanNumeral: string;
}>;

export type ChordProgressionTemplate = Readonly<{
  chords: ReadonlyArray<ProgressionChordSpecification>;
  id: ChordProgressionTemplateId;
  mode: ChordProgressionKeyMode;
  name: string;
}>;

export type RealizedProgressionChord = Readonly<{
  chordName: string;
  degree: ScaleDegree;
  notes: ReadonlyArray<PracticeNote>;
  quality: PracticeTriadQuality;
  romanNumeral: string;
}>;

export type RealizedChordProgression = Readonly<{
  chords: ReadonlyArray<RealizedProgressionChord>;
  key: ChordProgressionKey;
  template: ChordProgressionTemplate;
}>;

const majorChord = (
  degree: ScaleDegree,
  romanNumeral: string,
): ProgressionChordSpecification => ({
  degree,
  quality: "major",
  romanNumeral,
});

const minorChord = (
  degree: ScaleDegree,
  romanNumeral: string,
): ProgressionChordSpecification => ({
  degree,
  quality: "minor",
  romanNumeral,
});

const diminishedChord = (
  degree: ScaleDegree,
  romanNumeral: string,
): ProgressionChordSpecification => ({
  degree,
  quality: "diminished",
  romanNumeral,
});

export const SUPPORTED_CHORD_PROGRESSION_KEYS: ReadonlyArray<ChordProgressionKey> = [
  { id: "c-major", mode: "major", name: "C major", tonicLetter: "C", tonicName: "C", tonicPitchClass: 0 },
  { id: "g-major", mode: "major", name: "G major", tonicLetter: "G", tonicName: "G", tonicPitchClass: 7 },
  { id: "d-major", mode: "major", name: "D major", tonicLetter: "D", tonicName: "D", tonicPitchClass: 2 },
  { id: "f-major", mode: "major", name: "F major", tonicLetter: "F", tonicName: "F", tonicPitchClass: 5 },
  { id: "b-flat-major", mode: "major", name: "B♭ major", tonicLetter: "B", tonicName: "B♭", tonicPitchClass: 10 },
  { id: "e-flat-major", mode: "major", name: "E♭ major", tonicLetter: "E", tonicName: "E♭", tonicPitchClass: 3 },
  { id: "a-minor", mode: "minor", name: "A minor", tonicLetter: "A", tonicName: "A", tonicPitchClass: 9 },
  { id: "e-minor", mode: "minor", name: "E minor", tonicLetter: "E", tonicName: "E", tonicPitchClass: 4 },
  { id: "b-minor", mode: "minor", name: "B minor", tonicLetter: "B", tonicName: "B", tonicPitchClass: 11 },
  { id: "d-minor", mode: "minor", name: "D minor", tonicLetter: "D", tonicName: "D", tonicPitchClass: 2 },
  { id: "g-minor", mode: "minor", name: "G minor", tonicLetter: "G", tonicName: "G", tonicPitchClass: 7 },
  { id: "c-minor", mode: "minor", name: "C minor", tonicLetter: "C", tonicName: "C", tonicPitchClass: 0 },
];

export const CHORD_PROGRESSION_TEMPLATES: ReadonlyArray<ChordProgressionTemplate> = [
  { id: "major-1451", mode: "major", name: "I–IV–V–I", chords: [majorChord(1, "I"), majorChord(4, "IV"), majorChord(5, "V"), majorChord(1, "I")] },
  { id: "major-251", mode: "major", name: "ii–V–I", chords: [minorChord(2, "ii"), majorChord(5, "V"), majorChord(1, "I")] },
  { id: "major-1645", mode: "major", name: "I–vi–IV–V", chords: [majorChord(1, "I"), minorChord(6, "vi"), majorChord(4, "IV"), majorChord(5, "V")] },
  { id: "major-1564", mode: "major", name: "I–V–vi–IV", chords: [majorChord(1, "I"), majorChord(5, "V"), minorChord(6, "vi"), majorChord(4, "IV")] },
  { id: "major-6415", mode: "major", name: "vi–IV–I–V", chords: [minorChord(6, "vi"), majorChord(4, "IV"), majorChord(1, "I"), majorChord(5, "V")] },
  { id: "minor-1451", mode: "minor", name: "i–iv–V–i", chords: [minorChord(1, "i"), minorChord(4, "iv"), majorChord(5, "V"), minorChord(1, "i")] },
  { id: "minor-1637", mode: "minor", name: "i–VI–III–VII", chords: [minorChord(1, "i"), majorChord(6, "VI"), majorChord(3, "III"), majorChord(7, "VII")] },
  { id: "minor-1767", mode: "minor", name: "i–VII–VI–VII", chords: [minorChord(1, "i"), majorChord(7, "VII"), majorChord(6, "VI"), majorChord(7, "VII")] },
  { id: "minor-251", mode: "minor", name: "ii°–V–i", chords: [diminishedChord(2, "ii°"), majorChord(5, "V"), minorChord(1, "i")] },
];

const SCALE_SEMITONES: Readonly<Record<ChordProgressionKeyMode, ReadonlyArray<number>>> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

const NOTE_LETTERS: ReadonlyArray<NoteLetter> = ["C", "D", "E", "F", "G", "A", "B"];

export function getSupportedChordProgressionKey(
  id: ChordProgressionKeyId,
): ChordProgressionKey {
  const key = SUPPORTED_CHORD_PROGRESSION_KEYS.find((candidate) => candidate.id === id);

  if (!key) {
    throw new Error(`Unknown chord progression key ${id}.`);
  }

  return key;
}

export function getChordProgressionTemplate(
  id: ChordProgressionTemplateId,
): ChordProgressionTemplate {
  const template = CHORD_PROGRESSION_TEMPLATES.find((candidate) => candidate.id === id);

  if (!template) {
    throw new Error(`Unknown chord progression template ${id}.`);
  }

  return template;
}

export function getChordProgressionTemplatesForMode(
  mode: ChordProgressionKeyMode,
): ReadonlyArray<ChordProgressionTemplate> {
  return CHORD_PROGRESSION_TEMPLATES.filter((template) => template.mode === mode);
}

function getDegreeLetter(
  tonicLetter: NoteLetter,
  degree: ScaleDegree,
): NoteLetter {
  const tonicIndex = NOTE_LETTERS.indexOf(tonicLetter);
  const letter = NOTE_LETTERS[(tonicIndex + degree - 1) % NOTE_LETTERS.length];

  if (!letter) {
    throw new Error(`Unable to resolve scale degree ${degree} from ${tonicLetter}.`);
  }

  return letter;
}

export function realizeChordProgression({
  key,
  template,
  tonicMidiNumber,
}: Readonly<{
  key: ChordProgressionKey;
  template: ChordProgressionTemplate;
  tonicMidiNumber: number;
}>): RealizedChordProgression | null {
  if (key.mode !== template.mode) {
    throw new Error(
      `The ${template.name} template is not compatible with ${key.name}.`,
    );
  }

  if (getPitchClass(tonicMidiNumber) !== key.tonicPitchClass) {
    throw new Error(
      `MIDI ${tonicMidiNumber} does not match the tonic of ${key.name}.`,
    );
  }

  const scaleSemitones = SCALE_SEMITONES[key.mode];
  const chords: RealizedProgressionChord[] = [];

  for (const specification of template.chords) {
    const semitoneOffset = scaleSemitones[specification.degree - 1];

    if (semitoneOffset === undefined) {
      throw new Error(`Missing scale degree ${specification.degree}.`);
    }

    let rootNote: PracticeNote;

    try {
      rootNote = createTheoryPracticeNote(
        tonicMidiNumber + semitoneOffset,
        getDegreeLetter(key.tonicLetter, specification.degree),
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("without a double accidental")) {
        return null;
      }

      throw error;
    }

    const notes = createRootPositionTriad(rootNote, specification.quality);

    if (notes === null) {
      return null;
    }

    chords.push({
      chordName: `${rootNote.name} ${specification.quality}`,
      degree: specification.degree,
      notes,
      quality: specification.quality,
      romanNumeral: specification.romanNumeral,
    });
  }

  return { chords, key, template };
}
