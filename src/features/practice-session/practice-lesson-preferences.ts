import { validProgramId } from "./practice-program-types";
import type { PracticeSessionStorage } from "./practice-session-library";

export const PRACTICE_LESSON_PREFERENCE_KEY = "prelude-practice-lesson-preference-v1";
export type LessonPreference = Readonly<{ programId: string | null; message: string }>;
export const browserLessonStorage = () => window.localStorage;

/** A preference only: opening never repairs or rewrites stored data. */
export function loadLessonPreference(storage: () => PracticeSessionStorage = browserLessonStorage): LessonPreference {
  try {
    const text = storage().getItem(PRACTICE_LESSON_PREFERENCE_KEY);
    if (text === null) return { programId: null, message: "" };
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Object.keys(value).sort().join() !== "programId,version"
      || !("version" in value) || value.version !== 1 || !("programId" in value) || !validProgramId(value.programId)) {
      return { programId: null, message: "The preferred weekly program could not be read. Choose a program explicitly; existing data has not been changed." };
    }
    return { programId: value.programId, message: "" };
  } catch (error) {
    return { programId: null, message: error instanceof SyntaxError
      ? "The preferred weekly program is corrupt. Choose a program explicitly; existing data has not been changed."
      : "The preferred weekly program could not be loaded because browser storage is unavailable." };
  }
}

/** Only an explicit user choice can replace this identity. Definitions stay untouched. */
export function saveLessonPreference(programId: string, storage: () => PracticeSessionStorage = browserLessonStorage): LessonPreference {
  if (!validProgramId(programId)) throw Error("Choose a valid saved weekly program.");
  try {
    storage().setItem(PRACTICE_LESSON_PREFERENCE_KEY, JSON.stringify({ version: 1, programId }));
    return { programId, message: "" };
  } catch {
    return { programId, message: "This program is selected for this tab, but the preference could not be saved. Choose it again after reloading." };
  }
}
