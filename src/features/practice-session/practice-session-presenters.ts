import { getIntervalLabel } from "@/lib/music/intervals";
import type { PracticeExerciseEntry } from "./practice-session-types";

const clef = (mode: "bass" | "treble" | "mixed") => mode === "mixed" ? "Mixed staff" : `${mode[0]!.toUpperCase()}${mode.slice(1)} staff`;
const directions = (values: readonly string[]) => values.map((value) => value === "ascending-descending" ? "Ascending + Descending" : `${value[0]!.toUpperCase()}${value.slice(1)}`).join(", ");

export function getPracticeExerciseConceptName(entry: PracticeExerciseEntry): string {
  if (entry.engine === "flashcards") return entry.config.enabledExerciseTypes.includes("triads") ? "Triads" : "Note Recognition";
  if (entry.engine === "ear-training") return "Ear Intervals";
  if (entry.engine === "melody") return "Reading Flow";
  return entry.config.exerciseType === "intervals" ? "Melodic Intervals" : entry.config.exerciseType === "chord-progressions" ? "Chord Progressions" : `${entry.config.exerciseType[0]!.toUpperCase()}${entry.config.exerciseType.slice(1)}`;
}

export function getPracticeExerciseConfigurationSummary(entry: PracticeExerciseEntry): string {
  if (entry.engine === "flashcards") return `${clef(entry.config.mode)} · ${entry.config.enabledExerciseTypes.includes("triads") ? `${entry.config.enabledTriadQualities.length} qualities` : entry.config.enabledNoteCategories.join(", ")}`;
  if (entry.engine === "ear-training") return `${entry.config.enabledIntervals.map(getIntervalLabel).join(", ")} · ${directions(entry.config.enabledDirections)}`;
  if (entry.engine === "melody") return `${entry.config.keyId.replace("-", " ")} · ${entry.config.tempoBpm} BPM · ${entry.config.measureCount} ${entry.config.measureCount === 1 ? "measure" : "measures"}`;
  if (entry.config.exerciseType === "scales" && entry.config.scalePracticeMode !== "random") return `Repertoire — ${entry.config.scalePracticeMode === "repertoire-in-order" ? "In Order" : "Shuffle"} · ${entry.config.scaleRepertoire.length} ${entry.config.scaleRepertoire.length === 1 ? "scale" : "scales"}`;
  if (entry.config.exerciseType === "intervals") return `${entry.config.enabledIntervals.map(getIntervalLabel).join(", ")} · ${directions(entry.config.enabledDirections)}`;
  if (entry.config.exerciseType === "arpeggios") return `${entry.config.enabledArpeggios.join(", ")} · ${directions(entry.config.enabledArpeggioDirections)}`;
  if (entry.config.exerciseType === "scales") return `Random · ${entry.config.enabledScales.join(", ")} · ${directions(entry.config.enabledScaleDirections)}`;
  return `${entry.config.enabledChordProgressionKeyIds.length} ${entry.config.enabledChordProgressionKeyIds.length === 1 ? "key" : "keys"} · ${entry.config.enabledChordProgressionTemplateIds.length} ${entry.config.enabledChordProgressionTemplateIds.length === 1 ? "progression" : "progressions"}`;
}

export function getPracticeExerciseTargetSummary(entry: PracticeExerciseEntry): string {
  if (entry.engine === "melody") return `${entry.config.continuousDurationMinutes} ${entry.config.continuousDurationMinutes === 1 ? "minute" : "minutes"}`;
  if (entry.target.kind === "complete-scale-repertoire") return "Complete repertoire once";
  if (entry.target.count === null) return "Choose a target";
  if (entry.target.kind === "correct-answers") return `${entry.target.count} correct`;
  if (entry.target.kind === "correct-identifications") return `${entry.target.count} correct identifications`;
  return `${entry.target.count} completed exercises`;
}
