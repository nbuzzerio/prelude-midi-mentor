import { describe, expect, it } from "vitest";
import { appendFlashcardCompletedTarget, appendFlashcardIncorrectAttempt, createFlashcardPracticeResult, snapshotFlashcardPracticeTarget } from "./flashcard-practice-result";

const target = snapshotFlashcardPracticeTarget({ clef: "treble", name: { primary: "C" }, notes: [{ midiNumber: 60, name: "C", octave: 4 }] }, 10);
describe("Flashcard practice result", () => {
  it("retains target, retry, source, and existing response-duration evidence immutably", () => {
    const first = appendFlashcardIncorrectAttempt(createFlashcardPracticeResult(), { target, submittedMidiNumbers: [61], source: "midi" });
    const final = appendFlashcardCompletedTarget(first, { target, submittedMidiNumbers: [60], source: "midi", responseDurationMs: 1250 });
    expect(final.completedTargets[0]).toMatchObject({ target: { id: target.id, kind: "note", clef: "treble" }, priorIncorrectAttemptCount: 1, responseDurationMs: 1250 });
    expect(first.completedTargets).toEqual([]);
    expect(Object.isFrozen(final.completedTargets)).toBe(true);
  });
});
