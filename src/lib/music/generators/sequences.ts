import { NOTE_RANGES } from "@/data/note-ranges";
import type {
  Clef,
  PracticeNote,
  SequenceArpeggio,
  SequenceDirection,
  SequenceExerciseType,
  SequenceInterval,
  SequenceNoteCategory,
  SequenceScale,
  SequenceTarget,
} from "@/types/practice";

import {
  createTheoryPracticeNote,
  getRandomItem,
  getTheoryRootLetterCandidates,
  isNaturalMidiNumber,
} from "../note-utils";
import type { NoteLetter } from "../note-utils";

const INTERVAL_SEMITONES: Readonly<Record<SequenceInterval, number>> = {
  "minor-second": 1,
  "major-second": 2,
  "minor-third": 3,
  "major-third": 4,
  "perfect-fourth": 5,
  "perfect-fifth": 7,
  "minor-sixth": 8,
  "major-sixth": 9,
  "minor-seventh": 10,
  "major-seventh": 11,
  octave: 12,
};

const INTERVAL_DIATONIC_STEPS: Readonly<Record<SequenceInterval, number>> = {
  "minor-second": 1,
  "major-second": 1,
  "minor-third": 2,
  "major-third": 2,
  "perfect-fourth": 3,
  "perfect-fifth": 4,
  "minor-sixth": 5,
  "major-sixth": 5,
  "minor-seventh": 6,
  "major-seventh": 6,
  octave: 7,
};

const INTERVAL_LABELS: Readonly<Record<SequenceInterval, string>> = {
  "minor-second": "Minor second",
  "major-second": "Major second",
  "minor-third": "Minor third",
  "major-third": "Major third",
  "perfect-fourth": "Perfect fourth",
  "perfect-fifth": "Perfect fifth",
  "minor-sixth": "Minor sixth",
  "major-sixth": "Major sixth",
  "minor-seventh": "Minor seventh",
  "major-seventh": "Major seventh",
  octave: "Octave",
};

const SCALE_SEMITONE_PATTERNS: Readonly<
  Record<SequenceScale, ReadonlyArray<number>>
> = {
  major: [0, 2, 4, 5, 7, 9, 11, 12],

  "natural-minor": [0, 2, 3, 5, 7, 8, 10, 12],

  "harmonic-minor": [0, 2, 3, 5, 7, 8, 11, 12],

  "melodic-minor": [0, 2, 3, 5, 7, 9, 11, 12],

  "major-pentatonic": [0, 2, 4, 7, 9, 12],

  "minor-pentatonic": [0, 3, 5, 7, 10, 12],
};

const SCALE_DIATONIC_PATTERNS: Readonly<
  Record<SequenceScale, ReadonlyArray<number>>
> = {
  major: [0, 1, 2, 3, 4, 5, 6, 7],
  "natural-minor": [0, 1, 2, 3, 4, 5, 6, 7],
  "harmonic-minor": [0, 1, 2, 3, 4, 5, 6, 7],
  "melodic-minor": [0, 1, 2, 3, 4, 5, 6, 7],
  "major-pentatonic": [0, 1, 2, 4, 5, 7],
  "minor-pentatonic": [0, 2, 3, 4, 6, 7],
};

const SCALE_LABELS: Readonly<Record<SequenceScale, string>> = {
  major: "Major scale",

  "natural-minor": "Natural minor scale",

  "harmonic-minor": "Harmonic minor scale",

  "melodic-minor": "Melodic minor scale",

  "major-pentatonic": "Major pentatonic scale",

  "minor-pentatonic": "Minor pentatonic scale",
};

const ARPEGGIO_SEMITONE_PATTERNS: Readonly<
  Record<SequenceArpeggio, ReadonlyArray<number>>
> = {
  major: [0, 4, 7, 12],

  minor: [0, 3, 7, 12],

  diminished: [0, 3, 6, 12],

  augmented: [0, 4, 8, 12],

  "dominant-seventh": [0, 4, 7, 10],

  "major-seventh": [0, 4, 7, 11],

  "minor-seventh": [0, 3, 7, 10],
};

const ARPEGGIO_DIATONIC_PATTERNS: Readonly<
  Record<SequenceArpeggio, ReadonlyArray<number>>
