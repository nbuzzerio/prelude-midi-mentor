import { describe, expect, expectTypeOf, it } from "vitest";
import { DEFAULT_EAR_TRAINING_CONFIG } from "@/features/ear-training/ear-training-config";
import { DEFAULT_FLASHCARD_CONFIG } from "@/features/flashcards/flashcard-config";
import { DEFAULT_MELODY_CONFIG } from "@/features/melody/melody-config";
import { DEFAULT_SEQUENCE_CONFIG } from "@/features/sequences/sequence-config";
import type { FlashcardPracticeExercise, MelodyPracticeExercise, PracticeExerciseEntry } from "./practice-session-types";
import { parsePracticeExerciseEntry, parsePracticeSessionLibrary, validateRunnablePracticeSessionPreset } from "./practice-session-validation";

const flashcard = (id = "f1", count: number | null = 20) => ({ id, label: "Notes", engine: "flashcards", config: DEFAULT_FLASHCARD_CONFIG, target: { kind: "correct-answers", count } } as const);
const sequence = (id = "s1", count: number | null = 4) => ({ id, label: "Intervals", engine: "sequences", config: DEFAULT_SEQUENCE_CONFIG, target: { kind: "completed-sequences", count } } as const);
const repertoire = (scaleRepertoire: readonly string[] = ["c-major"]) => ({ id: "r1", label: "Scales", engine: "sequences", config: { ...DEFAULT_SEQUENCE_CONFIG, exerciseType: "scales", scalePracticeMode: "repertoire-in-order", scaleRepertoire }, target: { kind: "complete-scale-repertoire" } } as const);
const earTraining = () => ({ id: "e1", label: "Ear Intervals", engine: "ear-training", config: DEFAULT_EAR_TRAINING_CONFIG, target: { kind: "correct-identifications", count: 10 } } as const);
const melody = (continuousPractice = true) => ({ id: "m1", label: "Reading Flow", engine: "melody", config: { ...DEFAULT_MELODY_CONFIG, continuousPractice }, target: { kind: "configured-timed-practice" } } as const);
const preset = (exercises: readonly unknown[]) => ({ schemaVersion: 1, id: "preset-1", name: "Daily", exercises });
const library = (presets: readonly unknown[], lastUsedPresetId: string | null = null) => ({ schemaVersion: 1, presets, lastUsedPresetId });

