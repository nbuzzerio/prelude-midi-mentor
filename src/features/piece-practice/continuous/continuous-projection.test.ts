import { describe, expect, it } from "vitest";
import { CONTINUOUS_POLICY, projectContinuousPassage } from "./continuous-projection";
import { measure, note, testScore } from "./continuous-test-fixtures";

describe("continuous canonical passage projection", () => {
  it.each([["3/4", 3000, 3, 1000], ["4/4", 4000, 4, 1000], ["6/8", 3000, 2, 1500]] as const)("uses exact %s capacity and pulse", (meter, barMs, count, pulseMs) => {
    const p = projectContinuousPassage(testScore(meter), 0, 1, 60);
    expect(p).toMatchObject({ measureMs: barMs, durationMs: 2 * barMs, pulsesPerBar: count, pulseMs });
    expect(p.expected.map((e) => e.timeMs)).toEqual([0, barMs]);
  });
  it.each([1, 2, 3, 4])("projects %i complete measures with original identities", (bars) => {
    const source = testScore("4/4", 8);
    const p = projectContinuousPassage(source, 3, 3 + bars - 1, 120);
    expect(p.durationMs).toBe(bars * 2000);
    expect(p.expected[0]!.target.sourceMeasureId).toBe("m3");
    expect(p.expected[0]!.target.sourceEventIds).toEqual(["n3"]);
    expect(p.expected[0]!.timeMs).toBe(0);
  });
  it.each([[0, 4, 60], [-1, 0, 60], [0, 9, 60], [1, 0, 60], [0, 1, 39], [0, 1, 121], [0, 1, 60.5]])("rejects invalid range/tempo %s %s %s", (start, end, bpm) => {
    expect(() => projectContinuousPassage(testScore(), start, end, bpm)).toThrow();
  });
  it("detaches and deeply freezes source music and policy", () => {
    const source = testScore();
    const policy = { ...CONTINUOUS_POLICY };
    const p = projectContinuousPassage(source, 1, 1, 60, policy);
    expect(p.score).toEqual(source);
    expect(p.score).not.toBe(source);
    expect(Object.isFrozen(p.score.measures[0]!.events)).toBe(true);
    expect(Object.isFrozen(source)).toBe(false);
    Object.assign(source, { measures: [] });
    policy.associationCapMs = 1;
    expect(p.score.measures).toHaveLength(2);
    expect(p.policy.associationCapMs).toBe(400);
  });
  it("retains inherited key, meter, clefs and the complete source context", () => {
    const source = testScore();
    const withContext = { ...source, measures: [{ ...source.measures[0]!, keySignatureChange: "g-major" as const, clefChanges: { treble: "bass" as const } }, source.measures[1]!] };
    const p = projectContinuousPassage(withContext, 1, 1, 80);
    expect(p.expected[0]!.target.measureIndex).toBe(1);
    expect(p.score.measures[0]).toMatchObject({ keySignatureChange: "g-major", clefChanges: { treble: "bass" } });
  });
  it("omits internal cross-measure tie continuations and rejects an incoming boundary tie", () => {
    const source = { ...testScore(), measures: [measure("m0", [note("a", 0, 60, "whole")]), measure("m1", [note("b", 0, 60, "whole")])],
      ties: [{ id: "tie", fromEventId: "a", fromPitchId: "a-p", toEventId: "b", toPitchId: "b-p" }] };
    const p = projectContinuousPassage(source, 0, 1, 60);
    expect(p.expected).toHaveLength(1);
    expect(p.score.ties).toEqual(source.ties);
    expect(() => projectContinuousPassage(source, 1, 1, 60)).toThrow(/incoming tie/);
    expect(projectContinuousPassage(source, 0, 0, 60).score.ties).toHaveLength(1);
  });
  it("groups simultaneous cross-staff pitches and collapses physically unobservable unisons", () => {
    const source = { ...testScore(), measures: [measure("m0", [note("u"), note("l", 0, 60, "quarter", "bass")])] };
    const e = projectContinuousPassage(source, 0, 0, 60).expected[0]!;
    expect(e.target.attackedPitches).toHaveLength(2);
    expect(e.target.expectedMidiNumbers).toEqual([60]);
    expect(e.target.sourceEventIds).toEqual(["l", "u"]);
  });
  it("uses adjacent onset gaps at boundaries and compound pulse for isolated 6/8 notes", () => {
    const isolated = projectContinuousPassage(testScore("6/8", 1), 0, 0, 120).expected[0]!;
    expect(isolated).toMatchObject({ associationMs: 375, onTimeMs: 150 });
    const source = { ...testScore(), measures: [measure("m", [note("a", 0, 60, "sixteenth"), note("b", 120, 62, "sixteenth"), note("c", 240, 64, "eighth")])] };
    const p = projectContinuousPassage(source, 0, 0, 120);
    expect(p.expected.map((e) => e.associationMs)).toEqual([56.25, 56.25, 56.25]);
    expect(p.expected.map((e) => e.onTimeMs)).toEqual([50, 50, 50]);
  });
  it("allows silence and rests without creating expected attacks", () => {
    const p = projectContinuousPassage({ ...testScore(), measures: [measure("silent")] }, 0, 0, 40);
    expect(p.expected).toEqual([]);
    expect(p.durationMs).toBe(6000);
  });
  it("rejects unsupported meter, meter changes, unresolved rhythm and rolled chords", () => {
    expect(() => projectContinuousPassage(testScore("2/4"), 0, 0, 60)).toThrow(/3\/4/);
    const source = testScore();
    expect(() => projectContinuousPassage({ ...source, measures: [source.measures[0], { ...measure("m1", [], "3/4"), timeSignatureChange: "3/4" }] }, 0, 1, 60)).toThrow(/constant meter/);
    expect(() => projectContinuousPassage({ ...source, measures: [measure("m", [{ ...note("n"), rhythm: { status: "unresolved" } }])] }, 0, 0, 60)).toThrow(/validation/);
    const chord = note("n");
    expect(() => projectContinuousPassage({ ...source, measures: [measure("m", [{ ...chord, pitches: [...chord.pitches, ...note("e", 0, 64).pitches], arpeggiation: "up" }])] }, 0, 0, 60)).toThrow(/Rolled/);
  });
  it("rejects unsupported or overlapping policy windows", () => {
    expect(() => projectContinuousPassage(testScore(), 0, 0, 60, { ...CONTINUOUS_POLICY, associationGap: 0.6 })).toThrow(/policy/);
  });
});
