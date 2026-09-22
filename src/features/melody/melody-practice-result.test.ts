import { describe, expect, it } from "vitest";
import { appendMelodyContinuousTrialRetry, createMelodyContinuousDiagnosticTrial } from "./melody-continuous-practice";
import type { MelodyAttemptResult } from "./melody-scoring";
import type { MelodyExercise } from "./melody-types";
import { createMelodyPracticeResult, selectMelodyAttemptDiagnosticChips, selectMelodyPracticeDiagnosticChips, selectMelodyPracticeReport, selectMelodyPracticeReportPhases } from "./melody-practice-result";

describe("Melody practice result", () => {
  it("freezes the trial collection and preserves interruption without adding a score", () => {
    const result = createMelodyPracticeResult([], true);
    expect(result).toEqual({ engine: "melody", schemaVersion: 1, diagnosticTrials: [], interrupted: true });
    expect(Object.isFrozen(result.diagnosticTrials)).toBe(true);
    expect(result).not.toHaveProperty("score");
  });
  it("selects ordered trials through existing Melody diagnostic semantics", () => {
    const attempt = { attacks: [], exerciseId: "exercise", extraAttackCount: 0, extras: [], missedAttackCount: 0, movementScorePercent: null, movements: [], pitchScorePercent: 100, timingScorePercent: 90 } as MelodyAttemptResult;
    const exercise = { id: "exercise", seed: "seed" } as MelodyExercise;
    const second = createMelodyContinuousDiagnosticTrial(2, exercise, attempt);
    const first = createMelodyContinuousDiagnosticTrial(1, { ...exercise, id: "first" }, { ...attempt, exerciseId: "first" });
    const report = selectMelodyPracticeReport(createMelodyPracticeResult([second, first], true));
    expect(report.orderedTrials.map(({ originalOrder }) => originalOrder)).toEqual([1, 2]);
    expect(report.summary).toMatchObject({ trialsCompleted: 2, initiallyPitchPerfectTrials: 0 });
    expect(report).toMatchObject({ interrupted: true, hasRepairEvidence: false });
  });
  it("splits new Bonus trials and additional Repair evidence without mutating the boundary", () => {
    const attempt = { attacks: [], exerciseId: "exercise", extraAttackCount: 0, extras: [], missedAttackCount: 0, movementScorePercent: null, movements: [], pitchScorePercent: 80, timingScorePercent: 90 } as MelodyAttemptResult;
    const exercise = { id: "exercise", seed: "seed" } as MelodyExercise;
    const first = createMelodyContinuousDiagnosticTrial(1, exercise, attempt);
    const boundary = createMelodyPracticeResult([first]);
    const before = JSON.stringify(boundary);
    const retried = appendMelodyContinuousTrialRetry(boundary.diagnosticTrials, first.id, { ...attempt, pitchScorePercent: 100 });
    const second = createMelodyContinuousDiagnosticTrial(2, { ...exercise, id: "second" }, { ...attempt, exerciseId: "second" });
    const final = createMelodyPracticeResult([...retried, second]);
    const phases = selectMelodyPracticeReportPhases(boundary, final);
    expect(phases.prescribed?.summary.trialsCompleted).toBe(1);
    expect(phases.bonus?.newDiagnosticEvidence?.summary.trialsCompleted).toBe(1);
    expect(phases.bonus?.additionalRepairRetries).toBe(1);
    expect(selectMelodyPracticeReportPhases(final, final).bonus).toBeNull();
    expect(JSON.stringify(boundary)).toBe(before);
  });

  it("derives distinct pitch evidence, neutral metrics, and Repair retries without thresholds", () => {
    const attempt = {
      attacks: [{ status: "wrong-pitch" }], exerciseId: "exercise", extraAttackCount: 0, extras: [], missedAttackCount: 0,
      movementScorePercent: 76, movements: [], pitchScorePercent: 82, timingScorePercent: 71,
    } as unknown as MelodyAttemptResult;
    const attemptChips = selectMelodyAttemptDiagnosticChips(attempt);
    expect(attemptChips.map(({ id, kind, value }) => [id, kind, value])).toEqual([
      ["pitch-problem", "problem", undefined], ["melody-pitch-metric", "metric", "82%"],
      ["melody-movement-metric", "metric", "76%"], ["melody-timing-metric", "metric", "71%"],
    ]);
    expect(selectMelodyAttemptDiagnosticChips({ ...attempt, attacks: [], movementScorePercent: null }).map(({ id }) => id))
      .toEqual(["melody-pitch-metric", "melody-timing-metric"]);
    const exercise = { id: "exercise", seed: "seed" } as MelodyExercise;
    const trial = createMelodyContinuousDiagnosticTrial(1, exercise, attempt);
    const retried = appendMelodyContinuousTrialRetry([trial], trial.id, { ...attempt, pitchScorePercent: 100 });
    const report = selectMelodyPracticeReport(createMelodyPracticeResult(retried));
    expect(selectMelodyPracticeDiagnosticChips(report).find(({ id }) => id === "retried")?.count).toBe(1);
    expect(selectMelodyPracticeDiagnosticChips(report).some(({ accessibleText }) => /bad|warning|failed/i.test(accessibleText))).toBe(false);
  });
});
