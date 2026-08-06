import {
  getMusicKeyDefinition,
  type MusicKeyId,
  type MusicKeyOrientation,
} from "./keys";
import {
  createTheoryPracticeNote,
  getPitchClass,
  type NoteLetter,
} from "./note-utils";
import type { PracticeNote } from "@/types/practice";

export type KeyAwareNotationContext =
  | Readonly<{ keyId: MusicKeyId; type: "key" }>
  | Readonly<{ type: "no-key" }>;

export type ChromaticSpellingPreference =
  | "automatic"
  | "prefer-sharps"
  | "prefer-flats";

export const DEFAULT_KEY_AWARE_NOTATION_CONTEXT: KeyAwareNotationContext = {
  type: "no-key",
};

export const DEFAULT_CHROMATIC_SPELLING_PREFERENCE: ChromaticSpellingPreference =
  "automatic";

type SpellingKind = "natural" | "sharp" | "flat";
type SpellingCandidate = Readonly<{ kind: SpellingKind; note: PracticeNote }>;

const NOTE_LETTERS: ReadonlyArray<NoteLetter> = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL_PITCH_CLASS_BY_LETTER: Readonly<Record<NoteLetter, number>> = {
  A: 9, B: 11, C: 0, D: 2, E: 4, F: 5, G: 7,
};
const BALANCED_CHROMATIC_LETTER_BY_PITCH_CLASS: Readonly<Partial<Record<number, NoteLetter>>> = {
  1: "C", 3: "E", 6: "F", 8: "A", 10: "B",
};

function getSpellingCandidates(midiNumber: number): SpellingCandidate[] {
  if (!Number.isInteger(midiNumber) || midiNumber < 0 || midiNumber > 127) return [];
  const pitchClass = getPitchClass(midiNumber);
  const candidates: SpellingCandidate[] = [];
  for (const letter of NOTE_LETTERS) {
    const difference = getPitchClass(pitchClass - NATURAL_PITCH_CLASS_BY_LETTER[letter]);
    const kind: SpellingKind | null = difference === 0 ? "natural" : difference === 1 ? "sharp" : difference === 11 ? "flat" : null;
    if (kind === null) continue;
    try {
      candidates.push({ kind, note: createTheoryPracticeNote(midiNumber, letter) });
    } catch (error) {
      if (error instanceof Error && error.message.includes("without a double accidental")) continue;
      throw error;
    }
  }
  return candidates;
}

function selectChromaticCandidate(options: Readonly<{
  candidates: ReadonlyArray<SpellingCandidate>;
  midiNumber: number;
  orientation: MusicKeyOrientation;
  preference: ChromaticSpellingPreference;
}>): PracticeNote | null {
  const natural = options.candidates.find(({ kind }) => kind === "natural");
  if (natural) return natural.note;
  const preferredKind = options.preference === "prefer-sharps" ? "sharp"
    : options.preference === "prefer-flats" ? "flat"
      : options.orientation === "neutral" ? null : options.orientation;
  const preferred = preferredKind
    ? options.candidates.find(({ kind }) => kind === preferredKind)
    : undefined;
  if (preferred) return preferred.note;
  const balancedLetter = BALANCED_CHROMATIC_LETTER_BY_PITCH_CLASS[getPitchClass(options.midiNumber)];
  return options.candidates.find(({ note }) => note.name.startsWith(balancedLetter ?? ""))?.note
    ?? options.candidates[0]?.note
    ?? null;
}

export function spellKeyAwareMidiNumber({
  context = DEFAULT_KEY_AWARE_NOTATION_CONTEXT,
  midiNumber,
  preference = DEFAULT_CHROMATIC_SPELLING_PREFERENCE,
}: Readonly<{
  context?: KeyAwareNotationContext;
  midiNumber: number;
  preference?: ChromaticSpellingPreference;
}>): PracticeNote | null {
  const candidates = getSpellingCandidates(midiNumber);
  if (candidates.length === 0) return null;
  if (context.type === "no-key") {
    return selectChromaticCandidate({ candidates, midiNumber, orientation: "neutral", preference });
  }
  const key = getMusicKeyDefinition(context.keyId);
  const degree = key.diatonicScale.find(({ pitchClass }) => pitchClass === getPitchClass(midiNumber));
  if (degree) return createTheoryPracticeNote(midiNumber, degree.letter);
  return selectChromaticCandidate({ candidates, midiNumber, orientation: key.orientation, preference });
}

export function spellKeyAwareMidiNumbers(options: Readonly<{
  context?: KeyAwareNotationContext;
  midiNumbers: Iterable<number>;
  preference?: ChromaticSpellingPreference;
}>): ReadonlyArray<PracticeNote> | null {
  const notes: PracticeNote[] = [];
  for (const midiNumber of [...new Set(options.midiNumbers)].sort((a, b) => a - b)) {
    const note = spellKeyAwareMidiNumber({ ...options, midiNumber });
    if (note === null) return null;
    notes.push(note);
  }
  return notes;
}
