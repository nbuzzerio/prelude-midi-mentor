import type { MelodyContinuousDiagnosticTrial } from "./melody-continuous-practice";
import type { PracticeDiagnosticChip } from "@/components/practice-diagnostic-chips";
import type { MelodyAttemptResult } from "./melody-scoring";
import { summarizeMelodyContinuousPractice } from "./melody-continuous-practice";
import { summarizeMelodyRepairIntervals, summarizeMelodySightReadIntervals, type MelodyIntervalReport } from "./melody-interval-statistics";

export type MelodyPracticeResultV1 = Readonly<{
  engine: "melody";
  schemaVersion: 1;
  diagnosticTrials: readonly MelodyContinuousDiagnosticTrial[];
  interrupted: boolean;
}>;

export type MelodyPracticeReport = Readonly<{
  interrupted: boolean;
  orderedTrials: readonly MelodyContinuousDiagnosticTrial[];
  summary: ReturnType<typeof summarizeMelodyContinuousPractice>;
  sightReadIntervals: MelodyIntervalReport;
  repairIntervals: MelodyIntervalReport;
  hasRepairEvidence: boolean;
}>;
export type MelodyBonusPracticeReport = Readonly<{
  newDiagnosticEvidence: MelodyPracticeReport | null;
  additionalRepairRetries: number;
}>;
export type MelodyPracticeReportPhases = Readonly<{
  prescribed: MelodyPracticeReport | null;
  bonus: MelodyBonusPracticeReport | null;
  recorded: MelodyPracticeReport | null;
}>;

export function createMelodyPracticeResult(diagnosticTrials: readonly MelodyContinuousDiagnosticTrial[] = [], interrupted = false): MelodyPracticeResultV1 {
  return Object.freeze({ engine: "melody", schemaVersion: 1, diagnosticTrials: Object.freeze([...diagnosticTrials]), interrupted });
}

export function selectMelodyPracticeReport(result: MelodyPracticeResultV1): MelodyPracticeReport {
  const orderedTrials = Object.freeze([...result.diagnosticTrials].sort((left, right) => left.originalOrder - right.originalOrder));
  return Object.freeze({
    interrupted: result.interrupted,
    orderedTrials,
    summary: summarizeMelodyContinuousPractice(orderedTrials),
    sightReadIntervals: summarizeMelodySightReadIntervals(orderedTrials),
    repairIntervals: summarizeMelodyRepairIntervals(orderedTrials),
    hasRepairEvidence: orderedTrials.some(({ retryResults }) => retryResults.length > 0),
  });
}

function melodyPitchProblemChip(results: readonly MelodyAttemptResult[]): PracticeDiagnosticChip[] {
  const problemCount = results.reduce((count, result) => count
    + result.attacks.filter(({ status }) => status !== "correct").length
    + result.extras.length, 0);
  return problemCount === 0 ? [] : [{
    id: "pitch-problem", kind: "problem", label: "Pitch", count: problemCount,
    accessibleText: `Pitch problem evidence: ${problemCount} mismatched, missing, or extra ${problemCount === 1 ? "attack" : "attacks"}`,
  }];
}

export function selectMelodyAttemptDiagnosticChips(result: MelodyAttemptResult): readonly PracticeDiagnosticChip[] {
  return Object.freeze([
    ...melodyPitchProblemChip([result]),
    { id: "melody-pitch-metric", kind: "metric", label: "Pitch", value: `${result.pitchScorePercent}%`, accessibleText: `Pitch metric: ${result.pitchScorePercent} percent` },
    ...(result.movementScorePercent === null ? [] : [{ id: "melody-movement-metric", kind: "metric", label: "Movement", value: `${result.movementScorePercent}%`, accessibleText: `Movement metric: ${result.movementScorePercent} percent` } as const]),
    { id: "melody-timing-metric", kind: "metric", label: "Timing", value: `${result.timingScorePercent}%`, accessibleText: `Timing metric: ${result.timingScorePercent} percent` },
  ]);
}

export function selectMelodyPracticeDiagnosticChips(report: MelodyPracticeReport): readonly PracticeDiagnosticChip[] {
  const results = report.orderedTrials.map(({ originalResult }) => originalResult);
  return Object.freeze([
    ...melodyPitchProblemChip(results),
    ...(report.summary.totalReviewRetries > 0 ? [{ id: "retried", kind: "process", label: "Retried", count: report.summary.totalReviewRetries, accessibleText: `${report.summary.totalReviewRetries} Melody Repair ${report.summary.totalReviewRetries === 1 ? "retry" : "retries"}` } as const] : []),
    ...(report.summary.averagePitch === null ? [] : [{ id: "melody-pitch-metric", kind: "metric", label: "Pitch", value: `${report.summary.averagePitch}%`, accessibleText: `Original Pitch average metric: ${report.summary.averagePitch} percent` } as const]),
    ...(report.summary.averageMovement === null ? [] : [{ id: "melody-movement-metric", kind: "metric", label: "Movement", value: `${report.summary.averageMovement}%`, accessibleText: `Original Movement average metric: ${report.summary.averageMovement} percent` } as const]),
    ...(report.summary.averageTiming === null ? [] : [{ id: "melody-timing-metric", kind: "metric", label: "Timing", value: `${report.summary.averageTiming}%`, accessibleText: `Original Timing average metric: ${report.summary.averageTiming} percent` } as const]),
  ]);
}

function melodyTrialBase(trial: MelodyContinuousDiagnosticTrial) {
  return { id: trial.id, originalOrder: trial.originalOrder, exercise: trial.exercise, originalResult: trial.originalResult };
}

export function selectMelodyPracticeReportPhases(boundary: MelodyPracticeResultV1 | null, final: MelodyPracticeResultV1 | null): MelodyPracticeReportPhases {
  if (boundary === null) return Object.freeze({ prescribed: null, bonus: null, recorded: final === null ? null : selectMelodyPracticeReport(final) });
  const effectiveFinal = final ?? boundary;
  let additionalRepairRetries = 0;
  const trustworthy = boundary.diagnosticTrials.length <= effectiveFinal.diagnosticTrials.length
    && boundary.diagnosticTrials.every((trial, index) => {
      const finalTrial = effectiveFinal.diagnosticTrials[index];
      if (!finalTrial || JSON.stringify(melodyTrialBase(trial)) !== JSON.stringify(melodyTrialBase(finalTrial))
        || trial.retryResults.length > finalTrial.retryResults.length
        || !trial.retryResults.every((retry, retryIndex) => JSON.stringify(retry) === JSON.stringify(finalTrial.retryResults[retryIndex]))) return false;
      additionalRepairRetries += finalTrial.retryResults.length - trial.retryResults.length;
      return true;
    });
  if (!trustworthy) return Object.freeze({ prescribed: null, bonus: null, recorded: selectMelodyPracticeReport(effectiveFinal) });
  const newTrials = effectiveFinal.diagnosticTrials.slice(boundary.diagnosticTrials.length);
  const newDiagnosticEvidence = newTrials.length === 0 ? null : selectMelodyPracticeReport(createMelodyPracticeResult(newTrials, effectiveFinal.interrupted));
  const bonus = newDiagnosticEvidence === null && additionalRepairRetries === 0 ? null : Object.freeze({ newDiagnosticEvidence, additionalRepairRetries });
  return Object.freeze({ prescribed: selectMelodyPracticeReport(boundary), bonus, recorded: null });
}
