import { describe, expect, it } from "vitest";
import { appendFlashcardCompletedTarget, appendFlashcardIncorrectAttempt, createFlashcardPracticeResult, selectFlashcardPracticeReport, selectFlashcardPracticeReportPhases, snapshotFlashcardPracticeTarget } from "./flashcard-practice-result";

const target = snapshotFlashcardPracticeTarget({ clef: "treble", name: { primary: "C" }, notes: [{ midiNumber: 60, name: "C", octave: 4 }] }, 10);
describe("Flashcard practice result", () => {
  it("retains target, retry, source, and existing response-duration evidence immutably", () => {
    const first = appendFlashcardIncorrectAttempt(createFlashcardPracticeResult(), { target, submittedMidiNumbers: [61], source: "midi" });
    const final = appendFlashcardCompletedTarget(first, { target, submittedMidiNumbers: [60], source: "midi", responseDurationMs: 1250 });
    expect(final.completedTargets[0]).toMatchObject({ target: { id: target.id, kind: "note", clef: "treble" }, priorIncorrectAttemptCount: 1, responseDurationMs: 1250 });
    expect(first.completedTargets).toEqual([]);
    expect(Object.isFrozen(final.completedTargets)).toBe(true);
  });
  it("selects engine-local completion, retry, timing, and unresolved-attempt reporting", () => {
    const other = snapshotFlashcardPracticeTarget({ clef: "treble", name: { primary: "D" }, notes: [{ midiNumber: 62, name: "D", octave: 4 }] }, 20);
    let evidence = appendFlashcardIncorrectAttempt(createFlashcardPracticeResult(), { target, submittedMidiNumbers: [61], source: "midi" });
    evidence = appendFlashcardCompletedTarget(evidence, { target, submittedMidiNumbers: [60], source: "midi", responseDurationMs: 1000 });
    evidence = appendFlashcardIncorrectAttempt(evidence, { target: other, submittedMidiNumbers: [63], source: "virtual" });
    const report = selectFlashcardPracticeReport(evidence);
    expect(report).toMatchObject({ completedTargetCount: 1, incorrectAttemptCount: 2, firstTryTargetCount: 0, retriedTargetCount: 1, averageResponseDurationMs: 1000 });
    expect(report.unresolvedIncorrectAttempts.map(({ target: item }) => item.id)).toEqual([other.id]);
    expect(Object.isFrozen(report)).toBe(true);
  });
  it("splits appended Bonus evidence without mutating the boundary", () => {
    const boundary = appendFlashcardIncorrectAttempt(createFlashcardPracticeResult(), { target, submittedMidiNumbers: [61], source: "midi" });
    const before = JSON.stringify(boundary);
    const final = appendFlashcardCompletedTarget(boundary, { target, submittedMidiNumbers: [60], source: "midi", responseDurationMs: 800 });
    const phases = selectFlashcardPracticeReportPhases(boundary, final);
    expect(phases.prescribed).toMatchObject({ completedTargetCount: 0, incorrectAttemptCount: 1, unresolvedIncorrectAttempts: [{ target }] });
    expect(phases.bonus).toMatchObject({ completedTargetCount: 1, incorrectAttemptCount: 0, firstTryTargetCount: 1, averageResponseDurationMs: 800 });
    expect(selectFlashcardPracticeReportPhases(final, final).bonus).toBeNull();
    expect(selectFlashcardPracticeReportPhases(null, final)).toMatchObject({ prescribed: null, bonus: null, recorded: { completedTargetCount: 1 } });
    expect(JSON.stringify(boundary)).toBe(before);
  });
});
