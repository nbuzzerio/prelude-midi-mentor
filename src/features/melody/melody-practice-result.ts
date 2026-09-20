import type { MelodyContinuousDiagnosticTrial } from "./melody-continuous-practice";

export type MelodyPracticeResultV1 = Readonly<{
  engine: "melody";
  schemaVersion: 1;
  diagnosticTrials: readonly MelodyContinuousDiagnosticTrial[];
  interrupted: boolean;
}>;

export function createMelodyPracticeResult(diagnosticTrials: readonly MelodyContinuousDiagnosticTrial[] = [], interrupted = false): MelodyPracticeResultV1 {
  return Object.freeze({ engine: "melody", schemaVersion: 1, diagnosticTrials: Object.freeze([...diagnosticTrials]), interrupted });
}
