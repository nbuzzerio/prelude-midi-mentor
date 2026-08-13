import { NOTE_RANGES } from "@/data/note-ranges";
import {
  getChordProgressionTemplate,
  getSupportedChordProgressionKey,
  realizeChordProgression,
} from "@/lib/music/chord-progressions";
import type {
  ChordProgressionKeyId,
  ChordProgressionTemplateId,
} from "@/lib/music/chord-progressions";
import type {
  Clef,
  PracticeNote,
  SequenceArpeggio,
  SequenceArpeggioDirection,
  SequenceDirection,
  SequenceExerciseType,
  SequenceInterval,
  SequenceNoteCategory,
  SequenceScale,
  SequenceScaleDirection,
  SequenceTarget,
} from "@/types/practice";
import {
  SEQUENCE_DEFAULT_STEP_DURATION_TICKS,
  SEQUENCE_DEFAULT_TIMING,
} from "../sequence-timing";

import {
  createTheoryPracticeNote,
  getRandomItem,
  getTheoryRootLetterCandidates,
  isNaturalMidiNumber,
} from "../note-utils";
import type { NoteLetter } from "../note-utils";
import {
  getIntervalDiatonicSteps,
  getIntervalLabel,
  getIntervalSemitones,
} from "../intervals";

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

  "dominant-seventh": [0, 4, 7, 10, 12],

  "major-seventh": [0, 4, 7, 11, 12],

  "minor-seventh": [0, 3, 7, 10, 12],
};

const ARPEGGIO_DIATONIC_PATTERNS: Readonly<
  Record<SequenceArpeggio, ReadonlyArray<number>>
> = {
  major: [0, 2, 4, 7],
  minor: [0, 2, 4, 7],
  diminished: [0, 2, 4, 7],
  augmented: [0, 2, 4, 7],
  "dominant-seventh": [0, 2, 4, 6, 7],
  "major-seventh": [0, 2, 4, 6, 7],
  "minor-seventh": [0, 2, 4, 6, 7],
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
  enabledNoteCategories: ReadonlySet<SequenceNoteCategory>;
  enabledScaleDirections: ReadonlySet<SequenceScaleDirection>;
  enabledScales: ReadonlySet<SequenceScale>;
}>;

type GenerateArpeggioTargetOptions = Readonly<{
  clef: Clef;
  enabledArpeggios: ReadonlySet<SequenceArpeggio>;
  enabledArpeggioDirections: ReadonlySet<SequenceArpeggioDirection>;
  enabledNoteCategories: ReadonlySet<SequenceNoteCategory>;
}>;

type GenerateChordProgressionTargetOptions = Readonly<{
  clef: Clef;
  enabledChordProgressionKeyIds: ReadonlySet<ChordProgressionKeyId>;
  enabledChordProgressionTemplateIds: ReadonlySet<ChordProgressionTemplateId>;
}>;

export type GenerateSequenceTargetOptions = Readonly<{
  exerciseType: SequenceExerciseType;
  clef: Clef;
  enabledArpeggios: ReadonlySet<SequenceArpeggio>;
  enabledArpeggioDirections: ReadonlySet<SequenceArpeggioDirection>;
  enabledChordProgressionKeyIds: ReadonlySet<ChordProgressionKeyId>;
  enabledChordProgressionTemplateIds: ReadonlySet<ChordProgressionTemplateId>;
  enabledDirections: ReadonlySet<SequenceDirection>;
  enabledIntervals: ReadonlySet<SequenceInterval>;
  enabledNoteCategories: ReadonlySet<SequenceNoteCategory>;
  enabledScaleDirections: ReadonlySet<SequenceScaleDirection>;
  enabledScales: ReadonlySet<SequenceScale>;
}>;

const CHORD_PROGRESSION_RANGES: Readonly<
  Record<Clef, Readonly<{ minMidi: number; maxMidi: number }>>
> = {
  bass: { minMidi: NOTE_RANGES.bass.minMidi, maxMidi: 64 },
  treble: { minMidi: NOTE_RANGES.treble.minMidi, maxMidi: 88 },
};

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

