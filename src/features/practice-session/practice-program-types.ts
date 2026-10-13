import type { WeeklyPracticeExerciseV1 } from "./import/weekly-practice-contract";
import type { PracticeExerciseEntry, PracticeSessionWeekday } from "./practice-session-types";

export const PRACTICE_PROGRAM_LIMITS = Object.freeze({ programs: 100, revisionsPerProgram: 100, idCharacters: 80 });
export type PracticeProgramExercise = WeeklyPracticeExerciseV1 & Readonly<{ id: string; weeklyTarget?: Readonly<{ completedAttempts: number }> }>;
export type PracticeProgram = Readonly<{
  format: "prelude-weekly-practice"; schemaVersion: 2; programId: string; revision: number; title: string; instructions?: string;
  week: Readonly<{ startsOn: "sunday"; datePolicy: "local-at-attempt-start" }>;
  exercises: readonly PracticeProgramExercise[];
  suggestedRotation?: readonly Readonly<{ day: PracticeSessionWeekday; exerciseIds: readonly string[] }>[];
  weeklyGoal?: Readonly<{ distinctExercisesPracticed: number }>;
}>;
/** Resolved native configuration snapshot, reserved for later exact-revision attempt references. */
export type PracticeProgramRevision = Readonly<{
  schemaVersion: 1; programId: string; revision: number; program: PracticeProgram;
  nativeExercises: readonly PracticeExerciseEntry[];
}>;
export type PracticeProgramHead = Readonly<{ schemaVersion: 1; programId: string; revision: number }>;

export function validProgramId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(value);
}
