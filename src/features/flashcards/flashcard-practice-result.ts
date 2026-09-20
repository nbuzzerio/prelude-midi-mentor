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

export type FlashcardPracticeReport = Readonly<{
  completedTargetCount: number;
  incorrectAttemptCount: number;
  firstTryTargetCount: number;
  retriedTargetCount: number;
  averageResponseDurationMs: number | null;
  completedTargets: readonly FlashcardCompletedTargetEvidence[];
  unresolvedIncorrectAttempts: readonly FlashcardIncorrectAttemptEvidence[];
}>;
export type FlashcardPracticeReportPhases = Readonly<{
  prescribed: FlashcardPracticeReport | null;
  bonus: FlashcardPracticeReport | null;
  recorded: FlashcardPracticeReport | null;
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

export function selectFlashcardPracticeReport(result: FlashcardPracticeResultV1): FlashcardPracticeReport {
  const completedTargetIds = new Set(result.completedTargets.map(({ target }) => target.id));
  const totalResponseDurationMs = result.completedTargets.reduce((total, { responseDurationMs }) => total + responseDurationMs, 0);
  return Object.freeze({
    completedTargetCount: result.completedTargets.length,
    incorrectAttemptCount: result.incorrectAttempts.length,
    firstTryTargetCount: result.completedTargets.filter(({ priorIncorrectAttemptCount }) => priorIncorrectAttemptCount === 0).length,
    retriedTargetCount: result.completedTargets.filter(({ priorIncorrectAttemptCount }) => priorIncorrectAttemptCount > 0).length,
    averageResponseDurationMs: result.completedTargets.length === 0 ? null : Math.round(totalResponseDurationMs / result.completedTargets.length),
    completedTargets: Object.freeze([...result.completedTargets]),
    unresolvedIncorrectAttempts: Object.freeze(result.incorrectAttempts.filter(({ target }) => !completedTargetIds.has(target.id))),
  });
}

function isFlashcardEvidencePrefix<T>(boundary: readonly T[], final: readonly T[]): boolean {
  return boundary.length <= final.length && boundary.every((item, index) => JSON.stringify(item) === JSON.stringify(final[index]));
}

function flashcardPhaseResult(result: FlashcardPracticeResultV1, incorrectStart: number, completedStart: number): FlashcardPracticeResultV1 {
  const incorrectAttempts = result.incorrectAttempts.slice(incorrectStart);
  const completedTargets = result.completedTargets.slice(completedStart).map((item) => Object.freeze({
    ...item,
    priorIncorrectAttemptCount: incorrectAttempts.filter(({ target }) => target.id === item.target.id).length,
  }));
  return Object.freeze({ ...result, incorrectAttempts: Object.freeze(incorrectAttempts), completedTargets: Object.freeze(completedTargets) });
}

export function selectFlashcardPracticeReportPhases(boundary: FlashcardPracticeResultV1 | null, final: FlashcardPracticeResultV1 | null): FlashcardPracticeReportPhases {
  if (boundary === null) return Object.freeze({ prescribed: null, bonus: null, recorded: final === null ? null : selectFlashcardPracticeReport(final) });
  const effectiveFinal = final ?? boundary;
  if (!isFlashcardEvidencePrefix(boundary.incorrectAttempts, effectiveFinal.incorrectAttempts)
    || !isFlashcardEvidencePrefix(boundary.completedTargets, effectiveFinal.completedTargets)) {
    return Object.freeze({ prescribed: null, bonus: null, recorded: selectFlashcardPracticeReport(effectiveFinal) });
  }
  const bonusResult = flashcardPhaseResult(effectiveFinal, boundary.incorrectAttempts.length, boundary.completedTargets.length);
  const hasBonus = bonusResult.incorrectAttempts.length > 0 || bonusResult.completedTargets.length > 0;
  return Object.freeze({ prescribed: selectFlashcardPracticeReport(boundary), bonus: hasBonus ? selectFlashcardPracticeReport(bonusResult) : null, recorded: null });
}
