import { describe, expect, it } from "vitest";
import { createCalibrationStability, quantile } from "./pitch-stability";
import { VIOLIN_REFERENCES, type CalibrationSample } from "./calibration-types";
import { advanceCalibration, assessCalibration, createCalibrationSession } from "./calibration-session";
import { baselineRelativePitch } from "./instrument-interpretation";

export function sample(at: number, cents = 0): CalibrationSample {
  const hz = VIOLIN_REFERENCES[0].frequencyHz * 2 ** (cents / 1200);
  return { id: `o-${at}`, envelope: { observation: { frequencyHz: hz, quality: 0.99, levelDbfs: -20, reason: "usable" },
    snapshot: { state: "stable", fresh: true, ageMs: 0, pitch: { frequencyHz: VIOLIN_REFERENCES[0].frequencyHz, semitone: 55 } },
    observedAtMs: at, audioSeconds: at / 1000, captureGeneration: 1 } };
}
function measure(cents: (at: number) => number, step = 40) {
  const tracker = createCalibrationStability(VIOLIN_REFERENCES[0]);
  let result = tracker.update(sample(0));
  for (let at = step; at <= 1200; at += step) result = tracker.update(sample(at, cents(at)));
  return result;
}
describe("provisional raw violin stability", () => {
  it.each([[0, "within-band"], [5, "within-band"], [-5, "within-band"], [5.01, "near-target"],
    [15, "near-target"], [-15, "near-target"], [15.01, "needs-adjustment"], [50, "needs-adjustment"]])("assesses %s cents", (cents, tuning) => {
    const result = measure(() => Number(cents));
    expect(result.status).toBe("valid"); expect(result.tuning).toBe(tuning);
    expect(result.cents).toBeCloseTo(Number(cents), 8); expect(result.samples.length).toBeGreaterThanOrEqual(20);
  });
  it("uses raw frequency rather than the perfectly centered smoothed pitch", () => {
    expect(measure(() => -7).cents).toBeCloseTo(-7); expect(measure(() => -7).madCents).toBeCloseTo(0);
  });
  it("rejects slow drift and vibrato-like spread", () => {
    expect(measure((at) => at * 0.02).stable).toBe(false);
    expect(measure((at) => 20 * Math.sin(at / 80)).stable).toBe(false);
  });
  it("accepts exact 10-cent spread and 5-cent half-window drift, rejecting wider motion", () => {
    expect(measure((at) => at % 80 ? 5 : -5).stable).toBe(true);
    expect(measure((at) => at % 80 ? 5.01 : -5.01).stable).toBe(false);
    expect(measure((at) => at < 800 ? 0 : 5).stable).toBe(true);
    expect(measure((at) => at < 800 ? 0 : 5.01).stable).toBe(false);
  });
  it("uses robust center/spread for an isolated modest excursion", () => {
    const result = measure((at) => at === 800 ? 20 : 0);
    expect(result.stable).toBe(true); expect(result.cents).toBeCloseTo(0);
  });
  it("needs both settling and 800 ms of evidence", () => {
    const tracker = createCalibrationStability(VIOLIN_REFERENCES[0]);
    for (let at = 0; at < 1000; at += 40) expect(tracker.update(sample(at)).status).toBe("insufficient");
    expect(tracker.update(sample(1000)).status).toBe("valid");
  });
  it("requires at least 20 samples even when duration suffices", () => expect(measure(() => 0, 80).status).toBe("insufficient"));
  it("supports irregular cadence with one boundary sample", () => {
    const tracker = createCalibrationStability(VIOLIN_REFERENCES[0]); let at = 0;
    let result = tracker.update(sample(at));
    for (let i = 0; i < 40; i++) { at += i % 2 ? 31 : 39; result = tracker.update(sample(at)); }
    expect(result.status).toBe("valid"); expect(result.coverageMs).toBeGreaterThanOrEqual(800);
  });
  it.each(["gap", "stalled", "reversed", "generation", "quiet", "stale", "low-quality"])("invalidates %s evidence", (kind) => {
    const tracker = createCalibrationStability(VIOLIN_REFERENCES[0]);
    for (let at = 0; at <= 1000; at += 40) tracker.update(sample(at));
    const next = sample(kind === "gap" ? 1200 : kind === "reversed" ? 900 : 1040);
    const envelope = { ...next.envelope };
    if (kind === "stalled") envelope.audioSeconds = 1;
    if (kind === "generation") envelope.captureGeneration = 2;
    if (kind === "quiet") envelope.observation = { ...envelope.observation, reason: "quiet", frequencyHz: null };
    if (kind === "stale") envelope.snapshot = { ...envelope.snapshot, fresh: false };
    if (kind === "low-quality") envelope.observation = { ...envelope.observation, quality: 0.5 };
    expect(tracker.update({ ...next, envelope }).status).toBe("insufficient");
  });
  it.each([1200, 1901.955, 2400, 80])("never creates a baseline from displaced %s cents", (cents) => {
    const result = measure(() => cents); expect(result.status).toBe("ambiguous"); expect(result.samples).toHaveLength(0);
    expect(result.cents).toBeCloseTo(cents);
  });
  it("rejects a below-range sub-octave rather than supplying a baseline", () => expect(measure(() => -1200).status).toBe("insufficient"));
  it("defines quantiles by interpolated sorted rank", () => {
    expect(quantile([0, 10, 20], 0.1)).toBe(2); expect(quantile([0, 10, 20], 0.9)).toBe(18);
  });
});
describe("calibration transitions and conditional interpretation", () => {
  it("retains retries with new revisions and advances G D A E", () => {
    let state = assessCalibration(createCalibrationSession("c"), measure(() => -7));
    expect(advanceCalibration(state, "automatic")).toBe(state);
    state = advanceCalibration(state, "retry"); expect(state.revision).toBe(2); expect(state.attempts[0].measurement.cents).toBeCloseTo(-7);
    state = advanceCalibration(assessCalibration(state, measure(() => -7)), "continue");
    expect(state.attempts[1].disposition).toBe("continued-with-warning");
    expect(VIOLIN_REFERENCES[state.referenceIndex].note).toBe("D4");
    state = advanceCalibration(state, "skip"); state = advanceCalibration(state, "skip"); state = advanceCalibration(state, "skip");
    expect(state.phase).toBe("summary"); expect(state.attempts.slice(1).map((attempt) => attempt.reference.note)).toEqual(["G3", "D4", "A4", "E5"]);
  });
  it("only green allows automatic progression", () => {
    const state = assessCalibration(createCalibrationSession("c"), measure(() => 0));
    expect(advanceCalibration(state, "automatic").referenceIndex).toBe(1);
  });
  it("does not label unknown strings or baseline residuals as accurate concert pitch", () => {
    expect(baselineRelativePitch(-7, null)).toBeNull();
    const result = baselineRelativePitch(-7, { stringId: "D", cents: -7, revision: 2,
      provenance: { kind: "user-selected", source: "intended-string", version: 1, evidenceIds: [], calibrationRevision: 2, assumptions: ["Actual string unknown"] } });
    expect(result?.absoluteCents).toBe(-7); expect(result?.residualCents).toBe(0);
  });
});
