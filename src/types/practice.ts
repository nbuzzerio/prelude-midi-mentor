import type {
  IntervalDirection,
  MusicalInterval,
} from "@/lib/music/intervals";

export type Clef = "bass" | "treble";

export const PRACTICE_CLEF_MODES = ["bass", "treble", "mixed"] as const;
export type PracticeClefMode = (typeof PRACTICE_CLEF_MODES)[number];

export const PRACTICE_EXERCISE_TYPES = ["notes", "triads"] as const;
export type PracticeExerciseType = (typeof PRACTICE_EXERCISE_TYPES)[number];

export const PRACTICE_NOTE_CATEGORIES = ["naturals", "accidentals"] as const;
export type PracticeNoteCategory = (typeof PRACTICE_NOTE_CATEGORIES)[number];

export const PRACTICE_TRIAD_QUALITIES = ["major", "minor", "diminished", "augmented"] as const;
export type PracticeTriadQuality = (typeof PRACTICE_TRIAD_QUALITIES)[number];

export const PRACTICE_TRIAD_POSITIONS = ["root", "first", "second"] as const;
export type PracticeTriadPosition = (typeof PRACTICE_TRIAD_POSITIONS)[number];

export type FeedbackState = "idle" | "correct" | "incorrect";

export type PracticeNote = Readonly<{
  midiNumber: number;
  name: string;
  octave: number;
}>;

export type PracticeTargetName = Readonly<{
  primary: string;
  secondary?: string;
}>;

export type PracticeTarget = Readonly<{
  clef: Clef;
  name: PracticeTargetName;
  notes: ReadonlyArray<PracticeNote>;
}>;

export type PracticeStats = Readonly<{
  correct: number;
  incorrect: number;
  streak: number;
  totalResponseTimeMs: number;
}>;

export type SequenceStep = Readonly<{
  durationTicks: number;
  name?: PracticeTargetName;
  notes: ReadonlyArray<PracticeNote>;
}>;

export type SequenceMeter = Readonly<{
  denominator: number;
  numerator: number;
}>;

export type SequenceTiming = Readonly<{
  meter: SequenceMeter;
  ticksPerQuarter: number;
}>;

export type SequenceTarget = Readonly<{
  clef: Clef;
  name: PracticeTargetName;
  steps: ReadonlyArray<SequenceStep>;
  timing: SequenceTiming;
}>;

export type SequenceStats = Readonly<{
  completed: number;
  incorrectAttempts: number;
  streak: number;
  totalSequenceTimeMs: number;
}>;

export type SequenceExerciseType =
  | "intervals"
  | "scales"
  | "arpeggios"
  | "chord-progressions";

export type SequenceDirection = IntervalDirection;

export const SEQUENCE_DIRECTIONS = ["ascending", "descending"] as const;
export const SEQUENCE_SCALE_DIRECTIONS = ["ascending", "descending", "ascending-descending"] as const;
export type SequenceScaleDirection = (typeof SEQUENCE_SCALE_DIRECTIONS)[number];

export const SEQUENCE_ARPEGGIO_DIRECTIONS = SEQUENCE_SCALE_DIRECTIONS;
export type SequenceArpeggioDirection = (typeof SEQUENCE_ARPEGGIO_DIRECTIONS)[number];

export type SequenceInterval = MusicalInterval;

export const SEQUENCE_SCALES = ["major", "natural-minor", "harmonic-minor", "melodic-minor", "major-pentatonic", "minor-pentatonic"] as const;
export type SequenceScale = (typeof SEQUENCE_SCALES)[number];

export const SEQUENCE_ARPEGGIOS = ["major", "minor", "diminished", "augmented", "dominant-seventh", "major-seventh", "minor-seventh"] as const;
export type SequenceArpeggio = (typeof SEQUENCE_ARPEGGIOS)[number];

export type SequenceNoteCategory = "naturals" | "accidentals";
