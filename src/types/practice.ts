export type Clef = "bass" | "treble";

export type PracticeMode = Clef | "mixed";

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