> = {
  major: [0, 2, 4, 7],
  minor: [0, 2, 4, 7],
  diminished: [0, 2, 4, 7],
  augmented: [0, 2, 4, 7],
  "dominant-seventh": [0, 2, 4, 6],
  "major-seventh": [0, 2, 4, 6],
  "minor-seventh": [0, 2, 4, 6],
};

const ARPEGGIO_LABELS: Readonly<Record<SequenceArpeggio, string>> = {
  major: "Major arpeggio",

  minor: "Minor arpeggio",

  diminished: "Diminished arpeggio",

  augmented: "Augmented arpeggio",

  "dominant-seventh": "Dominant seventh arpeggio",

  "major-seventh": "Major seventh arpeggio",

  "minor-seventh": "Minor seventh arpeggio",
};

type GenerateIntervalTargetOptions = Readonly<{
  clef: Clef;
  enabledDirections: ReadonlySet<SequenceDirection>;
  enabledIntervals: ReadonlySet<SequenceInterval>;
  enabledNoteCategories: ReadonlySet<SequenceNoteCategory>;
}>;

type GenerateScaleTargetOptions = Readonly<{
  clef: Clef;
  enabledDirections: ReadonlySet<SequenceDirection>;
  enabledNoteCategories: ReadonlySet<SequenceNoteCategory>;
  enabledScales: ReadonlySet<SequenceScale>;
}>;

type GenerateArpeggioTargetOptions = Readonly<{
  clef: Clef;
  enabledArpeggios: ReadonlySet<SequenceArpeggio>;
  enabledDirections: ReadonlySet<SequenceDirection>;
  enabledNoteCategories: ReadonlySet<SequenceNoteCategory>;
}>;

export type GenerateSequenceTargetOptions = Readonly<{
  exerciseType: SequenceExerciseType;
  clef: Clef;
  enabledArpeggios: ReadonlySet<SequenceArpeggio>;
  enabledDirections: ReadonlySet<SequenceDirection>;
  enabledIntervals: ReadonlySet<SequenceInterval>;
  enabledNoteCategories: ReadonlySet<SequenceNoteCategory>;
  enabledScales: ReadonlySet<SequenceScale>;
}>;

function getDirectionMultiplier(direction: SequenceDirection): 1 | -1 {
  return direction === "ascending" ? 1 : -1;
}

function getNoteCategory(midiNumber: number): SequenceNoteCategory {
  return isNaturalMidiNumber(midiNumber) ? "naturals" : "accidentals";
}

const NOTE_LETTERS: ReadonlyArray<NoteLetter> = [
  "C",
  "D",
  "E",
  "F",
  "G",
  "A",
  "B",
];

function shiftNoteLetter(
  startingLetter: NoteLetter,
  diatonicSteps: number,
): NoteLetter {
  const startingIndex = NOTE_LETTERS.indexOf(startingLetter);

  if (startingIndex === -1) {
    throw new Error(`Unable to shift unknown note letter ${startingLetter}.`);
  }

  const shiftedIndex =
    (((startingIndex + diatonicSteps) % NOTE_LETTERS.length) +
      NOTE_LETTERS.length) %
    NOTE_LETTERS.length;

  const shiftedLetter = NOTE_LETTERS[shiftedIndex];

  if (shiftedLetter === undefined) {
    throw new Error(
      `Unable to resolve note letter ${diatonicSteps} steps from ${startingLetter}.`,
    );
  }

  return shiftedLetter;
}

function createTheoryPatternNotes({
  startingMidiNumber,
  semitonePattern,
  diatonicPattern,
  direction,
}: Readonly<{
  startingMidiNumber: number;
  semitonePattern: ReadonlyArray<number>;
  diatonicPattern: ReadonlyArray<number>;
  direction: SequenceDirection;
}>): ReadonlyArray<PracticeNote> {
  if (semitonePattern.length !== diatonicPattern.length) {
    throw new Error(
      "Theory semitone and diatonic patterns must have matching lengths.",
    );
  }

  const directionMultiplier = getDirectionMultiplier(direction);

  const validSpellings = getTheoryRootLetterCandidates(
    startingMidiNumber,
  ).flatMap((rootLetter) => {
    try {
      const notes = semitonePattern.map((semitones, index) => {
        const diatonicSteps = diatonicPattern[index];

        if (diatonicSteps === undefined) {
          throw new Error("Missing diatonic step for theory note.");
        }

        const noteLetter = shiftNoteLetter(
          rootLetter,
          diatonicSteps * directionMultiplier,
        );

        return createTheoryPracticeNote(
          startingMidiNumber + semitones * directionMultiplier,
          noteLetter,
        );
      });

      return [notes];
    } catch {
      return [];
    }
  });

  if (validSpellings.length === 0) {
    throw new Error(
      `No valid theory spelling exists for MIDI ${startingMidiNumber}.`,
    );
  }

  return getRandomItem(validSpellings);
}

