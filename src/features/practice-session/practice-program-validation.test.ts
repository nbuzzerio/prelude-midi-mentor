import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { WEEKLY_PROGRAM_EXAMPLE, WEEKLY_PROGRAM_JSON_SCHEMA_V2, createPracticeProgramLlmSpecification } from "./import/practice-program-specification";
import { REALISTIC_WEEKLY_PRACTICE_EXAMPLE } from "./import/weekly-practice-examples";
import { WEEKLY_PRACTICE_LIMITS as L } from "./import/weekly-practice-contract";
import { validateWeeklyPracticeCurriculum } from "./import/weekly-practice-validation";
import { canonicalProgramJson, parsePracticeProgramText, validatePracticeProgram } from "./practice-program-validation";

const example = () => JSON.parse(JSON.stringify(WEEKLY_PROGRAM_EXAMPLE));
const concepts = REALISTIC_WEEKLY_PRACTICE_EXAMPLE.days.flatMap(day => "exercises" in day ? [...day.exercises] : []);
describe("weekly program schema 2", () => {
  it("accepts the documented example without allocating new exercise identities", () => {
    const input = example(), before = canonicalProgramJson(input), result = parsePracticeProgramText(JSON.stringify(input));
    expect(result).toMatchObject({ ok: true, value: { programId: "piano-foundations", revision: 1, nativeExercises: [{ id: "reading" }, { id: "scale-set" }] } });
    expect(canonicalProgramJson(input)).toBe(before);
    if (result.ok) { expect(result.value.program).toEqual(input); expect(result.value.nativeExercises[1]).toMatchObject({ target: { kind: "complete-scale-repertoire" } }); }
  });
  it.each(concepts.map(exercise => [exercise.type, exercise] as const))("reuses canonical validation for %s", (_, exercise) => {
    const result = validatePracticeProgram({ ...example(), exercises: [{ ...exercise, id: "exercise" }], weeklyGoal: { distinctExercisesPracticed: 1 }, suggestedRotation: [] });
    expect(result).toMatchObject({ ok: true, value: { nativeExercises: [{ id: "exercise", label: exercise.label }] } });
  });
  it("keeps version 1 imports and identities separate, with no implicit conversion", () => {
    let id = 0;
    expect(validateWeeklyPracticeCurriculum(REALISTIC_WEEKLY_PRACTICE_EXAMPLE, () => `legacy-${id++}`)).toMatchObject({ ok: true });
    expect(validatePracticeProgram(REALISTIC_WEEKLY_PRACTICE_EXAMPLE)).toMatchObject({ ok: false });
    expect(validateWeeklyPracticeCurriculum(WEEKLY_PROGRAM_EXAMPLE, () => `legacy-${id++}`)).toMatchObject({ ok: false });
  });
  it.each([null, [], "invalid", "```json\n{}\n```", "{broken"])("rejects malformed or nonobject JSON %j", input => {
    expect(parsePracticeProgramText(typeof input === "string" ? input : JSON.stringify(input)).ok).toBe(false);
  });
  it("enforces UTF-8 byte limits before parsing", () => {
    expect(parsePracticeProgramText("é".repeat(L.jsonBytes))).toMatchObject({ ok: false, issues: [{ code: "input-too-large" }] });
  });
  it.each(["results", "attempts", "provider", "days"])("rejects imported %s and unknown fields atomically", key => {
    expect(validatePracticeProgram({ ...example(), [key]: [] })).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ path: `program.${key}`, code: "unknown-field" })]) });
  });
  it.each(["", "space id", "_bad", "a".repeat(81), 23])("rejects invalid stable ID %j", programId => {
    expect(validatePracticeProgram({ ...example(), programId }).ok).toBe(false);
  });
  it.each([0, -1, 1.5, "2", Number.MAX_SAFE_INTEGER + 1])("rejects invalid revision %j", revision => {
    expect(validatePracticeProgram({ ...example(), revision }).ok).toBe(false);
  });
  it("rejects duplicate IDs and unsupported concepts", () => {
    const input = example(); input.exercises[1].id = "reading"; input.exercises[0].type = "guided-improvisation";
    expect(validatePracticeProgram(input)).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ code: "duplicate-value" }), expect.objectContaining({ path: "program.exercises[0].type" })]) });
  });
  it("reports detailed native field errors and incompatible chord selections", () => {
    const exercise = concepts.find(exercise => exercise.type === "chord-progressions")!;
    const input = { ...example(), exercises: [{ ...exercise, id: "harmony", progressions: ["major-1451", "minor-1451"], invented: 1 }], suggestedRotation: [], weeklyGoal: { distinctExercisesPracticed: 1 } };
    expect(validatePracticeProgram(input)).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ code: "incompatible-selection" }), expect.objectContaining({ path: "program.exercises[0].invented" })]) });
  });
  it("rejects unsupported double-accidental scales", () => {
    const input = example(); input.exercises[1].scales = ["g-sharp-melodic-minor"];
    expect(validatePracticeProgram(input)).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining("double accidentals") })]) });
  });
  it("validates frequency, coverage, exact target fields and native targets separately", () => {
    const input = example(); input.weeklyGoal.distinctExercisesPracticed = 3;
    input.exercises[0].weeklyTarget = { completedAttempts: 0, history: [] }; input.exercises[0].target.correctAnswers = 1001;
    expect(validatePracticeProgram(input)).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ path: "program.weeklyGoal.distinctExercisesPracticed" }), expect.objectContaining({ path: "program.exercises[0].weeklyTarget.completedAttempts" }), expect.objectContaining({ path: "program.exercises[0].weeklyTarget.history" }), expect.objectContaining({ path: "program.exercises[0].target.correctAnswers" })]) });
  });
  it("validates rotation references, duplicates and unique weekdays", () => {
    const input = example(); input.suggestedRotation = [{ day: "monday", exerciseIds: ["reading", "reading", "missing"] }, { day: "monday", exerciseIds: ["scale-set"] }];
    expect(validatePracticeProgram(input)).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ code: "duplicate-value" }), expect.objectContaining({ code: "duplicate-day" }), expect.objectContaining({ path: "program.suggestedRotation[0].exerciseIds[2]" })]) });
  });
  it("allows reuse across optional rotations without duplicating definitions", () => {
    const input = example(); input.suggestedRotation.push({ day: "sunday", exerciseIds: ["reading"] });
    expect(validatePracticeProgram(input).ok).toBe(true);
    delete input.suggestedRotation; delete input.weeklyGoal; delete input.instructions; delete input.exercises[0].weeklyTarget;
    expect(validatePracticeProgram(input).ok).toBe(true);
  });
  it("enforces pool, rotation and reference limits", () => {
    const input = example(); input.exercises = Array.from({ length: 101 }, (_, index) => ({ ...input.exercises[0], id: `ex-${index}` }));
    expect(validatePracticeProgram(input)).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ path: "program.exercises", code: "too-many-items" })]) });
    input.exercises = input.exercises.slice(0, 100); input.suggestedRotation = Array.from({ length: 8 }, () => ({ day: "monday", exerciseIds: Array.from({ length: 25 }, (_, i) => `ex-${i}`) }));
    expect(validatePracticeProgram(input)).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ path: "program.suggestedRotation", code: "too-many-items" }), expect.objectContaining({ path: "program.suggestedRotation[0].exerciseIds" })]) });
  });
  it("requires the exact Sunday/local-date calendar contract", () => {
    expect(validatePracticeProgram({ ...example(), week: { startsOn: "monday", datePolicy: "utc", timeZone: "UTC" } }).ok).toBe(false);
  });
  it("bounds error reporting and counts Unicode characters rather than UTF-16 units", () => {
    const input = example(); input.title = "🎹".repeat(120); expect(validatePracticeProgram(input).ok).toBe(true);
    input.title += "🎹"; expect(validatePracticeProgram(input).ok).toBe(false);
    input.exercises = Array.from({ length: 100 }, () => ({ id: "?", type: "unknown", junk: true }));
    const result = validatePracticeProgram(input); if (result.ok) throw Error("Expected rejection"); expect(result.issues.length).toBeLessThanOrEqual(L.reportedIssues);
  });
  it("publishes all nine strict shapes and a parser-valid AI example", () => {
    expect(WEEKLY_PROGRAM_JSON_SCHEMA_V2.properties.exercises.items.oneOf).toHaveLength(9);
    const guide = createPracticeProgramLlmSpecification(); expect(guide).toContain("schemaVersion 2"); expect(guide).toContain("daily-prescription");
    expect(parsePracticeProgramText(guide.split("VALID EXAMPLE:\n")[1]!).ok).toBe(true);
    expect(canonicalProgramJson({ b: 2, a: [1, 2] })).toBe(canonicalProgramJson({ a: [1, 2], b: 2 }));
    expect(canonicalProgramJson([1, 2])).not.toBe(canonicalProgramJson([2, 1]));
  });
  it("keeps the documentation example identical to the parser-tested AI example", () => {
    const documentation = readFileSync("docs/WEEKLY_PROGRAM_V2.md", "utf8").replaceAll("\r\n", "\n");
    const text = documentation.split("```json\n")[1]!.split("\n```")[0]!;
    const parsed = parsePracticeProgramText(text); expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.program).toEqual(WEEKLY_PROGRAM_EXAMPLE);
  });
});
