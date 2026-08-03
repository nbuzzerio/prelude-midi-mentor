import { NOTE_RANGES } from "@/data/note-ranges";
import type {
  Clef,
  PracticeNote,
  PracticeTarget,
  PracticeTriadPosition,
  PracticeTriadQuality,
} from "@/types/practice";

import { createRootPositionTriad } from "../chords";

type NoteLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";

type RootSpelling = Readonly<{
  letter: NoteLetter;
  name: string;
}>;

type TriadFormula = readonly [root: 0, third: number, fifth: number];

type TriadMidiNumbers = readonly [
  rootOrBass: number,
  middle: number,
  top: number,
];

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

const TRIAD_QUALITY_LABELS: Readonly<Record<PracticeTriadQuality, string>> = {
  major: "Major",
  minor: "Minor",
  diminished: "Diminished",
  augmented: "Augmented",
};

const TRIAD_POSITION_LABELS: Readonly<Record<PracticeTriadPosition, string>> = {
  root: "Root position",
  first: "First inversion",
  second: "Second inversion",
};

function getPitchClass(midiNumber: number): number {
  return ((midiNumber % 12) + 12) % 12;
}

function getRandomItem<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];

  if (item === undefined) {
    throw new Error("Cannot select a random item from an empty array.");
  }

  return item;
}

export function getTriadMidiNumbers(
  rootMidiNumber: number,
  quality: PracticeTriadQuality,
  position: PracticeTriadPosition,
): TriadMidiNumbers {
  const [, thirdInterval, fifthInterval] = TRIAD_FORMULAS[quality];

  const root = rootMidiNumber;
  const third = rootMidiNumber + thirdInterval;
  const fifth = rootMidiNumber + fifthInterval;

  if (position === "first") {
    return [third, fifth, root + 12];
  }

  if (position === "second") {
    return [fifth, root + 12, third + 12];
  }

  return [root, third, fifth];
}

function createRootPositionNotes(
  rootMidiNumber: number,
  rootSpelling: RootSpelling,
  quality: PracticeTriadQuality,
): readonly PracticeNote[] | null {
  return createRootPositionTriad(
    {
      midiNumber: rootMidiNumber,
      name: rootSpelling.name,
      octave: Math.floor(rootMidiNumber / 12) - 1,
    },
    quality,
  );
}

function applyTriadPosition(
  rootPositionNotes: readonly PracticeNote[],
  position: PracticeTriadPosition,
): readonly PracticeNote[] {
  const [root, third, fifth] = rootPositionNotes;

  if (root === undefined || third === undefined || fifth === undefined) {
    throw new Error("A triad must contain exactly three notes.");
  }

  const raiseOneOctave = (note: PracticeNote): PracticeNote => ({
    ...note,
    midiNumber: note.midiNumber + 12,
    octave: note.octave + 1,
  });

  if (position === "first") {
    return [third, fifth, raiseOneOctave(root)];
  }

  if (position === "second") {
    return [fifth, raiseOneOctave(root), raiseOneOctave(third)];
  }

  return [root, third, fifth];
}

function notesFitClefRange(
  notes: readonly PracticeNote[],
  clef: Clef,
): boolean {
  const range = NOTE_RANGES[clef];

  return notes.every(
    (note) =>
      note.midiNumber >= range.minMidi && note.midiNumber <= range.maxMidi,
  );
}

type TriadCandidate = Readonly<{
  notes: readonly PracticeNote[];
  position: PracticeTriadPosition;
  quality: PracticeTriadQuality;
  rootName: string;
}>;

function getTriadCandidates(
  clef: Clef,
  enabledQualities: ReadonlySet<PracticeTriadQuality>,
  enabledPositions: ReadonlySet<PracticeTriadPosition>,
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
      for (const rootSpelling of rootSpellings) {
        const rootPositionNotes = createRootPositionNotes(
          rootMidiNumber,
          rootSpelling,
          quality,
        );

        if (rootPositionNotes === null) {
          continue;
        }

        for (const position of enabledPositions) {
          const positionedNotes = applyTriadPosition(
            rootPositionNotes,
            position,
          );

          if (!notesFitClefRange(positionedNotes, clef)) {
            continue;
          }

          candidates.push({
            notes: positionedNotes,
            position,
            quality,
            rootName: rootSpelling.name,
          });
        }
      }
    }
  }

  return candidates;
}

export function generateTriadTarget(
  clef: Clef,
  enabledQualities: ReadonlySet<PracticeTriadQuality>,
  enabledPositions: ReadonlySet<PracticeTriadPosition>,
): PracticeTarget {
  if (enabledQualities.size === 0) {
    throw new Error("At least one triad quality must be enabled.");
  }

  if (enabledPositions.size === 0) {
    throw new Error("At least one triad position must be enabled.");
  }

  const candidates = getTriadCandidates(
    clef,
    enabledQualities,
    enabledPositions,
  );

  if (candidates.length === 0) {
    throw new Error(`No playable triads are available in the ${clef} range.`);
  }

  const candidate = getRandomItem(candidates);

  return {
    clef,
    name: {
      primary: `${candidate.rootName} ${
        TRIAD_QUALITY_LABELS[candidate.quality]
      }`,
      secondary: TRIAD_POSITION_LABELS[candidate.position],
    },
    notes: candidate.notes,
  };
}
