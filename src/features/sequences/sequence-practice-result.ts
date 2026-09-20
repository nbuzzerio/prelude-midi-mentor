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
export type SequencePracticeReport = Readonly<{
  completedSequenceCount: number; incorrectSequenceAttemptCount: number;
  firstTrySequenceCount: number; retriedSequenceCount: number;
  averageCompletionDurationMs: number | null;
  configuredRepertoireCount: number; completedRepertoireCount: number;
  completedSequences: readonly SequenceCompletedEvidence[];
  unresolvedIncorrectAttempts: readonly SequenceIncorrectAttemptEvidence[];
}>;
export type SequencePracticeReportPhases = Readonly<{ prescribed: SequencePracticeReport | null; bonus: SequencePracticeReport | null; recorded: SequencePracticeReport | null }>;
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
export function selectSequencePracticeReport(result: SequencePracticeResultV1): SequencePracticeReport {
  const completedTargetIds = new Set(result.completedSequences.map(({ target }) => target.id));
  const completedRepertoireIds = new Set(result.completedSequences.flatMap(({ repertoireId }) => repertoireId === null ? [] : [repertoireId]));
  const totalDurationMs = result.completedSequences.reduce((total, { completionDurationMs }) => total + completionDurationMs, 0);
  return Object.freeze({
    completedSequenceCount: result.completedSequences.length,
    incorrectSequenceAttemptCount: result.incorrectSequenceAttempts.length,
    firstTrySequenceCount: result.completedSequences.filter(({ priorIncorrectAttemptCount }) => priorIncorrectAttemptCount === 0).length,
    retriedSequenceCount: result.completedSequences.filter(({ priorIncorrectAttemptCount }) => priorIncorrectAttemptCount > 0).length,
    averageCompletionDurationMs: result.completedSequences.length === 0 ? null : Math.round(totalDurationMs / result.completedSequences.length),
    configuredRepertoireCount: result.configuredRepertoireIds.length,
    completedRepertoireCount: result.configuredRepertoireIds.filter((id) => completedRepertoireIds.has(id)).length,
    completedSequences: Object.freeze([...result.completedSequences]),
    unresolvedIncorrectAttempts: Object.freeze(result.incorrectSequenceAttempts.filter(({ target }) => !completedTargetIds.has(target.id))),
  });
}
function isSequenceEvidencePrefix<T>(boundary: readonly T[], final: readonly T[]): boolean {
  return boundary.length <= final.length && boundary.every((item, index) => JSON.stringify(item) === JSON.stringify(final[index]));
}
function sequencePhaseResult(result: SequencePracticeResultV1, incorrectStart: number, completedStart: number): SequencePracticeResultV1 {
  const incorrectSequenceAttempts = result.incorrectSequenceAttempts.slice(incorrectStart);
  const completedSequences = result.completedSequences.slice(completedStart).map((item) => Object.freeze({
    ...item, priorIncorrectAttemptCount: incorrectSequenceAttempts.filter(({ target }) => target.id === item.target.id).length,
  }));
  return Object.freeze({ ...result, incorrectSequenceAttempts: Object.freeze(incorrectSequenceAttempts), completedSequences: Object.freeze(completedSequences) });
}
export function selectSequencePracticeReportPhases(boundary: SequencePracticeResultV1 | null, final: SequencePracticeResultV1 | null): SequencePracticeReportPhases {
  if (boundary === null) return Object.freeze({ prescribed: null, bonus: null, recorded: final === null ? null : selectSequencePracticeReport(final) });
  const effectiveFinal = final ?? boundary;
  if (!isSequenceEvidencePrefix(boundary.configuredRepertoireIds, effectiveFinal.configuredRepertoireIds)
    || boundary.configuredRepertoireIds.length !== effectiveFinal.configuredRepertoireIds.length
    || !isSequenceEvidencePrefix(boundary.incorrectSequenceAttempts, effectiveFinal.incorrectSequenceAttempts)
    || !isSequenceEvidencePrefix(boundary.completedSequences, effectiveFinal.completedSequences)) {
    return Object.freeze({ prescribed: null, bonus: null, recorded: selectSequencePracticeReport(effectiveFinal) });
  }
  const bonusResult = sequencePhaseResult(effectiveFinal, boundary.incorrectSequenceAttempts.length, boundary.completedSequences.length);
  const hasBonus = bonusResult.incorrectSequenceAttempts.length > 0 || bonusResult.completedSequences.length > 0;
  return Object.freeze({ prescribed: selectSequencePracticeReport(boundary), bonus: hasBonus ? selectSequencePracticeReport(bonusResult) : null, recorded: null });
}
