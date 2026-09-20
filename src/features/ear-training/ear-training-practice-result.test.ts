import { describe, expect, it } from "vitest";
import { appendEarTrainingCompletedTarget, appendEarTrainingIncorrectGuess, createEarTrainingPracticeResult, snapshotEarTrainingTarget } from "./ear-training-practice-result";

const target = snapshotEarTrainingTarget({ direction: "ascending", exerciseType: "melodic-interval", interval: "major-third", notes: [{ midiNumber: 60, name: "C", octave: 4 }, { midiNumber: 64, name: "E", octave: 4 }] }, 1);
describe("Ear Training practice result", () => {
  it("retains accepted wrong guesses and the existing response duration", () => {
    const first = appendEarTrainingIncorrectGuess(createEarTrainingPracticeResult(), { target, guessedInterval: "minor-third" });
    const final = appendEarTrainingCompletedTarget(first, { target, responseDurationMs: 900 });
    expect(final.completedTargets[0]).toMatchObject({ target: { interval: "major-third", direction: "ascending" }, priorIncorrectGuesses: ["minor-third"], responseDurationMs: 900 });
    expect(first.completedTargets).toEqual([]);
  });
});
