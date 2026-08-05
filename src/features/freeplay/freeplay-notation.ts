import {
  getMusicKeyDefinition,
  type MusicKeyId,
  type MusicKeyOrientation,
} from "@/lib/music/keys";
import {
  createTheoryPracticeNote,
  getPitchClass,
  type NoteLetter,
} from "@/lib/music/note-utils";
import type { PracticeNote } from "@/types/practice";

export type FreeplayNotationContext =
  | Readonly<{
      keyId: MusicKeyId;
      type: "key";
    }>
  | Readonly<{
      type: "no-key";
    }>;

export type FreeplayChromaticPreference =
  | "automatic"
  | "prefer-sharps"
  | "prefer-flats";

export const DEFAULT_FREEPLAY_NOTATION_CONTEXT: FreeplayNotationContext = {
  type: "no-key",
};

export const DEFAULT_FREEPLAY_CHROMATIC_PREFERENCE: FreeplayChromaticPreference =
  "automatic";

type SpellingKind = "natural" | "sharp" | "flat";

type SpellingCandidate = Readonly<{
  kind: SpellingKind;
  note: PracticeNote;
}>;

const NOTE_LETTERS: ReadonlyArray<NoteLetter> = [
  "C",
  "D",
  "E",
  "F",
  "G",
  "A",
  "B",
];

const NATURAL_PITCH_CLASS_BY_LETTER: Readonly<Record<NoteLetter, number>> = {
  A: 9,
  B: 11,
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
};

const BALANCED_CHROMATIC_LETTER_BY_PITCH_CLASS: Readonly<
  Partial<Record<number, NoteLetter>>
> = {
  1: "C",
  3: "E",
  6: "F",
  8: "A",
  10: "B",
};

function getSpellingCandidates(midiNumber: number): SpellingCandidate[] {
  if (
    !Number.isInteger(midiNumber) ||
    midiNumber < 0 ||
    midiNumber > 127
  ) {
    return [];
  }

  const pitchClass = getPitchClass(midiNumber);
  const candidates: SpellingCandidate[] = [];

  for (const letter of NOTE_LETTERS) {
    const difference = getPitchClass(
      pitchClass - NATURAL_PITCH_CLASS_BY_LETTER[letter],
    );
    const kind: SpellingKind | null =
      difference === 0
        ? "natural"
        : difference === 1
          ? "sharp"
          : difference === 11
            ? "flat"
            : null;

    if (kind === null) {
      continue;
    }

    try {
      candidates.push({
        kind,
        note: createTheoryPracticeNote(midiNumber, letter),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("without a double accidental")
      ) {
        continue;
      }

      throw error;
    }
  }

  return candidates;
}

function selectChromaticCandidate({
  candidates,
  midiNumber,
  orientation,
  preference,
}: Readonly<{
  candidates: ReadonlyArray<SpellingCandidate>;
  midiNumber: number;
  orientation: MusicKeyOrientation;
  preference: FreeplayChromaticPreference;
}>): PracticeNote | null {
  const naturalCandidate = candidates.find(
    (candidate) => candidate.kind === "natural",
  );

  if (naturalCandidate) {
    return naturalCandidate.note;
  }

  let preferredKind: Exclude<SpellingKind, "natural"> | null = null;

  if (preference === "prefer-sharps") {
    preferredKind = "sharp";
  } else if (preference === "prefer-flats") {
    preferredKind = "flat";
  } else if (orientation !== "neutral") {
    preferredKind = orientation;
  }

  if (preferredKind) {
    const preferredCandidate = candidates.find(
      (candidate) => candidate.kind === preferredKind,
    );

    if (preferredCandidate) {
      return preferredCandidate.note;
    }
  }

  const balancedLetter =
    BALANCED_CHROMATIC_LETTER_BY_PITCH_CLASS[getPitchClass(midiNumber)];
  const balancedCandidate = candidates.find(
    (candidate) => candidate.note.name.startsWith(balancedLetter ?? ""),
  );

  return balancedCandidate?.note ?? candidates[0]?.note ?? null;
}

export function spellFreeplayMidiNumber({
  context = DEFAULT_FREEPLAY_NOTATION_CONTEXT,
  midiNumber,
  preference = DEFAULT_FREEPLAY_CHROMATIC_PREFERENCE,
}: Readonly<{
  context?: FreeplayNotationContext;
  midiNumber: number;
  preference?: FreeplayChromaticPreference;
}>): PracticeNote | null {
  const candidates = getSpellingCandidates(midiNumber);

  if (candidates.length === 0) {
    return null;
  }

  if (context.type === "no-key") {
    return selectChromaticCandidate({
      candidates,
      midiNumber,
      orientation: "neutral",
      preference,
    });
  }

  const key = getMusicKeyDefinition(context.keyId);
  const pitchClass = getPitchClass(midiNumber);
  const diatonicDegree = key.diatonicScale.find(
    (degree) => degree.pitchClass === pitchClass,
  );

  if (diatonicDegree) {
    try {
      return createTheoryPracticeNote(midiNumber, diatonicDegree.letter);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("without a double accidental")
      ) {
        return null;
      }

      throw error;
    }
  }

  return selectChromaticCandidate({
    candidates,
    midiNumber,
    orientation: key.orientation,
    preference,
  });
}

export function spellFreeplayMidiNumbers({
  context = DEFAULT_FREEPLAY_NOTATION_CONTEXT,
  midiNumbers,
  preference = DEFAULT_FREEPLAY_CHROMATIC_PREFERENCE,
}: Readonly<{
  context?: FreeplayNotationContext;
  midiNumbers: Iterable<number>;
  preference?: FreeplayChromaticPreference;
}>): ReadonlyArray<PracticeNote> | null {
  const uniqueMidiNumbers = [...new Set(midiNumbers)].sort(
    (left, right) => left - right,
  );
  const notes: PracticeNote[] = [];

  for (const midiNumber of uniqueMidiNumbers) {
    const note = spellFreeplayMidiNumber({
      context,
      midiNumber,
      preference,
    });

    if (note === null) {
      return null;
    }

    notes.push(note);
  }

  return notes;
}