describe("Practice Session parsing", () => {
  it("parses every supported engine and preserves ordered, duplicate human labels", () => {
    const value = library([preset([flashcard(), sequence(), repertoire(), earTraining(), melody(), { ...flashcard("f2"), label: "Notes" }])]);
    const parsed = parsePracticeSessionLibrary(JSON.parse(JSON.stringify(value)));
    expect(parsed).toMatchObject({ ok: true, value: { presets: [{ exercises: [
      { engine: "flashcards" }, { engine: "sequences" }, { target: { kind: "complete-scale-repertoire" } }, { engine: "ear-training" }, { engine: "melody" }, { label: "Notes" },
    ] }] } });
  });

  it("delegates nested feature schemas and distinguishes corrupt from unsupported", () => {
    expect(parsePracticeSessionLibrary(library([preset([{ ...flashcard(), config: { ...DEFAULT_FLASHCARD_CONFIG, schemaVersion: 2 } }])]))).toMatchObject({ ok: false, reason: "unsupported", issue: { path: "library.presets[0].exercises[0].config" } });
    expect(parsePracticeSessionLibrary(library([preset([{ ...sequence(), config: { ...DEFAULT_SEQUENCE_CONFIG, mode: "invalid" } }])]))).toMatchObject({ ok: false, reason: "corrupt" });
    expect(parsePracticeSessionLibrary({ ...library([]), schemaVersion: 3 })).toMatchObject({ ok: false, reason: "unsupported" });
    expect(parsePracticeSessionLibrary({ ...library([]), extra: true })).toMatchObject({ ok: false, reason: "corrupt" });
  });

  it("rejects incompatible target families and malformed numeric targets", () => {
    expect(parsePracticeExerciseEntry({ ...flashcard(), target: { kind: "configured-timed-practice" } })).toMatchObject({ ok: false, reason: "corrupt" });
    expect(parsePracticeExerciseEntry({ ...earTraining(), target: { kind: "completed-sequences", count: 2 } })).toMatchObject({ ok: false, reason: "corrupt" });
    expect(parsePracticeExerciseEntry({ ...repertoire(), target: { kind: "completed-sequences", count: 2 } })).toMatchObject({ ok: false, reason: "corrupt" });
    expect(parsePracticeExerciseEntry({ ...sequence(), target: { kind: "complete-scale-repertoire" } })).toMatchObject({ ok: false, reason: "corrupt" });
    for (const count of [0, -1, 1.5, "2", Number.POSITIVE_INFINITY]) expect(parsePracticeExerciseEntry({ ...flashcard(), target: { kind: "correct-answers", count } })).toMatchObject({ ok: false, reason: "corrupt" });
  });

  it("allows exercise IDs to repeat across presets but not within one preset", () => {
    expect(parsePracticeSessionLibrary(library([preset([flashcard("same")]), { ...preset([flashcard("same")]), id: "preset-2" }]))).toMatchObject({ ok: true });
    expect(parsePracticeSessionLibrary(library([preset([flashcard("same"), flashcard("same")])]))).toMatchObject({ ok: false, reason: "corrupt" });
    expect(parsePracticeSessionLibrary(library([preset([]), preset([])]))).toMatchObject({ ok: false, reason: "corrupt" });
  });

  it("normalizes a dangling last-used ID in memory without rejecting presets", () => {
    expect(parsePracticeSessionLibrary(library([preset([flashcard()])], "missing"))).toEqual({ ok: true, value: { schemaVersion: 2, presets: [preset([flashcard()])], curricula: [], lastUsedPresetId: null } });
  });

  it("round trips v2 curriculum metadata and accepts an empty curriculum", () => {
    const value = { schemaVersion: 2, presets: [preset([flashcard()])], curricula: [
      { id: "week", title: "Foundation week", instructions: "Practice slowly.", days: [
        { day: "monday", kind: "practice", presetId: "preset-1", notes: "Read ahead.", estimatedDurationMinutes: 20 },
        { day: "tuesday", kind: "rest", notes: "Rest." },
      ] },
      { id: "empty", title: "Unassigned week", instructions: null, days: [] },
    ], lastUsedPresetId: null };
    expect(parsePracticeSessionLibrary(value)).toEqual({ ok: true, value });
  });

  it("rejects corrupt curriculum references, duplicate weekdays, and future library versions", () => {
    const current = { schemaVersion: 2, presets: [preset([flashcard()])], curricula: [], lastUsedPresetId: null };
    expect(parsePracticeSessionLibrary({ ...current, curricula: [{ id: "week", title: "Week", instructions: null, days: [{ day: "monday", kind: "practice", presetId: "missing", notes: null, estimatedDurationMinutes: null }] }] })).toMatchObject({ ok: false, issue: { path: "library.curricula[0].days[0]" } });
    expect(parsePracticeSessionLibrary({ ...current, curricula: [{ id: "week", title: "Week", instructions: null, days: [{ day: "monday", kind: "rest", notes: null }, { day: "monday", kind: "rest", notes: null }] }] })).toMatchObject({ ok: false, issue: { path: "library.curricula[0].days" } });
    expect(parsePracticeSessionLibrary({ ...current, schemaVersion: 3 })).toMatchObject({ ok: false, reason: "unsupported" });
  });

  it("detaches nested arrays at the parsing boundary", () => {
    const input = library([preset([flashcard()])]);
    const parsed = parsePracticeSessionLibrary(input);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.presets).not.toBe(input.presets);
    expect(parsed.value.presets[0]!.exercises).not.toBe((input.presets[0] as ReturnType<typeof preset>).exercises);
    expect(parsed.value.presets[0]!.exercises[0]!.config).not.toBe(DEFAULT_FLASHCARD_CONFIG);
  });
});

describe("Practice Session runnable validation", () => {
  it("accepts a complete prescription", () => {
    const parsed = parsePracticeSessionLibrary(library([preset([flashcard(), sequence(), repertoire(), earTraining(), melody()])]));
    if (!parsed.ok) throw new Error("fixture must parse");
    expect(validateRunnablePracticeSessionPreset(parsed.value.presets[0]!)).toMatchObject({ ok: true });
  });

  it("returns concise readiness issues for supported draft states", () => {
    const drafts = [
      preset([]),
      preset([flashcard("f", null)]),
      preset([repertoire([])]),
      preset([melody(false)]),
    ];
    expect(drafts.map((draft) => validateRunnablePracticeSessionPreset(draft as never))).toMatchObject([
      { ok: false, issues: [{ code: "no-exercises" }] },
      { ok: false, issues: [{ code: "target-required", exerciseId: "f" }] },
      { ok: false, issues: [{ code: "empty-repertoire", exerciseId: "r1" }] },
      { ok: false, issues: [{ code: "continuous-practice-required", exerciseId: "m1" }] },
    ]);
  });
});

describe("Practice Session static compatibility", () => {
  it("keeps engine target types distinct", () => {
    expectTypeOf<FlashcardPracticeExercise["target"]>().not.toEqualTypeOf<MelodyPracticeExercise["target"]>();
    expectTypeOf<PracticeExerciseEntry>().toBeObject();
  });
});
