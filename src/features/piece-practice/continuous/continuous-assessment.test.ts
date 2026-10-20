import { describe, expect, it } from "vitest";
import { assessContinuous } from "./continuous-assessment";
import { projectContinuousPassage } from "./continuous-projection";
import { attack, measure, note, testScore } from "./continuous-test-fixtures";

const single = () => projectContinuousPassage({ ...testScore(), measures: [measure("m", [note("n", 480)])] }, 0, 0, 60);
describe("continuous deterministic onset assessment", () => {
  it.each([[1000, "on-time"], [800, "early"], [1200, "late"]])("classifies correct pitch at %i as %s", (ms, timing) => {
    const r = assessContinuous(single(), [attack(1, 60, Number(ms))]);
    expect(r).toMatchObject({ matched: 1, wrong: 0, missing: 0 });
    expect(r.groups[0]!.pitches[0]!.timing).toBe(timing);
  });
  it("reports pitch correctness separately from timing uncertainty", () => {
    for (const a of [attack(1, 60, 1150), attack(1, 60, 1200, null)]) {
      expect(assessContinuous(single(), [a])).toMatchObject({ matched: 1, uncertain: 1, wrong: 0 });
    }
  });
  it("distinguishes wrong, missing and unmatched extra attacks", () => {
    expect(assessContinuous(single(), [attack(1, 61, 1000)])).toMatchObject({ wrong: 1, missing: 0, matched: 0, extras: [] });
    expect(assessContinuous(single(), [])).toMatchObject({ wrong: 0, missing: 1 });
    expect(assessContinuous(single(), [attack(1, 61, 2000)])).toMatchObject({ wrong: 0, missing: 1, extras: [1] });
  });
  it("matches correct pitches before earlier wrong candidates", () => {
    const r = assessContinuous(single(), [attack(1, 61, 1000), attack(2, 60, 1010)]);
    expect(r).toMatchObject({ matched: 1, wrong: 0, extras: [1] });
    expect(r.groups[0]!.pitches[0]!.attackId).toBe(2);
  });
  it("reports partial and complete block chords across both staves", () => {
    const upper = note("upper"); const lower = note("lower", 0, 48, "quarter", "bass");
    const p = projectContinuousPassage({ ...testScore(), measures: [measure("m", [upper, lower])] }, 0, 0, 60);
    const partial = assessContinuous(p, [attack(1, 60, 0)]);
    expect(partial).toMatchObject({ expected: 2, matched: 1, missing: 1 });
    expect(partial.groups[0]!.partialChord).toBe(true);
    const full = assessContinuous(p, [attack(1, 60, 0), attack(2, 48, 10)]);
    expect(full).toMatchObject({ matched: 2, missing: 0 });
    expect(full.groups[0]!.partialChord).toBe(false);
  });
  it("does not cascade a missed note into later fixed expectations", () => {
    const p = projectContinuousPassage({ ...testScore(), measures: [measure("m", [note("a"), note("b", 480, 62), note("c", 960, 64)])] }, 0, 0, 120);
    const r = assessContinuous(p, [attack(1, 62, 500), attack(2, 64, 1000)]);
    expect(r).toMatchObject({ matched: 2, missing: 1, wrong: 0, onTime: 2 });
    expect(r.groups.map((g) => g.timeMs)).toEqual([0, 500, 1000]);
  });
  it("requires distinct legitimate attacks for repeated pitches; a held note satisfies only once", () => {
    const p = projectContinuousPassage({ ...testScore(), measures: [measure("m", [note("a"), note("b", 480)])] }, 0, 0, 60);
    expect(assessContinuous(p, [attack(1, 60, 0)])).toMatchObject({ matched: 1, missing: 1 });
    expect(assessContinuous(p, [attack(1, 60, 0), attack(2, 60, 1000)])).toMatchObject({ matched: 2, missing: 0 });
  });
  it("does not consume one attack twice for cross-staff unisons", () => {
    const p = projectContinuousPassage({ ...testScore(), measures: [measure("m", [note("a"), note("b", 0, 60, "quarter", "bass")])] }, 0, 0, 60);
    expect(assessContinuous(p, [attack(1, 60, 0)])).toMatchObject({ expected: 1, matched: 1 });
  });
  it("reports duplicates and notes in silence as extras", () => {
    expect(assessContinuous(single(), [attack(1, 60, 1000), attack(2, 60, 1001), attack(3, 60, 3000)])).toMatchObject({ matched: 1, extras: [2, 3] });
  });
  it("breaks equal-distance ties by time then identity regardless of input order", () => {
    const a = attack(2, 60, 1010); const b = attack(1, 60, 990);
    expect(assessContinuous(single(), [a, b]).groups[0]!.pitches[0]!.attackId).toBe(1);
    expect(assessContinuous(single(), [b, a]).groups[0]!.pitches[0]!.attackId).toBe(1);
  });
  it("associates close eighth/sixteenth onsets without shifting their windows", () => {
    const p = projectContinuousPassage({ ...testScore(), measures: [measure("m", [note("a", 0, 60, "sixteenth"), note("b", 120, 62, "sixteenth"), note("c", 240, 64, "eighth")])] }, 0, 0, 120);
    expect(assessContinuous(p, [attack(1, 62, 125), attack(2, 64, 250)])).toMatchObject({ matched: 2, missing: 1, wrong: 0 });
    expect(assessContinuous(p, [attack(1, 60, 62.5)])).toMatchObject({ matched: 0, extras: [1] });
  });
  it("does not call future or partially observed windows missing after interruption", () => {
    expect(assessContinuous(single(), [], 900)).toMatchObject({ missing: 0, unobserved: 1 });
    expect(assessContinuous(single(), [], 1400)).toMatchObject({ missing: 1, unobserved: 0 });
  });
  it("includes an exact association boundary and rejects an attack just outside", () => {
    const p = single(); const e = p.expected[0]!;
    expect(assessContinuous(p, [attack(1, 60, e.timeMs + e.associationMs)])).toMatchObject({ matched: 1 });
    expect(assessContinuous(p, [attack(1, 60, e.timeMs + e.associationMs + 0.01)])).toMatchObject({ missing: 1, extras: [1] });
  });
});
