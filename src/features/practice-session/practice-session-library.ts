import {
  parsePracticeExerciseEntry,
  parsePracticeSessionLibrary,
} from "./practice-session-validation";
import type {
  PracticeExerciseEntry,
  PracticeSessionIdFactory,
  PracticeSessionLibrary,
  PracticeSessionPreset,
} from "./practice-session-types";

export const PRACTICE_SESSION_LIBRARY_STORAGE_KEY = "prelude-practice-session-library-v1";

export const EMPTY_PRACTICE_SESSION_LIBRARY: PracticeSessionLibrary = Object.freeze({
  schemaVersion: 2,
  presets: Object.freeze([]),
  curricula: Object.freeze([]),
  lastUsedPresetId: null,
});

export type PracticeSessionStorage = Pick<Storage, "getItem" | "setItem">;
export type PracticeSessionOperationResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; reason: "not-found" | "invalid-index" | "invalid-value" | "id-collision" }>;
export type PracticeSessionLibraryLoadResult =
  | Readonly<{ ok: true; value: PracticeSessionLibrary }>
  | Readonly<{ ok: false; reason: "unavailable" | "corrupt" | "unsupported"; message: string }>;
export type PracticeSessionLibrarySaveResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: "invalid" | "unavailable" | "write-failed"; message: string }>;

const defaultIdFactory: PracticeSessionIdFactory = () => crypto.randomUUID();

function validNewId(id: string, existing: readonly string[]): boolean {
  return id.trim().length > 0 && !existing.includes(id);
}

function updatePreset(
  library: PracticeSessionLibrary,
  presetId: string,
  change: (preset: PracticeSessionPreset) => PracticeSessionOperationResult<PracticeSessionPreset>,
): PracticeSessionOperationResult<PracticeSessionLibrary> {
  const index = library.presets.findIndex(({ id }) => id === presetId);
  if (index < 0) return { ok: false, reason: "not-found" };
  const changed = change(library.presets[index]!);
  if (!changed.ok) return changed;
  return { ok: true, value: { ...library, presets: library.presets.map((preset, candidate) => candidate === index ? changed.value : preset) } };
}

export function createPracticeSessionPreset(
  name: string,
  idFactory: PracticeSessionIdFactory = defaultIdFactory,
): PracticeSessionOperationResult<PracticeSessionPreset> {
  if (name.trim().length === 0) return { ok: false, reason: "invalid-value" };
  const id = idFactory();
  if (id.trim().length === 0) return { ok: false, reason: "invalid-value" };
  return { ok: true, value: { schemaVersion: 1, id, name, exercises: [] } };
}

export function addPracticeSessionPreset(library: PracticeSessionLibrary, preset: PracticeSessionPreset): PracticeSessionOperationResult<PracticeSessionLibrary> {
  if (!validNewId(preset.id, library.presets.map(({ id }) => id))) return { ok: false, reason: "id-collision" };
  const parsed = parsePracticeSessionLibrary({ ...library, presets: [...library.presets, preset] });
  return parsed.ok ? { ok: true, value: parsed.value } : { ok: false, reason: "invalid-value" };
}

export function renamePracticeSessionPreset(library: PracticeSessionLibrary, presetId: string, name: string): PracticeSessionOperationResult<PracticeSessionLibrary> {
  if (name.trim().length === 0) return { ok: false, reason: "invalid-value" };
  return updatePreset(library, presetId, (preset) => ({ ok: true, value: { ...preset, name } }));
}

export function updatePracticeSessionPreset(
  library: PracticeSessionLibrary,
  presetId: string,
  replacement: PracticeSessionPreset,
): PracticeSessionOperationResult<PracticeSessionLibrary> {
  if (replacement.id !== presetId) return { ok: false, reason: "invalid-value" };
  return updatePreset(library, presetId, () => {
    const candidate = { ...library, presets: library.presets.map((preset) => preset.id === presetId ? replacement : preset) };
    const parsed = parsePracticeSessionLibrary(candidate);
    if (!parsed.ok) return { ok: false, reason: "invalid-value" };
    return { ok: true, value: parsed.value.presets.find(({ id }) => id === presetId)! };
  });
}

