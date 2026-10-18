import { describe, expect, it } from "vitest";
import { resolveMorningLesson } from "./practice-lesson";
import { testProgram } from "./practice-program-test-fixtures";

const sunday = new Date(2026, 9, 18, 8).getTime();
const program = () => {
  const value = testProgram();
  return { ...value, program: { ...value.program, suggestedRotation: [
    { day: "sunday" as const, exerciseIds: ["exercise-2", "exercise-0"] },
    { day: "monday" as const, exerciseIds: ["exercise-8"] },
  ] } };
};
describe("today's saved advisory rotation", () => {
  it("uses the local weekday and preserves authored order", () => {
    expect(resolveMorningLesson(program(), sunday)).toMatchObject({ weekday: "sunday", exerciseIds: ["exercise-2", "exercise-0"] });
    expect(resolveMorningLesson(program(), new Date(2026, 9, 19, 0).getTime()).exerciseIds).toEqual(["exercise-8"]);
  });
  it.each([undefined, [], [{ day: "sunday" as const, exerciseIds: [] }]])("does not invent work for an absent or empty rotation", suggestedRotation => {
    const value = program();
    expect(resolveMorningLesson({ ...value, program: { ...value.program, suggestedRotation } }, sunday).exerciseIds).toEqual([]);
  });
  it("rejects invalid references instead of filtering them", () => {
    const value = program();
    expect(() => resolveMorningLesson({ ...value, program: { ...value.program, suggestedRotation: [{ day: "sunday", exerciseIds: ["exercise-0", "missing"] }] } }, sunday)).toThrow("unavailable exercise: missing");
    expect(() => resolveMorningLesson({ ...value, nativeExercises: [] }, sunday)).toThrow("unavailable exercise");
  });
  it("rejects unavailable native configurations and duplicate references", () => {
    const value = program();
    expect(() => resolveMorningLesson({ ...value, nativeExercises: value.nativeExercises.map(entry => entry.id === "exercise-0" ? { ...entry, target: { kind: "correct-answers", count: null } } as typeof entry : entry) }, sunday)).toThrow("Choose a target");
    expect(() => resolveMorningLesson({ ...value, program: { ...value.program, suggestedRotation: [{ day: "sunday", exerciseIds: ["exercise-0", "exercise-0"] }] } }, sunday)).toThrow("duplicate");
  });
  it("detaches the exact saved revision and configurations without restoring defaults", () => {
    const value = program();
    const first = value.nativeExercises[0]!;
    if (first.engine !== "flashcards") throw Error("fixture");
    value.nativeExercises = [{ ...first, config: { ...first.config, replayCorrectVirtualChords: false } }, ...value.nativeExercises.slice(1)];
    const resolved = resolveMorningLesson(value, sunday), expected = structuredClone(resolved.program);
    Reflect.set(value.nativeExercises[0]!.config, "replayCorrectVirtualChords", true);
    value.nativeExercises = []; value.program.suggestedRotation[0]!.exerciseIds.reverse();
    expect(resolved.program).toEqual(expected);
    expect(resolved.program.nativeExercises[0]).toMatchObject({ config: { replayCorrectVirtualChords: false } });
    expect(resolved.exerciseIds).toEqual(["exercise-2", "exercise-0"]);
  });
});
