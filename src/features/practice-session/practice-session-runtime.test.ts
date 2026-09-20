import { describe, expect, it } from "vitest";
import { PRACTICE_SESSION_BUILDER_OPTIONS } from "./practice-session-builder-options";
import {
  createPracticeSessionRunSnapshot,
  practiceSessionRunReducer,
  type ActivePracticeSessionRun,
  type PracticeSessionRunSnapshot,
  type PracticeSessionRunState,
} from "./practice-session-runtime";
import type { PracticeExerciseEntry, PracticeSessionPreset } from "./practice-session-types";
import type { FlashcardPracticeResultV1 } from "@/features/flashcards/flashcard-practice-result";

function entry(option: number, id: string, count = 2): PracticeExerciseEntry {
  const created = PRACTICE_SESSION_BUILDER_OPTIONS[option]!.createEntry(id);
  return "count" in created.target ? { ...created, target: { ...created.target, count } } as PracticeExerciseEntry : created;
}

function snapshot(exercises: readonly PracticeExerciseEntry[]): PracticeSessionRunSnapshot {
  return { presetId: "preset", presetName: "Daily", exercises };
}

function start(exercises: readonly PracticeExerciseEntry[], runId = "run"): ActivePracticeSessionRun {
  return practiceSessionRunReducer(null, { type: "START_RUN", runId, startedAt: 10, firstExerciseToken: "token-1", snapshot: snapshot(exercises) }) as ActivePracticeSessionRun;
}

const scope = { runId: "run", exerciseToken: "token-1", exerciseId: "e1" };

