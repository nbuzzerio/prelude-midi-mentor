export type Clef = "bass" | "treble";

export type PracticeMode = Clef | "mixed";

export type FeedbackState = "idle" | "correct" | "incorrect";

export type TargetNote = Readonly<{
  clef: Clef;
  midiNumber: number;
  name: string;
  octave: number;
}>;

export type PracticeStats = Readonly<{
  correct: number;
  incorrect: number;
  streak: number;
  totalResponseTimeMs: number;
}>;
