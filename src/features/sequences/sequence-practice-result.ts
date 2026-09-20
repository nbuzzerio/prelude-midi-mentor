import type { Clef, PracticeTargetName, SequenceTarget } from "@/types/practice";
import type { ScaleRepertoireId } from "./scale-repertoire";

export type SequencePracticeAnswerSource = "midi" | "virtual" | "simulation";
export type SequencePracticeTargetSnapshot = Readonly<{
  id: string;
  clef: Clef;
  name: PracticeTargetName;
  steps: readonly Readonly<{ expectedMidiNumbers: readonly number[] }>[];
}>;
export type SequenceIncorrectAttemptEvidence = Readonly<{
  sequence: number; target: SequencePracticeTargetSnapshot; failedStepIndex: number;
  expectedMidiNumbers: readonly number[]; submittedMidiNumbers: readonly number[]; source: SequencePracticeAnswerSource;
}>;
export type SequenceCompletedEvidence = Readonly<{
  sequence: number; target: SequencePracticeTargetSnapshot; completionDurationMs: number;
  priorIncorrectAttemptCount: number; source: SequencePracticeAnswerSource; repertoireId: ScaleRepertoireId | null;
}>;
export type SequencePracticeResultV1 = Readonly<{
  engine: "sequences"; schemaVersion: 1; configuredRepertoireIds: readonly ScaleRepertoireId[];
  incorrectSequenceAttempts: readonly SequenceIncorrectAttemptEvidence[];
  completedSequences: readonly SequenceCompletedEvidence[];
}>;
export function createSequencePracticeResult(configuredRepertoireIds: readonly ScaleRepertoireId[] = []): SequencePracticeResultV1 {
  return Object.freeze({ engine: "sequences", schemaVersion: 1, configuredRepertoireIds: Object.freeze([...configuredRepertoireIds]), incorrectSequenceAttempts: Object.freeze([]), completedSequences: Object.freeze([]) });
}
export function snapshotSequencePracticeTarget(target: SequenceTarget, startedAt: number): SequencePracticeTargetSnapshot {
  return Object.freeze({ id: `${startedAt}:${target.clef}:${target.steps.flatMap(({ notes }) => notes.map(({ midiNumber }) => midiNumber)).join(",")}`, clef: target.clef, name: Object.freeze({ ...target.name }), steps: Object.freeze(target.steps.map(({ notes }) => Object.freeze({ expectedMidiNumbers: Object.freeze(notes.map(({ midiNumber }) => midiNumber)) }))) });
}
export function appendSequenceIncorrectAttempt(result: SequencePracticeResultV1, evidence: Omit<SequenceIncorrectAttemptEvidence, "sequence">): SequencePracticeResultV1 {
  return Object.freeze({ ...result, incorrectSequenceAttempts: Object.freeze([...result.incorrectSequenceAttempts, Object.freeze({ ...evidence, expectedMidiNumbers: Object.freeze([...evidence.expectedMidiNumbers]), submittedMidiNumbers: Object.freeze([...evidence.submittedMidiNumbers]), sequence: result.incorrectSequenceAttempts.length })]) });
}
export function appendCompletedSequence(result: SequencePracticeResultV1, evidence: Omit<SequenceCompletedEvidence, "sequence" | "priorIncorrectAttemptCount">): SequencePracticeResultV1 {
  const priorIncorrectAttemptCount = result.incorrectSequenceAttempts.filter(({ target }) => target.id === evidence.target.id).length;
  return Object.freeze({ ...result, completedSequences: Object.freeze([...result.completedSequences, Object.freeze({ ...evidence, priorIncorrectAttemptCount, sequence: result.completedSequences.length })]) });
}
