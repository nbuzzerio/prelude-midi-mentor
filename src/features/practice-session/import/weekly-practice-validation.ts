import { CHORD_PROGRESSION_TEMPLATES, SUPPORTED_CHORD_PROGRESSION_KEYS } from "@/lib/music/chord-progressions";
import { SCALE_REPERTOIRE_CATALOG } from "@/features/sequences/scale-repertoire";
import { translateWeeklyPracticeCurriculum, type TranslatedWeeklyPracticeCurriculum, type WeeklyPracticeIdFactory } from "./weekly-practice-translation";
import { WEEKLY_PRACTICE_CAPABILITIES as C, WEEKLY_PRACTICE_EXERCISE_TYPES, WEEKLY_PRACTICE_FORMAT, WEEKLY_PRACTICE_LIMITS as L, WEEKLY_PRACTICE_SCHEMA_VERSION, type WeeklyPracticeCurriculumV1, type WeeklyPracticeExerciseType } from "./weekly-practice-contract";

export type WeeklyPracticeIssueCode = "invalid-json" | "input-too-large" | "unsupported-format" | "unsupported-version" | "unknown-field" | "missing-field" | "invalid-type" | "empty-string" | "string-too-long" | "invalid-value" | "duplicate-value" | "out-of-range" | "too-many-items" | "duplicate-day" | "incompatible-selection" | "canonical-config-rejected";
export type WeeklyPracticeValidationIssue = Readonly<{ severity: "error"; code: WeeklyPracticeIssueCode; path: string; message: string; day?: string; dayIndex?: number; exerciseIndex?: number; exerciseLabel?: string; field?: string; allowedValues?: readonly (string | number)[] }>;
export type WeeklyPracticeValidationResult = Readonly<{ ok: true; curriculum: WeeklyPracticeCurriculumV1; translated: TranslatedWeeklyPracticeCurriculum }> | Readonly<{ ok: false; issues: readonly WeeklyPracticeValidationIssue[] }>;

type RecordValue = Record<string, unknown>;
type Context = Readonly<{ day?: string; dayIndex?: number; exerciseIndex?: number; exerciseLabel?: string }>;
const isRecord = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
const chars = (value: string) => [...value].length;

