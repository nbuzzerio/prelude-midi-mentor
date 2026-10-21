import { describe, expect, it } from "vitest";
import { attack, measure, note, testScore, TEST_INPUT } from "../continuous/continuous-test-fixtures";
import { assessContinuous } from "../continuous/continuous-assessment";
import type { ContinuousAttempt, ContinuousAttack } from "../continuous/continuous-types";
import { createEntry, editEntry, playablePassage } from "./rolodex-model";
import { summarizeAcknowledged, targetFingerprint } from "./rolodex-qualification";
import { programCalendarNow } from "../../practice-session/practice-program-attempt";
import { validateSummary } from "./rolodex-progress";

const entry = createEntry(testScore(), "piano");
const passage = playablePassage(entry);
const date = "2026-10-20T12:00:00.000Z";
function attempt(attacks: readonly ContinuousAttack[], status: ContinuousAttempt["status"] = "completed", observed = passage.durationMs + passage.tailMs): ContinuousAttempt {
  return { version: 1, id: "native", revision: 2, passage, input: TEST_INPUT, startedAt: date, endedAt: "2026-10-20T12:01:00.000Z",
    performanceStartedAt: date, status, observedThroughMs: observed, attacks, assessment: assessContinuous(passage, attacks, observed), reason: null, terminalSaveAttempts: 1 };
}
const gate = { version: 1 as const, generation: "owner", enabled: true, acceptedAt: "2026-10-19T12:00:00.000Z", inputId: TEST_INPUT.id, policy: entry.policy };
const clean = [attack(1, 60, 0), attack(2, 62, passage.measureMs)];
const summarize = (a: ContinuousAttempt, accepted: typeof gate | null = gate) => summarizeAcknowledged(entry, a, programCalendarNow(Date.parse(date)), "2026-10-20", accepted, "2026-10-20T12:01:01.000Z");

describe("qualification consumes acknowledged native evidence", () => {
  it("recognizes a complete confidently clean target without modifying A1 evidence", async () => {
    const a = attempt(clean), before = JSON.stringify(a), result = await summarize(a);
    expect(result).toMatchObject({ expected: 2, matched: 2, onTime: 2, determination: "clean", acceptance: gate, restored: false });
    expect(() => validateSummary(result)).not.toThrow(); expect(JSON.stringify(a)).toBe(before);
  });
  it.each([
    ["wrong", [attack(1, 61, 0), clean[1]!], "non-clean"],
    ["missing", [clean[1]!], "non-clean"],
    ["extra", [...clean, attack(3, 72, 2000)], "non-clean"],
    ["early", [clean[0]!, attack(2, 62, passage.measureMs - 200)], "non-clean"],
    ["late", [clean[0]!, attack(2, 62, passage.measureMs + 200)], "non-clean"],
    ["unreliable extra", [...clean, attack(3, 72, 2000, null)], "inconclusive"],
    ["uncertain", [clean[0]!, attack(2, 62, passage.measureMs, null)], "inconclusive"],
  ] as const)("keeps %s separate from clean eligibility", async (_name, attacks, result) => {
    expect((await summarize(attempt(attacks))).determination).toBe(result);
  });
  it.each(["stopped", "interrupted", "failed"] as const)("does not qualify %s evidence", async status => {
    expect((await summarize(attempt([clean[0]!], status, 300))).determination).toBe("inconclusive");
  });
  it("keeps default-off, changed device and newly enabled acceptance provisional", async () => {
    expect((await summarize(attempt(clean), null)).acceptance).toBeNull();
    expect((await summarize(attempt(clean), { ...gate, inputId: "other" })).acceptance).toBeNull();
    expect((await summarize(attempt(clean), { ...gate, acceptedAt: "2026-10-21T00:00:00.000Z" })).acceptance).toBeNull();
    expect((await summarize(attempt(clean), { ...gate, policy: { ...gate.policy, onTimeCapMs: 100 } })).acceptance).toBeNull();
  });
  it("rejects mismatched frozen tempo or invented assessment", async () => {
    await expect(summarizeAcknowledged(editEntry(entry, { bpm: 80 }), attempt(clean), null, null, gate, date)).rejects.toThrow(/prescription/);
    await expect(summarize({ ...attempt(clean), assessment: { ...attempt(clean).assessment!, onTime: 99 } })).rejects.toThrow(/associations/);
  });
  it("fingerprints identities, range, eligibility and exact policy but ignores nicknames", async () => {
    const hash = await targetFingerprint(entry);
    expect(await targetFingerprint(editEntry(entry, { nickname: "Reading" }))).toBe(hash);
    for (const changed of [editEntry(entry, { bpm: 80 }), editEntry(entry, { start: 1 }), editEntry(entry, { eligibleInstruments: ["piano", "violin"] })]) expect(await targetFingerprint(changed)).not.toBe(hash);
  });
  it("requires all distinct pitches in a chord, and never invents hand evidence", async () => {
    const chord = { ...note("chord"), pitches: [note("c", 0, 60).pitches[0]!, note("e", 0, 64).pitches[0]!] };
    const e = createEntry({ ...testScore(), measures: [measure("m0", [chord]), measure("m1")] }, "piano"), p = playablePassage(e);
    const a = { ...attempt([attack(1, 60, 0)]), passage: p, observedThroughMs: p.durationMs + p.tailMs, assessment: assessContinuous(p, [attack(1, 60, 0)]) };
    expect((await summarizeAcknowledged(e, a, null, null, null, date)).determination).toBe("non-clean");
    const attacks = [attack(1, 60, 0), attack(2, 64, 0)];
    expect((await summarizeAcknowledged(e, { ...a, attacks, assessment: assessContinuous(p, attacks) }, null, null, null, date)).determination).toBe("clean");
  });
  it("never qualifies silence or count-in-only evidence", async () => {
    const e = createEntry({ ...testScore(), measures: [measure("m0"), measure("m1")] }, "piano"), p = playablePassage(e);
    const a = { ...attempt([]), passage: p, assessment: assessContinuous(p, []) };
    expect((await summarizeAcknowledged(e, a, null, null, null, date)).determination).toBe("inconclusive");
    expect((await summarize({ ...attempt([], "stopped", 0), performanceStartedAt: null })).determination).toBe("inconclusive");
  });
});
