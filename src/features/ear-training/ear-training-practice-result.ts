import type { IntervalDirection, MusicalInterval } from "@/lib/music/intervals";
import type { EarTrainingTarget } from "./ear-training-types";

export type EarTrainingTargetSnapshot = Readonly<{
  id: string; interval: MusicalInterval; direction: IntervalDirection;
  notes: readonly [Readonly<{ midiNumber: number; name: string; octave: number }>, Readonly<{ midiNumber: number; name: string; octave: number }>];
}>;
export type EarTrainingIncorrectGuessEvidence = Readonly<{ sequence: number; target: EarTrainingTargetSnapshot; guessedInterval: MusicalInterval }>;
export type EarTrainingCompletedTargetEvidence = Readonly<{
  sequence: number; target: EarTrainingTargetSnapshot; responseDurationMs: number; priorIncorrectGuesses: readonly MusicalInterval[];
}>;
export type EarTrainingPracticeResultV1 = Readonly<{
  engine: "ear-training"; schemaVersion: 1;
  incorrectGuesses: readonly EarTrainingIncorrectGuessEvidence[];
  completedTargets: readonly EarTrainingCompletedTargetEvidence[];
}>;
export function createEarTrainingPracticeResult(): EarTrainingPracticeResultV1 {
  return Object.freeze({ engine: "ear-training", schemaVersion: 1, incorrectGuesses: Object.freeze([]), completedTargets: Object.freeze([]) });
}
export function snapshotEarTrainingTarget(target: EarTrainingTarget, targetVersion: number): EarTrainingTargetSnapshot {
  return Object.freeze({ id: `${targetVersion}:${target.direction}:${target.interval}:${target.notes.map(({ midiNumber }) => midiNumber).join(",")}`, interval: target.interval, direction: target.direction, notes: Object.freeze(target.notes.map((note) => Object.freeze({ ...note }))) as EarTrainingTargetSnapshot["notes"] });
}
export function appendEarTrainingIncorrectGuess(result: EarTrainingPracticeResultV1, evidence: Omit<EarTrainingIncorrectGuessEvidence, "sequence">): EarTrainingPracticeResultV1 {
  return Object.freeze({ ...result, incorrectGuesses: Object.freeze([...result.incorrectGuesses, Object.freeze({ ...evidence, sequence: result.incorrectGuesses.length })]) });
}
export function appendEarTrainingCompletedTarget(result: EarTrainingPracticeResultV1, evidence: Omit<EarTrainingCompletedTargetEvidence, "sequence" | "priorIncorrectGuesses">): EarTrainingPracticeResultV1 {
  const priorIncorrectGuesses = result.incorrectGuesses.filter(({ target }) => target.id === evidence.target.id).map(({ guessedInterval }) => guessedInterval);
  return Object.freeze({ ...result, completedTargets: Object.freeze([...result.completedTargets, Object.freeze({ ...evidence, priorIncorrectGuesses: Object.freeze(priorIncorrectGuesses), sequence: result.completedTargets.length })]) });
}
