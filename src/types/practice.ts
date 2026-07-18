export type Clef = "bass" | "treble";

export type PracticeClefMode = Clef | "mixed";

export type PracticeExerciseType = "notes" | "triads";

export type FeedbackState = "idle" | "correct" | "incorrect";

export type PracticeNote = Readonly<{
  midiNumber: number;
  name: string;
  octave: number;
}>;

export type PracticeTarget = Readonly<{
  clef: Clef;
  notes: ReadonlyArray<PracticeNote>;
}>;

export type PracticeStats = Readonly<{
  correct: number;
  incorrect: number;
  streak: number;
  totalResponseTimeMs: number;
}>;
