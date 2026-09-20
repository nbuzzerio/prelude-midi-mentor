export type PracticeSessionPrintOptions = Readonly<{
  sessionSummary: boolean; exerciseSummaries: boolean; exerciseDetails: boolean;
  timing: boolean; includeSkippedAndNotEntered: boolean; engineDiagnostics: boolean;
}>;

export const DEFAULT_PRACTICE_SESSION_PRINT_OPTIONS: PracticeSessionPrintOptions = Object.freeze({
  sessionSummary: true, exerciseSummaries: true, exerciseDetails: true,
  timing: true, includeSkippedAndNotEntered: true, engineDiagnostics: true,
});
