import { describe, expect, it } from "vitest";
import { assessContinuous } from "./continuous-assessment";
import { projectContinuousPassage } from "./continuous-projection";
import { continuousStore, validateContinuousAttempt, validateContinuousReplacement } from "./continuous-store";
import { attack, TEST_DATE, TEST_INPUT, testScore } from "./continuous-test-fixtures";
import type { ContinuousAttempt } from "./continuous-types";

function record(): ContinuousAttempt {
  const passage = projectContinuousPassage(testScore(), 0, 1, 60);
  const attacks = [attack(1, 60, 0)];
  return { version: 1, id: "attempt", revision: 1, passage, input: TEST_INPUT, status: "completed", startedAt: TEST_DATE,
    endedAt: TEST_DATE, performanceStartedAt: TEST_DATE, observedThroughMs: passage.durationMs + passage.tailMs,
    reason: null, attacks, assessment: assessContinuous(passage, attacks), terminalSaveAttempts: 1 };
}
describe("continuous attempt evidence validation", () => {
  it("round trips terminal provenance, raw attacks and associations without depending on the source library", () => {
    const r = record();
    expect(() => validateContinuousAttempt(JSON.parse(JSON.stringify(r)))).not.toThrow();
    expect(r.passage.score.measures).toHaveLength(2);
  });
  it.each(["version", "status", "endedAt", "revision", "terminalSaveAttempts"])("rejects corrupt %s", (field) => {
    expect(() => validateContinuousAttempt({ ...record(), [field]: "invalid" } as unknown as ContinuousAttempt)).toThrow();
  });
  it("rejects changed projection/policy, invented timing, invalid source and duplicate attacks", () => {
    const r = record();
    expect(() => validateContinuousAttempt({ ...r, passage: { ...r.passage, durationMs: 1 } })).toThrow(/provenance/);
    expect(() => validateContinuousAttempt({ ...r, assessment: { ...r.assessment!, matched: 99 } })).toThrow(/associations/);
    expect(() => validateContinuousAttempt({ ...r, attacks: [r.attacks[0]!, r.attacks[0]!] })).toThrow();
    expect(() => validateContinuousAttempt({ ...r, attacks: [{ ...r.attacks[0]!, input: { id: "virtual", name: "Virtual" } }] })).toThrow(/evidence/);
  });
  it("accepts acknowledged active checkpoints without manufacturing a terminal result", () => {
    const r = record();
    expect(() => validateContinuousAttempt({ ...r, status: "started", endedAt: null, assessment: null, terminalSaveAttempts: 0 })).not.toThrow();
  });
  it("rejects premature completion and evidence above bounded limits", () => {
    const r = record();
    expect(() => validateContinuousAttempt({ ...r, observedThroughMs: 1000 })).toThrow(/lifecycle/);
    expect(() => validateContinuousAttempt({ ...r, attacks: Array.from({ length: 2049 }, (_, i) => attack(i + 1, 60, 0)) })).toThrow();
  });
  it("fails closed when native IndexedDB is unavailable", async () => {
    await expect(continuousStore.save(record())).rejects.toThrow(/unavailable/);
    await expect(continuousStore.list()).rejects.toThrow(/unavailable/);
  });
  it("accepts idempotent acknowledgement and retry metadata for the same terminal evidence", () => {
    const r = record();
    expect(() => validateContinuousReplacement(r, r)).not.toThrow();
    expect(() => validateContinuousReplacement(r, { ...r, revision: 2, terminalSaveAttempts: 2 })).not.toThrow();
  });
  it("rejects stale revisions, rewritten terminal evidence and changed identity/provenance", () => {
    const r = record();
    expect(() => validateContinuousReplacement(r, { ...r, revision: 0 })).toThrow(/newer/);
    expect(() => validateContinuousReplacement(r, { ...r, revision: 2, attacks: [] })).toThrow(/Terminal/);
    expect(() => validateContinuousReplacement(r, { ...r, revision: 2, input: { ...r.input, id: "other" } })).toThrow(/identity/);
  });
});
