import { programCalendarNow } from "./practice-program-attempt";
import type { PracticeProgramRevision } from "./practice-program-types";
import { validateRunnablePracticeSessionPreset } from "./practice-session-validation";

export const NO_SUGGESTED_LESSON = "No suggested lesson for today. Choose exercises.";
export type MorningLesson = Readonly<{ program: PracticeProgramRevision; exerciseIds: readonly string[]; weekday: string }>;

/** Resolve advice without inventing work or rebuilding preserved native settings. */
export function resolveMorningLesson(program: PracticeProgramRevision, at: number): MorningLesson {
  const weekday = programCalendarNow(at).weekday;
  const exerciseIds = program.program.suggestedRotation?.find(value => value.day === weekday)?.exerciseIds ?? [];
  const exercises = exerciseIds.map(id => {
    const index = program.program.exercises.findIndex(value => value.id === id);
    const native = program.nativeExercises[index];
    if (index < 0 || !native || native.id !== id) throw Error(`Today's rotation refers to an unavailable exercise: ${id}. Edit the lesson or repair the saved program.`);
    return native;
  });
  if (new Set(exerciseIds).size !== exerciseIds.length) throw Error("Today's rotation contains duplicate exercise references. No exercise was started.");
  if (exercises.length) {
    const runnable = validateRunnablePracticeSessionPreset({ schemaVersion: 1, id: program.programId, name: program.program.title, exercises });
    if (!runnable.ok) throw Error(`Today's lesson cannot start: ${runnable.issues.map(value => value.message).join(" ")}`);
  }
  return structuredClone({ program, exerciseIds, weekday });
}
