import type { PracticeTarget } from "@/types/practice";

export function notesMatchTarget(
  playedNotes: ReadonlySet<number>,
  practiceTarget: PracticeTarget,
): boolean {
  if (playedNotes.size !== practiceTarget.notes.length) {
    return false;
  }

  return practiceTarget.notes.every((note) => playedNotes.has(note.midiNumber));
}

export function getTargetMidiNumbers(
  practiceTarget: PracticeTarget,
): ReadonlySet<number> {
  return new Set(practiceTarget.notes.map((note) => note.midiNumber));
}
