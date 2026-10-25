import { describe, expect, it } from "vitest";
import { admitContinuousPassage, continuousBudget, continuousAttackBytes, continuousBytes, CONTINUOUS_MAX_RECORD_BYTES } from "./continuous-budget";
import { projectContinuousPassage } from "./continuous-projection";
import { assessContinuous } from "./continuous-assessment";
import { validateContinuousAttempt } from "./continuous-store";
import { attack, denseScore, testScore, TEST_DATE, TEST_INPUT } from "./continuous-test-fixtures";
import type { ContinuousAttempt } from "./continuous-types";

describe("long-passage evidence admission", () => {
  it.each(["3/4", "4/4", "6/8"] as const)("bounds a whole dense %s terminal assessment without changing associations", meter => {
    const p = projectContinuousPassage(denseScore(16, 2, meter), 0, 15, 40);
    const budget = admitContinuousPassage(p, TEST_INPUT);
    const attacks = p.expected.flatMap(e => e.target.expectedMidiNumbers.map(midi => ({ midi, timeMs: e.timeMs })))
      .map((a, i) => attack(i + 1, a.midi, a.timeMs));
    const assessment = assessContinuous(p, attacks);
    const r: ContinuousAttempt = { version: 1, id: "dense-16", revision: 50, passage: p, input: TEST_INPUT,
      startedAt: TEST_DATE, endedAt: TEST_DATE, performanceStartedAt: TEST_DATE, status: "completed",
      observedThroughMs: p.durationMs + p.tailMs, reason: null, attacks, assessment, terminalSaveAttempts: 1 };
    expect(assessment.matched).toBe(budget.expectedAttacks);
    expect(continuousBytes(r)).toBeLessThanOrEqual(budget.terminalBytes + attacks.reduce((n, a) => n + continuousAttackBytes(a), 0));
    expect(budget.requiredBytes).toBeLessThan(CONTINUOUS_MAX_RECORD_BYTES);
    expect(() => validateContinuousAttempt(JSON.parse(JSON.stringify(r)))).not.toThrow();
  });
  it("rejects impossible expected demand and conservatively rejects dense byte demand before Ready", () => {
    // Admission is separate from reconstruction: historical silent attempts
    // with more expected attacks still remain readable, without rewriting them.
    const p = projectContinuousPassage(denseScore(16, 4), 0, 15, 40);
    expect(continuousBudget(p, TEST_INPUT).expectedAttacks).toBe(2048);
    expect(() => admitContinuousPassage(p, TEST_INPUT)).toThrow(/2 MiB/);
    let id = 0;
    const dense = denseScore(16, 5);
    const shortenedIds = { ...dense, measures: dense.measures.map(m => ({ ...m, events: m.events.map(e => ({ ...e,
      id: `e${(id++).toString(36)}`, ...(e.kind === "notes" ? { pitches: e.pitches.map(p => ({ ...p, id: `p${(id++).toString(36)}` })) } : {}) })) })) };
    const over = projectContinuousPassage(shortenedIds, 0, 15, 40);
    expect(() => admitContinuousPassage(over, TEST_INPUT)).toThrow(/2,560.*2,048/);
  });
  it("keeps a large eligible full source and exact original range while rejecting oversized full sources", () => {
    const p = projectContinuousPassage(denseScore(512, 1, "4/4", 1920), 496, 511, 40);
    expect(p.score.measures).toHaveLength(512); expect(p.expected[0]?.target.measureIndex).toBe(496);
    expect(() => admitContinuousPassage(p, TEST_INPUT)).not.toThrow();
    expect(() => projectContinuousPassage(denseScore(1024, 1, "4/4", 1920), 0, 15, 40)).toThrow(/256 KiB/);
  });
  it("accounts for escaped Unicode device metadata and the whole source rather than just visible bars", () => {
    const p = projectContinuousPassage(denseScore(64, 1, "4/4", 480), 48, 63, 60);
    const normal = continuousBudget(p, TEST_INPUT);
    const long = continuousBudget(p, { id: "\\\"🎹".repeat(150), name: "ピアノ".repeat(300) });
    expect(long.requiredBytes).toBeGreaterThan(normal.requiredBytes + normal.expectedAttacks * 1000);
    expect(p.score.measures).toHaveLength(64);
    expect(p.expected[0]!.target.measureIndex).toBe(48);
    expect(() => admitContinuousPassage(p, { id: "x".repeat(30000), name: null })).toThrow(/shorter/);
  });
  it("enforces the actual 2 MiB record boundary independently of conservative admission", () => {
    const p = projectContinuousPassage(testScore(), 0, 1, 60);
    const r: ContinuousAttempt = { version: 1, id: "boundary", revision: 1, passage: p, input: TEST_INPUT,
      startedAt: TEST_DATE, endedAt: TEST_DATE, performanceStartedAt: TEST_DATE, status: "interrupted",
      observedThroughMs: 0, reason: "", attacks: [], assessment: assessContinuous(p, [], 0), terminalSaveAttempts: 1 };
    const atLimit = { ...r, reason: "x".repeat(CONTINUOUS_MAX_RECORD_BYTES - continuousBytes(r)) };
    expect(continuousBytes(atLimit)).toBe(CONTINUOUS_MAX_RECORD_BYTES);
    expect(() => validateContinuousAttempt(atLimit)).not.toThrow();
    expect(() => validateContinuousAttempt({ ...atLimit, reason: atLimit.reason + "x" })).toThrow(/record limit/);
  });
});