describe("Practice Session runtime reducer", () => {
  it("creates a detached snapshot", () => {
    const exercise = entry(0, "e1");
    const preset: PracticeSessionPreset = { schemaVersion: 1, id: "preset", name: "Daily", exercises: [exercise] };
    const result = createPracticeSessionRunSnapshot(preset);
    expect(result).toEqual({ presetId: "preset", presetName: "Daily", exercises: [exercise] });
    expect(result.exercises).not.toBe(preset.exercises);
    expect(result.exercises[0]).not.toBe(exercise);
  });

  it("latches numeric achievement once and keeps Bonus actual uncapped", () => {
    let state: PracticeSessionRunState = start([entry(0, "e1")]);
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 11 })!;
    expect(state.status === "active" && state.records[0]?.targetAchieved).toBe(false);
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 12 })!;
    expect(state.status === "active" && state.completionPresentation).toBe("target-complete");
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 13 })!;
    expect(state.status === "active" && state.records[0]?.actual).toBe(2);
    state = practiceSessionRunReducer(state, { type: "KEEP_PLAYING", ...scope, at: 14 })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 15 })!;
    expect(state.status === "active" && state.records[0]?.actual).toBe(3);
    expect(state.status === "active" && state.completionPresentation).toBe("bonus");
  });

  it("holds numeric actual at target until Bonus is selected", () => {
    let state: PracticeSessionRunState = start([entry(0, "e1", 1)]);
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 11 })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 12 })!;
    expect(state.status === "active" && state.records[0]?.actual).toBe(1);
    expect(state.status === "active" && state.records[0]?.bonusUsed).toBe(false);
    expect(state.status === "active" && state.completionPresentation).toBe("target-complete");
    state = practiceSessionRunReducer(state, { type: "KEEP_PLAYING", ...scope, at: 13 })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 14 })!;
    expect(state.status === "active" && state.records[0]?.actual).toBe(2);
  });

  it("uses the repertoire event as authority and retains the final scale unit", () => {
    const repertoire = PRACTICE_SESSION_BUILDER_OPTIONS[3]!.createEntry("e1");
    let state: PracticeSessionRunState = start([repertoire]);
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 11 })!;
    expect(state.status === "active" && state.records[0]?.targetAchieved).toBe(false);
    state = practiceSessionRunReducer(state, { type: "TARGET_REACHED", ...scope, at: 12 })!;
    expect(state.status === "active" && state.records[0]?.actual).toBe(1);
    expect(state.status === "active" && state.records[0]?.targetAchieved).toBe(true);
  });

  it("holds repertoire scale progress at completion until Bonus is selected", () => {
    const repertoire = PRACTICE_SESSION_BUILDER_OPTIONS[3]!.createEntry("e1");
    let state: PracticeSessionRunState = start([repertoire]);
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 11 })!;
    state = practiceSessionRunReducer(state, { type: "TARGET_REACHED", ...scope, at: 12 })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 13 })!;
    expect(state.status === "active" && state.records[0]?.actual).toBe(1);
    state = practiceSessionRunReducer(state, { type: "KEEP_PLAYING", ...scope, at: 14 })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 15 })!;
    expect(state.status === "active" && state.records[0]?.actual).toBe(2);
  });

  it("advances with a fresh record and rejects stale callbacks", () => {
    let state: PracticeSessionRunState = start([entry(0, "e1", 1), entry(2, "e2", 1)]);
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 11 })!;
    state = practiceSessionRunReducer(state, { type: "ADVANCE", ...scope, endedAt: 20, nextStartedAt: 21, nextExerciseToken: "token-2" })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 12 })!;
    expect(state.status === "active" && state.records[1]?.actual).toBe(0);
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", runId: "run", exerciseToken: "token-2", exerciseId: "e2", at: 22 })!;
    expect(state.status === "active" && state.records[1]?.actual).toBe(1);
  });

  it("scopes engine results and captures the target boundary after the completing action", () => {
    const mutable = { engine: "flashcards", schemaVersion: 1, incorrectAttempts: [], completedTargets: [{ sequence: 0, target: { id: "target", kind: "note", clef: "treble", name: { primary: "C" }, expectedPitches: [{ midiNumber: 60, name: "C", octave: 4 }] }, submittedMidiNumbers: [60], source: "midi", responseDurationMs: 500, priorIncorrectAttemptCount: 0 }] } as unknown as FlashcardPracticeResultV1;
    let state: PracticeSessionRunState = start([entry(0, "e1", 1), entry(0, "e2", 1)]);
    state = practiceSessionRunReducer(state, { type: "ENGINE_RESULT_CHANGED", ...scope, result: mutable })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 11 })!;
    expect(state.status === "active" && state.records[0]?.targetBoundaryEngineResult).toMatchObject({ completedTargets: [{ responseDurationMs: 500 }] });
    (mutable.completedTargets[0] as { responseDurationMs: number }).responseDurationMs = 999;
    expect(state.status === "active" && state.records[0]?.targetBoundaryEngineResult).toMatchObject({ completedTargets: [{ responseDurationMs: 500 }] });
    state = practiceSessionRunReducer(state, { type: "KEEP_PLAYING", ...scope, at: 12 })!;
    const bonus = { ...mutable, completedTargets: [...mutable.completedTargets, { ...mutable.completedTargets[0]!, sequence: 1, responseDurationMs: 700 }] } as FlashcardPracticeResultV1;
    state = practiceSessionRunReducer(state, { type: "ENGINE_RESULT_CHANGED", ...scope, result: bonus })!;
    expect(state.status === "active" && state.records[0]?.latestEngineResult).toMatchObject({ completedTargets: [{ responseDurationMs: 999 }, { responseDurationMs: 700 }] });
    expect(state.status === "active" && state.records[0]?.targetBoundaryEngineResult).toMatchObject({ completedTargets: [{ responseDurationMs: 500 }] });
  });

  it("ignores stale, previous-exercise, previous-run, and wrong-engine result publications", () => {
    const result = { engine: "flashcards", schemaVersion: 1, incorrectAttempts: [], completedTargets: [] } as const;
    let state: PracticeSessionRunState = start([entry(0, "e1", 1), entry(0, "e2", 1)]);
    state = practiceSessionRunReducer(state, { type: "ENGINE_RESULT_CHANGED", runId: "other", exerciseToken: "token-1", exerciseId: "e1", result })!;
    expect(state.status === "active" && state.records[0]?.latestEngineResult).toBeNull();
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 11 })!;
    state = practiceSessionRunReducer(state, { type: "ADVANCE", ...scope, endedAt: 12, nextStartedAt: 12, nextExerciseToken: "token-2" })!;
    state = practiceSessionRunReducer(state, { type: "ENGINE_RESULT_CHANGED", ...scope, result })!;
    state = practiceSessionRunReducer(state, { type: "ENGINE_RESULT_CHANGED", runId: "run", exerciseToken: "token-2", exerciseId: "e2", result: { engine: "ear-training", schemaVersion: 1, incorrectGuesses: [], completedTargets: [] } })!;
    expect(state.status === "active" && state.records[1]?.latestEngineResult).toBeNull();
    expect(state.records[0]?.latestEngineResult).toBeNull();
  });

  it("records Skip and omits exercises never entered after End", () => {
    let state: PracticeSessionRunState = start([entry(0, "e1"), entry(2, "e2"), entry(6, "e3")]);
    state = practiceSessionRunReducer(state, { type: "SKIP", ...scope, endedAt: 20, nextStartedAt: 21, nextExerciseToken: "token-2" })!;
    state = practiceSessionRunReducer(state, { type: "END", runId: "run", exerciseToken: "token-2", exerciseId: "e2", endedAt: 30 })!;
    expect(state.status).toBe("summary");
    if (state.status === "summary") expect(state.records.map(({ disposition }) => disposition)).toEqual(["skipped", "ended-before-target"]);
  });

  it("finishes the final achieved exercise naturally", () => {
    let state: PracticeSessionRunState = start([entry(0, "e1", 1)]);
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 11 })!;
    state = practiceSessionRunReducer(state, { type: "ADVANCE", ...scope, endedAt: 30 })!;
    expect(state.status === "summary" && state.endReason).toBe("completed");
    expect(state.status === "summary" && state.records[0]?.disposition).toBe("completed");
  });

  it("records an achieved exercise completed when End is chosen", () => {
    let state: PracticeSessionRunState = start([entry(0, "e1", 1), entry(2, "e2")]);
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 11 })!;
    state = practiceSessionRunReducer(state, { type: "END", ...scope, endedAt: 30 })!;
    expect(state.status === "summary" && state.endReason).toBe("ended");
    expect(state.status === "summary" && state.records.map(({ disposition }) => disposition)).toEqual(["completed"]);
  });

  it("invalidates callbacks when the run is cleared", () => {
    const state = start([entry(0, "e1")]);
    const cleared = practiceSessionRunReducer(state, { type: "CLEAR_RUN" });
    expect(cleared).toBeNull();
    expect(practiceSessionRunReducer(cleared, { type: "UNIT_COMPLETED", ...scope, at: 20 })).toBeNull();
  });

  it("rejects callbacks from an ended run and from another run", () => {
    let state: PracticeSessionRunState = start([entry(0, "e1")]);
    state = practiceSessionRunReducer(state, { type: "END", ...scope, endedAt: 20 })!;
    expect(practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 21 })).toBe(state);
    const next = start([entry(0, "e1")], "new-run");
    expect(practiceSessionRunReducer(next, { type: "UNIT_COMPLETED", ...scope, at: 21 })).toBe(next);
  });

  it("records ordered lifecycle evidence and separates prescribed from foreground Bonus time", () => {
    let state: PracticeSessionRunState = start([entry(0, "e1", 2)]);
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 15 })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 20 })!;
    state = practiceSessionRunReducer(state, { type: "VISIBILITY_CHANGED", ...scope, at: 25, foreground: false })!;
    state = practiceSessionRunReducer(state, { type: "VISIBILITY_CHANGED", ...scope, at: 40, foreground: true })!;
    state = practiceSessionRunReducer(state, { type: "KEEP_PLAYING", ...scope, at: 50 })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 55 })!;
    state = practiceSessionRunReducer(state, { type: "VISIBILITY_CHANGED", ...scope, at: 60, foreground: false })!;
    state = practiceSessionRunReducer(state, { type: "VISIBILITY_CHANGED", ...scope, at: 100, foreground: true })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 105 })!;
    state = practiceSessionRunReducer(state, { type: "ADVANCE", ...scope, endedAt: 110 })!;
    expect(state.status).toBe("summary");
    if (state.status !== "summary") return;
    expect(state.records[0]).toMatchObject({ prescribedUnitsCompleted: 2, bonusUnitsCompleted: 2, actual: 4, targetAchieved: true, bonusUsed: true, disposition: "completed" });
    expect(state.records[0]?.prescribedTime.accumulatedMs).toBe(10);
    expect(state.records[0]?.bonusTime.accumulatedMs).toBe(20);
    expect(state.evidence.map(({ sequence, type }) => [sequence, type])).toEqual([
      [0, "exercise-entered"], [1, "unit-completed"], [2, "unit-completed"], [3, "target-reached"],
      [4, "bonus-started"], [5, "unit-completed"], [6, "unit-completed"], [7, "exercise-ended"], [8, "session-ended"],
    ]);
  });

  it("excludes hidden prescribed time and never resumes target-complete timing", () => {
    let state: PracticeSessionRunState = start([entry(0, "e1", 1)]);
    state = practiceSessionRunReducer(state, { type: "VISIBILITY_CHANGED", ...scope, at: 15, foreground: false })!;
    state = practiceSessionRunReducer(state, { type: "VISIBILITY_CHANGED", ...scope, at: 30, foreground: true })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 35 })!;
    state = practiceSessionRunReducer(state, { type: "VISIBILITY_CHANGED", ...scope, at: 40, foreground: false })!;
    state = practiceSessionRunReducer(state, { type: "VISIBILITY_CHANGED", ...scope, at: 70, foreground: true })!;
    state = practiceSessionRunReducer(state, { type: "END", ...scope, endedAt: 100 })!;
    expect(state.status === "summary" && state.records[0]?.prescribedTime.accumulatedMs).toBe(10);
  });

  it("stops Skip and End timing and cannot accept stale evidence afterward", () => {
    let state: PracticeSessionRunState = start([entry(0, "e1"), entry(2, "e2")]);
    state = practiceSessionRunReducer(state, { type: "SKIP", ...scope, endedAt: 20, nextStartedAt: 30, nextExerciseToken: "token-2" })!;
    const stale = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope, at: 40 })!;
    expect(stale).toBe(state);
    state = practiceSessionRunReducer(stale, { type: "END", runId: "run", exerciseToken: "token-2", exerciseId: "e2", endedAt: 50 })!;
    expect(state.status).toBe("summary");
    if (state.status !== "summary") return;
    expect(state.records.map(({ disposition, prescribedTime }) => [disposition, prescribedTime.accumulatedMs])).toEqual([["skipped", 10], ["ended-before-target", 20]]);
    const frozen = practiceSessionRunReducer(state, { type: "VISIBILITY_CHANGED", runId: "run", exerciseToken: "token-2", exerciseId: "e2", at: 100, foreground: true });
    expect(frozen).toBe(state);
  });
});
