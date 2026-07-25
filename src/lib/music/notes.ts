import { NOTE_RANGES } from "../../data/note-ranges";
import type {
  Clef,
  PracticeClefMode,
  PracticeExerciseType,
  PracticeNoteCategory,
  PracticeTarget,
  PracticeTriadPosition,
  PracticeTriadQuality,
} from "../../types/practice";
import { generateTriadTarget } from "./generators/triads";

import {
  createPracticeNote,
  getClefForMode,
  getRandomAccidentalSpelling,
  getRandomItem,
  isNaturalMidiNumber,
} from "./note-utils";

export { getFullNoteName, getNoteName, getNoteOctave } from "./note-utils";

function getRandomExerciseType(
  enabledExerciseTypes: ReadonlySet<PracticeExerciseType>,
): PracticeExerciseType {
  return getRandomItem(Array.from(enabledExerciseTypes));
}

function getEligibleIndividualNoteMidiNumbers(
  clef: Clef,
  enabledNoteCategories: ReadonlySet<PracticeNoteCategory>,
): ReadonlyArray<number> {
  const range = NOTE_RANGES[clef];
  const eligibleMidiNumbers: number[] = [];

  for (
    let midiNumber = range.minMidi;
    midiNumber <= range.maxMidi;
    midiNumber += 1
  ) {
    const category: PracticeNoteCategory = isNaturalMidiNumber(midiNumber)
      ? "naturals"
      : "accidentals";

    if (enabledNoteCategories.has(category)) {
      eligibleMidiNumbers.push(midiNumber);
    }
  }

  return eligibleMidiNumbers;
}

function generateIndividualNoteTarget(
  clef: Clef,
  enabledNoteCategories: ReadonlySet<PracticeNoteCategory>,
): PracticeTarget {
  if (enabledNoteCategories.size === 0) {
    throw new Error("At least one individual note category must be enabled.");
  }

  const eligibleMidiNumbers = getEligibleIndividualNoteMidiNumbers(
    clef,
    enabledNoteCategories,
  );

  const midiNumber = getRandomItem(eligibleMidiNumbers);

  const accidentalSpelling = isNaturalMidiNumber(midiNumber)
    ? "sharp"
    : getRandomAccidentalSpelling();

  const note = createPracticeNote(midiNumber, accidentalSpelling);

  return {
    clef,
    name: {
      primary: `${note.name}${note.octave}`,
      secondary: "Individual note",
    },
    notes: [note],
  };
}

export function generatePracticeTarget(
  mode: PracticeClefMode,
  enabledExerciseTypes: ReadonlySet<PracticeExerciseType>,
  enabledNoteCategories: ReadonlySet<PracticeNoteCategory>,
  enabledTriadQualities: ReadonlySet<PracticeTriadQuality>,
  enabledTriadPositions: ReadonlySet<PracticeTriadPosition>,
): PracticeTarget {
  if (enabledExerciseTypes.size === 0) {
    throw new Error("At least one practice exercise type must be enabled.");
  }

  const clef = getClefForMode(mode);
  const exerciseType = getRandomExerciseType(enabledExerciseTypes);

  if (exerciseType === "triads") {
    return generateTriadTarget(
      clef,
      enabledTriadQualities,
      enabledTriadPositions,
    );
  }

  return generateIndividualNoteTarget(clef, enabledNoteCategories);
}
