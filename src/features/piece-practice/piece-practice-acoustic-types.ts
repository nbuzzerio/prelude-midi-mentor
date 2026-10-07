export type PiecePracticeInputSource = "midi" | "virtual" | "microphone";

export type PiecePracticeInputConfiguration = Readonly<
  | { mode: "keyboard" }
  | { mode: "microphone"; instrument: "violin" | "ocarina"; pitchToleranceCents: number }
>;

export const DEFAULT_PIECE_PRACTICE_INPUT: PiecePracticeInputConfiguration = Object.freeze({ mode: "keyboard" });

/** Physical acoustic evidence. No target, spelling, velocity, or expected answer. */
export type AcousticAttack = Readonly<{
  source: "microphone";
  captureGeneration: number;
  sequence: number;
  onsetObservedAtMs: number;
  confirmedAtMs: number;
  frequencyHz: number;
  nearestSemitone: number;
  articulation: "initial-acquisition" | "after-quiet" | "pitch-change" | "reattack";
}>;

export type AcousticPitchGrade = Readonly<{
  accepted: boolean;
  rejection: "wrong-pitch" | "outside-tolerance" | null;
  frequencyHz: number;
  nearestSemitone: number;
  expectedSemitone: number;
  centsFromExpected: number;
  pitchToleranceCents: number;
}>;

export function samePiecePracticeInputConfiguration(left = DEFAULT_PIECE_PRACTICE_INPUT, right = DEFAULT_PIECE_PRACTICE_INPUT): boolean {
  return left.mode === right.mode && (left.mode === "keyboard" || (right.mode === "microphone"
    && left.instrument === right.instrument && left.pitchToleranceCents === right.pitchToleranceCents));
}
