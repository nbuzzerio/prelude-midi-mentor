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
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope })!;
    expect(state.status === "active" && state.records[0]?.targetAchieved).toBe(false);
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope })!;
    expect(state.status === "active" && state.completionPresentation).toBe("target-complete");
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope })!;
    expect(state.status === "active" && state.records[0]?.actual).toBe(2);
    state = practiceSessionRunReducer(state, { type: "KEEP_PLAYING", ...scope })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope })!;
    expect(state.status === "active" && state.records[0]?.actual).toBe(3);
    expect(state.status === "active" && state.completionPresentation).toBe("bonus");
  });

  it("holds numeric actual at target until Bonus is selected", () => {
    let state: PracticeSessionRunState = start([entry(0, "e1", 1)]);
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope })!;
    expect(state.status === "active" && state.records[0]?.actual).toBe(1);
    expect(state.status === "active" && state.records[0]?.bonusUsed).toBe(false);
    expect(state.status === "active" && state.completionPresentation).toBe("target-complete");
    state = practiceSessionRunReducer(state, { type: "KEEP_PLAYING", ...scope })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope })!;
    expect(state.status === "active" && state.records[0]?.actual).toBe(2);
  });

  it("uses the repertoire event as authority and retains the final scale unit", () => {
    const repertoire = PRACTICE_SESSION_BUILDER_OPTIONS[3]!.createEntry("e1");
    let state: PracticeSessionRunState = start([repertoire]);
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope })!;
    expect(state.status === "active" && state.records[0]?.targetAchieved).toBe(false);
    state = practiceSessionRunReducer(state, { type: "TARGET_REACHED", ...scope })!;
    expect(state.status === "active" && state.records[0]?.actual).toBe(1);
    expect(state.status === "active" && state.records[0]?.targetAchieved).toBe(true);
  });

  it("holds repertoire scale progress at completion until Bonus is selected", () => {
    const repertoire = PRACTICE_SESSION_BUILDER_OPTIONS[3]!.createEntry("e1");
    let state: PracticeSessionRunState = start([repertoire]);
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope })!;
    state = practiceSessionRunReducer(state, { type: "TARGET_REACHED", ...scope })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope })!;
    expect(state.status === "active" && state.records[0]?.actual).toBe(1);
    state = practiceSessionRunReducer(state, { type: "KEEP_PLAYING", ...scope })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope })!;
    expect(state.status === "active" && state.records[0]?.actual).toBe(2);
  });

  it("advances with a fresh record and rejects stale callbacks", () => {
    let state: PracticeSessionRunState = start([entry(0, "e1", 1), entry(2, "e2", 1)]);
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope })!;
    state = practiceSessionRunReducer(state, { type: "ADVANCE", ...scope, endedAt: 20, nextStartedAt: 21, nextExerciseToken: "token-2" })!;
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope })!;
    expect(state.status === "active" && state.records[1]?.actual).toBe(0);
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", runId: "run", exerciseToken: "token-2", exerciseId: "e2" })!;
    expect(state.status === "active" && state.records[1]?.actual).toBe(1);
  });

  it("records Skip and omits exercises never entered after End", () => {
    let state: PracticeSessionRunState = start([entry(0, "e1"), entry(2, "e2"), entry(6, "e3")]);
    state = practiceSessionRunReducer(state, { type: "SKIP", ...scope, endedAt: 20, nextStartedAt: 21, nextExerciseToken: "token-2" })!;
    state = practiceSessionRunReducer(state, { type: "END", runId: "run", exerciseToken: "token-2", exerciseId: "e2", endedAt: 30 })!;
    expect(state.status).toBe("summary");
    if (state.status === "summary") expect(state.records.map(({ disposition }) => disposition)).toEqual(["skipped", "not-reached"]);
  });

  it("finishes the final achieved exercise naturally", () => {
    let state: PracticeSessionRunState = start([entry(0, "e1", 1)]);
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope })!;
    state = practiceSessionRunReducer(state, { type: "ADVANCE", ...scope, endedAt: 30 })!;
    expect(state.status === "summary" && state.endReason).toBe("completed");
    expect(state.status === "summary" && state.records[0]?.disposition).toBe("completed");
  });

  it("records an achieved exercise completed when End is chosen", () => {
    let state: PracticeSessionRunState = start([entry(0, "e1", 1), entry(2, "e2")]);
    state = practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope })!;
    state = practiceSessionRunReducer(state, { type: "END", ...scope, endedAt: 30 })!;
    expect(state.status === "summary" && state.endReason).toBe("ended");
    expect(state.status === "summary" && state.records.map(({ disposition }) => disposition)).toEqual(["completed"]);
  });

  it("invalidates callbacks when the run is cleared", () => {
    const state = start([entry(0, "e1")]);
    const cleared = practiceSessionRunReducer(state, { type: "CLEAR_RUN" });
    expect(cleared).toBeNull();
    expect(practiceSessionRunReducer(cleared, { type: "UNIT_COMPLETED", ...scope })).toBeNull();
  });

  it("rejects callbacks from an ended run and from another run", () => {
    let state: PracticeSessionRunState = start([entry(0, "e1")]);
    state = practiceSessionRunReducer(state, { type: "END", ...scope, endedAt: 20 })!;
    expect(practiceSessionRunReducer(state, { type: "UNIT_COMPLETED", ...scope })).toBe(state);
    const next = start([entry(0, "e1")], "new-run");
    expect(practiceSessionRunReducer(next, { type: "UNIT_COMPLETED", ...scope })).toBe(next);
  });
});
