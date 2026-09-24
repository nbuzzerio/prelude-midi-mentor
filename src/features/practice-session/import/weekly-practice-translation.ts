import { DEFAULT_EAR_TRAINING_CONFIG } from "@/features/ear-training/ear-training-config";
import { DEFAULT_FLASHCARD_CONFIG } from "@/features/flashcards/flashcard-config";
import { DEFAULT_MELODY_CONFIG } from "@/features/melody/melody-config";
import { DEFAULT_SEQUENCE_CONFIG } from "@/features/sequences/sequence-config";
import type { PracticeExerciseEntry, PracticeSessionCurriculum, PracticeSessionPreset } from "../practice-session-types";
import { parsePracticeExerciseEntry, parsePracticeSessionPreset, validateRunnablePracticeSessionPreset } from "../practice-session-validation";
import type { WeeklyPracticeCurriculumV1, WeeklyPracticeExerciseV1 } from "./weekly-practice-contract";

export type WeeklyPracticeIdFactory = () => string;
export type TranslatedWeeklyPracticeCurriculum = Readonly<{ curriculum: PracticeSessionCurriculum; presets: readonly PracticeSessionPreset[] }>;

export function translateWeeklyPracticeExercise(exercise: WeeklyPracticeExerciseV1, id: string): PracticeExerciseEntry {
  let candidate: unknown;
  switch (exercise.type) {
    case "note-recognition": candidate = { id, label: exercise.label, engine: "flashcards", config: { ...DEFAULT_FLASHCARD_CONFIG, mode: exercise.staff, showTargetName: exercise.showTargetName, enabledExerciseTypes: ["notes"], enabledNoteCategories: [...exercise.noteCategories] }, target: { kind: "correct-answers", count: exercise.target.correctAnswers } }; break;
    case "triads": candidate = { id, label: exercise.label, engine: "flashcards", config: { ...DEFAULT_FLASHCARD_CONFIG, mode: exercise.staff, showTargetName: exercise.showTargetName, enabledExerciseTypes: ["triads"], enabledTriadQualities: [...exercise.qualities], enabledTriadPositions: [...exercise.positions] }, target: { kind: "correct-answers", count: exercise.target.correctAnswers } }; break;
    case "melodic-intervals": candidate = { id, label: exercise.label, engine: "sequences", config: { ...DEFAULT_SEQUENCE_CONFIG, exerciseType: "intervals", mode: exercise.staff, showTargetName: exercise.showTargetName, enabledDirections: [...exercise.directions], enabledIntervals: [...exercise.intervals], enabledNoteCategories: [...exercise.startingNoteCategories] }, target: { kind: "completed-sequences", count: exercise.target.completedSequences } }; break;
    case "random-scales": candidate = { id, label: exercise.label, engine: "sequences", config: { ...DEFAULT_SEQUENCE_CONFIG, exerciseType: "scales", scalePracticeMode: "random", mode: exercise.staff, showTargetName: exercise.showTargetName, enabledScales: [...exercise.scaleTypes], enabledScaleDirections: [...exercise.directions], enabledNoteCategories: [...exercise.startingNoteCategories] }, target: { kind: "completed-sequences", count: exercise.target.completedSequences } }; break;
    case "scale-repertoire": candidate = { id, label: exercise.label, engine: "sequences", config: { ...DEFAULT_SEQUENCE_CONFIG, exerciseType: "scales", scalePracticeMode: exercise.order === "in-order" ? "repertoire-in-order" : "repertoire-shuffle", scaleRepertoire: [...exercise.scales], mode: exercise.staff, showTargetName: exercise.showTargetName }, target: { kind: "complete-scale-repertoire" } }; break;
    case "arpeggios": candidate = { id, label: exercise.label, engine: "sequences", config: { ...DEFAULT_SEQUENCE_CONFIG, exerciseType: "arpeggios", mode: exercise.staff, showTargetName: exercise.showTargetName, enabledArpeggios: [...exercise.arpeggioTypes], enabledArpeggioDirections: [...exercise.directions], enabledNoteCategories: [...exercise.startingNoteCategories] }, target: { kind: "completed-sequences", count: exercise.target.completedSequences } }; break;
    case "chord-progressions": candidate = { id, label: exercise.label, engine: "sequences", config: { ...DEFAULT_SEQUENCE_CONFIG, exerciseType: "chord-progressions", mode: exercise.staff, showTargetName: exercise.showTargetName, enabledChordProgressionKeyIds: [...exercise.keys], enabledChordProgressionTemplateIds: [...exercise.progressions] }, target: { kind: "completed-sequences", count: exercise.target.completedSequences } }; break;
    case "ear-intervals": candidate = { id, label: exercise.label, engine: "ear-training", config: { ...DEFAULT_EAR_TRAINING_CONFIG, enabledDirections: [...exercise.directions], enabledIntervals: [...exercise.intervals] }, target: { kind: "correct-identifications", count: exercise.target.correctIdentifications } }; break;
    case "reading-flow": candidate = { id, label: exercise.label, engine: "melody", config: { ...DEFAULT_MELODY_CONFIG, staff: exercise.staff, keyId: exercise.key, tempoBpm: exercise.tempoBpm, measureCount: exercise.measureCount, continuousPractice: true, continuousDurationMinutes: exercise.durationMinutes }, target: { kind: "configured-timed-practice" } }; break;
  }
  const parsed = parsePracticeExerciseEntry(candidate);
  if (!parsed.ok) throw new Error(`Weekly Practice translation produced an invalid canonical exercise at ${parsed.issue.path}.`);
  return parsed.value;
}

export function translateWeeklyPracticeCurriculum(curriculum: WeeklyPracticeCurriculumV1, createId: WeeklyPracticeIdFactory): TranslatedWeeklyPracticeCurriculum {
  const curriculumId = createId();
  const presets: PracticeSessionPreset[] = [];
  const days: PracticeSessionCurriculum["days"][number][] = [];
  for (const day of curriculum.days) {
    if (day.kind === "rest") { days.push({ day: day.day, kind: "rest", notes: day.notes ?? null }); continue; }
    const presetId = createId();
    const exercises = day.exercises.map((exercise) => translateWeeklyPracticeExercise(exercise, createId()));
    const parsed = parsePracticeSessionPreset({ schemaVersion: 1, id: presetId, name: day.name, exercises });
    if (!parsed.ok) throw new Error(`Weekly Practice translation produced an invalid preset at ${parsed.issue.path}.`);
    const runnable = validateRunnablePracticeSessionPreset(parsed.value);
    if (!runnable.ok) throw new Error(`Weekly Practice translation produced a non-runnable preset: ${runnable.issues[0]?.message ?? "unknown reason"}`);
    presets.push(parsed.value);
    days.push({ day: day.day, kind: "practice", presetId, notes: day.notes ?? null, estimatedDurationMinutes: day.estimatedDurationMinutes ?? null });
  }
  return { curriculum: { id: curriculumId, title: curriculum.title, instructions: curriculum.instructions ?? null, days }, presets };
}
