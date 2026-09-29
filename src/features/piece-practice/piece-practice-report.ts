import { formatPiecePracticeMidiPitch, formatPiecePracticeWrittenPitch, type PiecePracticeAttackEvidence, type PiecePracticeMistakeEvidence } from "./piece-practice-evidence";
import { getPiecePracticeMeasureResults, type PiecePracticeSessionState } from "./piece-practice-session";

export function mistakeText(evidence: PiecePracticeMistakeEvidence) {
  const expected = evidence.expectedPitches.map(formatPiecePracticeWrittenPitch).join(", ") || "None";
  if (evidence.kind === "normal-attempt") return {
    expected,
    played: evidence.receivedMidiNumbers.map(formatPiecePracticeMidiPitch).join(", ") || "No new notes",
    missing: evidence.missingMidiNumbers.map((midiNumber) => evidence.expectedPitches.find((pitch) => pitch.midiNumber === midiNumber)).map((pitch, index) => pitch ? formatPiecePracticeWrittenPitch(pitch) : formatPiecePracticeMidiPitch(evidence.missingMidiNumbers[index]!)),
    extra: evidence.extraMidiNumbers.map(formatPiecePracticeMidiPitch),
    held: evidence.unexpectedHeldMidiNumbers.map(formatPiecePracticeMidiPitch),
    label: "Unsuccessful attempt",
  };
  if (evidence.kind === "rolled-unexpected-pitch") return {
    expected,
    played: formatPiecePracticeMidiPitch(evidence.receivedMidiNumber),
    missing: [], extra: [formatPiecePracticeMidiPitch(evidence.receivedMidiNumber)], held: [],
    label: "Unexpected pitch during rolled chord",
  };
  return {
    expected,
    played: evidence.accumulatedMidiNumbers.map(formatPiecePracticeMidiPitch).join(", ") || "No completed roll",
    missing: evidence.missingMidiNumbers.map((midiNumber) => evidence.expectedPitches.find((pitch) => pitch.midiNumber === midiNumber)).map((pitch, index) => pitch ? formatPiecePracticeWrittenPitch(pitch) : formatPiecePracticeMidiPitch(evidence.missingMidiNumbers[index]!)), extra: [], held: [],
    label: "Rolled chord timed out",
  };
}


export function formatPiecePracticeAttackEvidence(attack: PiecePracticeAttackEvidence): string {
  return `Measure ${attack.measureIndex + 1}, target ${attack.targetId}, ${(attack.occurredAtActiveMs / 1000).toFixed(3)}s: ${formatPiecePracticeMidiPitch(attack.midiNumber)}, velocity ${attack.attackVelocity}`;
}

/** Pure report presentation; attack evidence never participates in correctness or timing grading. */
export function formatPiecePracticeReport({ title, rangeText, state, includeAttackStrength = false }: Readonly<{
  title: string; rangeText: string; state: PiecePracticeSessionState; includeAttackStrength?: boolean;
}>): string {
  const results = getPiecePracticeMeasureResults(state);
  const lines = [
    `${title} - Piece Practice report`, `Practice range: ${rangeText}`,
    `Elapsed time: ${((state.completedAtActiveMs ?? state.activeElapsedMs) / 1000).toFixed(1)}s`,
    `Mistakes: ${state.mistakeEvidence.length}`,
    `Problem measures: ${results.filter(({ isProblem }) => isProblem).map(({ measureNumber }) => measureNumber).join(", ") || "None"}`,
  ];
  for (const result of results) {
    lines.push("", `Measure ${result.measureNumber}: ${result.mistakeCount} mistakes, ${result.hesitationCount} slow responses, ${result.skippedTargetCount} skipped, ${(result.activeDurationMs / 1000).toFixed(1)}s`);
    for (const item of state.mistakeEvidence.filter(({ measureIndex }) => measureIndex === result.measureIndex)) {
      const text = mistakeText(item);
      lines.push(text.label, `Expected: ${text.expected}`, `Played: ${text.played}`);
      if (text.missing.length) lines.push(`Missing: ${text.missing.join(", ")}`);
      if (text.extra.length) lines.push(`Extra: ${text.extra.join(", ")}`);
      if (text.held.length) lines.push(`Unexpected held: ${text.held.join(", ")}`);
    }
    for (const timing of state.targetTimings.filter(({ measureIndex, isHesitation }) => measureIndex === result.measureIndex && isHesitation)) {
      lines.push(`Slow response: ${timing.expectedPitches.map(formatPiecePracticeWrittenPitch).join(", ")} - ${(timing.responseDurationMs / 1000).toFixed(1)}s`);
    }
    if (includeAttackStrength) {
      const attacks = (state.attackEvidence ?? []).filter(({ measureIndex }) => measureIndex === result.measureIndex);
      if (attacks.length) lines.push("Performed (physical MIDI attacks):", ...attacks.map(formatPiecePracticeAttackEvidence));
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
