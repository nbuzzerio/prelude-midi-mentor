import { DEFAULT_EAR_TRAINING_CONFIG } from "@/features/ear-training/ear-training-config";
import { DEFAULT_FLASHCARD_CONFIG } from "@/features/flashcards/flashcard-config";
import { DEFAULT_MELODY_CONFIG } from "@/features/melody/melody-config";
import { DEFAULT_SEQUENCE_CONFIG } from "@/features/sequences/sequence-config";
import type { PracticeExerciseEntry } from "./practice-session-types";

export type PracticeSessionBuilderOptionId = "note-recognition" | "triads" | "melodic-intervals" | "scales" | "arpeggios" | "chord-progressions" | "ear-intervals" | "reading-flow";
export type PracticeSessionBuilderOption = Readonly<{
  id: PracticeSessionBuilderOptionId;
  label: string;
  description: string;
  createEntry: (id: string) => PracticeExerciseEntry;
}>;

const numericSequence = (id: string, label: string, exerciseType: "intervals" | "arpeggios" | "chord-progressions"): PracticeExerciseEntry => ({
  id, label, engine: "sequences", config: { ...DEFAULT_SEQUENCE_CONFIG, exerciseType }, target: { kind: "completed-sequences", count: null },
});

export const PRACTICE_SESSION_BUILDER_OPTIONS: readonly PracticeSessionBuilderOption[] = [
  { id: "note-recognition", label: "Note Recognition", description: "Identify written notes.", createEntry: (id) => ({ id, label: "Note Recognition", engine: "flashcards", config: { ...DEFAULT_FLASHCARD_CONFIG, enabledExerciseTypes: ["notes"] }, target: { kind: "correct-answers", count: null } }) },
  { id: "triads", label: "Triads", description: "Identify written triads.", createEntry: (id) => ({ id, label: "Triads", engine: "flashcards", config: { ...DEFAULT_FLASHCARD_CONFIG, enabledExerciseTypes: ["triads"] }, target: { kind: "correct-answers", count: null } }) },
  { id: "melodic-intervals", label: "Melodic Intervals", description: "Play melodic interval sequences.", createEntry: (id) => numericSequence(id, "Melodic Intervals", "intervals") },
  { id: "scales", label: "Scales", description: "Build an ordered or shuffled scale repertoire.", createEntry: (id) => ({ id, label: "Scales", engine: "sequences", config: { ...DEFAULT_SEQUENCE_CONFIG, exerciseType: "scales", scalePracticeMode: "repertoire-in-order", scaleRepertoire: [] }, target: { kind: "complete-scale-repertoire" } }) },
  { id: "arpeggios", label: "Arpeggios", description: "Play arpeggio sequences.", createEntry: (id) => numericSequence(id, "Arpeggios", "arpeggios") },
  { id: "chord-progressions", label: "Chord Progressions", description: "Play progression runs.", createEntry: (id) => numericSequence(id, "Chord Progressions", "chord-progressions") },
  { id: "ear-intervals", label: "Ear Intervals", description: "Identify intervals by ear.", createEntry: (id) => ({ id, label: "Ear Intervals", engine: "ear-training", config: { ...DEFAULT_EAR_TRAINING_CONFIG }, target: { kind: "correct-identifications", count: null } }) },
  { id: "reading-flow", label: "Reading Flow", description: "Configure timed melody reading.", createEntry: (id) => ({ id, label: "Reading Flow", engine: "melody", config: { ...DEFAULT_MELODY_CONFIG, continuousPractice: true }, target: { kind: "configured-timed-practice" } }) },
];
