import type { RolodexInstrument } from "../piece-practice/rolodex/rolodex-types";
import { browserLessonStorage } from "./practice-lesson-preferences";
import type { PracticeSessionStorage } from "./practice-session-library";

export const REPERTOIRE_PREFERENCE_KEY = "prelude-lesson-repertoire-v1";
export const REPERTOIRE_INSTRUMENTS: readonly RolodexInstrument[] = ["piano", "violin", "ocarina"];
export type RepertoirePreference = Readonly<{ enabled: boolean; instruments: readonly RolodexInstrument[]; message: string }>;
const defaults = (): RepertoirePreference => ({ enabled: false, instruments: ["piano"], message: "" });

/** Reading does not repair corrupt data or opt anyone into repertoire. */
export function loadRepertoirePreference(storage: () => PracticeSessionStorage = browserLessonStorage): RepertoirePreference {
  try {
    const text = storage().getItem(REPERTOIRE_PREFERENCE_KEY);
    if (text === null) return defaults();
    const value = JSON.parse(text);
    if (!value || Object.keys(value).sort().join() !== "enabled,instruments,version" || value.version !== 1
      || typeof value.enabled !== "boolean" || !Array.isArray(value.instruments)
      || value.instruments.some((i: unknown) => !REPERTOIRE_INSTRUMENTS.includes(i as RolodexInstrument))
      || new Set(value.instruments).size !== value.instruments.length) throw Error("Invalid preference");
    return { enabled: value.enabled, instruments: value.instruments, message: "" };
  } catch {
    return { ...defaults(), message: "Repertoire settings could not be read. Repertoire is off; saved data has not been changed. Choose settings explicitly to recover." };
  }
}

export function saveRepertoirePreference(value: RepertoirePreference, storage: () => PracticeSessionStorage = browserLessonStorage): RepertoirePreference {
  const instruments = REPERTOIRE_INSTRUMENTS.filter(i => value.instruments.includes(i));
  try {
    storage().setItem(REPERTOIRE_PREFERENCE_KEY, JSON.stringify({ version: 1, enabled: value.enabled, instruments }));
    return { enabled: value.enabled, instruments, message: "" };
  } catch {
    return { ...loadRepertoirePreference(storage), message: "Repertoire settings were not saved. Previous settings remain in use. Retry your change when browser storage is available." };
  }
}
