import type { PiecePracticeAttackedPitch, PiecePracticePiece, PiecePracticeTarget } from "./piece-practice-types";
import { isPiecePracticeStaffAssessed } from "./piece-practice-assessment";

/** Initial empirical release-overlap allowance, not articulation grading. */
export const PIECE_PRACTICE_RELEASE_OVERLAP_GRACE_MS = 250;

export type PiecePracticeTransition = Readonly<{
  targetId: string;
  predecessorPitches: readonly PiecePracticeAttackedPitch[];
  eligibleHeldMidiNumbers: readonly number[];
  firstAttackAtMs: number | null;
}>;

export function getPiecePracticeTransitionHeldMidiNumbers(
  transition: PiecePracticeTransition | null,
  targetId: string,
  logicalAttemptAtMs: number,
): readonly number[] {
  if (!transition || transition.targetId !== targetId || transition.firstAttackAtMs === null
    || logicalAttemptAtMs > transition.firstAttackAtMs + PIECE_PRACTICE_RELEASE_OVERLAP_GRACE_MS) return [];
  return transition.eligibleHeldMidiNumbers;
}

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
    if (event.kind !== "notes" || event.startTick !== target.startTick || !isPiecePracticeStaffAssessed(piece.assessmentFocus ?? "both", event.staff)) return [];
    return event.pitches
      .filter(({ incomingTieIds, requiresAttack }) => !requiresAttack && incomingTieIds.length > 0)
      .map(({ midiNumber }) => midiNumber);
  }));
}

export function getPiecePracticeBoundaryReattackPitches(piece: PiecePracticePiece, measureIndex: number): readonly PiecePracticeAttackedPitch[] {
  const measure = piece.measures[measureIndex];
  if (!measure) return [];
  const activeEndpointKeys = new Set((piece.soundingSpans ?? [])
    .filter(({ attackTick, endTick }) => attackTick < measure.absoluteStartTick && endTick > measure.absoluteStartTick)
    .flatMap(({ endpointKeys }) => endpointKeys));
  return measure.sourceEvents.flatMap((event): PiecePracticeAttackedPitch[] => {
    if (event.kind !== "notes" || event.startTick !== 0 || !isPiecePracticeStaffAssessed(piece.assessmentFocus ?? "both", event.staff)) return [];
    return event.pitches.filter((pitch) => pitch.incomingTieIds.length > 0
      && activeEndpointKeys.has(`${event.sourceEventId}:${pitch.sourcePitchId}`)).map((pitch) => ({
        sourceEventId: event.sourceEventId,
        sourcePitchId: pitch.sourcePitchId,
        staff: event.staff,
        midiNumber: pitch.midiNumber,
        letter: pitch.letter,
        accidental: pitch.accidental,
        octave: pitch.octave,
        duration: event.duration,
        durationTicks: event.durationTicks,
        incomingTieIds: pitch.incomingTieIds,
        outgoingTieIds: pitch.outgoingTieIds,
      }));
  }).sort((left, right) => left.midiNumber - right.midiNumber || left.sourceEventId.localeCompare(right.sourceEventId));
}

export function getPiecePracticeAllowedHeldMidiNumbers(input: Readonly<{
  piece: PiecePracticePiece;
  target: PiecePracticeTarget;
  additionalAllowedMidiNumbers?: Iterable<number>;
}>): readonly number[] {
  return uniqueSorted([...(input.piece.soundingSpans ?? [])
    .filter(({ attackTick, endTick }) => attackTick < input.target.absoluteStartTick && endTick > input.target.absoluteStartTick)
    .map(({ midiNumber }) => midiNumber), ...(input.additionalAllowedMidiNumbers ?? [])]);
}
