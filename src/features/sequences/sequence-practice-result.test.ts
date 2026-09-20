import { describe, expect, it } from "vitest";
import { appendCompletedSequence, appendSequenceIncorrectAttempt, createSequencePracticeResult, snapshotSequencePracticeTarget } from "./sequence-practice-result";

const target = snapshotSequencePracticeTarget({ clef: "treble", name: { primary: "C major" }, steps: [{ durationTicks: 480, notes: [{ midiNumber: 60, name: "C", octave: 4 }] }], timing: { meter: { numerator: 4, denominator: 4 }, ticksPerQuarter: 480 } }, 10);
describe("Sequence practice result", () => {
  it("retains sequence-attempt terminology, repertoire order, retries, and completion duration", () => {
    const first = appendSequenceIncorrectAttempt(createSequencePracticeResult(["c-major"]), { target, failedStepIndex: 0, expectedMidiNumbers: [60], submittedMidiNumbers: [61], source: "virtual" });
    const final = appendCompletedSequence(first, { target, completionDurationMs: 2400, source: "virtual", repertoireId: "c-major" });
    expect(final.incorrectSequenceAttempts[0]).toMatchObject({ failedStepIndex: 0, submittedMidiNumbers: [61] });
    expect(final.completedSequences[0]).toMatchObject({ repertoireId: "c-major", priorIncorrectAttemptCount: 1, completionDurationMs: 2400 });
    expect(first.completedSequences).toEqual([]);
  });
});
