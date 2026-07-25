import { NOTE_RANGES } from "@/data/note-ranges";
import type {
  Clef,
  SequenceDirection,
  SequenceExerciseType,
  SequenceInterval,
  SequenceNoteCategory,
  SequenceScale,
  SequenceTarget,
} from "@/types/practice";

import {
  createPracticeNote,
  getRandomAccidentalSpelling,
  getRandomItem,
  isNaturalMidiNumber,
} from "../note-utils";

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
};

const SCALE_LABELS: Readonly<Record<SequenceScale, string>> = {
  major: "Major scale",
  "natural-minor": "Natural minor scale",
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

export type GenerateSequenceTargetOptions = Readonly<{
  exerciseType: SequenceExerciseType;
  clef: Clef;
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

function getPracticeNote(midiNumber: number) {
  const spelling = isNaturalMidiNumber(midiNumber)
    ? "sharp"
    : getRandomAccidentalSpelling();

  return createPracticeNote(midiNumber, spelling);
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

function getEligibleScaleStartingMidiNumbers({
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

  const destinationMidiNumber =
    startingMidiNumber +
    INTERVAL_SEMITONES[interval] * getDirectionMultiplier(direction);

  return {
    clef,
    name: {
      primary: INTERVAL_LABELS[interval],
      secondary:
        direction === "ascending"
          ? "Ascending melodic interval"
          : "Descending melodic interval",
    },
    steps: [
      {
        notes: [getPracticeNote(startingMidiNumber)],
      },
      {
        notes: [getPracticeNote(destinationMidiNumber)],
      },
    ],
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

  const eligibleStartingMidiNumbers = getEligibleScaleStartingMidiNumbers({
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
  const directionMultiplier = getDirectionMultiplier(direction);

  const steps = SCALE_SEMITONE_PATTERNS[scale].map((semitones) => ({
    notes: [
      getPracticeNote(startingMidiNumber + semitones * directionMultiplier),
    ],
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

export function generateSequenceTarget(
  options: GenerateSequenceTargetOptions,
): SequenceTarget {
  switch (options.exerciseType) {
    case "intervals":
      return generateIntervalTarget(options);

    case "scales":
      return generateScaleTarget(options);
  }
}
