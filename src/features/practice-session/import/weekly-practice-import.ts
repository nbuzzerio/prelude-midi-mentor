import type { PracticeSessionIdFactory, PracticeSessionLibrary, PracticeSessionPreset } from "../practice-session-types";
import { parsePracticeSessionLibrary } from "../practice-session-validation";
import { WEEKLY_PRACTICE_LIMITS } from "./weekly-practice-contract";
import { createWeeklyPracticeImportPreview, type WeeklyPracticeImportPreview } from "./weekly-practice-preview";
import type { TranslatedWeeklyPracticeCurriculum } from "./weekly-practice-translation";
import { parseWeeklyPracticeCurriculumText, type WeeklyPracticeValidationIssue } from "./weekly-practice-validation";

export type WeeklyPracticeImportName = Readonly<{ presetId: string; originalName: string; proposedName: string }>;
export type WeeklyPracticeImportCandidate = Readonly<{ translated: TranslatedWeeklyPracticeCurriculum; names: readonly WeeklyPracticeImportName[]; preview: WeeklyPracticeImportPreview }>;
export type WeeklyPracticeImportPreparationResult = Readonly<{ ok: true; candidate: WeeklyPracticeImportCandidate }> | Readonly<{ ok: false; reason: "validation"; issues: readonly WeeklyPracticeValidationIssue[] }> | Readonly<{ ok: false; reason: "id-generation"; message: string }>;
export type WeeklyPracticeImportNameIssue = Readonly<{ presetId: string; code: "empty" | "too-long" | "collision"; message: string }>;
export type WeeklyPracticeImportApplyResult = Readonly<{ ok: true; library: PracticeSessionLibrary; firstImportedPresetId: string | null }> | Readonly<{ ok: false; reason: "invalid-name"; issues: readonly WeeklyPracticeImportNameIssue[] }> | Readonly<{ ok: false; reason: "id-collision" | "invalid-candidate"; message: string }>;

const ID_ATTEMPT_LIMIT = 100;
export function practiceSessionPresetNameKey(name: string): string { return name.normalize("NFKC").trim().toLocaleLowerCase("en-US"); }
const length = (value: string) => [...value].length;
const truncate = (value: string, maximum: number) => [...value].slice(0, maximum).join("");
function suffixedName(base: string, suffix: string): string {
  const room = WEEKLY_PRACTICE_LIMITS.dayNameCharacters - length(suffix);
  return `${truncate(base.trim(), room).trimEnd()}${suffix}`;
}
function proposedName(requested: string, occupied: Set<string>): string {
  if (!occupied.has(practiceSessionPresetNameKey(requested))) return requested;
  for (let number = 1; ; number += 1) {
    const suffix = number === 1 ? " — Imported" : ` — Imported (${number})`;
    const candidate = suffixedName(requested, suffix);
    if (!occupied.has(practiceSessionPresetNameKey(candidate))) return candidate;
  }
}
function existingIds(library: PracticeSessionLibrary): Set<string> {
  return new Set([...library.curricula.map(({ id }) => id), ...library.presets.flatMap((preset) => [preset.id, ...preset.exercises.map(({ id }) => id)])]);
}
function collisionSafeFactory(library: PracticeSessionLibrary, createId: PracticeSessionIdFactory, failed: { value: boolean }): PracticeSessionIdFactory {
  const occupied = existingIds(library);
  return () => {
    for (let attempt = 0; attempt < ID_ATTEMPT_LIMIT; attempt += 1) {
      const id = createId();
      if (id.trim() && !occupied.has(id)) { occupied.add(id); return id; }
    }
    failed.value = true;
    throw new Error("Prelude could not create unique identities for this import.");
  };
}

export function prepareWeeklyPracticeImport(sourceText: string, library: PracticeSessionLibrary, createId: PracticeSessionIdFactory): WeeklyPracticeImportPreparationResult {
  const idFailure = { value: false };
  const parsed = parseWeeklyPracticeCurriculumText(sourceText, collisionSafeFactory(library, createId, idFailure));
  if (!parsed.ok) return idFailure.value ? { ok: false, reason: "id-generation", message: "Prelude could not create unique identities for this import. Try again." } : { ok: false, reason: "validation", issues: parsed.issues };
  const occupied = new Set(library.presets.map(({ name }) => practiceSessionPresetNameKey(name)));
  const names = parsed.translated.presets.map((preset) => {
    const name = proposedName(preset.name, occupied); occupied.add(practiceSessionPresetNameKey(name));
    return { presetId: preset.id, originalName: preset.name, proposedName: name };
  });
  return { ok: true, candidate: { translated: parsed.translated, names, preview: createWeeklyPracticeImportPreview(parsed.curriculum, names) } };
}

export function validateWeeklyPracticeImportNames(library: PracticeSessionLibrary, candidate: WeeklyPracticeImportCandidate, editedNames: Readonly<Record<string, string>>): readonly WeeklyPracticeImportNameIssue[] {
  const occupied = new Set(library.presets.map(({ name }) => practiceSessionPresetNameKey(name)));
  const issues: WeeklyPracticeImportNameIssue[] = [];
  for (const item of candidate.names) {
    const name = editedNames[item.presetId] ?? item.proposedName;
    if (!name.trim()) issues.push({ presetId: item.presetId, code: "empty", message: "Enter a preset name." });
    else if (length(name) > WEEKLY_PRACTICE_LIMITS.dayNameCharacters) issues.push({ presetId: item.presetId, code: "too-long", message: `Preset names must be ${WEEKLY_PRACTICE_LIMITS.dayNameCharacters} characters or fewer.` });
    else if (occupied.has(practiceSessionPresetNameKey(name))) issues.push({ presetId: item.presetId, code: "collision", message: "Choose a name that is not already used by another preset in this library or import." });
    else occupied.add(practiceSessionPresetNameKey(name));
  }
  return issues;
}

export function applyWeeklyPracticeImport(library: PracticeSessionLibrary, candidate: WeeklyPracticeImportCandidate, editedNames: Readonly<Record<string, string>>): WeeklyPracticeImportApplyResult {
  const nameIssues = validateWeeklyPracticeImportNames(library, candidate, editedNames);
  if (nameIssues.length) return { ok: false, reason: "invalid-name", issues: nameIssues };
  const occupiedIds = existingIds(library); const candidateIds = new Set<string>();
  const ids = [candidate.translated.curriculum.id, ...candidate.translated.presets.flatMap((preset) => [preset.id, ...preset.exercises.map(({ id }) => id)])];
  for (const id of ids) {
    if (!id.trim() || occupiedIds.has(id) || candidateIds.has(id)) return { ok: false, reason: "id-collision", message: "The library changed and an imported identity now conflicts. Validate the source again." };
    candidateIds.add(id);
  }
  const names = new Map(candidate.names.map((item) => [item.presetId, editedNames[item.presetId] ?? item.proposedName]));
  const presets: PracticeSessionPreset[] = candidate.translated.presets.map((preset) => ({ ...preset, name: names.get(preset.id)! }));
  const merged = { ...library, presets: [...library.presets, ...presets], curricula: [...library.curricula, candidate.translated.curriculum], lastUsedPresetId: library.lastUsedPresetId };
  const parsed = parsePracticeSessionLibrary(merged);
  return parsed.ok ? { ok: true, library: parsed.value, firstImportedPresetId: presets[0]?.id ?? null } : { ok: false, reason: "invalid-candidate", message: "Prelude could not add this curriculum because the complete library would be invalid." };
}
