import type { PiecePracticeTarget } from "./piece-practice-types";

export type PiecePracticeAttempt = Readonly<{
  attackMidiNumbers: Iterable<number>;
  heldMidiNumbers?: Iterable<number>;
  allowedHeldMidiNumbers?: Iterable<number>;
}>;

export type PiecePracticeGrade = Readonly<{
  correct: boolean;
  expectedMidiNumbers: readonly number[];
  receivedMidiNumbers: readonly number[];
  missingMidiNumbers: readonly number[];
  extraMidiNumbers: readonly number[];
  unexpectedHeldMidiNumbers: readonly number[];
  expectedWrittenPitches: PiecePracticeTarget["attackedPitches"];
}>;

function uniqueSorted(values: Iterable<number>): readonly number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

export function gradePiecePracticeTarget(target: PiecePracticeTarget, attempt: PiecePracticeAttempt): PiecePracticeGrade {
  const expectedMidiNumbers = uniqueSorted(target.expectedMidiNumbers);
  const receivedMidiNumbers = uniqueSorted(attempt.attackMidiNumbers);
  const expected = new Set(expectedMidiNumbers);
  const received = new Set(receivedMidiNumbers);
  const allowedHeld = new Set(attempt.allowedHeldMidiNumbers ?? []);
  const missingMidiNumbers = expectedMidiNumbers.filter((midiNumber) => !received.has(midiNumber));
  const extraMidiNumbers = receivedMidiNumbers.filter((midiNumber) => !expected.has(midiNumber));
  const unexpectedHeldMidiNumbers = uniqueSorted(attempt.heldMidiNumbers ?? [])
    .filter((midiNumber) => !expected.has(midiNumber) && !allowedHeld.has(midiNumber));
  return {
    correct: missingMidiNumbers.length === 0 && extraMidiNumbers.length === 0 && unexpectedHeldMidiNumbers.length === 0,
    expectedMidiNumbers,
    receivedMidiNumbers,
    missingMidiNumbers,
    extraMidiNumbers,
    unexpectedHeldMidiNumbers,
    expectedWrittenPitches: target.attackedPitches,
  };
}