export function addPracticeExercise(
  library: PracticeSessionLibrary,
  presetId: string,
  exercise: PracticeExerciseEntry,
  insertionIndex?: number,
): PracticeSessionOperationResult<PracticeSessionLibrary> {
  return updatePreset(library, presetId, (preset) => {
    if (preset.exercises.some(({ id }) => id === exercise.id)) return { ok: false, reason: "id-collision" };
    const parsed = parsePracticeExerciseEntry(exercise);
    if (!parsed.ok) return { ok: false, reason: "invalid-value" };
    const index = insertionIndex ?? preset.exercises.length;
    if (!Number.isInteger(index) || index < 0 || index > preset.exercises.length) return { ok: false, reason: "invalid-index" };
    const exercises = [...preset.exercises];
    exercises.splice(index, 0, parsed.value);
    return { ok: true, value: { ...preset, exercises } };
  });
}

export function updatePracticeExercise(
  library: PracticeSessionLibrary,
  presetId: string,
  exerciseId: string,
  replacement: PracticeExerciseEntry,
): PracticeSessionOperationResult<PracticeSessionLibrary> {
  return updatePreset(library, presetId, (preset) => {
    const index = preset.exercises.findIndex(({ id }) => id === exerciseId);
    if (index < 0) return { ok: false, reason: "not-found" };
    if (replacement.id !== exerciseId) return { ok: false, reason: "invalid-value" };
    const parsed = parsePracticeExerciseEntry(replacement);
    if (!parsed.ok) return { ok: false, reason: "invalid-value" };
    return { ok: true, value: { ...preset, exercises: preset.exercises.map((exercise, candidate) => candidate === index ? parsed.value : exercise) } };
  });
}

export function removePracticeExercise(library: PracticeSessionLibrary, presetId: string, exerciseId: string): PracticeSessionOperationResult<PracticeSessionLibrary> {
  return updatePreset(library, presetId, (preset) => preset.exercises.some(({ id }) => id === exerciseId)
    ? { ok: true, value: { ...preset, exercises: preset.exercises.filter(({ id }) => id !== exerciseId) } }
    : { ok: false, reason: "not-found" });
}

export function movePracticeExercise(library: PracticeSessionLibrary, presetId: string, exerciseId: string, destinationIndex: number): PracticeSessionOperationResult<PracticeSessionLibrary> {
  return updatePreset(library, presetId, (preset) => {
    const sourceIndex = preset.exercises.findIndex(({ id }) => id === exerciseId);
    if (sourceIndex < 0) return { ok: false, reason: "not-found" };
    if (!Number.isInteger(destinationIndex) || destinationIndex < 0 || destinationIndex >= preset.exercises.length) return { ok: false, reason: "invalid-index" };
    const exercises = [...preset.exercises];
    const [exercise] = exercises.splice(sourceIndex, 1);
    exercises.splice(destinationIndex, 0, exercise!);
    return { ok: true, value: { ...preset, exercises } };
  });
}

export function duplicatePracticeExercise(
  library: PracticeSessionLibrary,
  presetId: string,
  exerciseId: string,
  idFactory: PracticeSessionIdFactory = defaultIdFactory,
): PracticeSessionOperationResult<PracticeSessionLibrary> {
  return updatePreset(library, presetId, (preset) => {
    const index = preset.exercises.findIndex(({ id }) => id === exerciseId);
    if (index < 0) return { ok: false, reason: "not-found" };
    const id = idFactory();
    if (!validNewId(id, preset.exercises.map((exercise) => exercise.id))) return { ok: false, reason: "id-collision" };
    const copy = structuredClone({ ...preset.exercises[index]!, id }) as PracticeExerciseEntry;
    const exercises = [...preset.exercises];
    exercises.splice(index + 1, 0, copy);
    return { ok: true, value: { ...preset, exercises } };
  });
}

