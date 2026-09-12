import { describe, expect, it } from "vitest";
import { createStaffBuilderScore } from "./staff-builder-score";
import { areStaffBuilderAuthoredScoresEquivalent, getStaffBuilderEditorPracticeReadiness } from "./staff-builder-practice-readiness";

function score() {
  return createStaffBuilderScore({
    title: "Study", tempoBpm: 96, initialKeySignatureId: "c-major", initialTimeSignature: "4/4",
    factories: { createId: () => "score", now: () => "2026-09-01T12:00:00.000Z" },
  });
}

describe("Staff Builder editor practice readiness", () => {
  it("requires validation, clear capture, a matching validated save, and healthy persistence in precedence order", () => {
    const current = score();
    const snapshot = { pieceId: current.id, score: current };
    const base = { score: current, validatedSavedSnapshot: snapshot, issueCount: 0, hasPendingCapture: false, savingAvailable: true };
    expect(getStaffBuilderEditorPracticeReadiness(base)).toEqual({ ready: true, reason: null });
    expect(getStaffBuilderEditorPracticeReadiness({ ...base, issueCount: 1, hasPendingCapture: true, validatedSavedSnapshot: null })).toEqual({ ready: false, reason: "Fix validation issues before practicing." });
    expect(getStaffBuilderEditorPracticeReadiness({ ...base, hasPendingCapture: true, validatedSavedSnapshot: null })).toEqual({ ready: false, reason: "Lock in or clear pending notes before practicing." });
    expect(getStaffBuilderEditorPracticeReadiness({ ...base, validatedSavedSnapshot: null })).toEqual({ ready: false, reason: "Save before practicing." });
    expect(getStaffBuilderEditorPracticeReadiness({ ...base, savingAvailable: false })).toEqual({ ready: false, reason: "Staff Builder changes could not be saved in this browser." });
  });

  it("compares authored score identity while excluding timestamps and including practice-affecting edits", () => {
    const current = score();
    expect(areStaffBuilderAuthoredScoresEquivalent(current, { ...current, updatedAt: "2026-09-02T12:00:00.000Z" })).toBe(true);
    expect(areStaffBuilderAuthoredScoresEquivalent(current, { ...current, tempoBpm: 97 })).toBe(false);
    expect(areStaffBuilderAuthoredScoresEquivalent(current, { ...current, annotations: [{ id: "note", kind: "study-note", anchor: { kind: "measure", measureId: current.measures[0]!.id }, text: "Phrase" }] })).toBe(false);
  });
});
