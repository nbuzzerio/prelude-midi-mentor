import { describe, expect, it } from "vitest";
import { appendEarTrainingCompletedTarget, appendEarTrainingIncorrectGuess, createEarTrainingPracticeResult, selectEarTrainingPracticeReport, selectEarTrainingPracticeReportPhases, snapshotEarTrainingTarget } from "./ear-training-practice-result";

const target = snapshotEarTrainingTarget({ direction: "ascending", exerciseType: "melodic-interval", interval: "major-third", notes: [{ midiNumber: 60, name: "C", octave: 4 }, { midiNumber: 64, name: "E", octave: 4 }] }, 1);
describe("Ear Training practice result", () => {
  it("retains accepted wrong guesses and the existing response duration", () => {
    const first = appendEarTrainingIncorrectGuess(createEarTrainingPracticeResult(), { target, guessedInterval: "minor-third" });
    const final = appendEarTrainingCompletedTarget(first, { target, responseDurationMs: 900 });
    expect(final.completedTargets[0]).toMatchObject({ target: { interval: "major-third", direction: "ascending" }, priorIncorrectGuesses: ["minor-third"], responseDurationMs: 900 });
    expect(first.completedTargets).toEqual([]);
  });
  it("selects identification, first-guess, retry, and response-time reporting", () => {
    let evidence = appendEarTrainingIncorrectGuess(createEarTrainingPracticeResult(), { target, guessedInterval: "minor-third" });
    evidence = appendEarTrainingCompletedTarget(evidence, { target, responseDurationMs: 900 });
    const report = selectEarTrainingPracticeReport(evidence);
    expect(report).toMatchObject({ completedIdentificationCount: 1, incorrectGuessCount: 1, firstGuessIdentificationCount: 0, retriedIdentificationCount: 1, averageResponseDurationMs: 900, unresolvedIncorrectGuesses: [] });
  });
  it("splits Bonus identifications and phase-local unresolved guesses", () => {
    const boundary = appendEarTrainingIncorrectGuess(createEarTrainingPracticeResult(), { target, guessedInterval: "minor-third" });
    const before = JSON.stringify(boundary);
    const final = appendEarTrainingCompletedTarget(boundary, { target, responseDurationMs: 700 });
    const phases = selectEarTrainingPracticeReportPhases(boundary, final);
    expect(phases.prescribed).toMatchObject({ completedIdentificationCount: 0, incorrectGuessCount: 1, unresolvedIncorrectGuesses: [{ target }] });
    expect(phases.bonus).toMatchObject({ completedIdentificationCount: 1, incorrectGuessCount: 0, firstGuessIdentificationCount: 1, averageResponseDurationMs: 700 });
    expect(selectEarTrainingPracticeReportPhases(final, final).bonus).toBeNull();
    expect(JSON.stringify(boundary)).toBe(before);
  });
});