export function duplicatePracticeSessionPreset(
  library: PracticeSessionLibrary,
  presetId: string,
  idFactory: PracticeSessionIdFactory = defaultIdFactory,
): PracticeSessionOperationResult<PracticeSessionLibrary> {
  const index = library.presets.findIndex(({ id }) => id === presetId);
  if (index < 0) return { ok: false, reason: "not-found" };
  const presetIdCopy = idFactory();
  if (!validNewId(presetIdCopy, library.presets.map(({ id }) => id))) return { ok: false, reason: "id-collision" };
  const exerciseIds: string[] = [];
  const exercises = library.presets[index]!.exercises.map((exercise) => {
    const id = idFactory();
    exerciseIds.push(id);
    return structuredClone({ ...exercise, id }) as PracticeExerciseEntry;
  });
  if (exerciseIds.some((id) => id.trim().length === 0) || new Set(exerciseIds).size !== exerciseIds.length) return { ok: false, reason: "id-collision" };
  const copy: PracticeSessionPreset = { ...library.presets[index]!, id: presetIdCopy, name: `${library.presets[index]!.name} — Copy`, exercises };
  const presets = [...library.presets];
  presets.splice(index + 1, 0, copy);
  return { ok: true, value: { ...library, presets } };
}

export function deletePracticeSessionPreset(library: PracticeSessionLibrary, presetId: string): PracticeSessionOperationResult<PracticeSessionLibrary> {
  if (!library.presets.some(({ id }) => id === presetId)) return { ok: false, reason: "not-found" };
  return { ok: true, value: {
    ...library,
    presets: library.presets.filter(({ id }) => id !== presetId),
    curricula: library.curricula.map((curriculum) => ({
      ...curriculum,
      days: curriculum.days.filter((day) => day.kind !== "practice" || day.presetId !== presetId),
    })),
    lastUsedPresetId: library.lastUsedPresetId === presetId ? null : library.lastUsedPresetId,
  } };
}

export function setLastUsedPracticeSessionPreset(library: PracticeSessionLibrary, presetId: string | null): PracticeSessionOperationResult<PracticeSessionLibrary> {
  return presetId === null || library.presets.some(({ id }) => id === presetId)
    ? { ok: true, value: { ...library, lastUsedPresetId: presetId } }
    : { ok: false, reason: "not-found" };
}

export function serializePracticeSessionLibrary(library: PracticeSessionLibrary): PracticeSessionOperationResult<string> {
  const parsed = parsePracticeSessionLibrary(library);
  if (!parsed.ok) return { ok: false, reason: "invalid-value" };
  try { return { ok: true, value: JSON.stringify(parsed.value) }; }
  catch { return { ok: false, reason: "invalid-value" }; }
}

export function loadPracticeSessionLibrary(storage: PracticeSessionStorage): PracticeSessionLibraryLoadResult {
  let raw: string | null;
  try { raw = storage.getItem(PRACTICE_SESSION_LIBRARY_STORAGE_KEY); }
  catch { return { ok: false, reason: "unavailable", message: "Practice Session storage is unavailable in this browser." }; }
  if (raw === null) return { ok: true, value: { schemaVersion: 2, presets: [], curricula: [], lastUsedPresetId: null } };
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { return { ok: false, reason: "corrupt", message: "Stored Practice Session data could not be read." }; }
  const parsed = parsePracticeSessionLibrary(value);
  return parsed.ok ? parsed : { ok: false, reason: parsed.reason, message: parsed.issue.message };
}

export function savePracticeSessionLibrary(storage: PracticeSessionStorage, library: PracticeSessionLibrary): PracticeSessionLibrarySaveResult {
  const serialized = serializePracticeSessionLibrary(library);
  if (!serialized.ok) return { ok: false, reason: "invalid", message: "The Practice Session library contains invalid data." };
  try { storage.setItem(PRACTICE_SESSION_LIBRARY_STORAGE_KEY, serialized.value); return { ok: true }; }
  catch { return { ok: false, reason: "write-failed", message: "Practice Session changes could not be saved in this browser." }; }
}