class Collector {
  readonly issues: WeeklyPracticeValidationIssue[] = [];
  add(code: WeeklyPracticeIssueCode, path: string, message: string, context: Context = {}, allowedValues?: readonly (string | number)[]) {
    if (this.issues.length >= L.reportedIssues) return;
    this.issues.push({ severity: "error", code, path, message, ...context, ...(path.includes(".") || path.includes("[") ? { field: path.split(/[.[]/).at(-1)?.replace("]", "") } : {}), ...(allowedValues ? { allowedValues } : {}) });
  }
  exact(value: RecordValue, required: readonly string[], path: string, context: Context, optional: readonly string[] = []) {
    for (const key of required) if (!Object.hasOwn(value, key)) this.add("missing-field", `${path}.${key}`, `Required field "${key}" is missing.`, context);
    const allowed = [...required, ...optional];
    for (const key of Object.keys(value)) if (!allowed.includes(key)) this.add("unknown-field", `${path}.${key}`, `Field "${key}" is not supported.`, context);
  }
}

function stringField(c: Collector, value: unknown, path: string, max: number, context: Context, optional = false): value is string | undefined {
  if (optional && value === undefined) return true;
  if (typeof value !== "string") { c.add("invalid-type", path, "Expected a string.", context); return false; }
  if (!value.trim()) { c.add("empty-string", path, "Expected a non-empty string.", context); return false; }
  if (chars(value) > max) { c.add("string-too-long", path, `Must be ${max} characters or fewer.`, context); return false; }
  return true;
}

function booleanField(c: Collector, value: unknown, path: string, context: Context) {
  if (typeof value !== "boolean") c.add("invalid-type", path, "Expected true or false.", context);
}

function enumField(c: Collector, value: unknown, allowed: readonly (string | number)[], path: string, context: Context) {
  if (!allowed.includes(value as never)) c.add("invalid-value", path, `Unsupported value ${JSON.stringify(value)}.`, context, allowed);
}

function numberField(c: Collector, value: unknown, min: number, max: number, path: string, context: Context) {
  if (!Number.isInteger(value)) c.add("invalid-type", path, "Expected a whole number.", context);
  else if ((value as number) < min || (value as number) > max) c.add("out-of-range", path, `Must be between ${min} and ${max}.`, context);
}

function selection(c: Collector, value: unknown, allowed: readonly string[], path: string, context: Context) {
  if (!Array.isArray(value)) { c.add("invalid-type", path, "Expected an array.", context); return; }
  if (value.length === 0) c.add("out-of-range", path, "Select at least one value.", context);
  const seen = new Set<unknown>();
  value.forEach((item, index) => {
    if (seen.has(item)) c.add("duplicate-value", `${path}[${index}]`, `Duplicate value ${JSON.stringify(item)} is not allowed.`, context);
    seen.add(item);
    if (typeof item !== "string" || !allowed.includes(item)) c.add("invalid-value", `${path}[${index}]`, `Unsupported value ${JSON.stringify(item)}.`, context, allowed);
  });
}

function target(c: Collector, value: unknown, key: "correctAnswers" | "completedSequences" | "correctIdentifications", path: string, context: Context) {
  if (!isRecord(value)) { c.add("invalid-type", path, "Expected a target object.", context); return; }
  c.exact(value, [key], path, context);
  numberField(c, value[key], 1, L.targetCount, `${path}.${key}`, context);
}

const baseKeys = ["type", "label"] as const;
const exerciseKeys: Readonly<Record<WeeklyPracticeExerciseType, readonly string[]>> = {
  "note-recognition": [...baseKeys, "staff", "noteCategories", "showTargetName", "target"],
  triads: [...baseKeys, "staff", "qualities", "positions", "showTargetName", "target"],
  "melodic-intervals": [...baseKeys, "staff", "directions", "intervals", "startingNoteCategories", "showTargetName", "target"],
  "random-scales": [...baseKeys, "staff", "scaleTypes", "directions", "startingNoteCategories", "showTargetName", "target"],
  "scale-repertoire": [...baseKeys, "staff", "order", "scales", "showTargetName"],
  arpeggios: [...baseKeys, "staff", "arpeggioTypes", "directions", "startingNoteCategories", "showTargetName", "target"],
  "chord-progressions": [...baseKeys, "staff", "keys", "progressions", "showTargetName", "target"],
  "ear-intervals": [...baseKeys, "directions", "intervals", "target"],
  "reading-flow": [...baseKeys, "staff", "key", "tempoBpm", "measureCount", "durationMinutes"],
};

function validateExercise(c: Collector, value: unknown, path: string, context: Context) {
  if (!isRecord(value)) { c.add("invalid-type", path, "Expected an exercise object.", context); return; }
  const type = value.type;
  if (typeof type !== "string" || !WEEKLY_PRACTICE_EXERCISE_TYPES.includes(type as never)) {
    enumField(c, type, WEEKLY_PRACTICE_EXERCISE_TYPES, `${path}.type`, context); return;
  }
  const typed = type as WeeklyPracticeExerciseType;
  const withLabel = typeof value.label === "string" ? { ...context, exerciseLabel: value.label } : context;
  c.exact(value, exerciseKeys[typed], path, withLabel);
  stringField(c, value.label, `${path}.label`, L.exerciseLabelCharacters, withLabel);
  if (typed !== "ear-intervals") enumField(c, value.staff, typed === "reading-flow" ? C.melodyStaffs : C.clefs, `${path}.staff`, withLabel);
  if ("showTargetName" in value) booleanField(c, value.showTargetName, `${path}.showTargetName`, withLabel);
  if (typed === "note-recognition") { selection(c, value.noteCategories, C.noteCategories, `${path}.noteCategories`, withLabel); target(c, value.target, "correctAnswers", `${path}.target`, withLabel); }
  if (typed === "triads") { selection(c, value.qualities, C.triadQualities, `${path}.qualities`, withLabel); selection(c, value.positions, C.triadPositions, `${path}.positions`, withLabel); target(c, value.target, "correctAnswers", `${path}.target`, withLabel); }
  if (typed === "melodic-intervals") { selection(c, value.directions, C.intervalDirections, `${path}.directions`, withLabel); selection(c, value.intervals, C.intervals, `${path}.intervals`, withLabel); selection(c, value.startingNoteCategories, C.noteCategories, `${path}.startingNoteCategories`, withLabel); target(c, value.target, "completedSequences", `${path}.target`, withLabel); }
  if (typed === "random-scales") { selection(c, value.scaleTypes, C.scales, `${path}.scaleTypes`, withLabel); selection(c, value.directions, C.scaleDirections, `${path}.directions`, withLabel); selection(c, value.startingNoteCategories, C.noteCategories, `${path}.startingNoteCategories`, withLabel); target(c, value.target, "completedSequences", `${path}.target`, withLabel); }
  if (typed === "scale-repertoire") {
    enumField(c, value.order, ["in-order", "shuffle"], `${path}.order`, withLabel);
    selection(c, value.scales, C.repertoireScales, `${path}.scales`, withLabel);
    if (Array.isArray(value.scales)) value.scales.forEach((scale, index) => {
      const unavailable = SCALE_REPERTOIRE_CATALOG.find(({ id }) => id === scale && !C.repertoireScales.includes(id));
      if (unavailable) c.add("invalid-value", `${path}.scales[${index}]`, `${unavailable.name} is unavailable: ${unavailable.disabledReason}`, withLabel, C.repertoireScales);
    });
  }
  if (typed === "arpeggios") { selection(c, value.arpeggioTypes, C.arpeggios, `${path}.arpeggioTypes`, withLabel); selection(c, value.directions, C.arpeggioDirections, `${path}.directions`, withLabel); selection(c, value.startingNoteCategories, C.noteCategories, `${path}.startingNoteCategories`, withLabel); target(c, value.target, "completedSequences", `${path}.target`, withLabel); }
  if (typed === "chord-progressions") {
    selection(c, value.keys, C.chordProgressionKeys, `${path}.keys`, withLabel); selection(c, value.progressions, C.chordProgressions, `${path}.progressions`, withLabel); target(c, value.target, "completedSequences", `${path}.target`, withLabel);
    if (Array.isArray(value.keys) && Array.isArray(value.progressions)) {
      const modes = new Set<string>();
      value.keys.forEach((id) => { const key = SUPPORTED_CHORD_PROGRESSION_KEYS.find((item) => item.id === id); if (key) modes.add(key.mode); });
      value.progressions.forEach((id) => { const progression = CHORD_PROGRESSION_TEMPLATES.find((item) => item.id === id); if (progression) modes.add(progression.mode); });
      if (modes.size > 1) c.add("incompatible-selection", `${path}.progressions`, "All selected chord-progression keys and templates must use the same major or minor mode.", withLabel);
    }
  }
  if (typed === "ear-intervals") { selection(c, value.directions, C.intervalDirections, `${path}.directions`, withLabel); selection(c, value.intervals, C.intervals, `${path}.intervals`, withLabel); target(c, value.target, "correctIdentifications", `${path}.target`, withLabel); }
  if (typed === "reading-flow") { enumField(c, value.key, C.melodyKeys, `${path}.key`, withLabel); enumField(c, value.tempoBpm, C.melodyTempos, `${path}.tempoBpm`, withLabel); enumField(c, value.measureCount, C.melodyMeasureCounts, `${path}.measureCount`, withLabel); enumField(c, value.durationMinutes, C.melodyDurations, `${path}.durationMinutes`, withLabel); }
}

export function validateWeeklyPracticeCurriculum(value: unknown, createId: WeeklyPracticeIdFactory = () => crypto.randomUUID()): WeeklyPracticeValidationResult {
  const c = new Collector();
  if (!isRecord(value)) return { ok: false, issues: [{ severity: "error", code: "invalid-type", path: "curriculum", message: "Expected a curriculum object." }] };
  c.exact(value, ["format", "schemaVersion", "title", "days"], "curriculum", {}, ["instructions"]);
  if (value.format !== WEEKLY_PRACTICE_FORMAT) c.add("unsupported-format", "curriculum.format", `Expected format "${WEEKLY_PRACTICE_FORMAT}".`);
  if (value.schemaVersion !== WEEKLY_PRACTICE_SCHEMA_VERSION) c.add("unsupported-version", "curriculum.schemaVersion", `Only weekly interchange schema version ${WEEKLY_PRACTICE_SCHEMA_VERSION} is supported.`);
  stringField(c, value.title, "curriculum.title", L.titleCharacters, {});
  stringField(c, value.instructions, "curriculum.instructions", L.instructionsCharacters, {}, true);
  if (!Array.isArray(value.days)) c.add("invalid-type", "curriculum.days", "Expected an array of days.");
  else {
    if (value.days.length > 7) c.add("too-many-items", "curriculum.days", "A weekly curriculum may contain at most seven days.");
    const weekdays = new Set<unknown>(); let exerciseTotal = 0;
    value.days.forEach((day, dayIndex) => {
      const path = `curriculum.days[${dayIndex}]`;
      const dayValue = isRecord(day) ? day.day : undefined;
      const context: Context = { dayIndex, ...(typeof dayValue === "string" ? { day: dayValue } : {}) };
      if (!isRecord(day)) { c.add("invalid-type", path, "Expected a day object.", context); return; }
      if (weekdays.has(dayValue)) c.add("duplicate-day", `${path}.day`, `Weekday ${JSON.stringify(dayValue)} appears more than once.`, context);
      weekdays.add(dayValue); enumField(c, dayValue, C.weekdays, `${path}.day`, context);
      if (day.kind === "rest") {
        c.exact(day, ["day", "kind"], path, context, ["notes"]);
        stringField(c, day.notes, `${path}.notes`, L.dayNotesCharacters, context, true);
      } else if (day.kind === "practice") {
        c.exact(day, ["day", "kind", "name", "exercises"], path, context, ["notes", "estimatedDurationMinutes"]);
        stringField(c, day.name, `${path}.name`, L.dayNameCharacters, context);
        stringField(c, day.notes, `${path}.notes`, L.dayNotesCharacters, context, true);
        if (day.estimatedDurationMinutes !== undefined) numberField(c, day.estimatedDurationMinutes, 1, L.estimatedDurationMinutes, `${path}.estimatedDurationMinutes`, context);
        if (!Array.isArray(day.exercises)) c.add("invalid-type", `${path}.exercises`, "Expected an array of exercises.", context);
        else {
          exerciseTotal += day.exercises.length;
          if (day.exercises.length === 0) c.add("out-of-range", `${path}.exercises`, "A practice day needs at least one exercise.", context);
          if (day.exercises.length > L.exercisesPerDay) c.add("too-many-items", `${path}.exercises`, `A practice day may contain at most ${L.exercisesPerDay} exercises.`, context);
          day.exercises.forEach((exercise, exerciseIndex) => validateExercise(c, exercise, `${path}.exercises[${exerciseIndex}]`, { ...context, exerciseIndex }));
        }
      } else { c.add("invalid-value", `${path}.kind`, "Day kind must be practice or rest.", context, ["practice", "rest"]); }
    });
    if (exerciseTotal > L.totalExercises) c.add("too-many-items", "curriculum.days", `A curriculum may contain at most ${L.totalExercises} total exercises.`);
  }
  if (c.issues.length > 0) return { ok: false, issues: c.issues };
  const curriculum = value as unknown as WeeklyPracticeCurriculumV1;
  try { return { ok: true, curriculum, translated: translateWeeklyPracticeCurriculum(curriculum, createId) }; }
  catch (error) { return { ok: false, issues: [{ severity: "error", code: "canonical-config-rejected", path: "curriculum", message: error instanceof Error ? error.message : "Prelude rejected the translated curriculum." }] }; }
}

export function parseWeeklyPracticeCurriculumText(text: string, createId?: WeeklyPracticeIdFactory): WeeklyPracticeValidationResult {
  if (new TextEncoder().encode(text).byteLength > L.jsonBytes) return { ok: false, issues: [{ severity: "error", code: "input-too-large", path: "curriculum", message: `Weekly Practice JSON must be ${L.jsonBytes} bytes or smaller.` }] };
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { return { ok: false, issues: [{ severity: "error", code: "invalid-json", path: "curriculum", message: "The text is not valid JSON. Return or paste one raw JSON object without Markdown fences." }] }; }
  return validateWeeklyPracticeCurriculum(value, createId);
}