function getEligibleIntervalStartingMidiNumbers({
  clef,
  direction,
  interval,
  enabledNoteCategories,
}: Readonly<{
  clef: Clef;
  direction: SequenceDirection;
  interval: SequenceInterval;
  enabledNoteCategories: ReadonlySet<SequenceNoteCategory>;
}>): ReadonlyArray<number> {
  const range = NOTE_RANGES[clef];
  const semitones = INTERVAL_SEMITONES[interval];
  const directionMultiplier = getDirectionMultiplier(direction);

  const eligibleMidiNumbers: number[] = [];

  for (
    let midiNumber = range.minMidi;
    midiNumber <= range.maxMidi;
    midiNumber += 1
  ) {
    const destinationMidiNumber = midiNumber + semitones * directionMultiplier;

    const destinationIsInsideRange =
      destinationMidiNumber >= range.minMidi &&
      destinationMidiNumber <= range.maxMidi;

    if (!destinationIsInsideRange) {
      continue;
    }

    const category = getNoteCategory(midiNumber);

    if (enabledNoteCategories.has(category)) {
      eligibleMidiNumbers.push(midiNumber);
    }
  }

  return eligibleMidiNumbers;
}

function getEligibleOneOctaveStartingMidiNumbers({
  clef,
  direction,
  enabledNoteCategories,
}: Readonly<{
  clef: Clef;
  direction: SequenceDirection;
  enabledNoteCategories: ReadonlySet<SequenceNoteCategory>;
}>): ReadonlyArray<number> {
  const range = NOTE_RANGES[clef];
  const directionMultiplier = getDirectionMultiplier(direction);

  const eligibleMidiNumbers: number[] = [];

  for (
    let midiNumber = range.minMidi;
    midiNumber <= range.maxMidi;
    midiNumber += 1
  ) {
    const finalMidiNumber = midiNumber + 12 * directionMultiplier;

    const finalNoteIsInsideRange =
      finalMidiNumber >= range.minMidi && finalMidiNumber <= range.maxMidi;

    if (!finalNoteIsInsideRange) {
      continue;
    }

    const category = getNoteCategory(midiNumber);

    if (enabledNoteCategories.has(category)) {
      eligibleMidiNumbers.push(midiNumber);
    }
  }

  return eligibleMidiNumbers;
}

export function getIntervalSemitones(interval: SequenceInterval): number {
  return INTERVAL_SEMITONES[interval];
}

function generateIntervalTarget({
  clef,
  enabledDirections,
  enabledIntervals,
  enabledNoteCategories,
}: GenerateIntervalTargetOptions): SequenceTarget {
  if (enabledDirections.size === 0) {
    throw new Error("At least one sequence direction must be enabled.");
  }

  if (enabledIntervals.size === 0) {
    throw new Error("At least one sequence interval must be enabled.");
  }

  if (enabledNoteCategories.size === 0) {
    throw new Error("At least one sequence note category must be enabled.");
  }

  const direction = getRandomItem(Array.from(enabledDirections));
  const interval = getRandomItem(Array.from(enabledIntervals));

  const eligibleStartingMidiNumbers = getEligibleIntervalStartingMidiNumbers({
    clef,
    direction,
    interval,
    enabledNoteCategories,
  });

  if (eligibleStartingMidiNumbers.length === 0) {
    throw new Error(
      `No valid ${direction} ${interval} targets exist for the current settings.`,
    );
  }

  const startingMidiNumber = getRandomItem(eligibleStartingMidiNumbers);

  const notes = createTheoryPatternNotes({
    startingMidiNumber,
    semitonePattern: [0, INTERVAL_SEMITONES[interval]],
    diatonicPattern: [0, INTERVAL_DIATONIC_STEPS[interval]],
    direction,
  });

  return {
    clef,
    name: {
      primary: INTERVAL_LABELS[interval],
      secondary:
        direction === "ascending"
          ? "Ascending melodic interval"
          : "Descending melodic interval",
    },
    steps: notes.map((note) => ({
      notes: [note],
    })),
  };
}

