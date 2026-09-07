import { parseEarTrainingConfig } from "@/features/ear-training/ear-training-config";
import { parseFlashcardConfig } from "@/features/flashcards/flashcard-config";
import { parseMelodyConfig } from "@/features/melody/melody-config";
import { parseSequenceConfig } from "@/features/sequences/sequence-config";
import type {
  PracticeExerciseEntry,
  PracticeSessionLibrary,
  PracticeSessionPreset,
  PracticeSessionRunnableIssue,
  RandomSequenceConfig,
  RepertoireSequenceConfig,
  RunnablePresetValidationResult,
} from "./practice-session-types";

export type PracticeSessionParseFailure = Readonly<{
  ok: false;
  reason: "corrupt" | "unsupported";
  issue: Readonly<{ path: string; message: string }>;
}>;

export type PracticeSessionParseResult<T> = Readonly<{ ok: true; value: T }> | PracticeSessionParseFailure;

function failure(reason: "corrupt" | "unsupported", path: string, message: string): PracticeSessionParseFailure {
  return { ok: false, reason, issue: { path, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseVersion(value: Record<string, unknown>, path: string): PracticeSessionParseFailure | null {
  if (value.schemaVersion === 1) return null;
  return typeof value.schemaVersion === "number" && Number.isInteger(value.schemaVersion) && value.schemaVersion > 0
    ? failure("unsupported", `${path}.schemaVersion`, "This Practice Session schema version is unsupported.")
    : failure("corrupt", `${path}.schemaVersion`, "The Practice Session schema version is invalid.");
}

function parseCountTarget<K extends "correct-answers" | "completed-sequences" | "correct-identifications">(value: unknown, kind: K, path: string) {
  if (!isRecord(value) || !hasExactKeys(value, ["kind", "count"]) || value.kind !== kind
    || (value.count !== null && (!Number.isInteger(value.count) || (value.count as number) <= 0))) {
    return failure("corrupt", path, `Expected a ${kind} target with a positive integer or null count.`);
  }
  return { ok: true as const, value: { kind, count: value.count as number | null } };
}

function parseMarkerTarget<K extends "complete-scale-repertoire" | "configured-timed-practice">(value: unknown, kind: K, path: string) {
  return isRecord(value) && hasExactKeys(value, ["kind"]) && value.kind === kind
    ? { ok: true as const, value: { kind } }
    : failure("corrupt", path, `Expected a ${kind} target.`);
}

export function parsePracticeExerciseEntry(value: unknown, path = "exercise"): PracticeSessionParseResult<PracticeExerciseEntry> {
  if (!isRecord(value) || !hasExactKeys(value, ["id", "label", "engine", "config", "target"])
    || !isNonEmptyString(value.id) || !isNonEmptyString(value.label)) {
    return failure("corrupt", path, "The exercise entry is malformed.");
  }
  const base = { id: value.id, label: value.label };
  if (value.engine === "flashcards") {
    const config = parseFlashcardConfig(value.config);
    if (!config.ok) return failure(config.reason, `${path}.config`, "The Flashcard configuration is invalid or unsupported.");
    const target = parseCountTarget(value.target, "correct-answers", `${path}.target`);
    return target.ok ? { ok: true, value: { ...base, engine: "flashcards", config: config.value, target: target.value } } : target;
  }
  if (value.engine === "ear-training") {
    const config = parseEarTrainingConfig(value.config);
    if (!config.ok) return failure(config.reason, `${path}.config`, "The Ear Training configuration is invalid or unsupported.");
    const target = parseCountTarget(value.target, "correct-identifications", `${path}.target`);
    return target.ok ? { ok: true, value: { ...base, engine: "ear-training", config: config.value, target: target.value } } : target;
  }
  if (value.engine === "melody") {
    const config = parseMelodyConfig(value.config);
    if (!config.ok) return failure(config.reason, `${path}.config`, "The Melody configuration is invalid or unsupported.");
    const target = parseMarkerTarget(value.target, "configured-timed-practice", `${path}.target`);
    return target.ok ? { ok: true, value: { ...base, engine: "melody", config: config.value, target: target.value } } : target;
  }
  if (value.engine === "sequences") {
    const config = parseSequenceConfig(value.config);
    if (!config.ok) return failure(config.reason, `${path}.config`, "The Sequence configuration is invalid or unsupported.");
    const repertoire = config.value.exerciseType === "scales" && config.value.scalePracticeMode !== "random";
    if (repertoire) {
      const target = parseMarkerTarget(value.target, "complete-scale-repertoire", `${path}.target`);
      return target.ok ? { ok: true, value: { ...base, engine: "sequences", config: config.value as RepertoireSequenceConfig, target: target.value } } : target;
    }
    const target = parseCountTarget(value.target, "completed-sequences", `${path}.target`);
    return target.ok ? { ok: true, value: { ...base, engine: "sequences", config: config.value as RandomSequenceConfig, target: target.value } } : target;
  }
  return failure("corrupt", `${path}.engine`, "The exercise engine is unknown.");
}

export function parsePracticeSessionPreset(value: unknown, path = "preset"): PracticeSessionParseResult<PracticeSessionPreset> {
  if (!isRecord(value) || !hasExactKeys(value, ["schemaVersion", "id", "name", "exercises"])) return failure("corrupt", path, "The preset is malformed.");
  const versionFailure = parseVersion(value, path);
  if (versionFailure) return versionFailure;
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.name) || !Array.isArray(value.exercises)) return failure("corrupt", path, "The preset identity, name, or exercise list is invalid.");
  const exercises: PracticeExerciseEntry[] = [];
  for (let index = 0; index < value.exercises.length; index += 1) {
    const parsed = parsePracticeExerciseEntry(value.exercises[index], `${path}.exercises[${index}]`);
    if (!parsed.ok) return parsed;
    exercises.push(parsed.value);
  }
  if (new Set(exercises.map(({ id }) => id)).size !== exercises.length) return failure("corrupt", `${path}.exercises`, "Exercise IDs must be unique within a preset.");
  return { ok: true, value: { schemaVersion: 1, id: value.id, name: value.name, exercises } };
}

export function parsePracticeSessionLibrary(value: unknown): PracticeSessionParseResult<PracticeSessionLibrary> {
  const path = "library";
  if (!isRecord(value) || !hasExactKeys(value, ["schemaVersion", "presets", "lastUsedPresetId"])) return failure("corrupt", path, "The Practice Session library is malformed.");
  const versionFailure = parseVersion(value, path);
  if (versionFailure) return versionFailure;
  if (!Array.isArray(value.presets) || (value.lastUsedPresetId !== null && !isNonEmptyString(value.lastUsedPresetId))) return failure("corrupt", path, "The preset list or last-used identity is invalid.");
  const presets: PracticeSessionPreset[] = [];
  for (let index = 0; index < value.presets.length; index += 1) {
    const parsed = parsePracticeSessionPreset(value.presets[index], `library.presets[${index}]`);
    if (!parsed.ok) return parsed;
    presets.push(parsed.value);
  }
  if (new Set(presets.map(({ id }) => id)).size !== presets.length) return failure("corrupt", "library.presets", "Preset IDs must be unique.");
  const lastUsedPresetId = typeof value.lastUsedPresetId === "string" && presets.some(({ id }) => id === value.lastUsedPresetId)
    ? value.lastUsedPresetId
    : null;
  return { ok: true, value: { schemaVersion: 1, presets, lastUsedPresetId } };
}

export function validateRunnablePracticeSessionPreset(preset: PracticeSessionPreset): RunnablePresetValidationResult {
  const defensive = parsePracticeSessionPreset(preset);
  if (!defensive.ok) return { ok: false, issues: [{ code: "invalid-prescription", message: "This preset contains invalid prescription data." }] };
  const issues: PracticeSessionRunnableIssue[] = [];
  if (preset.exercises.length === 0) issues.push({ code: "no-exercises", message: "Add at least one exercise." });
  for (const exercise of preset.exercises) {
    if ("count" in exercise.target && exercise.target.count === null) {
      issues.push({ exerciseId: exercise.id, code: "target-required", message: `Choose a target for ${exercise.label}.` });
    } else if (exercise.engine === "sequences" && exercise.target.kind === "complete-scale-repertoire" && exercise.config.scaleRepertoire.length === 0) {
      issues.push({ exerciseId: exercise.id, code: "empty-repertoire", message: `Select at least one scale for ${exercise.label}.` });
    } else if (exercise.engine === "melody" && !exercise.config.continuousPractice) {
      issues.push({ exerciseId: exercise.id, code: "continuous-practice-required", message: `Enable Continuous Practice for ${exercise.label}.` });
    }
  }
  return issues.length === 0 ? { ok: true, preset } : { ok: false, issues };
}
