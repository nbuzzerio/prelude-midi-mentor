import { describe, expect, it } from "vitest";
import { PRACTICE_SESSION_BUILDER_OPTIONS } from "./practice-session-builder-options";
import { getPracticeExerciseConceptName, getPracticeExerciseConfigurationSummary, getPracticeExerciseTargetSummary } from "./practice-session-presenters";

const entry = (id: string) => PRACTICE_SESSION_BUILDER_OPTIONS.find((option) => option.id === id)!.createEntry(id);

describe("Practice Session presenters", () => {
  it("summarizes every concept without serializing configs", () => {
    for (const option of PRACTICE_SESSION_BUILDER_OPTIONS) {
      const exercise = option.createEntry(option.id);
      expect(getPracticeExerciseConceptName(exercise).length).toBeGreaterThan(2);
      expect(getPracticeExerciseConfigurationSummary(exercise)).not.toContain("schemaVersion");
    }
  });

  it("uses native target language", () => {
    expect(getPracticeExerciseTargetSummary(entry("note-recognition"))).toBe("Choose a target");
    expect(getPracticeExerciseTargetSummary(entry("scales"))).toBe("Complete repertoire once");
    expect(getPracticeExerciseTargetSummary(entry("reading-flow"))).toBe("5 minutes");
  });
});
