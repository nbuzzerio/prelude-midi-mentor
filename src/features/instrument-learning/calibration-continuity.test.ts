import { describe, expect, it } from "vitest";
import { createCalibrationContinuity } from "./calibration-continuity";
import { PRECISE_CALIBRATION_POLICY, VIOLIN_REFERENCES, type CalibrationSample } from "./calibration-types";

function stream() {
  const tracker = createCalibrationContinuity(VIOLIN_REFERENCES[0], PRECISE_CALIBRATION_POLICY);
  let at = 0, index = 0;
  const frame = (cents: number | null, state: CalibrationSample["envelope"]["snapshot"]["state"] = "stable") => {
    at += [31, 37, 42, 34][index++ % 4];
    const hz = cents === null ? null : VIOLIN_REFERENCES[0].frequencyHz * 2 ** (cents / 1200);
    return tracker.update({ id: `o-${index}`, envelope: { observedAtMs: at, audioSeconds: at / 1000, captureGeneration: 1,
      observation: { frequencyHz: hz, reason: hz === null ? "quiet" : "usable", quality: hz === null ? 0 : 0.99, levelDbfs: hz === null ? -80 : -20 },
      snapshot: { state, fresh: state === "stable", ageMs: state === "stable" ? 0 : 140, pitch: hz === null ? null : { frequencyHz: hz, semitone: 55 } } } });
  };
  return { tracker, frame, now: () => at };
}

describe("bowed calibration continuity", () => {
  it("shows actual harmonic estimates but only explains sustained ambiguity", () => {
    const s = stream();
    for (let i = 0; i < 25; i++) { s.frame(12); s.tracker.feedback(s.now(), true); }
    expect(s.tracker.feedback(s.now(), true).status).toBe("Live");
    s.frame(1200);
    expect(s.tracker.feedback(s.now(), true)).toMatchObject({ status: "Live", frequencyHz: VIOLIN_REFERENCES[0].frequencyHz * 2 });
    expect(s.tracker.feedback(s.now(), true).ambiguity).toBeNull();
    for (let i = 0; i < 25; i++) { s.frame(12); expect(s.tracker.feedback(s.now(), true).status).not.toBe("Uncertain"); }
    for (let i = 0; i < 15; i++) { s.frame(1200); s.tracker.feedback(s.now(), true); }
    expect(s.tracker.feedback(s.now(), true)).toMatchObject({ status: "Live", ambiguity: "possible-harmonic-or-different-pitch" });
  });
  it("confirms fluctuating green with null frames, tracker reacquisition and a brief harmonic", () => {
    const s = stream();
    let confirmed = false;
    for (let i = 0; i < 110; i++) {
      s.frame(i === 45 ? 1200 : i % 13 === 0 ? null : 2 * Math.sin(i / 3), i % 13 === 1 ? "acquiring" : i % 17 === 0 ? "uncertain" : "stable");
      confirmed ||= s.tracker.confirmed(s.now());
    }
    expect(confirmed).toBe(true);
    expect(s.tracker.feedback(s.now(), true).assessment?.tuning).toBe("within-band");
  });
  it("approaches green gradually from yellow while preserving useful feedback", () => {
    const s = stream();
    for (let i = 0; i < 50; i++) s.frame(12 + Math.sin(i));
    expect(s.tracker.feedback(s.now(), true).assessment?.tuning).toBe("near-target");
    s.frame(null);
    expect(s.tracker.feedback(s.now(), true).assessment?.tuning).toBe("near-target");
    for (let i = 0; i < 90; i++) s.frame(Math.max(0, 12 - i * 0.4) + 0.8 * Math.sin(i));
    expect(s.tracker.confirmed(s.now())).toBe(true);
  });
  it("tolerates short raw excursions around the green boundary without changing the five-cent band", () => {
    const s = stream();
    let confirmed = false;
    for (let i = 0; i < 160; i++) {
      s.frame(3.5 + 2 * Math.sin(i));
      confirmed ||= s.tracker.confirmed(s.now());
    }
    expect(confirmed).toBe(true);
    expect(s.tracker.feedback(s.now(), true).assessment?.cents).toBeLessThan(5);
  });
  it.each([20, 1200])("never confirms sustained displaced pitch at %s cents", (cents) => {
    const s = stream();
    for (let i = 0; i < 150; i++) { s.frame(cents); expect(s.tracker.confirmed(s.now())).toBe(false); }
  });
  it("retains the last heard reading through silence but expires confirmation", () => {
    const s = stream();
    for (let i = 0; i < 40; i++) s.frame(0);
    const hz = s.tracker.feedback(s.now(), true).frequencyHz;
    expect(s.tracker.feedback(s.now(), true).confirming).toBe(false);
    s.frame(null);
    expect(s.tracker.feedback(s.now(), true)).toMatchObject({ frequencyHz: hz, status: "Last heard" });
    for (let i = 0; i < 40; i++) s.frame(null);
    expect(s.tracker.confirmed(s.now())).toBe(false);
    expect(s.tracker.feedback(s.now(), true)).toMatchObject({ frequencyHz: hz, confirming: false });
    s.tracker.reset();
    expect(s.tracker.feedback(s.now(), false)).toMatchObject({ frequencyHz: hz, status: "Last heard", confirming: false });
    expect(s.tracker.confirmed(s.now())).toBe(false);
  });
  it("preserves a window across one dropout but requires fresh green at the end of confirmation", () => {
    const s = stream();
    for (let i = 0; i < 60; i++) s.frame(0);
    expect(s.tracker.confirmed(s.now())).toBe(true);
    s.frame(null);
    expect(s.tracker.confirmed(s.now())).toBe(false);
    expect(s.frame(0).status).toBe("valid");
    expect(s.tracker.confirmed(s.now())).toBe(true);
    expect(s.tracker.confirmed(s.now() + 200)).toBe(false);
  });
  it("rejects sustained off-band data while retaining the last useful assessment", () => {
    const s = stream();
    for (let i = 0; i < 40; i++) s.frame(0);
    for (let i = 0; i < 60; i++) s.frame(25);
    expect(s.tracker.confirmed(s.now())).toBe(false);
    expect(s.tracker.feedback(s.now(), true).assessment?.tuning).toBe("needs-adjustment");
  });
});
