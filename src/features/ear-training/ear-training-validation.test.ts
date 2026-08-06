import { describe, expect, it } from "vitest";
import { isEarTrainingAnswerCorrect } from "./ear-training-validation";
import type { EarTrainingTarget } from "./ear-training-types";

const target: EarTrainingTarget = {
  direction: "descending",
  exerciseType: "melodic-interval",
  interval: "major-third",
  notes: [{ midiNumber: 64, name: "E", octave: 4 }, { midiNumber: 60, name: "C", octave: 4 }],
};

describe("ear-training validation", () => {
  it("grades interval identity without making direction part of the answer", () => {
    expect(isEarTrainingAnswerCorrect("major-third", target)).toBe(true);
    expect(isEarTrainingAnswerCorrect("minor-third", target)).toBe(false);
  });
});
