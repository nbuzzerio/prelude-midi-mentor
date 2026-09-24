import { describe, expect, it, vi } from "vitest";
import { parsePracticeSessionPreset, validateRunnablePracticeSessionPreset } from "../practice-session-validation";
import { MINIMAL_WEEKLY_PRACTICE_EXAMPLE, REALISTIC_WEEKLY_PRACTICE_EXAMPLE } from "./weekly-practice-examples";
import { WEEKLY_PRACTICE_LIMITS } from "./weekly-practice-contract";
import { parseWeeklyPracticeCurriculumText, validateWeeklyPracticeCurriculum } from "./weekly-practice-validation";

const ids = () => { let value = 0; return () => `id-${value++}`; };

describe("Weekly Practice curriculum validation and translation", () => {
  it("accepts the minimal partial week and produces one runnable ordinary preset", () => {
    const result = validateWeeklyPracticeCurriculum(MINIMAL_WEEKLY_PRACTICE_EXAMPLE, ids());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.translated).toMatchObject({ curriculum: { title: "Reading basics", days: [{ day: "monday", kind: "practice", presetId: "id-1" }] }, presets: [{ schemaVersion: 1, id: "id-1", exercises: [{ engine: "flashcards", config: { enabledExerciseTypes: ["notes"] }, target: { kind: "correct-answers", count: 20 } }] }] });
    expect(parsePracticeSessionPreset(result.translated.presets[0])).toMatchObject({ ok: true });
    expect(validateRunnablePracticeSessionPreset(result.translated.presets[0]!)).toMatchObject({ ok: true });
  });

  it("translates all nine external concepts through canonical parser and runnable validation", () => {
    const result = validateWeeklyPracticeCurriculum(REALISTIC_WEEKLY_PRACTICE_EXAMPLE, ids());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.translated.presets.flatMap(({ exercises }) => exercises).map(({ label }) => label)).toHaveLength(9);
    for (const preset of result.translated.presets) {
      expect(parsePracticeSessionPreset(preset)).toMatchObject({ ok: true });
      expect(validateRunnablePracticeSessionPreset(preset)).toMatchObject({ ok: true });
    }
    expect(result.translated.curriculum.days.find(({ kind }) => kind === "rest")).toEqual({ day: "wednesday", kind: "rest", notes: "Rest or use ungraded practice outside this prescription." });
  });

  it("collects exact-key, duplicate-day, target, and detailed exercise field issues", () => {
    const input = structuredClone(MINIMAL_WEEKLY_PRACTICE_EXAMPLE) as unknown as { extra?: boolean; days: Record<string, unknown>[] };
    input.extra = true;
    input.days.push({ day: "monday", kind: "practice", name: "Broken", exercises: [{ type: "note-recognition", label: "Broken notes", staff: "alto", noteCategories: ["naturals", "naturals"], showTargetName: false, target: { correctAnswers: 0 }, invented: true }] });
    const result = validateWeeklyPracticeCurriculum(input, ids());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "unknown-field", path: "curriculum.extra" }),
      expect.objectContaining({ code: "duplicate-day", day: "monday", dayIndex: 1 }),
      expect.objectContaining({ code: "invalid-value", path: "curriculum.days[1].exercises[0].staff", exerciseIndex: 0, exerciseLabel: "Broken notes" }),
      expect.objectContaining({ code: "duplicate-value", path: "curriculum.days[1].exercises[0].noteCategories[1]" }),
      expect.objectContaining({ code: "out-of-range", path: "curriculum.days[1].exercises[0].target.correctAnswers" }),
      expect.objectContaining({ code: "unknown-field", path: "curriculum.days[1].exercises[0].invented" }),
    ]));
  });

  it("requires strict all-major or all-minor chord progression selections", () => {
    const input = structuredClone(REALISTIC_WEEKLY_PRACTICE_EXAMPLE) as unknown as { days: { exercises?: Record<string, unknown>[] }[] };
    const progression = input.days.flatMap(({ exercises = [] }) => exercises).find(({ type }) => type === "chord-progressions")!;
    progression.progressions = ["major-1451", "minor-1451"];
    const result = validateWeeklyPracticeCurriculum(input, ids());
    expect(result).toMatchObject({ ok: false, issues: [expect.objectContaining({ code: "incompatible-selection", exerciseLabel: "Major-key progressions" })] });
  });

  it("rejects unavailable repertoire entries with a musical reason", () => {
    const input = structuredClone(REALISTIC_WEEKLY_PRACTICE_EXAMPLE) as unknown as { days: { exercises?: Record<string, unknown>[] }[] };
    const repertoire = input.days.flatMap(({ exercises = [] }) => exercises).find(({ type }) => type === "scale-repertoire")!;
    repertoire.scales = ["g-sharp-melodic-minor"];
    const result = validateWeeklyPracticeCurriculum(input, ids());
    expect(result).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.objectContaining({ path: expect.stringContaining("scales[0]"), message: expect.stringContaining("double accidentals") })]) });
  });

  it("rejects malformed JSON, Markdown fences, and oversized UTF-8 input without translating", () => {
    const createId = vi.fn(() => "id");
    expect(parseWeeklyPracticeCurriculumText("```json\n{}\n```", createId)).toMatchObject({ ok: false, issues: [{ code: "invalid-json" }] });
    expect(parseWeeklyPracticeCurriculumText("é".repeat(WEEKLY_PRACTICE_LIMITS.jsonBytes), createId)).toMatchObject({ ok: false, issues: [{ code: "input-too-large" }] });
    expect(createId).not.toHaveBeenCalled();
  });

  it("enforces string, day exercise, and total exercise bounds", () => {
    const tooLong = { ...MINIMAL_WEEKLY_PRACTICE_EXAMPLE, title: "x".repeat(WEEKLY_PRACTICE_LIMITS.titleCharacters + 1) };
    expect(validateWeeklyPracticeCurriculum(tooLong, ids())).toMatchObject({ ok: false, issues: [expect.objectContaining({ code: "string-too-long", path: "curriculum.title" })] });
    const exercise = MINIMAL_WEEKLY_PRACTICE_EXAMPLE.days[0]!.exercises[0]!;
    const tooMany = { ...MINIMAL_WEEKLY_PRACTICE_EXAMPLE, days: [{ ...MINIMAL_WEEKLY_PRACTICE_EXAMPLE.days[0]!, exercises: Array.from({ length: WEEKLY_PRACTICE_LIMITS.exercisesPerDay + 1 }, () => exercise) }] };
    expect(validateWeeklyPracticeCurriculum(tooMany, ids())).toMatchObject({ ok: false, issues: [expect.objectContaining({ code: "too-many-items", path: "curriculum.days[0].exercises" })] });
  });
});
