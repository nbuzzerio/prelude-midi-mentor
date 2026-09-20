import type { Clef, PracticeTarget, PracticeTargetName } from "@/types/practice";

export type FlashcardPracticeAnswerSource = "midi" | "virtual" | "simulation";

export type FlashcardPracticeTargetSnapshot = Readonly<{
  id: string;
  kind: "note" | "triad";
  clef: Clef;
  name: PracticeTargetName;
  expectedPitches: readonly Readonly<{ midiNumber: number; name: string; octave: number }>[];
}>;

export type FlashcardIncorrectAttemptEvidence = Readonly<{
  sequence: number;
  target: FlashcardPracticeTargetSnapshot;
  submittedMidiNumbers: readonly number[];
  source: FlashcardPracticeAnswerSource;
}>;

export type FlashcardCompletedTargetEvidence = Readonly<{
  sequence: number;
  target: FlashcardPracticeTargetSnapshot;
  submittedMidiNumbers: readonly number[];
  source: FlashcardPracticeAnswerSource;
  responseDurationMs: number;
  priorIncorrectAttemptCount: number;
}>;

export type FlashcardPracticeResultV1 = Readonly<{
  engine: "flashcards";
  schemaVersion: 1;
  incorrectAttempts: readonly FlashcardIncorrectAttemptEvidence[];
  completedTargets: readonly FlashcardCompletedTargetEvidence[];
}>;

export function createFlashcardPracticeResult(): FlashcardPracticeResultV1 {
  return Object.freeze({ engine: "flashcards", schemaVersion: 1, incorrectAttempts: Object.freeze([]), completedTargets: Object.freeze([]) });
}

export function snapshotFlashcardPracticeTarget(target: PracticeTarget, startedAt: number): FlashcardPracticeTargetSnapshot {
  return Object.freeze({ id: `${startedAt}:${target.clef}:${target.notes.map(({ midiNumber }) => midiNumber).join(",")}`, kind: target.notes.length === 1 ? "note" : "triad", clef: target.clef, name: Object.freeze({ ...target.name }), expectedPitches: Object.freeze(target.notes.map((pitch) => Object.freeze({ ...pitch }))) });
}

export function appendFlashcardIncorrectAttempt(result: FlashcardPracticeResultV1, evidence: Omit<FlashcardIncorrectAttemptEvidence, "sequence">): FlashcardPracticeResultV1 {
  return Object.freeze({ ...result, incorrectAttempts: Object.freeze([...result.incorrectAttempts, Object.freeze({ ...evidence, submittedMidiNumbers: Object.freeze([...evidence.submittedMidiNumbers]), sequence: result.incorrectAttempts.length })]) });
}

export function appendFlashcardCompletedTarget(result: FlashcardPracticeResultV1, evidence: Omit<FlashcardCompletedTargetEvidence, "sequence" | "priorIncorrectAttemptCount">): FlashcardPracticeResultV1 {
  const priorIncorrectAttemptCount = result.incorrectAttempts.filter(({ target }) => target.id === evidence.target.id).length;
  return Object.freeze({ ...result, completedTargets: Object.freeze([...result.completedTargets, Object.freeze({ ...evidence, submittedMidiNumbers: Object.freeze([...evidence.submittedMidiNumbers]), priorIncorrectAttemptCount, sequence: result.completedTargets.length })]) });
}