function getPracticeNoteLetter(note: PracticeNote): NoteLetter {
  const noteLetter = NOTE_LETTERS.find((letter) => note.name.startsWith(letter));

  if (!noteLetter) {
    throw new Error(`Unable to resolve note letter from ${note.name}.`);
  }

  return noteLetter;
}

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
  rootLetter,
}: Readonly<{
  startingMidiNumber: number;
  semitonePattern: ReadonlyArray<number>;
  diatonicPattern: ReadonlyArray<number>;
  direction: SequenceDirection;
  rootLetter?: NoteLetter;
}>): ReadonlyArray<PracticeNote> {
  if (semitonePattern.length !== diatonicPattern.length) {
    throw new Error(
      "Theory semitone and diatonic patterns must have matching lengths.",
    );
  }

  const directionMultiplier = getDirectionMultiplier(direction);

  const rootLetterCandidates = rootLetter
    ? [rootLetter]
    : getTheoryRootLetterCandidates(startingMidiNumber);

  const validSpellings = rootLetterCandidates.flatMap((candidateRootLetter) => {
    try {
      const notes = semitonePattern.map((semitones, index) => {
        const diatonicSteps = diatonicPattern[index];

        if (diatonicSteps === undefined) {
          throw new Error("Missing diatonic step for theory note.");
        }

        const noteLetter = shiftNoteLetter(
          candidateRootLetter,
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
  const semitones = getIntervalSemitones(interval);
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

export { getIntervalSemitones } from "../intervals";

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
    semitonePattern: [0, getIntervalSemitones(interval)],
    diatonicPattern: [0, getIntervalDiatonicSteps(interval)],
    direction,
  });

  return {
    clef,
    name: {
      primary: getIntervalLabel(interval),
      secondary:
        direction === "ascending"
          ? "Ascending melodic interval"
          : "Descending melodic interval",
    },
    steps: notes.map((note) => ({
      durationTicks: SEQUENCE_DEFAULT_STEP_DURATION_TICKS,
      notes: [note],
    })),
    timing: SEQUENCE_DEFAULT_TIMING,
  };
}

function generateScaleTarget({
  clef,
  enabledNoteCategories,
  enabledScaleDirections,
  enabledScales,
}: GenerateScaleTargetOptions): SequenceTarget {
  if (enabledScaleDirections.size === 0) {
    throw new Error("At least one scale direction must be enabled.");
  }

  if (enabledScales.size === 0) {
    throw new Error("At least one sequence scale must be enabled.");
  }

  if (enabledNoteCategories.size === 0) {
    throw new Error("At least one sequence note category must be enabled.");
  }

  const direction = getRandomItem(Array.from(enabledScaleDirections));
  const scale = getRandomItem(Array.from(enabledScales));

  const rangeDirection =
    direction === "descending" ? "descending" : "ascending";

  const eligibleStartingMidiNumbers = getEligibleOneOctaveStartingMidiNumbers({
    clef,
    direction: rangeDirection,
    enabledNoteCategories,
  });

  if (eligibleStartingMidiNumbers.length === 0) {
    throw new Error(
      `No valid ${direction} ${scale} targets exist for the current settings.`,
    );
  }

  const startingMidiNumber = getRandomItem(eligibleStartingMidiNumbers);

  const lowerTonicMidiNumber =
    direction === "descending"
      ? startingMidiNumber - 12
      : startingMidiNumber;

  const ascendingScale =
    scale === "melodic-minor" && direction === "descending"
      ? "natural-minor"
      : scale;

  const ascendingNotes = createTheoryPatternNotes({
    startingMidiNumber: lowerTonicMidiNumber,
    semitonePattern: SCALE_SEMITONE_PATTERNS[ascendingScale],
    diatonicPattern: SCALE_DIATONIC_PATTERNS[ascendingScale],
    direction: "ascending",
  });

  const ascendingRootNote = ascendingNotes[0];

  if (!ascendingRootNote) {
    throw new Error(`Unable to generate ${scale} scale notes.`);
  }

  let notes: ReadonlyArray<PracticeNote>;

  if (direction === "ascending") {
    notes = ascendingNotes;
  } else {
    const descendingScale =
      scale === "melodic-minor" ? "natural-minor" : scale;

    const descendingNotes =
      descendingScale === ascendingScale
        ? [...ascendingNotes].reverse()
        : [
            ...createTheoryPatternNotes({
              startingMidiNumber: lowerTonicMidiNumber,
              semitonePattern: SCALE_SEMITONE_PATTERNS[descendingScale],
              diatonicPattern: SCALE_DIATONIC_PATTERNS[descendingScale],
              direction: "ascending",
              rootLetter: getPracticeNoteLetter(ascendingRootNote),
            }),
          ].reverse();

    notes =
      direction === "descending"
        ? descendingNotes
        : [...ascendingNotes, ...descendingNotes.slice(1)];
  }

  const steps = notes.map((note) => ({
    durationTicks: SEQUENCE_DEFAULT_STEP_DURATION_TICKS,
    notes: [note],
  }));

  return {
    clef,
    name: {
      primary: SCALE_LABELS[scale],
      secondary:
        direction === "ascending"
          ? "Ascending one-octave scale"
          : direction === "descending"
            ? "Descending one-octave scale"
            : "Ascending and descending one-octave scale",
    },
    steps,
    timing: SEQUENCE_DEFAULT_TIMING,
  };
}

function generateArpeggioTarget({
  clef,
  enabledArpeggios,
  enabledArpeggioDirections,
  enabledNoteCategories,
}: GenerateArpeggioTargetOptions): SequenceTarget {
  if (enabledArpeggioDirections.size === 0) {
    throw new Error("At least one sequence arpeggio direction must be enabled.");
  }

  if (enabledArpeggios.size === 0) {
    throw new Error("At least one sequence arpeggio must be enabled.");
  }

  if (enabledNoteCategories.size === 0) {
    throw new Error("At least one sequence note category must be enabled.");
  }

  const direction = getRandomItem(Array.from(enabledArpeggioDirections));
  const arpeggio = getRandomItem(Array.from(enabledArpeggios));

  const eligibleStartingMidiNumbers = getEligibleOneOctaveStartingMidiNumbers({
    clef,
    direction: "ascending",
    enabledNoteCategories,
  });

  if (eligibleStartingMidiNumbers.length === 0) {
    throw new Error(
      `No valid ${direction} ${arpeggio} arpeggio targets exist for the current settings.`,
    );
  }
  
  const startingMidiNumber = getRandomItem(eligibleStartingMidiNumbers);

  const ascendingNotes = createTheoryPatternNotes({
    startingMidiNumber,
    semitonePattern: ARPEGGIO_SEMITONE_PATTERNS[arpeggio],
    diatonicPattern: ARPEGGIO_DIATONIC_PATTERNS[arpeggio],
    direction: "ascending",
  });

  const notes =
    direction === "ascending"
      ? ascendingNotes
      : direction === "descending"
        ? [...ascendingNotes].reverse()
        : [...ascendingNotes, ...[...ascendingNotes].reverse().slice(1)];

  const steps = notes.map((note) => ({
    durationTicks: SEQUENCE_DEFAULT_STEP_DURATION_TICKS,
    notes: [note],
  }));

  return {
    clef,
    name: {
      primary: ARPEGGIO_LABELS[arpeggio],
      secondary:
        direction === "ascending"
          ? "Ascending one-octave arpeggio"
          : direction === "descending"
            ? "Descending one-octave arpeggio"
            : "Ascending and descending one-octave arpeggio",
    },
    steps,
    timing: SEQUENCE_DEFAULT_TIMING,
  };
}

function generateChordProgressionTarget({
  clef,
  enabledChordProgressionKeyIds,
  enabledChordProgressionTemplateIds,
}: GenerateChordProgressionTargetOptions): SequenceTarget {
  if (enabledChordProgressionKeyIds.size === 0) {
    throw new Error("At least one chord progression key must be enabled.");
  }

  if (enabledChordProgressionTemplateIds.size === 0) {
    throw new Error("At least one chord progression template must be enabled.");
  }

  const keys = Array.from(enabledChordProgressionKeyIds).map(
    getSupportedChordProgressionKey,
  );
  const templates = Array.from(enabledChordProgressionTemplateIds).map(
    getChordProgressionTemplate,
  );
  const compatiblePairs = keys.flatMap((key) =>
    templates
      .filter((template) => template.mode === key.mode)
      .map((template) => ({ key, template })),
  );

  if (compatiblePairs.length === 0) {
    throw new Error(
      "At least one enabled chord progression key and template must have matching modes.",
    );
  }

  const range = CHORD_PROGRESSION_RANGES[clef];
  const eligibleTargets: SequenceTarget[] = [];

  for (const { key, template } of compatiblePairs) {
    for (
      let tonicMidiNumber = range.minMidi;
      tonicMidiNumber <= range.maxMidi;
      tonicMidiNumber += 1
    ) {
      if (((tonicMidiNumber % 12) + 12) % 12 !== key.tonicPitchClass) {
        continue;
      }

      const progression = realizeChordProgression({
        key,
        template,
        tonicMidiNumber,
      });

      if (
        progression === null ||
        progression.chords.some((chord) =>
          chord.notes.some(
            (note) =>
              note.midiNumber < range.minMidi ||
              note.midiNumber > range.maxMidi,
          ),
        )
      ) {
        continue;
      }

      eligibleTargets.push({
        clef,
        name: {
          primary: progression.template.name,
          secondary: progression.key.name,
        },
        steps: progression.chords.map((chord) => ({
          durationTicks: SEQUENCE_DEFAULT_STEP_DURATION_TICKS,
          name: {
            primary: chord.romanNumeral,
            secondary: chord.chordName,
          },
          notes: chord.notes,
        })),
        timing: SEQUENCE_DEFAULT_TIMING,
      });
    }
  }

  if (eligibleTargets.length === 0) {
    throw new Error(
      `No playable chord progression targets exist in the ${clef} clef for the current settings.`,
    );
  }

  return getRandomItem(eligibleTargets);
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

    case "chord-progressions":
      return generateChordProgressionTarget(options);
  }
}
