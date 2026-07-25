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
  inputMidiNumbers,
  sequenceTarget,
  stepIndex,
}: Readonly<{
  inputMidiNumbers: ReadonlySet<number>;
  sequenceTarget: SequenceTarget;
  stepIndex: number;
}>): boolean {
  const targetMidiNumbers = getCurrentSequenceStepMidiNumbers(
    sequenceTarget,
    stepIndex,
  );

  if (inputMidiNumbers.size !== targetMidiNumbers.size) {
    return false;
  }

  return [...targetMidiNumbers].every((midiNumber) =>
    inputMidiNumbers.has(midiNumber),
  );
}
