import { describe, expect, it } from "vitest";
import { createCalibrationStability, quantile } from "./pitch-stability";
import { PRECISE_CALIBRATION_POLICY, VIOLIN_REFERENCES, type CalibrationSample } from "./calibration-types";
import { advanceCalibration, assessCalibration, createCalibrationSession } from "./calibration-session";
import { baselineRelativePitch } from "./instrument-interpretation";

export function sample(at: number, cents = 0): CalibrationSample {
  const hz = VIOLIN_REFERENCES[0].frequencyHz * 2 ** (cents / 1200);
  return { id: `o-${at}`, envelope: { observation: { frequencyHz: hz, quality: 0.99, levelDbfs: -20, reason: "usable" },
    snapshot: { state: "stable", fresh: true, ageMs: 0, pitch: { frequencyHz: VIOLIN_REFERENCES[0].frequencyHz, semitone: 55 } },
    observedAtMs: at, audioSeconds: at / 1000, captureGeneration: 1 } };
}
function measure(cents: (at: number) => number, step = 40) {
  const tracker = createCalibrationStability(VIOLIN_REFERENCES[0], PRECISE_CALIBRATION_POLICY);
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
    const tracker = createCalibrationStability(VIOLIN_REFERENCES[0], PRECISE_CALIBRATION_POLICY);
    for (let at = 0; at < 1000; at += 40) expect(tracker.update(sample(at)).status).toBe("insufficient");
    expect(tracker.update(sample(1000)).status).toBe("valid");
  });
  it("requires at least 20 samples even when duration suffices", () => expect(measure(() => 0, 80).status).toBe("insufficient"));
  it("supports irregular cadence with one boundary sample", () => {
    const tracker = createCalibrationStability(VIOLIN_REFERENCES[0], PRECISE_CALIBRATION_POLICY); let at = 0;
    let result = tracker.update(sample(at));
    for (let i = 0; i < 40; i++) { at += i % 2 ? 31 : 39; result = tracker.update(sample(at)); }
    expect(result.status).toBe("valid"); expect(result.coverageMs).toBeGreaterThanOrEqual(800);
  });
  it.each(["gap", "stalled", "reversed", "generation", "quiet", "low-quality"])("invalidates %s evidence", (kind) => {
    const tracker = createCalibrationStability(VIOLIN_REFERENCES[0], PRECISE_CALIBRATION_POLICY);
    for (let at = 0; at <= 1000; at += 40) tracker.update(sample(at));
    const next = sample(kind === "gap" ? 1200 : kind === "reversed" ? 900 : 1040);
    const envelope = { ...next.envelope };
    if (kind === "stalled") envelope.audioSeconds = 1;
    if (kind === "generation") envelope.captureGeneration = 2;
    if (kind === "quiet") envelope.observation = { ...envelope.observation, reason: "quiet", frequencyHz: null };
    if (kind === "low-quality") envelope.observation = { ...envelope.observation, quality: 0.5 };
    expect(tracker.update({ ...next, envelope }).status).toBe("insufficient");
  });
  it.each([1200, 1901.955, 2400, 80])("never creates a baseline from displaced %s cents", (cents) => {
    const result = measure(() => cents); expect(result.status).toBe("ambiguous"); expect(result.samples).toHaveLength(0);
    expect(result.cents).toBeCloseTo(cents);
  });
  it("rejects a below-range sub-octave rather than supplying a baseline", () => expect(measure(() => -1200).status).toBe("insufficient"));
  it("uses usable raw windows even while the shared tracker is reacquiring", () => {
    const tracker = createCalibrationStability(VIOLIN_REFERENCES[0], PRECISE_CALIBRATION_POLICY);
    let result = tracker.update(sample(0));
    for (let at = 40; at <= 1400; at += 40) {
      const next = sample(at, Math.sin(at / 90));
      result = tracker.update({ ...next, envelope: { ...next.envelope, snapshot: { state: "acquiring", fresh: false, ageMs: 140, pitch: null } } });
    }
    expect(result.status).toBe("valid"); expect(result.tuning).toBe("within-band");
  });
  it("keeps useful samples after rejected frames instead of starting settling again", () => {
    const tracker = createCalibrationStability(VIOLIN_REFERENCES[0], PRECISE_CALIBRATION_POLICY);
    for (let at = 0; at <= 1200; at += 40) tracker.update(sample(at));
    const bad = sample(1240);
    expect(tracker.update({ ...bad, envelope: { ...bad.envelope, observation: { ...bad.envelope.observation, reason: "quiet", frequencyHz: null } } }).status).toBe("insufficient");
    expect(tracker.update(sample(1280)).status).toBe("valid");
  });
  it("reports only participating post-settling samples and span, retaining them through a brief dropout", () => {
    const tracker = createCalibrationStability(VIOLIN_REFERENCES[0], PRECISE_CALIBRATION_POLICY);
    for (let at = 0; at <= 720; at += 40) tracker.update(sample(at, 12));
    expect(tracker.progress(720)).toMatchObject({ sampleCount: 14, coverageMs: 520, requiredSamples: 20, requiredSpanMs: 800, blocker: "samples" });
    expect(tracker.progress(740)).toMatchObject({ sampleCount: 14, coverageMs: 520 });
    const rejected = sample(760, 12);
    tracker.update({ ...rejected, envelope: { ...rejected.envelope, observation: { frequencyHz: null, reason: "quiet", quality: 0, levelDbfs: -80 } } });
    expect(tracker.progress(760)).toMatchObject({ sampleCount: 14, coverageMs: 520, blocker: "quiet" });
    expect(tracker.progress(920)).toMatchObject({ sampleCount: 0, coverageMs: 0, resetCause: "gap" });
    tracker.update(sample(1000, 12));
    expect(tracker.progress(1000)).toMatchObject({ sampleCount: 0, coverageMs: 0, blocker: "gap" });
    tracker.reset();
    expect(tracker.progress(1000)).toMatchObject({ sampleCount: 0, coverageMs: 0, blocker: "no-observations" });
  });
  it.each([[30, 780, 20, 570, "span"], [80, 1200, 13, 960, "samples"]] as const)("separates span and sample requirements at %s ms cadence", (step, end, count, span, blocker) => {
    const tracker = createCalibrationStability(VIOLIN_REFERENCES[0], PRECISE_CALIBRATION_POLICY);
    for (let at = 0; at <= end; at += step) tracker.update(sample(at, 12));
    expect(tracker.progress(end)).toMatchObject({ sampleCount: count, coverageMs: span, blocker });
  });
  it.each(["spread", "drift"] as const)("reports an actual completed-window %s failure", (blocker) => {
    const tracker = createCalibrationStability(VIOLIN_REFERENCES[0], PRECISE_CALIBRATION_POLICY);
    for (let at = 0; at <= 1200; at += 40) tracker.update(sample(at, blocker === "spread" ? at % 80 ? 12 : -12 : at < 800 ? 0 : 6));
    expect(tracker.progress(1200)).toMatchObject({ blocker, coverageMs: 800 });
    expect(tracker.progress(1200).sampleCount).toBeGreaterThanOrEqual(20);
  });
  it("does not count a usable raw estimate outside the fundamental region or a harmonic", () => {
    const tracker = createCalibrationStability(VIOLIN_REFERENCES[0], PRECISE_CALIBRATION_POLICY);
    tracker.update(sample(0, -65));
    expect(tracker.progress(0)).toMatchObject({ sampleCount: 0, coverageMs: 0, blocker: "outside-fundamental" });
    tracker.update(sample(40, 1200));
    expect(tracker.progress(40)).toMatchObject({ sampleCount: 0, coverageMs: 0, blocker: "harmonic" });
  });
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
