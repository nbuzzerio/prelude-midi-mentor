import { NOTE_RANGES } from "@/data/note-ranges";
import type {
  Clef,
  SequenceDirection,
  SequenceInterval,
  SequenceNoteCategory,
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

type GenerateIntervalTargetOptions = Readonly<{
  clef: Clef;
  enabledDirections: ReadonlySet<SequenceDirection>;
  enabledIntervals: ReadonlySet<SequenceInterval>;
  enabledNoteCategories: ReadonlySet<SequenceNoteCategory>;
}>;

export type GenerateSequenceTargetOptions = Readonly<{
  exerciseType: "intervals";
  clef: Clef;
  enabledDirections: ReadonlySet<SequenceDirection>;
  enabledIntervals: ReadonlySet<SequenceInterval>;
  enabledNoteCategories: ReadonlySet<SequenceNoteCategory>;
}>;

function getDirectionMultiplier(direction: SequenceDirection): 1 | -1 {
  return direction === "ascending" ? 1 : -1;
}

function getNoteCategory(midiNumber: number): SequenceNoteCategory {
  return isNaturalMidiNumber(midiNumber) ? "naturals" : "accidentals";
}

function getEligibleStartingMidiNumbers({
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

  const eligibleStartingMidiNumbers = getEligibleStartingMidiNumbers({
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

  /*
   * For now, each accidental note chooses its display spelling
   * independently. A later theory-focused enhancement can derive
   * diatonically correct interval spellings.
   */
  const startingSpelling = isNaturalMidiNumber(startingMidiNumber)
    ? "sharp"
    : getRandomAccidentalSpelling();

  const destinationSpelling = isNaturalMidiNumber(destinationMidiNumber)
    ? "sharp"
    : getRandomAccidentalSpelling();

  const startingNote = createPracticeNote(startingMidiNumber, startingSpelling);

  const destinationNote = createPracticeNote(
    destinationMidiNumber,
    destinationSpelling,
  );

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
        notes: [startingNote],
      },
      {
        notes: [destinationNote],
      },
    ],
  };
}

export function generateSequenceTarget(
  options: GenerateSequenceTargetOptions,
): SequenceTarget {
  switch (options.exerciseType) {
    case "intervals":
      return generateIntervalTarget(options);
  }
}
