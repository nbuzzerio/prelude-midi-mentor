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
