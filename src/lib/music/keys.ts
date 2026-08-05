import type { NoteLetter } from "./note-utils";

export type MusicKeyMode = "major" | "minor";

export type MusicKeyOrientation = "neutral" | "sharp" | "flat";

export type MusicKeyId =
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

export type MusicKeyScaleDegree = Readonly<{
  letter: NoteLetter;
  name: string;
  pitchClass: number;
}>;

type DiatonicScale = readonly [
  MusicKeyScaleDegree,
  MusicKeyScaleDegree,
  MusicKeyScaleDegree,
  MusicKeyScaleDegree,
  MusicKeyScaleDegree,
  MusicKeyScaleDegree,
  MusicKeyScaleDegree,
];

export type MusicKeyDefinition = Readonly<{
  diatonicScale: DiatonicScale;
  id: MusicKeyId;
  mode: MusicKeyMode;
  name: string;
  orientation: MusicKeyOrientation;
  tonicLetter: NoteLetter;
  tonicName: string;
  tonicPitchClass: number;
  vexflowKeySignature: string;
}>;

export const MUSIC_KEY_SCALE_SEMITONES: Readonly<
  Record<MusicKeyMode, readonly [number, number, number, number, number, number, number]>
> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

const NOTE_LETTERS: ReadonlyArray<NoteLetter> = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
];

function normalizePitchClass(value: number): number {
  return ((value % 12) + 12) % 12;
}

function scaleDegree(name: string): MusicKeyScaleDegree {
  const letter = NOTE_LETTERS.find((candidate) => name.startsWith(candidate));

  if (!letter) {
    throw new Error(`Unable to resolve scale-degree letter from ${name}.`);
  }

  const naturalPitchClasses: Readonly<Record<NoteLetter, number>> = {
    A: 9,
    B: 11,
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
  };
  const accidentalOffset = name.includes("♯")
    ? 1
    : name.includes("♭")
      ? -1
      : 0;

  return {
    letter,
    name,
    pitchClass: normalizePitchClass(
      naturalPitchClasses[letter] + accidentalOffset,
    ),
  };
}

function diatonicScale(
  names: readonly [string, string, string, string, string, string, string],
): DiatonicScale {
  return names.map(scaleDegree) as unknown as DiatonicScale;
}

export const MUSIC_KEYS: ReadonlyArray<MusicKeyDefinition> = [
  {
    id: "c-major",
    mode: "major",
    name: "C major",
    orientation: "neutral",
    tonicLetter: "C",
    tonicName: "C",
    tonicPitchClass: 0,
    vexflowKeySignature: "C",
    diatonicScale: diatonicScale(["C", "D", "E", "F", "G", "A", "B"]),
  },
  {
    id: "g-major",
    mode: "major",
    name: "G major",
    orientation: "sharp",
    tonicLetter: "G",
    tonicName: "G",
    tonicPitchClass: 7,
    vexflowKeySignature: "G",
    diatonicScale: diatonicScale(["G", "A", "B", "C", "D", "E", "F♯"]),
  },
  {
    id: "d-major",
    mode: "major",
    name: "D major",
    orientation: "sharp",
    tonicLetter: "D",
    tonicName: "D",
    tonicPitchClass: 2,
    vexflowKeySignature: "D",
    diatonicScale: diatonicScale(["D", "E", "F♯", "G", "A", "B", "C♯"]),
  },
  {
    id: "f-major",
    mode: "major",
    name: "F major",
    orientation: "flat",
    tonicLetter: "F",
    tonicName: "F",
    tonicPitchClass: 5,
    vexflowKeySignature: "F",
    diatonicScale: diatonicScale(["F", "G", "A", "B♭", "C", "D", "E"]),
  },
  {
    id: "b-flat-major",
    mode: "major",
    name: "B♭ major",
    orientation: "flat",
    tonicLetter: "B",
    tonicName: "B♭",
    tonicPitchClass: 10,
    vexflowKeySignature: "Bb",
    diatonicScale: diatonicScale(["B♭", "C", "D", "E♭", "F", "G", "A"]),
  },
  {
    id: "e-flat-major",
    mode: "major",
    name: "E♭ major",
    orientation: "flat",
    tonicLetter: "E",
    tonicName: "E♭",
    tonicPitchClass: 3,
    vexflowKeySignature: "Eb",
    diatonicScale: diatonicScale(["E♭", "F", "G", "A♭", "B♭", "C", "D"]),
  },
  {
    id: "a-minor",
    mode: "minor",
    name: "A minor",
    orientation: "neutral",
    tonicLetter: "A",
    tonicName: "A",
    tonicPitchClass: 9,
    vexflowKeySignature: "Am",
    diatonicScale: diatonicScale(["A", "B", "C", "D", "E", "F", "G"]),
  },
  {
    id: "e-minor",
    mode: "minor",
    name: "E minor",
    orientation: "sharp",
    tonicLetter: "E",
    tonicName: "E",
    tonicPitchClass: 4,
    vexflowKeySignature: "Em",
    diatonicScale: diatonicScale(["E", "F♯", "G", "A", "B", "C", "D"]),
  },
  {
    id: "b-minor",
    mode: "minor",
    name: "B minor",
    orientation: "sharp",
    tonicLetter: "B",
    tonicName: "B",
    tonicPitchClass: 11,
    vexflowKeySignature: "Bm",
    diatonicScale: diatonicScale(["B", "C♯", "D", "E", "F♯", "G", "A"]),
  },
  {
    id: "d-minor",
    mode: "minor",
    name: "D minor",
    orientation: "flat",
    tonicLetter: "D",
    tonicName: "D",
    tonicPitchClass: 2,
    vexflowKeySignature: "Dm",
    diatonicScale: diatonicScale(["D", "E", "F", "G", "A", "B♭", "C"]),
  },
  {
    id: "g-minor",
    mode: "minor",
    name: "G minor",
    orientation: "flat",
    tonicLetter: "G",
    tonicName: "G",
    tonicPitchClass: 7,
    vexflowKeySignature: "Gm",
    diatonicScale: diatonicScale(["G", "A", "B♭", "C", "D", "E♭", "F"]),
  },
  {
    id: "c-minor",
    mode: "minor",
    name: "C minor",
    orientation: "flat",
    tonicLetter: "C",
    tonicName: "C",
    tonicPitchClass: 0,
    vexflowKeySignature: "Cm",
    diatonicScale: diatonicScale(["C", "D", "E♭", "F", "G", "A♭", "B♭"]),
  },
];

export function getMusicKeyDefinition(id: MusicKeyId): MusicKeyDefinition {
  const key = MUSIC_KEYS.find((candidate) => candidate.id === id);

  if (!key) {
    throw new Error(`Unknown music key ${id}.`);
  }

  return key;
}

export function getMusicKeysByMode(
  mode: MusicKeyMode,
): ReadonlyArray<MusicKeyDefinition> {
  return MUSIC_KEYS.filter((key) => key.mode === mode);
}
