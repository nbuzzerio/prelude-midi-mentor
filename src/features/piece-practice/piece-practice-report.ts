import { formatPiecePracticeMidiPitch, type PiecePracticeAttackEvidence, type PiecePracticeMistakeEvidence, type PiecePracticeExpectedPitchSnapshot, type PiecePracticePitchPresentation } from "./piece-practice-evidence";
import { getPiecePracticeMeasureResults, type PiecePracticeSessionState } from "./piece-practice-session";
import type { PiecePracticePiece } from "./piece-practice-types";
import { getPiecePracticeBoundaryReattackPitches } from "./piece-practice-input";
import { piecePracticeAssessmentLabel } from "./piece-practice-assessment";

export type PiecePracticeReportPresentation = Readonly<{ piece?: PiecePracticePiece; showMidiDetails?: boolean }>;

export function getPiecePracticeReportPitchContext(
  location: Readonly<{ measureIndex: number; targetId: string }>,
  { piece, showMidiDetails = false }: PiecePracticeReportPresentation = {},
  expectedPitches?: readonly PiecePracticeExpectedPitchSnapshot[],
): PiecePracticePitchPresentation {
  const measure = piece?.measures[location.measureIndex];
  const target = measure?.targets.find(({ id }) => id === location.targetId);
  const boundary = piece && location.targetId === `${measure?.sourceMeasureId}:boundary-target`
    ? [...getPiecePracticeBoundaryReattackPitches(piece, location.measureIndex), ...(measure?.targets[0]?.startTick === 0 ? measure.targets[0].attackedPitches : [])] : [];
  return { expectedPitches: expectedPitches?.length ? expectedPitches : target?.attackedPitches ?? boundary,
    keySignatureId: measure?.keySignatureId, showMidiDetails };
}

export function mistakeText(evidence: PiecePracticeMistakeEvidence, presentation: PiecePracticeReportPresentation = {}) {
  const context = { ...getPiecePracticeReportPitchContext(evidence, presentation, evidence.expectedPitches),
    predecessorPitches: evidence.kind === "normal-attempt" ? evidence.predecessorPitches : undefined };
  const pitchName = (midiNumber: number) => formatPiecePracticeMidiPitch(midiNumber, context);
  const expected = evidence.expectedPitches.map((pitch) => formatPiecePracticeMidiPitch(pitch.midiNumber, { ...context, expectedPitches: [pitch] })).join(", ") || "None";
  if (evidence.kind === "normal-attempt") return {
    expected,
    played: evidence.receivedMidiNumbers.map(pitchName).join(", ") || "No new notes",
    missing: evidence.missingMidiNumbers.map(pitchName),
    extra: evidence.extraMidiNumbers.map(pitchName),
    held: evidence.unexpectedHeldMidiNumbers.map(pitchName),
    label: "Unsuccessful attempt",
  };
  if (evidence.kind === "rolled-unexpected-pitch") return {
    expected,
    played: pitchName(evidence.receivedMidiNumber),
    missing: [], extra: [pitchName(evidence.receivedMidiNumber)], held: [],
    label: "Unexpected pitch during rolled chord",
  };
  return {
    expected,
    played: evidence.accumulatedMidiNumbers.map(pitchName).join(", ") || "No completed roll",
    missing: evidence.missingMidiNumbers.map(pitchName), extra: [], held: [],
    label: "Rolled chord timed out",
  };
}


export function formatPiecePracticeAttackEvidence(attack: PiecePracticeAttackEvidence, presentation: PiecePracticeReportPresentation = {}): string {
  return `Measure ${attack.measureIndex + 1}, target ${attack.targetId}, ${(attack.occurredAtActiveMs / 1000).toFixed(3)}s: ${formatPiecePracticeMidiPitch(attack.midiNumber, getPiecePracticeReportPitchContext(attack, presentation))}, velocity ${attack.attackVelocity}`;
}

/** Pure report presentation; attack evidence never participates in correctness or timing grading. */
export function formatPiecePracticeReport({ title, rangeText, state, includeAttackStrength = false, piece, showMidiDetails = false }: Readonly<{
  title: string; rangeText: string; state: PiecePracticeSessionState; includeAttackStrength?: boolean;
}> & PiecePracticeReportPresentation): string {
  const presentation = { piece, showMidiDetails };
  const results = getPiecePracticeMeasureResults(state);
  const lines = [
    `${title} - Piece Practice report`, `Practice range: ${rangeText}`, `Assessment: ${piecePracticeAssessmentLabel(state.assessmentFocus)}`,
    `Elapsed time: ${((state.completedAtActiveMs ?? state.activeElapsedMs) / 1000).toFixed(1)}s`,
    `Mistakes: ${state.mistakeEvidence.length}`,
    `Problem measures: ${results.filter(({ isProblem }) => isProblem).map(({ measureNumber }) => measureNumber).join(", ") || "None"}`,
  ];
  for (const result of results) {
    lines.push("", `Measure ${result.measureNumber}: ${result.mistakeCount} mistakes, ${result.hesitationCount} slow responses, ${result.skippedTargetCount} skipped, ${(result.activeDurationMs / 1000).toFixed(1)}s`);
    if (result.restartCount) lines.push(`Restarts: ${result.restartCount}`);
    for (const item of state.mistakeEvidence.filter(({ measureIndex }) => measureIndex === result.measureIndex)) {
      const text = mistakeText(item, presentation);
      lines.push(text.label, `Expected: ${text.expected}`, `Played: ${text.played}`);
      if (text.missing.length) lines.push(`Missing: ${text.missing.join(", ")}`);
      if (text.extra.length) lines.push(`Extra: ${text.extra.join(", ")}`);
      if (text.held.length) lines.push(`Unexpected held: ${text.held.join(", ")}`);
    }
    for (const timing of state.targetTimings.filter(({ measureIndex, isHesitation }) => measureIndex === result.measureIndex && isHesitation)) {
      if (timing.responseDurationMs === null) continue;
      const context = getPiecePracticeReportPitchContext(timing, presentation, timing.expectedPitches);
      lines.push(`Slow response: ${timing.expectedPitches.map((pitch) => formatPiecePracticeMidiPitch(pitch.midiNumber, { ...context, expectedPitches: [pitch] })).join(", ")} - ${(timing.responseDurationMs / 1000).toFixed(1)}s`);
    }
    for (const timing of state.targetTimings) {
      if (timing.measureIndex === result.measureIndex && timing.timingBasis === "unarmed-skip") {
        lines.push("Skipped before first attempt; response not timed.");
      }
    }
    if (includeAttackStrength) {
      const attacks = (state.attackEvidence ?? []).filter(({ measureIndex }) => measureIndex === result.measureIndex);
      if (attacks.length) lines.push("Performed (physical MIDI attacks):", ...attacks.map((attack) => formatPiecePracticeAttackEvidence(attack, presentation)));
    }
  }
  if (includeAttackStrength) {
    const velocities = (state.attackEvidence ?? []).map(({ attackVelocity }) => attackVelocity);
    lines.push("", "MIDI ATTACK VELOCITY", `Physical MIDI attacks with velocity evidence: ${velocities.length}`);
    if (velocities.length) lines.push(`Range: ${Math.min(...velocities)}-${Math.max(...velocities)}`);
    else lines.push("No MIDI attack velocity evidence available.");
    lines.push("Exact Note On values only; no dynamics assessment. Other inputs may not provide velocity.");
  }
  return lines.join("\n");
}
