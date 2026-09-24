import type { WeeklyPracticeCurriculumV1 } from "./weekly-practice-contract";

export const MINIMAL_WEEKLY_PRACTICE_EXAMPLE = Object.freeze({
  format: "prelude-weekly-practice", schemaVersion: 1, title: "Reading basics", days: [{
    day: "monday", kind: "practice", name: "Monday — Reading basics", exercises: [{
      type: "note-recognition", label: "Treble natural notes", staff: "treble", noteCategories: ["naturals"], showTargetName: false, target: { correctAnswers: 20 },
    }],
  }],
} as const satisfies WeeklyPracticeCurriculumV1);

export const REALISTIC_WEEKLY_PRACTICE_EXAMPLE = Object.freeze({
  format: "prelude-weekly-practice", schemaVersion: 1, title: "Foundations week",
  instructions: "Work accurately at a comfortable pace and stop if tension develops.",
  days: [
    { day: "monday", kind: "practice", name: "Monday — Reading and triads", notes: "Keep your eyes on the staff.", estimatedDurationMinutes: 25, exercises: [
      { type: "note-recognition", label: "Mixed-staff notes", staff: "mixed", noteCategories: ["naturals", "accidentals"], showTargetName: false, target: { correctAnswers: 20 } },
      { type: "triads", label: "Major and minor triads", staff: "treble", qualities: ["major", "minor"], positions: ["root", "first"], showTargetName: true, target: { correctAnswers: 12 } },
    ] },
    { day: "tuesday", kind: "practice", name: "Tuesday — Sequence technique", estimatedDurationMinutes: 25, exercises: [
      { type: "melodic-intervals", label: "Seconds and thirds", staff: "treble", directions: ["ascending", "descending"], intervals: ["minor-second", "major-second", "minor-third", "major-third"], startingNoteCategories: ["naturals"], showTargetName: true, target: { completedSequences: 8 } },
      { type: "random-scales", label: "Major scale patterns", staff: "treble", scaleTypes: ["major"], directions: ["ascending-descending"], startingNoteCategories: ["naturals"], showTargetName: true, target: { completedSequences: 4 } },
      { type: "arpeggios", label: "Major and minor arpeggios", staff: "treble", arpeggioTypes: ["major", "minor"], directions: ["ascending-descending"], startingNoteCategories: ["naturals"], showTargetName: true, target: { completedSequences: 4 } },
    ] },
    { day: "wednesday", kind: "rest", notes: "Rest or use ungraded practice outside this prescription." },
    { day: "thursday", kind: "practice", name: "Thursday — Repertoire and harmony", estimatedDurationMinutes: 30, exercises: [
      { type: "scale-repertoire", label: "C major and A minor repertoire", staff: "treble", order: "in-order", scales: ["c-major", "a-natural-minor", "a-harmonic-minor", "a-melodic-minor"], showTargetName: true },
      { type: "chord-progressions", label: "Major-key progressions", staff: "treble", keys: ["c-major", "g-major"], progressions: ["major-1451", "major-251"], showTargetName: true, target: { completedSequences: 4 } },
    ] },
    { day: "friday", kind: "practice", name: "Friday — Listening and reading flow", estimatedDurationMinutes: 20, exercises: [
      { type: "ear-intervals", label: "Identify seconds and thirds", directions: ["ascending", "descending"], intervals: ["minor-second", "major-second", "minor-third", "major-third"], target: { correctIdentifications: 12 } },
      { type: "reading-flow", label: "C-major reading flow", staff: "treble", key: "c-major", tempoBpm: 60, measureCount: 1, durationMinutes: 5 },
    ] },
  ],
} as const satisfies WeeklyPracticeCurriculumV1);
