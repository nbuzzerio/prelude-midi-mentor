import type { IntervalDirection, MusicalInterval } from "@/lib/music/intervals";
import type { PracticeDiagnosticChip } from "@/components/practice-diagnostic-chips";
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
export type EarTrainingPracticeReport = Readonly<{
  completedIdentificationCount: number; incorrectGuessCount: number;
  firstGuessIdentificationCount: number; retriedIdentificationCount: number;
  averageResponseDurationMs: number | null;
  completedTargets: readonly EarTrainingCompletedTargetEvidence[];
  unresolvedIncorrectGuesses: readonly EarTrainingIncorrectGuessEvidence[];
}>;
export type EarTrainingPracticeReportPhases = Readonly<{ prescribed: EarTrainingPracticeReport | null; bonus: EarTrainingPracticeReport | null; recorded: EarTrainingPracticeReport | null }>;
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
export function selectEarTrainingPracticeReport(result: EarTrainingPracticeResultV1): EarTrainingPracticeReport {
  const completedTargetIds = new Set(result.completedTargets.map(({ target }) => target.id));
  const totalResponseDurationMs = result.completedTargets.reduce((total, { responseDurationMs }) => total + responseDurationMs, 0);
  return Object.freeze({
    completedIdentificationCount: result.completedTargets.length,
    incorrectGuessCount: result.incorrectGuesses.length,
    firstGuessIdentificationCount: result.completedTargets.filter(({ priorIncorrectGuesses }) => priorIncorrectGuesses.length === 0).length,
    retriedIdentificationCount: result.completedTargets.filter(({ priorIncorrectGuesses }) => priorIncorrectGuesses.length > 0).length,
    averageResponseDurationMs: result.completedTargets.length === 0 ? null : Math.round(totalResponseDurationMs / result.completedTargets.length),
    completedTargets: Object.freeze([...result.completedTargets]),
    unresolvedIncorrectGuesses: Object.freeze(result.incorrectGuesses.filter(({ target }) => !completedTargetIds.has(target.id))),
  });
}
export function selectEarTrainingDiagnosticChips(report: EarTrainingPracticeReport): readonly PracticeDiagnosticChip[] {
  return Object.freeze([
    ...(report.incorrectGuessCount > 0 ? [{ id: "identification", kind: "problem", label: "Identification", count: report.incorrectGuessCount, accessibleText: `Identification problem evidence: ${report.incorrectGuessCount} incorrect ${report.incorrectGuessCount === 1 ? "guess" : "guesses"}` } as const] : []),
    ...(report.retriedIdentificationCount > 0 ? [{ id: "retried", kind: "process", label: "Retried", count: report.retriedIdentificationCount, accessibleText: `${report.retriedIdentificationCount} ${report.retriedIdentificationCount === 1 ? "interval was" : "intervals were"} identified after another guess` } as const] : []),
  ]);
}
function isEarTrainingEvidencePrefix<T>(boundary: readonly T[], final: readonly T[]): boolean {
  return boundary.length <= final.length && boundary.every((item, index) => JSON.stringify(item) === JSON.stringify(final[index]));
}
function earTrainingPhaseResult(result: EarTrainingPracticeResultV1, incorrectStart: number, completedStart: number): EarTrainingPracticeResultV1 {
  const incorrectGuesses = result.incorrectGuesses.slice(incorrectStart);
  const completedTargets = result.completedTargets.slice(completedStart).map((item) => Object.freeze({
    ...item,
    priorIncorrectGuesses: Object.freeze(incorrectGuesses.filter(({ target }) => target.id === item.target.id).map(({ guessedInterval }) => guessedInterval)),
  }));
  return Object.freeze({ ...result, incorrectGuesses: Object.freeze(incorrectGuesses), completedTargets: Object.freeze(completedTargets) });
}
export function selectEarTrainingPracticeReportPhases(boundary: EarTrainingPracticeResultV1 | null, final: EarTrainingPracticeResultV1 | null): EarTrainingPracticeReportPhases {
  if (boundary === null) return Object.freeze({ prescribed: null, bonus: null, recorded: final === null ? null : selectEarTrainingPracticeReport(final) });
  const effectiveFinal = final ?? boundary;
  if (!isEarTrainingEvidencePrefix(boundary.incorrectGuesses, effectiveFinal.incorrectGuesses)
    || !isEarTrainingEvidencePrefix(boundary.completedTargets, effectiveFinal.completedTargets)) {
    return Object.freeze({ prescribed: null, bonus: null, recorded: selectEarTrainingPracticeReport(effectiveFinal) });
  }
  const bonusResult = earTrainingPhaseResult(effectiveFinal, boundary.incorrectGuesses.length, boundary.completedTargets.length);
  const hasBonus = bonusResult.incorrectGuesses.length > 0 || bonusResult.completedTargets.length > 0;
  return Object.freeze({ prescribed: selectEarTrainingPracticeReport(boundary), bonus: hasBonus ? selectEarTrainingPracticeReport(bonusResult) : null, recorded: null });
}
