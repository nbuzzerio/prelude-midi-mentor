import type { StaffBuilderScore } from "./staff-builder-types";

export type StaffBuilderValidatedSavedSnapshot = Readonly<{
  pieceId: string;
  score: StaffBuilderScore;
}>;

function authoredScoreValue(score: StaffBuilderScore) {
  return {
    schemaVersion: score.schemaVersion,
    id: score.id,
    title: score.title,
    tempoBpm: score.tempoBpm,
    initialKeySignatureId: score.initialKeySignatureId,
    initialTimeSignature: score.initialTimeSignature,
    measures: score.measures,
    ties: score.ties,
    annotations: score.annotations,
  };
}

export function areStaffBuilderAuthoredScoresEquivalent(left: StaffBuilderScore, right: StaffBuilderScore): boolean {
  return JSON.stringify(authoredScoreValue(left)) === JSON.stringify(authoredScoreValue(right));
}

export type StaffBuilderPracticeReadiness = Readonly<
  | { ready: true; reason: null }
  | { ready: false; reason: string }
>;

export function getStaffBuilderEditorPracticeReadiness(input: Readonly<{
  score: StaffBuilderScore;
  validatedSavedSnapshot: StaffBuilderValidatedSavedSnapshot | null;
  issueCount: number;
  hasPendingCapture: boolean;
  savingAvailable: boolean;
}>): StaffBuilderPracticeReadiness {
  if (input.issueCount > 0) return { ready: false, reason: "Fix validation issues before practicing." };
  if (input.hasPendingCapture) return { ready: false, reason: "Lock in or clear pending notes before practicing." };
  if (!input.validatedSavedSnapshot
    || input.validatedSavedSnapshot.pieceId !== input.score.id
    || !areStaffBuilderAuthoredScoresEquivalent(input.score, input.validatedSavedSnapshot.score)) {
    return { ready: false, reason: "Save before practicing." };
  }
  if (!input.savingAvailable) return { ready: false, reason: "Staff Builder changes could not be saved in this browser." };
  return { ready: true, reason: null };
}
