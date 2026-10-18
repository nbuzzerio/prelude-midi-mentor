import { describe, expect, it } from "vitest";
import { getPracticeLessonCue as cue } from "./practice-lesson-cues";
import { testProgram } from "./practice-program-test-fixtures";
import { DEFAULT_SEQUENCE_CONFIG } from "@/features/sequences/sequence-config";
import { DEFAULT_FLASHCARD_CONFIG } from "@/features/flashcards/flashcard-config";

const sequence = (config: object, target = { kind: "completed-sequences", count: 2 }) => ({ id: "a", label: "D harmonic minor (untrusted title)", engine: "sequences", config: { ...DEFAULT_SEQUENCE_CONFIG, ...config }, target });
describe("configuration-grounded lesson cues", () => {
  it.each(["bass", "treble", "mixed"])("uses actual %s clef, ignoring a misleading title", mode => {
    const text = cue({ id: "a", label: "Minor arpeggios", engine: "flashcards", config: { ...DEFAULT_FLASHCARD_CONFIG, mode, enabledExerciseTypes: ["notes"] }, target: { kind: "correct-answers", count: 3 } });
    expect(text).toContain(mode === "mixed" ? "Check the clef" : `${mode} notes`);
  });
  it("uses general advice for mixed flashcard content", () => {
    expect(cue({ ...testProgram().nativeExercises[0], config: { ...DEFAULT_FLASHCARD_CONFIG, enabledExerciseTypes: ["notes", "triads"] } })).toContain("notes and chord shapes");
  });
  it("only names D harmonic minor for that single saved repertoire", () => {
    expect(cue(sequence({ exerciseType: "scales", scalePracticeMode: "repertoire-in-order", scaleRepertoire: ["d-harmonic-minor"] }, { kind: "complete-scale-repertoire" } as never))).toContain("In D harmonic minor");
    expect(cue(sequence({ exerciseType: "scales", enabledScales: ["harmonic-minor"] }))).not.toContain("In D");
    expect(cue(sequence({ exerciseType: "scales", enabledScales: ["major", "harmonic-minor"] }))).not.toContain("raised seventh");
  });
  it.each([
    ["ascending", "raised sixth and seventh"], ["descending", "uses natural minor"], ["ascending-descending", "natural minor descending"],
  ])("respects classical melodic minor %s", (direction, text) => {
    expect(cue(sequence({ exerciseType: "scales", enabledScales: ["melodic-minor"], enabledScaleDirections: [direction] }))).toContain(text);
  });
  it("uses both directions for melodic minor repertoire, including sharp tonics", () => {
    expect(cue(sequence({ exerciseType: "scales", scalePracticeMode: "repertoire-shuffle", scaleRepertoire: ["f-sharp-melodic-minor"] }, { kind: "complete-scale-repertoire" } as never))).toContain("natural minor descending");
  });
  it("only claims minor triads for an exclusively minor arpeggio selection", () => {
    expect(cue(sequence({ exerciseType: "arpeggios", enabledArpeggios: ["minor"] }))).toContain("minor triad");
    expect(cue(sequence({ exerciseType: "arpeggios", enabledArpeggios: ["minor", "major"] }))).not.toContain("minor triad");
  });
  it("derives ear and flow purposes from their engines", () => {
    for (const entry of testProgram().nativeExercises) expect(cue(entry)).not.toContain("comfortable pace");
    expect(cue(testProgram().nativeExercises.find(entry => entry.engine === "ear-training"))).toContain("distance between");
    expect(cue(testProgram().nativeExercises.find(entry => entry.engine === "melody"))).toContain("steady pulse");
  });
  it.each([undefined, {}, { engine: "future" }, { ...testProgram().nativeExercises[0], config: {} }])("falls back safely for missing or unsupported settings %j", value => {
    expect(cue(value)).toBe("Read the exercise instructions and work at a comfortable pace.");
  });
});
