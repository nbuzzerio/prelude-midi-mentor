import type {
  EarTrainingTarget,
} from "./ear-training-types";
import {
  getIntervalDiatonicSteps,
  getIntervalSemitones,
  type IntervalDirection,
  type MusicalInterval,
} from "@/lib/music/intervals";
import {
  createTheoryPracticeNote,
  getRandomItem,
  getTheoryRootLetterCandidates,
  type NoteLetter,
} from "@/lib/music/note-utils";

export const EAR_TRAINING_MIN_MIDI = 60;
export const EAR_TRAINING_MAX_MIDI = 84;

type GenerateEarTrainingTargetOptions = Readonly<{
  enabledDirections: ReadonlySet<IntervalDirection>;
  enabledIntervals: ReadonlySet<MusicalInterval>;
}>;

const NOTE_LETTERS: readonly NoteLetter[] = ["C", "D", "E", "F", "G", "A", "B"];

function shiftLetter(
  letter: NoteLetter,
  steps: number,
  direction: IntervalDirection,
): NoteLetter {
  const multiplier = direction === "ascending" ? 1 : -1;
  const index = NOTE_LETTERS.indexOf(letter);
  const shifted = NOTE_LETTERS[
    (((index + steps * multiplier) % NOTE_LETTERS.length) + NOTE_LETTERS.length) %
      NOTE_LETTERS.length
  ];
  if (!shifted) throw new Error("Unable to shift interval letter.");
  return shifted;
}

export function generateEarTrainingTarget({
  enabledDirections,
  enabledIntervals,
}: GenerateEarTrainingTargetOptions): EarTrainingTarget {
  if (enabledIntervals.size === 0) {
    throw new Error("At least one ear-training interval must be enabled.");
  }
  if (enabledDirections.size === 0) {
    throw new Error("At least one ear-training direction must be enabled.");
  }

  const interval = getRandomItem([...enabledIntervals]);
  const direction = getRandomItem([...enabledDirections]);
  const multiplier = direction === "ascending" ? 1 : -1;
  const distance = getIntervalSemitones(interval) * multiplier;
  const candidates: EarTrainingTarget["notes"][] = [];

  for (let startMidi = EAR_TRAINING_MIN_MIDI; startMidi <= EAR_TRAINING_MAX_MIDI; startMidi += 1) {
    const endMidi = startMidi + distance;
    if (endMidi < EAR_TRAINING_MIN_MIDI || endMidi > EAR_TRAINING_MAX_MIDI) continue;

    for (const rootLetter of getTheoryRootLetterCandidates(startMidi)) {
      try {
        candidates.push([
          createTheoryPracticeNote(startMidi, rootLetter),
          createTheoryPracticeNote(
            endMidi,
            shiftLetter(rootLetter, getIntervalDiatonicSteps(interval), direction),
          ),
        ]);
      } catch (error) {
        if (error instanceof Error && error.message.includes("double accidental")) continue;
        throw error;
      }
    }
  }

  if (candidates.length === 0) {
    throw new Error(`No playable ${direction} ${interval} targets exist.`);
  }

  return {
    direction,
    exerciseType: "melodic-interval",
    interval,
    notes: getRandomItem(candidates),
  };
}
