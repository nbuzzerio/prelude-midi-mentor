import { describe, expect, it } from "vitest";
import { PRACTICE_SESSION_BUILDER_OPTIONS } from "./practice-session-builder-options";
import { derivePracticeSessionReport } from "./practice-session-report";
import { practiceSessionRunReducer, type PracticeSessionRunSnapshot, type PracticeSessionRunState } from "./practice-session-runtime";
import type { PracticeExerciseEntry } from "./practice-session-types";

function entry(index: number, id: string, count = 1): PracticeExerciseEntry {
  const created = PRACTICE_SESSION_BUILDER_OPTIONS[index]!.createEntry(id);
  return "count" in created.target ? { ...created, target: { ...created.target, count } } as PracticeExerciseEntry : created;
}

function start(exercises: readonly PracticeExerciseEntry[], at = 0): PracticeSessionRunState {
  const snapshot: PracticeSessionRunSnapshot = { presetId: "preset", presetName: "Daily", exercises };
  return practiceSessionRunReducer(null, { type: "START_RUN", runId: "run", startedAt: at, firstExerciseToken: "t1", snapshot })!;
}

describe("Practice Session report derivation", () => {
  it("exposes final and boundary engine payloads without interpreting them", () => {
    let state = start([entry(0, "only")]);
    const boundary = { engine: "flashcards", schemaVersion: 1, incorrectAttempts: [], completedTargets: [] } as const;
    state = practiceSessionRunReducer(state, { type: "ENGINE_RESULT_CHANGED", runId: "run", exerciseToken: "t1", exerciseId: "only", result: boundary })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", runId: "run", exerciseToken: "t1", exerciseId: "only", at: 1 })!;
    state = practiceSessionRunReducer(state, { type: "KEEP_PLAYING", runId: "run", exerciseToken: "t1", exerciseId: "only", at: 2 })!;
    const latest = { ...boundary, completedTargets: [{ sequence: 0, target: { id: "t", kind: "note", clef: "treble", name: { primary: "C" }, expectedPitches: [{ midiNumber: 60, name: "C", octave: 4 }] }, submittedMidiNumbers: [60], source: "midi", responseDurationMs: 10, priorIncorrectAttemptCount: 0 }] } as const;
    state = practiceSessionRunReducer(state, { type: "ENGINE_RESULT_CHANGED", runId: "run", exerciseToken: "t1", exerciseId: "only", result: latest })!;
    const report = derivePracticeSessionReport(state, 3);
    expect(report.exercises[0]?.targetBoundaryEngineResult).toEqual(boundary);
    expect(report.exercises[0]?.finalEngineResult).toEqual(latest);
    expect(report.exercises[0]).not.toHaveProperty("accuracy");
  });
  it("joins entered evidence with the complete authored prescription", () => {
    const exercises = [entry(0, "complete"), entry(2, "skip"), entry(6, "ended"), entry(7, "never")];
    let state = start(exercises);
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", runId: "run", exerciseToken: "t1", exerciseId: "complete", at: 10 })!;
    state = practiceSessionRunReducer(state, { type: "KEEP_PLAYING", runId: "run", exerciseToken: "t1", exerciseId: "complete", at: 20 })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", runId: "run", exerciseToken: "t1", exerciseId: "complete", at: 25 })!;
    state = practiceSessionRunReducer(state, { type: "ADVANCE", runId: "run", exerciseToken: "t1", exerciseId: "complete", endedAt: 30, nextStartedAt: 30, nextExerciseToken: "t2" })!;
    state = practiceSessionRunReducer(state, { type: "SKIP", runId: "run", exerciseToken: "t2", exerciseId: "skip", endedAt: 40, nextStartedAt: 40, nextExerciseToken: "t3" })!;
    state = practiceSessionRunReducer(state, { type: "END", runId: "run", exerciseToken: "t3", exerciseId: "ended", endedAt: 50 })!;
    const report = derivePracticeSessionReport(state);
    expect(report.exercises.map(({ exerciseId, outcome }) => [exerciseId, outcome])).toEqual([
      ["complete", "completed"], ["skip", "skipped"], ["ended", "ended-before-target"], ["never", "never-entered"],
    ]);
    expect(report.exercises[0]).toMatchObject({
      entered: true, prescribedUnitsCompleted: 1, bonusUnitsCompleted: 1,
      prescribedActiveDurationMs: 10, bonusActiveDurationMs: 10, totalActiveDurationMs: 20,
      targetReached: true, bonusUsed: true,
    });
    expect(report).toMatchObject({
      totalActiveDurationMs: 40, enteredExerciseCount: 3, targetReachedCount: 1,
      skippedCount: 1, endedBeforeTargetCount: 1, neverEnteredCount: 1, bonusExerciseCount: 1,
    });
    expect(report.exercises.map(({ exerciseIndex }) => exerciseIndex)).toEqual([0, 1, 2, 3]);
  });

  it("supports a valid zero-duration completed session", () => {
    let state = start([entry(0, "only")]);
    state = practiceSessionRunReducer(state, { type: "END", runId: "run", exerciseToken: "t1", exerciseId: "only", endedAt: 0 })!;
    expect(derivePracticeSessionReport(state)).toMatchObject({ totalActiveDurationMs: 0, enteredExerciseCount: 1, endedBeforeTargetCount: 1 });
  });

  it("derives long presets without omitting never-entered exercises", () => {
    const exercises = Array.from({ length: 100 }, (_, index) => entry(0, `exercise-${index}`));
    let state = start(exercises);
    state = practiceSessionRunReducer(state, { type: "END", runId: "run", exerciseToken: "t1", exerciseId: "exercise-0", endedAt: 1 })!;
    const report = derivePracticeSessionReport(state);
    expect(report.exercises).toHaveLength(100);
    expect(report.neverEnteredCount).toBe(99);
    expect(report.exercises.at(-1)?.exerciseId).toBe("exercise-99");
  });
});