function generateScaleTarget({
  clef,
  enabledDirections,
  enabledNoteCategories,
  enabledScales,
}: GenerateScaleTargetOptions): SequenceTarget {
  if (enabledDirections.size === 0) {
    throw new Error("At least one sequence direction must be enabled.");
  }

  if (enabledScales.size === 0) {
    throw new Error("At least one sequence scale must be enabled.");
  }

  if (enabledNoteCategories.size === 0) {
    throw new Error("At least one sequence note category must be enabled.");
  }

  const direction = getRandomItem(Array.from(enabledDirections));
  const scale = getRandomItem(Array.from(enabledScales));

  const eligibleStartingMidiNumbers = getEligibleOneOctaveStartingMidiNumbers({
    clef,
    direction,
    enabledNoteCategories,
  });

  if (eligibleStartingMidiNumbers.length === 0) {
    throw new Error(
      `No valid ${direction} ${scale} targets exist for the current settings.`,
    );
  }

  const startingMidiNumber = getRandomItem(eligibleStartingMidiNumbers);

  const notes = createTheoryPatternNotes({
    startingMidiNumber,
    semitonePattern: SCALE_SEMITONE_PATTERNS[scale],
    diatonicPattern: SCALE_DIATONIC_PATTERNS[scale],
    direction,
  });

  const steps = notes.map((note) => ({
    notes: [note],
  }));

  return {
    clef,
    name: {
      primary: SCALE_LABELS[scale],
      secondary:
        direction === "ascending"
          ? "Ascending one-octave scale"
          : "Descending one-octave scale",
    },
    steps,
  };
}

function generateArpeggioTarget({
  clef,
  enabledArpeggios,
  enabledDirections,
  enabledNoteCategories,
}: GenerateArpeggioTargetOptions): SequenceTarget {
  if (enabledDirections.size === 0) {
    throw new Error("At least one sequence direction must be enabled.");
  }

  if (enabledArpeggios.size === 0) {
    throw new Error("At least one sequence arpeggio must be enabled.");
  }

  if (enabledNoteCategories.size === 0) {
    throw new Error("At least one sequence note category must be enabled.");
  }

  const direction = getRandomItem(Array.from(enabledDirections));
  const arpeggio = getRandomItem(Array.from(enabledArpeggios));

  const eligibleStartingMidiNumbers = getEligibleOneOctaveStartingMidiNumbers({
    clef,
    direction,
    enabledNoteCategories,
  });

  if (eligibleStartingMidiNumbers.length === 0) {
    throw new Error(
      `No valid ${direction} ${arpeggio} arpeggio targets exist for the current settings.`,
    );
  }
  
  const startingMidiNumber = getRandomItem(eligibleStartingMidiNumbers);

  const notes = createTheoryPatternNotes({
    startingMidiNumber,
    semitonePattern: ARPEGGIO_SEMITONE_PATTERNS[arpeggio],
    diatonicPattern: ARPEGGIO_DIATONIC_PATTERNS[arpeggio],
    direction,
  });

  const steps = notes.map((note) => ({
    notes: [note],
  }));

  return {
    clef,
    name: {
      primary: ARPEGGIO_LABELS[arpeggio],
      secondary:
        direction === "ascending"
          ? "Ascending one-octave arpeggio"
          : "Descending one-octave arpeggio",
    },
    steps,
  };
}

export function generateSequenceTarget(
  options: GenerateSequenceTargetOptions,
): SequenceTarget {
  switch (options.exerciseType) {
    case "intervals":
      return generateIntervalTarget(options);

    case "scales":
      return generateScaleTarget(options);

    case "arpeggios":
      return generateArpeggioTarget(options);
  }
}
