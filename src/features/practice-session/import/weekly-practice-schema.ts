import { WEEKLY_PRACTICE_CAPABILITIES as C, WEEKLY_PRACTICE_EXERCISE_TYPES, WEEKLY_PRACTICE_FORMAT, WEEKLY_PRACTICE_LIMITS as L, WEEKLY_PRACTICE_SCHEMA_VERSION } from "./weekly-practice-contract";

const string = (maxLength: number) => ({ type: "string", minLength: 1, maxLength });
const selection = (values: readonly (string | number)[]) => ({ type: "array", minItems: 1, uniqueItems: true, items: { enum: values } });
const countTarget = (name: string) => ({ type: "object", additionalProperties: false, required: [name], properties: { [name]: { type: "integer", minimum: 1, maximum: L.targetCount } } });
const exercise = (type: string, properties: Record<string, unknown>, required: readonly string[]) => ({ type: "object", additionalProperties: false, required: ["type", "label", ...required], properties: { type: { const: type }, label: string(L.exerciseLabelCharacters), ...properties } });
const sharedSequence = { staff: { enum: C.clefs }, startingNoteCategories: selection(C.noteCategories), showTargetName: { type: "boolean" }, target: countTarget("completedSequences") };

export const WEEKLY_PRACTICE_EXERCISE_SCHEMAS = Object.freeze({
  "note-recognition": exercise("note-recognition", { staff: { enum: C.clefs }, noteCategories: selection(C.noteCategories), showTargetName: { type: "boolean" }, target: countTarget("correctAnswers") }, ["staff", "noteCategories", "showTargetName", "target"]),
  triads: exercise("triads", { staff: { enum: C.clefs }, qualities: selection(C.triadQualities), positions: selection(C.triadPositions), showTargetName: { type: "boolean" }, target: countTarget("correctAnswers") }, ["staff", "qualities", "positions", "showTargetName", "target"]),
  "melodic-intervals": exercise("melodic-intervals", { ...sharedSequence, directions: selection(C.intervalDirections), intervals: selection(C.intervals) }, ["staff", "directions", "intervals", "startingNoteCategories", "showTargetName", "target"]),
  "random-scales": exercise("random-scales", { ...sharedSequence, scaleTypes: selection(C.scales), directions: selection(C.scaleDirections) }, ["staff", "scaleTypes", "directions", "startingNoteCategories", "showTargetName", "target"]),
  "scale-repertoire": exercise("scale-repertoire", { staff: { enum: C.clefs }, order: { enum: ["in-order", "shuffle"] }, scales: selection(C.repertoireScales), showTargetName: { type: "boolean" } }, ["staff", "order", "scales", "showTargetName"]),
  arpeggios: exercise("arpeggios", { ...sharedSequence, arpeggioTypes: selection(C.arpeggios), directions: selection(C.arpeggioDirections) }, ["staff", "arpeggioTypes", "directions", "startingNoteCategories", "showTargetName", "target"]),
  "chord-progressions": exercise("chord-progressions", { staff: { enum: C.clefs }, keys: selection(C.chordProgressionKeys), progressions: selection(C.chordProgressions), showTargetName: { type: "boolean" }, target: countTarget("completedSequences") }, ["staff", "keys", "progressions", "showTargetName", "target"]),
  "ear-intervals": exercise("ear-intervals", { directions: selection(C.intervalDirections), intervals: selection(C.intervals), target: countTarget("correctIdentifications") }, ["directions", "intervals", "target"]),
  "reading-flow": exercise("reading-flow", { staff: { enum: C.melodyStaffs }, key: { enum: C.melodyKeys }, tempoBpm: { enum: C.melodyTempos }, measureCount: { enum: C.melodyMeasureCounts }, durationMinutes: { enum: C.melodyDurations } }, ["staff", "key", "tempoBpm", "measureCount", "durationMinutes"]),
});

export const WEEKLY_PRACTICE_JSON_SCHEMA_V1 = Object.freeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Prelude Weekly Practice Curriculum",
  type: "object", additionalProperties: false,
  required: ["format", "schemaVersion", "title", "days"],
  properties: {
    format: { const: WEEKLY_PRACTICE_FORMAT }, schemaVersion: { const: WEEKLY_PRACTICE_SCHEMA_VERSION },
    title: string(L.titleCharacters), instructions: string(L.instructionsCharacters),
    days: { type: "array", maxItems: 7, items: { oneOf: [
      { type: "object", additionalProperties: false, required: ["day", "kind"], properties: { day: { enum: C.weekdays }, kind: { const: "rest" }, notes: string(L.dayNotesCharacters) } },
      { type: "object", additionalProperties: false, required: ["day", "kind", "name", "exercises"], properties: { day: { enum: C.weekdays }, kind: { const: "practice" }, name: string(L.dayNameCharacters), notes: string(L.dayNotesCharacters), estimatedDurationMinutes: { type: "integer", minimum: 1, maximum: L.estimatedDurationMinutes }, exercises: { type: "array", minItems: 1, maxItems: L.exercisesPerDay, items: { oneOf: WEEKLY_PRACTICE_EXERCISE_TYPES.map((type) => WEEKLY_PRACTICE_EXERCISE_SCHEMAS[type]) } } } },
    ] } },
  },
});
