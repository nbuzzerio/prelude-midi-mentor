import type { MelodyContinuousDiagnosticTrial } from "./melody-continuous-practice";
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
