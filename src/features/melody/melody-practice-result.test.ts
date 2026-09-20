import { describe, expect, it } from "vitest";
import { createMelodyPracticeResult } from "./melody-practice-result";

describe("Melody practice result", () => {
  it("freezes the trial collection and preserves interruption without adding a score", () => {
    const result = createMelodyPracticeResult([], true);
    expect(result).toEqual({ engine: "melody", schemaVersion: 1, diagnosticTrials: [], interrupted: true });
    expect(Object.isFrozen(result.diagnosticTrials)).toBe(true);
    expect(result).not.toHaveProperty("score");
  });
});
