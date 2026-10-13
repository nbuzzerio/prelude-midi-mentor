import { WEEKLY_PRACTICE_CAPABILITIES as C, WEEKLY_PRACTICE_EXERCISE_TYPES, WEEKLY_PRACTICE_LIMITS as L } from "./weekly-practice-contract";
import { WEEKLY_PRACTICE_EXERCISE_SCHEMAS } from "./weekly-practice-schema";
import type { PracticeProgram } from "../practice-program-types";

export const WEEKLY_PROGRAM_EXAMPLE = {
  format: "prelude-weekly-practice", schemaVersion: 2, programId: "piano-foundations", revision: 1,
  title: "Flexible foundations", instructions: "Choose from the pool. Repeat exercises when useful; missed days are fine.",
  week: { startsOn: "sunday", datePolicy: "local-at-attempt-start" },
  exercises: [
    { id: "reading", type: "note-recognition", label: "Treble natural notes", staff: "treble", noteCategories: ["naturals"], showTargetName: false, target: { correctAnswers: 20 }, weeklyTarget: { completedAttempts: 3 } },
    { id: "scale-set", type: "scale-repertoire", label: "C major and A minor", staff: "treble", order: "in-order", scales: ["c-major", "a-natural-minor", "a-harmonic-minor", "a-melodic-minor"], showTargetName: true },
  ],
  weeklyGoal: { distinctExercisesPracticed: 2 },
  suggestedRotation: [{ day: "monday", exerciseIds: ["reading", "scale-set"] }, { day: "thursday", exerciseIds: ["scale-set"] }],
} as const satisfies PracticeProgram;

const id = { type: "string", pattern: "^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$", maxLength: 80 };
const text = (maxLength: number) => ({ type: "string", minLength: 1, maxLength });
const goal = (name: string, maximum: number) => ({ type: "object", additionalProperties: false, required: [name], properties: { [name]: { type: "integer", minimum: 1, maximum } } });
export const WEEKLY_PROGRAM_JSON_SCHEMA_V2 = {
  $schema: "https://json-schema.org/draft/2020-12/schema", title: "Prelude Weekly Program", type: "object", additionalProperties: false,
  required: ["format", "schemaVersion", "programId", "revision", "title", "week", "exercises"],
  properties: {
    format: { const: "prelude-weekly-practice" }, schemaVersion: { const: 2 }, programId: id,
    revision: { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER }, title: text(L.titleCharacters), instructions: text(L.instructionsCharacters),
    week: { type: "object", additionalProperties: false, required: ["startsOn", "datePolicy"], properties: { startsOn: { const: "sunday" }, datePolicy: { const: "local-at-attempt-start" } } },
    exercises: { type: "array", minItems: 1, maxItems: L.totalExercises, items: { oneOf: WEEKLY_PRACTICE_EXERCISE_TYPES.map(type => {
      const native = WEEKLY_PRACTICE_EXERCISE_SCHEMAS[type];
      return { ...native, required: ["id", ...native.required], properties: { ...native.properties, id, weeklyTarget: goal("completedAttempts", L.targetCount) } };
    }) } },
    weeklyGoal: goal("distinctExercisesPracticed", L.totalExercises),
    suggestedRotation: { type: "array", maxItems: 7, items: { type: "object", additionalProperties: false, required: ["day", "exerciseIds"], properties: { day: { enum: C.weekdays }, exerciseIds: { type: "array", minItems: 1, maxItems: L.exercisesPerDay, uniqueItems: true, items: id } } } },
  },
} as const;

export function createPracticeProgramLlmSpecification(): string {
  return `Create one flexible weekly piano-practice program for Prelude. Ask only useful missing-context questions. Return one raw JSON object, without Markdown fences or commentary.
Format prelude-weekly-practice, schemaVersion 2. Imports contain definitions only. Saved programs support flexible daily selection, repeated native exercises and basic local attempt history. Version 1 remains a separate daily-prescription format, imported using Import Weekly Plan.
Use a stable programId and positive integer revision; increment the revision when changing an existing program. Exercise IDs stay stable across revisions. Do not invent results, attempts, schedules, provider metadata or Guided Improvisation.
Weeks start Sunday and use local calendar dates at attempt start. exercises is a nonempty reusable pool, not mandatory daily assignments. suggestedRotation is optional advice; weekdays must be unique, exerciseIds unique within each rotation and resolve to pool IDs. Exercises may recur across different weekday suggestions. Omitted days are fine.
Optional weeklyTarget.completedAttempts is a positive frequency goal, separate from the native exercise target. Optional weeklyGoal.distinctExercisesPracticed must not exceed the pool size. These are goals, not imported results. Coverage counts saved started attempts; frequency counts completed attempts. Completion is separate from musical quality.
All fields are strict. Supported concepts: ${WEEKLY_PRACTICE_EXERCISE_TYPES.join(", ")}.
Native exercise meanings are unchanged: correctAnswers counts correctly played visual targets; completedSequences counts complete sequences; correctIdentifications counts heard intervals identified. Scale Repertoire completes the selected list once; Reading Flow uses durationMinutes.
Use only supported scale IDs: ${C.repertoireScales.join(", ")}. Chord progression keys/templates must be all major or all minor. Classical melodic minor ascends with raised sixth/seventh and descends as natural minor. No double accidentals, fingering/hand fields, Staff Builder scores or wrong-note grading for improvisation.
Limits: ${L.jsonBytes} UTF-8 bytes; 1-${L.totalExercises} pool exercises; at most seven rotations with 1-${L.exercisesPerDay} references each; count goals 1-${L.targetCount}. IDs use 1-80 ASCII letters/digits/dot/underscore/hyphen, first letter/digit. Titles max ${L.titleCharacters}, labels ${L.exerciseLabelCharacters}, instructions ${L.instructionsCharacters} Unicode characters. Arrays preserve selected order; duplicate selections are invalid.
JSON SCHEMA (Prelude additionally validates IDs, references, coverage and native musical configurations):
${JSON.stringify(WEEKLY_PROGRAM_JSON_SCHEMA_V2, null, 2)}
VALID EXAMPLE:
${JSON.stringify(WEEKLY_PROGRAM_EXAMPLE, null, 2)}
`;
}
