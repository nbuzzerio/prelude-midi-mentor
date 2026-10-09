import { describe, expect, it } from "vitest";
import { CALIBRATION_POLICY, VIOLIN_REFERENCES, type CalibrationSample } from "./calibration-types";
import { createCalibrationStability } from "./pitch-stability";

function stream() {
  const collector = createCalibrationStability(VIOLIN_REFERENCES[0]);
  let at = 0, sequence = 0;
  const frame = (cents: number | null, step = 33, level = cents === null ? -80 : -20) => {
    at += step;
    const sample: CalibrationSample = { id: `o-${sequence++}`, envelope: {
      observedAtMs: at, audioSeconds: at / 1000, captureGeneration: 1,
      snapshot: { state: "acquiring", pitch: null, fresh: false, ageMs: null },
      observation: { frequencyHz: cents === null ? null : VIOLIN_REFERENCES[0].frequencyHz * 2 ** (cents / 1200),
        reason: cents === null ? "quiet" : "usable", quality: cents === null ? 0 : 0.97, levelDbfs: level },
    } };
    return collector.update(sample);
  };
  return { collector, frame, now: () => at };
}
describe("beginner short-note calibration", () => {
  it("accepts a short decaying G3 candidate despite tracker acquisition", () => {
    const s = stream(); let result;
    for (let i = 0; i < 6; i++) result = s.frame([3, -2, 1, 2, -1, 1][i], [31, 35, 34, 37, 32, 35][i], -12 - i * 4);
    expect(s.now()).toBeLessThan(300);
    expect(result).toMatchObject({ status: "valid", tuning: "within-band", sampleCount: 4 });
    expect(result!.coverageMs).toBeGreaterThanOrEqual(90);
    expect(result!.coverageMs).toBeLessThan(300);
    expect(result!.samples[0].envelope.observedAtMs).toBeGreaterThan(50);
  });
  it("never accepts an isolated frame or the noisy beginning of a candidate", () => {
    const s = stream();
    expect(s.frame(0).status).toBe("insufficient");
    expect(s.frame(0).status).toBe("insufficient");
    expect(s.frame(30).status).toBe("insufficient");
    expect(s.frame(null).status).toBe("insufficient");
    expect(s.collector.progress(s.now()).sampleCount).toBe(1);
  });
  it("combines compatible useful ringing across repeated short candidates, excluding the silent gap", () => {
    const s = stream();
    for (let i = 0; i < 4; i++) s.frame(2);
    s.frame(null, 300);
    let result;
    for (let i = 0; i < 5; i++) result = s.frame(3);
    expect(result).toMatchObject({ status: "valid", sampleCount: 5 });
    expect(result!.coverageMs).toBe(99);
    expect(result!.endMs! - result!.startMs!).toBeGreaterThan(300);
  });
  it("separates a material tuning adjustment instead of averaging old yellow with new green", () => {
    const s = stream(); let result;
    for (let i = 0; i < 6; i++) result = s.frame(22);
    expect(result?.tuning).toBe("near-target");
    s.frame(null);
    for (let i = 0; i < 6; i++) result = s.frame(-5);
    expect(result).toMatchObject({ status: "valid", tuning: "within-band", sampleCount: 4 });
    expect(result!.cents).toBeCloseTo(-5);
    expect(result!.samples.every((e) => Math.abs(1200 * Math.log2(e.envelope.observation.frequencyHz! / VIOLIN_REFERENCES[0].frequencyHz) + 5) < 1)).toBe(true);
  });
  it("rejects incompatible alternation even if one cluster appears green", () => {
    const s = stream();
    for (let i = 0; i < 30; i++) expect(s.frame(i % 2 ? -18 : 18).status).not.toBe("valid");
    expect(s.collector.progress(s.now()).blocker).toBe("spread");
  });
  it("does not count an octave glitch as an agreeing fundamental observation", () => {
    const s = stream();
    for (let i = 0; i < 4; i++) s.frame(0);
    expect(s.frame(1200).status).toBe("ambiguous");
    const result = s.frame(0);
    expect(result.status).toBe("insufficient");
    expect(result.sampleCount).toBe(3);
  });
  it.each([[5, "within-band"], [-5, "within-band"], [10, "within-band"], [-10, "within-band"], [10.01, "near-target"], [-10.01, "near-target"], [25, "near-target"], [-25, "near-target"], [25.01, "needs-adjustment"], [-25.01, "needs-adjustment"]] as const)("uses the beginner %s-cent boundary", (cents, tuning) => {
    const s = stream(); let result;
    for (let i = 0; i < 6; i++) result = s.frame(cents);
    expect(result?.tuning).toBe(tuning);
  });
  it("bounds retained evidence by age and count", () => {
    const s = stream();
    for (let i = 0; i < 100; i++) s.frame(22);
    expect(s.collector.progress(s.now()).sampleCount).toBe(CALIBRATION_POLICY.maximumSamples);
    expect(s.collector.progress(s.now() + 3001).sampleCount).toBe(0);
    s.frame(null, 3001);
    expect(s.collector.progress(s.now()).sampleCount).toBe(0);
    s.frame(0); s.frame(0); s.frame(0);
    expect(s.collector.progress(s.now()).sampleCount).toBe(1);
  });
});
