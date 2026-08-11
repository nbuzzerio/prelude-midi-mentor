import type { PiecePracticePiece, PiecePracticeTarget } from "./piece-practice-types";

function uniqueSorted(midiNumbers: Iterable<number>): readonly number[] {
  return [...new Set(midiNumbers)].sort((left, right) => left - right);
}

export function getPiecePracticeIncomingTiedMidiNumbers(
  piece: PiecePracticePiece,
  target: PiecePracticeTarget,
): readonly number[] {
  const measure = piece.measures[target.measureIndex];
  if (!measure) return [];
  return uniqueSorted(measure.sourceEvents.flatMap((event) => {
    if (event.kind !== "notes" || event.startTick !== target.startTick) return [];
    return event.pitches
      .filter(({ incomingTieIds, requiresAttack }) => !requiresAttack && incomingTieIds.length > 0)
      .map(({ midiNumber }) => midiNumber);
  }));
}

export function getPiecePracticeAllowedHeldMidiNumbers(input: Readonly<{
  incomingTiedMidiNumbers: Iterable<number>;
  previousSuccessfulTargetMidiNumbers: Iterable<number>;
}>): readonly number[] {
  return uniqueSorted([
    ...input.incomingTiedMidiNumbers,
    ...input.previousSuccessfulTargetMidiNumbers,
  ]);
}
