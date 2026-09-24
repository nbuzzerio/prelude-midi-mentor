import { WEEKLY_PRACTICE_CAPABILITIES as C, WEEKLY_PRACTICE_EXERCISE_DESCRIPTIONS, WEEKLY_PRACTICE_EXERCISE_TYPES, WEEKLY_PRACTICE_FORMAT, WEEKLY_PRACTICE_LIMITS as L, WEEKLY_PRACTICE_SCHEMA_VERSION } from "./weekly-practice-contract";
import { MINIMAL_WEEKLY_PRACTICE_EXAMPLE, REALISTIC_WEEKLY_PRACTICE_EXAMPLE } from "./weekly-practice-examples";
import { WEEKLY_PRACTICE_JSON_SCHEMA_V1 } from "./weekly-practice-schema";

export function createWeeklyPracticeLlmSpecification(): string {
  const concepts = WEEKLY_PRACTICE_EXERCISE_TYPES.map((type) => `- ${type}: ${WEEKLY_PRACTICE_EXERCISE_DESCRIPTIONS[type]}`).join("\n");
  return `You are helping me create a weekly piano-practice plan for Prelude MIDI Mentor. Follow the authoritative Prelude Weekly Practice specification below. If important student context is missing, ask a small number of useful questions before generating the plan. Do not require a fixed questionnaire or ask for information that is not material to the plan. When you generate the final plan, return only the raw JSON document with no Markdown fences or surrounding prose.

Prelude Weekly Practice Curriculum specification

Format: ${WEEKLY_PRACTICE_FORMAT}
Schema version: ${WEEKLY_PRACTICE_SCHEMA_VERSION}

PURPOSE
Create a reusable weekly piano-practice curriculum. A partial week is valid. Practice days become ordered Prelude Practice Session presets; rest days are descriptive metadata and create no empty session. This format describes practice prescriptions, not a calendar or completion history.

PLANNING GUIDANCE
- Ask only for important missing context. Useful examples include experience or level, current repertoire, reading weaknesses, theory or ear-training goals, available practice days, approximate minutes per day, and the desired balance of reading, ear work, scales, arpeggios, and chords.
- Do not invent student facts. Do not force every example question to be answered when it is unnecessary.
- Use the supported-concept descriptions as educational guidance, not as a mandatory teaching philosophy. Keep choices neutral when the user has not expressed a preference.
- Choose a realistic number of exercises and targets for the available practice time. The estimated duration is planning context, not a Prelude timer or schedule.
- The structural rules, field shapes, allowed values, and limits are authoritative and must be followed exactly.

OUTPUT RULES
- For the final plan, return exactly one raw JSON object.
- Do not use Markdown fences.
- Add no surrounding commentary to the final JSON.
- Use only the supported exercise concepts, settings, and values below.
- Do not invent hand, fingering, contrary-motion, calendar date, scheduling, recurrence, reminder, Free Play, Piece Practice, or Staff Builder fields.
- Include no runtime state, completion history, evidence, results, or LLM/provider metadata.
- Do not use internal Prelude engine names or configuration schema versions.

SUPPORTED CONCEPTS AND EDUCATIONAL USE
${concepts}

FIELD AND TARGET MEANINGS
- title names the curriculum; instructions give curriculum-level educational guidance.
- A practice day's name becomes its user-facing Practice Session preset name. Day notes preserve day-specific educational context.
- estimatedDurationMinutes communicates the intended daily time commitment; it does not schedule or time the session.
- label is the user-facing exercise name. staff selects the notation staff supported by that exercise.
- showTargetName controls whether Prelude visibly names the generated musical target.
- startingNoteCategories limits the categories from which generated starting notes may be chosen.
- correctAnswers is the number of correctly played visual targets required. completedSequences is the number of complete generated sequences required. correctIdentifications is the number of correctly identified heard intervals required.
- Scale Repertoire has no numeric target: the selected repertoire list is completed once. Reading Flow uses durationMinutes as its timed-practice target.

IMPORTANT RULES AND LIMITS
- Days are a unique subset of Monday through Sunday: ${C.weekdays.join(", ")}.
- Practice days need 1-${L.exercisesPerDay} ordered exercises; the whole curriculum may contain at most ${L.totalExercises} exercises. Rest days have no exercises and create no preset.
- The JSON document must be no larger than ${L.jsonBytes} bytes.
- Curriculum titles are at most ${L.titleCharacters} characters; instructions are at most ${L.instructionsCharacters}; practice-day names are at most ${L.dayNameCharacters}; day notes are at most ${L.dayNotesCharacters}; and exercise labels are at most ${L.exerciseLabelCharacters}.
- estimatedDurationMinutes is a whole number from 1-${L.estimatedDurationMinutes}. Count targets are whole numbers from 1-${L.targetCount}.
- Scale Repertoire completes its selected list once and supports only: ${C.repertoireScales.join(", ")}.
- Chord Progression keys and progression templates must all be major or all be minor.
- Reading Flow supports staffs ${C.melodyStaffs.join(", ")}; keys ${C.melodyKeys.join(", ")}; tempos ${C.melodyTempos.join(", ")} BPM; ${C.melodyMeasureCounts.join(" or ")} measures; and ${C.melodyDurations.join(", ")} minute durations.

JSON SCHEMA
The schema below supplies the exact required fields and allowed values for every exercise concept.
${JSON.stringify(WEEKLY_PRACTICE_JSON_SCHEMA_V1, null, 2)}

MINIMAL VALID EXAMPLE
${JSON.stringify(MINIMAL_WEEKLY_PRACTICE_EXAMPLE, null, 2)}

REALISTIC EXAMPLE
${JSON.stringify(REALISTIC_WEEKLY_PRACTICE_EXAMPLE, null, 2)}
`;
}
