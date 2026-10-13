import { WEEKLY_PRACTICE_LIMITS as L } from "./import/weekly-practice-contract";
import { validateWeeklyPracticeExercise, type WeeklyPracticeValidationIssue } from "./import/weekly-practice-validation";
import { translateWeeklyPracticeExercise } from "./import/weekly-practice-translation";
import { PRACTICE_SESSION_WEEKDAYS } from "./practice-session-types";
import { validProgramId, type PracticeProgram, type PracticeProgramRevision } from "./practice-program-types";

export type PracticeProgramValidation = Readonly<{ ok: true; value: PracticeProgramRevision }> | Readonly<{ ok: false; issues: readonly WeeklyPracticeValidationIssue[] }>;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
/** Deterministic equality ignores object-key order, preserves meaningful selection order. */
export function canonicalProgramJson(value: unknown): string {
  const order = (item: unknown): unknown => Array.isArray(item) ? item.map(order) : record(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, order(item[key])])) : item;
  return JSON.stringify(order(value));
}
export function validatePracticeProgram(input: unknown): PracticeProgramValidation {
  const issues: WeeklyPracticeValidationIssue[] = [];
  const add = (path: string, message: string, code: WeeklyPracticeValidationIssue["code"] = "invalid-value") => {
    if (issues.length < L.reportedIssues) issues.push({ severity: "error", code, path, message });
  };
  const exact = (value: Record<string, unknown>, required: readonly string[], optional: readonly string[], path: string) => {
    for (const key of required) if (!Object.hasOwn(value, key)) add(`${path}.${key}`, "Required field is missing.", "missing-field");
    for (const key of Object.keys(value)) if (![...required, ...optional].includes(key)) add(`${path}.${key}`, "Unknown field is not supported.", "unknown-field");
  };
  const text = (value: unknown, maximum: number, path: string) => {
    if (typeof value !== "string" || !value.trim() || [...value].length > maximum) add(path, `Use a nonempty string of at most ${maximum} characters.`);
  };
  const count = (value: unknown, maximum: number, path: string) => {
    if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > maximum) add(path, `Use an integer from 1 through ${maximum}.`, "out-of-range");
  };
  if (!record(input)) { add("program", "Expected a program object.", "invalid-type"); return { ok: false, issues }; }
  exact(input, ["format", "schemaVersion", "programId", "revision", "title", "week", "exercises"], ["instructions", "suggestedRotation", "weeklyGoal"], "program");
  if (input.format !== "prelude-weekly-practice") add("program.format", "Expected prelude-weekly-practice.", "unsupported-format");
  if (input.schemaVersion !== 2) add("program.schemaVersion", "Weekly programs require schemaVersion 2. Use Import Weekly Plan for version 1.", "unsupported-version");
  if (!validProgramId(input.programId)) add("program.programId", "Use 1–80 ASCII letters, digits, dots, underscores or hyphens, beginning with a letter or digit.");
  count(input.revision, Number.MAX_SAFE_INTEGER, "program.revision"); text(input.title, L.titleCharacters, "program.title");
  if (Object.hasOwn(input, "instructions")) text(input.instructions, L.instructionsCharacters, "program.instructions");
  if (!record(input.week)) add("program.week", "Expected the weekly calendar policy.", "invalid-type");
  else {
    exact(input.week, ["startsOn", "datePolicy"], [], "program.week");
    if (input.week.startsOn !== "sunday") add("program.week.startsOn", "Weeks start on Sunday.");
    if (input.week.datePolicy !== "local-at-attempt-start") add("program.week.datePolicy", "Use local-at-attempt-start.");
  }
  const ids = new Set<string>();
  if (!Array.isArray(input.exercises)) add("program.exercises", "Expected an exercise pool.", "invalid-type");
  else {
    if (!input.exercises.length || input.exercises.length > L.totalExercises) add("program.exercises", `Use 1–${L.totalExercises} pool exercises.`, "too-many-items");
    input.exercises.slice(0, L.totalExercises).forEach((exercise, index) => {
      const path = `program.exercises[${index}]`;
      if (!record(exercise)) { add(path, "Expected an exercise object.", "invalid-type"); return; }
      if (!validProgramId(exercise.id)) add(`${path}.id`, "Use a valid stable exercise ID.");
      else { if (ids.has(exercise.id)) add(`${path}.id`, "Exercise ID is duplicated.", "duplicate-value"); ids.add(exercise.id); }
      const native = Object.fromEntries(Object.entries(exercise).filter(([key]) => key !== "id" && key !== "weeklyTarget"));
      for (const issue of validateWeeklyPracticeExercise(native, path)) if (issues.length < L.reportedIssues) issues.push(issue);
      if (Object.hasOwn(exercise, "weeklyTarget")) {
        if (!record(exercise.weeklyTarget)) add(`${path}.weeklyTarget`, "Expected a weekly frequency goal.");
        else { exact(exercise.weeklyTarget, ["completedAttempts"], [], `${path}.weeklyTarget`); count(exercise.weeklyTarget.completedAttempts, L.targetCount, `${path}.weeklyTarget.completedAttempts`); }
      }
    });
  }
  if (Object.hasOwn(input, "weeklyGoal")) {
    if (!record(input.weeklyGoal)) add("program.weeklyGoal", "Expected a weekly coverage goal.");
    else { exact(input.weeklyGoal, ["distinctExercisesPracticed"], [], "program.weeklyGoal"); count(input.weeklyGoal.distinctExercisesPracticed, ids.size, "program.weeklyGoal.distinctExercisesPracticed"); }
  }
  if (Object.hasOwn(input, "suggestedRotation")) {
    if (!Array.isArray(input.suggestedRotation)) add("program.suggestedRotation", "Expected suggested rotations.");
    else {
      if (input.suggestedRotation.length > 7) add("program.suggestedRotation", "Use at most seven rotations.", "too-many-items");
      const days = new Set<unknown>();
      input.suggestedRotation.slice(0, 7).forEach((rotation, index) => {
        const path = `program.suggestedRotation[${index}]`;
        if (!record(rotation)) { add(path, "Expected a rotation object."); return; }
        exact(rotation, ["day", "exerciseIds"], [], path);
        if (!PRACTICE_SESSION_WEEKDAYS.includes(rotation.day as never)) add(`${path}.day`, "Use a supported weekday.");
        if (days.has(rotation.day)) add(`${path}.day`, "Weekday is duplicated.", "duplicate-day"); days.add(rotation.day);
        if (!Array.isArray(rotation.exerciseIds)) add(`${path}.exerciseIds`, "Expected exercise references.");
        else {
          if (!rotation.exerciseIds.length || rotation.exerciseIds.length > L.exercisesPerDay) add(`${path}.exerciseIds`, `Use 1–${L.exercisesPerDay} references.`, "too-many-items");
          const references = new Set<unknown>();
          rotation.exerciseIds.slice(0, L.exercisesPerDay).forEach((id, i) => {
            if (!ids.has(id as string)) add(`${path}.exerciseIds[${i}]`, "Reference does not resolve to a pool exercise.");
            if (references.has(id)) add(`${path}.exerciseIds[${i}]`, "Rotation reference is duplicated.", "duplicate-value"); references.add(id);
          });
        }
      });
    }
  }
  if (issues.length) return { ok: false, issues };
  try {
    const serialized = canonicalProgramJson(input);
    if (new TextEncoder().encode(serialized).byteLength > L.jsonBytes) { add("program", "The program exceeds the 256 KiB UTF-8 limit.", "input-too-large"); return { ok: false, issues }; }
    const program = JSON.parse(serialized) as PracticeProgram;
    const nativeExercises = program.exercises.map(({ id, weeklyTarget: _weeklyTarget, ...exercise }) => {
      void _weeklyTarget; return translateWeeklyPracticeExercise(exercise, id);
    });
    return { ok: true, value: { schemaVersion: 1, programId: program.programId, revision: program.revision, program, nativeExercises } };
  } catch { add("program.exercises", "The native feature rejected this configuration.", "canonical-config-rejected"); return { ok: false, issues }; }
}
export function parsePracticeProgramText(text: string): PracticeProgramValidation {
  if (new TextEncoder().encode(text).byteLength > L.jsonBytes) return { ok: false, issues: [{ severity: "error", code: "input-too-large", path: "program", message: `Weekly Practice JSON must be ${L.jsonBytes} bytes or smaller.` }] };
  try { return validatePracticeProgram(JSON.parse(text)); }
  catch { return { ok: false, issues: [{ severity: "error", code: "invalid-json", path: "program", message: "Paste one raw JSON object without Markdown fences." }] }; }
}
