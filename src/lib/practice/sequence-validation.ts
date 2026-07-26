import type { PracticeNote, SequenceTarget } from "../../types/practice";

export function getSequenceStepMidiNumbers(
  notes: ReadonlyArray<PracticeNote>,
): ReadonlySet<number> {
  return new Set(notes.map((note) => note.midiNumber));
}

export function getCurrentSequenceStepMidiNumbers(
  sequenceTarget: SequenceTarget,
  stepIndex: number,
): ReadonlySet<number> {
  const step = sequenceTarget.steps[stepIndex];

  if (!step) {
    return new Set();
  }

  return getSequenceStepMidiNumbers(step.notes);
}

export function getPreviousSequenceStepMidiNumbers(
  sequenceTarget: SequenceTarget,
  stepIndex: number,
): ReadonlySet<number> {
  if (stepIndex <= 0) {
    return new Set();
  }

  return getCurrentSequenceStepMidiNumbers(sequenceTarget, stepIndex - 1);
}

export function getSequenceTargetMidiNumbers(
  sequenceTarget: SequenceTarget,
): ReadonlySet<number> {
  return new Set(
    sequenceTarget.steps.flatMap((step) =>
      step.notes.map((note) => note.midiNumber),
    ),
  );
}

export function sequenceStepMatchesInput({
  allowedLingeringMidiNumbers = new Set(),
  inputMidiNumbers,
  sequenceTarget,
  stepIndex,
}: Readonly<{
  allowedLingeringMidiNumbers?: ReadonlySet<number>;
  inputMidiNumbers: ReadonlySet<number>;
  sequenceTarget: SequenceTarget;
  stepIndex: number;
}>): boolean {
  const targetMidiNumbers = getCurrentSequenceStepMidiNumbers(
    sequenceTarget,
    stepIndex,
  );

  const containsEveryTargetNote = [...targetMidiNumbers].every((midiNumber) =>
    inputMidiNumbers.has(midiNumber),
  );

  if (!containsEveryTargetNote) {
    return false;
  }

  return [...inputMidiNumbers].every(
    (midiNumber) =>
      targetMidiNumbers.has(midiNumber) ||
      allowedLingeringMidiNumbers.has(midiNumber),
  );
}
