import { describe, expect, it } from "vitest";
import { appendCompletedSequence, appendSequenceIncorrectAttempt, createSequencePracticeResult, selectSequenceDiagnosticChips, selectSequencePracticeReport, selectSequencePracticeReportPhases, snapshotSequencePracticeTarget } from "./sequence-practice-result";

const target = snapshotSequencePracticeTarget({ clef: "treble", name: { primary: "C major" }, steps: [{ durationTicks: 480, notes: [{ midiNumber: 60, name: "C", octave: 4 }] }], timing: { meter: { numerator: 4, denominator: 4 }, ticksPerQuarter: 480 } }, 10);
describe("Sequence practice result", () => {
  it("retains sequence-attempt terminology, repertoire order, retries, and completion duration", () => {
    const first = appendSequenceIncorrectAttempt(createSequencePracticeResult(["c-major"]), { target, failedStepIndex: 0, expectedMidiNumbers: [60], submittedMidiNumbers: [61], source: "virtual" });
    const final = appendCompletedSequence(first, { target, completionDurationMs: 2400, source: "virtual", repertoireId: "c-major" });
    expect(final.incorrectSequenceAttempts[0]).toMatchObject({ failedStepIndex: 0, submittedMidiNumbers: [61] });
    expect(final.completedSequences[0]).toMatchObject({ repertoireId: "c-major", priorIncorrectAttemptCount: 1, completionDurationMs: 2400 });
    expect(first.completedSequences).toEqual([]);
  });
  it("selects sequence terminology, timing, retries, and repertoire coverage", () => {
    let evidence = appendSequenceIncorrectAttempt(createSequencePracticeResult(["c-major", "g-major"]), { target, failedStepIndex: 0, expectedMidiNumbers: [60], submittedMidiNumbers: [61], source: "virtual" });
    evidence = appendCompletedSequence(evidence, { target, completionDurationMs: 2400, source: "virtual", repertoireId: "c-major" });
    const report = selectSequencePracticeReport(evidence);
    expect(report).toMatchObject({
      completedSequenceCount: 1, incorrectSequenceAttemptCount: 1, firstTrySequenceCount: 0,
      retriedSequenceCount: 1, averageCompletionDurationMs: 2400,
      configuredRepertoireCount: 2, completedRepertoireCount: 1, unresolvedIncorrectAttempts: [],
    });
    expect(selectSequenceDiagnosticChips(report).map(({ id, count }) => [id, count])).toEqual([["pitch-problem", 1], ["retried", 1]]);
    expect(evidence.incorrectSequenceAttempts[0]).toMatchObject({ expectedMidiNumbers: [60], submittedMidiNumbers: [61], failedStepIndex: 0 });
  });
  it("splits Bonus sequence evidence and phase-local unresolved attempts", () => {
    const boundary = appendSequenceIncorrectAttempt(createSequencePracticeResult(["c-major"]), { target, failedStepIndex: 0, expectedMidiNumbers: [60], submittedMidiNumbers: [61], source: "midi" });
    const before = JSON.stringify(boundary);
    const final = appendCompletedSequence(boundary, { target, completionDurationMs: 2000, source: "midi", repertoireId: "c-major" });
    const phases = selectSequencePracticeReportPhases(boundary, final);
    expect(phases.prescribed).toMatchObject({ completedSequenceCount: 0, incorrectSequenceAttemptCount: 1, unresolvedIncorrectAttempts: [{ target }] });
    expect(phases.bonus).toMatchObject({ completedSequenceCount: 1, incorrectSequenceAttemptCount: 0, firstTrySequenceCount: 1, completedRepertoireCount: 1 });
    expect(selectSequencePracticeReportPhases(final, final).bonus).toBeNull();
    expect(JSON.stringify(boundary)).toBe(before);
  });
});
