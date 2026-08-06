import type {
  IntervalDirection,
  MusicalInterval,
} from "@/lib/music/intervals";

export type Clef = "bass" | "treble";

export type PracticeClefMode = Clef | "mixed";

export type PracticeExerciseType = "notes" | "triads";

export type PracticeNoteCategory = "naturals" | "accidentals";

export type PracticeTriadQuality =
  | "major"
  | "minor"
  | "diminished"
  | "augmented";

export type PracticeTriadPosition = "root" | "first" | "second";

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
  name?: PracticeTargetName;
  notes: ReadonlyArray<PracticeNote>;
}>;

export type SequenceTarget = Readonly<{
  clef: Clef;
  name: PracticeTargetName;
  steps: ReadonlyArray<SequenceStep>;
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

export type SequenceScaleDirection =
  | SequenceDirection
  | "ascending-descending";

export type SequenceInterval = MusicalInterval;

export type SequenceScale =
  | "major"
  | "natural-minor"
  | "harmonic-minor"
  | "melodic-minor"
  | "major-pentatonic"
  | "minor-pentatonic";

export type SequenceArpeggio =
  | "major"
  | "minor"
  | "diminished"
  | "augmented"
  | "dominant-seventh"
  | "major-seventh"
  | "minor-seventh";

export type SequenceNoteCategory = "naturals" | "accidentals";
