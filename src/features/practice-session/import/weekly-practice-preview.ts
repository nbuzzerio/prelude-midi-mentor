import { SCALE_REPERTOIRE_CATALOG } from "@/features/sequences/scale-repertoire";
import { CHORD_PROGRESSION_TEMPLATES, SUPPORTED_CHORD_PROGRESSION_KEYS } from "@/lib/music/chord-progressions";
import { getIntervalLabel } from "@/lib/music/intervals";
import type { PracticeSessionWeekday } from "../practice-session-types";
import { WEEKLY_PRACTICE_EXERCISE_DESCRIPTIONS, type WeeklyPracticeCurriculumV1, type WeeklyPracticeExerciseType, type WeeklyPracticeExerciseV1 } from "./weekly-practice-contract";

export type WeeklyPracticePreviewExercise = Readonly<{ type: WeeklyPracticeExerciseType; conceptName: string; description: string; label: string; configurationSummary: string; targetSummary: string }>;
export type WeeklyPracticePreviewDay = Readonly<{ day: PracticeSessionWeekday; kind: "rest"; notes: string | null }> | Readonly<{ day: PracticeSessionWeekday; kind: "practice"; presetId: string; originalName: string; proposedName: string; notes: string | null; estimatedDurationMinutes: number | null; exercises: readonly WeeklyPracticePreviewExercise[] }>;
export type WeeklyPracticeImportPreview = Readonly<{ title: string; instructions: string | null; days: readonly WeeklyPracticePreviewDay[] }>;

const title = (value: string) => value.split("-").map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`).join(" ");
const list = (values: readonly string[]) => values.map(title).join(", ");
const directions = (values: readonly string[]) => values.map((value) => value === "ascending-descending" ? "Ascending + Descending" : title(value)).join(", ");
const staff = (value: string) => value === "mixed" ? "Mixed staff" : `${title(value)} staff`;
const conceptNames: Readonly<Record<WeeklyPracticeExerciseType, string>> = {
  "note-recognition": "Note Recognition", triads: "Triads", "melodic-intervals": "Melodic Intervals", "random-scales": "Random Scales", "scale-repertoire": "Scale Repertoire", arpeggios: "Arpeggios", "chord-progressions": "Chord Progressions", "ear-intervals": "Ear Intervals", "reading-flow": "Reading Flow",
};

export function createWeeklyPracticePreviewExercise(exercise: WeeklyPracticeExerciseV1): WeeklyPracticePreviewExercise {
  let configurationSummary: string;
  let targetSummary: string;
  switch (exercise.type) {
    case "note-recognition": configurationSummary = `${staff(exercise.staff)} · ${list(exercise.noteCategories)}`; targetSummary = `${exercise.target.correctAnswers} correct answers`; break;
    case "triads": configurationSummary = `${staff(exercise.staff)} · ${list(exercise.qualities)} · ${exercise.positions.map((position) => position === "root" ? "Root position" : `${title(position)} inversion`).join(", ")}`; targetSummary = `${exercise.target.correctAnswers} correct answers`; break;
    case "melodic-intervals": configurationSummary = `${staff(exercise.staff)} · ${exercise.intervals.map(getIntervalLabel).join(", ")} · ${directions(exercise.directions)} · Starts: ${list(exercise.startingNoteCategories)}`; targetSummary = `${exercise.target.completedSequences} completed sequences`; break;
    case "random-scales": configurationSummary = `${staff(exercise.staff)} · ${list(exercise.scaleTypes)} · ${directions(exercise.directions)} · Starts: ${list(exercise.startingNoteCategories)}`; targetSummary = `${exercise.target.completedSequences} completed scales`; break;
    case "scale-repertoire": configurationSummary = `${staff(exercise.staff)} · ${exercise.order === "in-order" ? "In order" : "Shuffle"} · ${exercise.scales.map((id) => SCALE_REPERTOIRE_CATALOG.find((entry) => entry.id === id)?.name ?? id).join(", ")}`; targetSummary = "Complete repertoire once"; break;
    case "arpeggios": configurationSummary = `${staff(exercise.staff)} · ${list(exercise.arpeggioTypes)} · ${directions(exercise.directions)} · Starts: ${list(exercise.startingNoteCategories)}`; targetSummary = `${exercise.target.completedSequences} completed arpeggios`; break;
    case "chord-progressions": configurationSummary = `${staff(exercise.staff)} · ${exercise.keys.map((id) => SUPPORTED_CHORD_PROGRESSION_KEYS.find((key) => key.id === id)?.name ?? id).join(", ")} · ${exercise.progressions.map((id) => CHORD_PROGRESSION_TEMPLATES.find((template) => template.id === id)?.name ?? id).join(", ")}`; targetSummary = `${exercise.target.completedSequences} completed progressions`; break;
    case "ear-intervals": configurationSummary = `${exercise.intervals.map(getIntervalLabel).join(", ")} · ${directions(exercise.directions)}`; targetSummary = `${exercise.target.correctIdentifications} correct identifications`; break;
    case "reading-flow": configurationSummary = `${staff(exercise.staff)} · ${title(exercise.key)} · ${exercise.tempoBpm} BPM · ${exercise.measureCount} ${exercise.measureCount === 1 ? "measure" : "measures"}`; targetSummary = `${exercise.durationMinutes} minutes`; break;
  }
  return { type: exercise.type, conceptName: conceptNames[exercise.type], description: WEEKLY_PRACTICE_EXERCISE_DESCRIPTIONS[exercise.type], label: exercise.label, configurationSummary, targetSummary };
}

export function createWeeklyPracticeImportPreview(curriculum: WeeklyPracticeCurriculumV1, practiceDays: readonly Readonly<{ presetId: string; proposedName: string }>[]): WeeklyPracticeImportPreview {
  let practiceIndex = 0;
  return { title: curriculum.title, instructions: curriculum.instructions ?? null, days: curriculum.days.map((day) => {
    if (day.kind === "rest") return { day: day.day, kind: "rest", notes: day.notes ?? null };
    const prepared = practiceDays[practiceIndex++]!;
    return { day: day.day, kind: "practice", presetId: prepared.presetId, originalName: day.name, proposedName: prepared.proposedName, notes: day.notes ?? null, estimatedDurationMinutes: day.estimatedDurationMinutes ?? null, exercises: day.exercises.map(createWeeklyPracticePreviewExercise) };
  }) };
}
