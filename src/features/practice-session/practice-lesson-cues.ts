import { parsePracticeExerciseEntry } from "./practice-session-validation";
import { getScaleRepertoireEntry } from "@/features/sequences/scale-repertoire";

/** Advice about the frozen prescription, never an inference about the player's ability. */
export function getPracticeLessonCue(value: unknown): string {
  const parsed = parsePracticeExerciseEntry(value);
  if (!parsed.ok) return "Read the exercise instructions and work at a comfortable pace.";
  const entry = parsed.value;
  if (entry.engine === "melody") return "Maintain a steady pulse and continue through mistakes.";
  if (entry.engine === "ear-training") return "Listen for the distance between the two pitches.";
  if (entry.engine === "flashcards") {
    if (entry.config.enabledExerciseTypes.length !== 1 || entry.config.enabledExerciseTypes[0] !== "notes") return "Recognize the notes and chord shapes shown on the staff.";
    if (entry.config.mode === "mixed") return "Check the clef before identifying each note.";
    if (entry.config.mode === "bass") return "Recognize bass notes by staff position instead of counting lines.";
    return "Recognize treble notes by staff position instead of counting lines.";
  }
  const config = entry.config;
  if (config.exerciseType === "intervals") return "Recognize the distance and direction between the written pitches.";
  if (config.exerciseType === "chord-progressions") return "Listen to how each chord leads to the next in the progression.";
  if (config.exerciseType === "arpeggios") return config.enabledArpeggios.length === 1 && config.enabledArpeggios[0] === "minor"
    ? "Become familiar with the shape and sound of a minor triad." : "Recognize the chord shape as its notes unfold.";
  const forms = config.scalePracticeMode === "random" ? config.enabledScales : config.scaleRepertoire.map(id => getScaleRepertoireEntry(id).form);
  if (config.scalePracticeMode !== "random" && config.scaleRepertoire.length === 1 && config.scaleRepertoire[0] === "d-harmonic-minor") return "In D harmonic minor, listen for the raised seventh leading toward the tonic.";
  // Repertoire always travels both ways; random scales use the selected native directions.
  if (forms.length && forms.every(form => form === "melodic-minor" || form.endsWith("-melodic-minor"))) {
    if (config.scalePracticeMode !== "random" || config.enabledScaleDirections.includes("ascending-descending")) return "In classical melodic minor, raise the sixth and seventh ascending; return to natural minor descending.";
    if (config.enabledScaleDirections.every(direction => direction === "ascending")) return "In ascending melodic minor, listen for the raised sixth and seventh.";
    if (config.enabledScaleDirections.every(direction => direction === "descending")) return "Descending classical melodic minor uses natural minor.";
  }
  if (forms.length && forms.every(form => form === "harmonic-minor" || form.endsWith("-harmonic-minor"))) return "Listen for harmonic minor's raised seventh leading toward the tonic.";
  if (forms.length && forms.every(form => form === "natural-minor" || form.endsWith("-natural-minor"))) return "Become familiar with the pattern and sound of natural minor.";
  return entry.target.kind === "complete-scale-repertoire" ? "Work through the selected scales, keeping their different patterns clear." : "Follow the selected scale pattern with an even pulse.";
}
