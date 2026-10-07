import { describe, expect, it } from "vitest";
import { equalTemperedFrequency } from "@/lib/audio/monophonic/pitch-math";
import { gradeAcousticPitch, reliableAcousticObservation, validPiecePracticeInputConfiguration, validPitchTolerance } from "./piece-practice-acoustic-validation";

describe("expected-relative acoustic acceptance", () => {
  it.each([0, 15, -15, 25, -25])("accepts %s cents including exact boundaries", (cents) => {
    expect(gradeAcousticPitch(440 * 2 ** (cents / 1200), 69, 25)).toMatchObject({ accepted: true, rejection: null });
  });
  it.each([25.0001, -25.0001, 43])("rejects %s cents despite the same nearest pitch", (cents) => {
    expect(gradeAcousticPitch(440 * 2 ** (cents / 1200), 69, 25)).toMatchObject({ accepted: false, rejection: "outside-tolerance" });
  });
  it.each([100, -100, 1200, -1200, 55])("rejects a different physical pitch at %s cents", (cents) => {
    expect(gradeAcousticPitch(440 * 2 ** (cents / 1200), 69, 49)).toMatchObject({ accepted: false, rejection: "wrong-pitch" });
  });
  it("accepts enharmonic frequency identity and keeps actual deviation", () => {
    const hz = equalTemperedFrequency(66) * 2 ** (31 / 1200);
    expect(gradeAcousticPitch(hz, 66, 40)).toMatchObject({ accepted: true, nearestSemitone: 66 });
    expect(gradeAcousticPitch(hz, 66, 40)?.centsFromExpected).toBeCloseTo(31, 9);
  });
  it.each([null, 0, -1, NaN, Infinity])("abstains for frequency %s", (hz) => expect(gradeAcousticPitch(hz, 69, 25)).toBeNull());
  it.each([0, 50, 100, 1.5, NaN, Infinity, "25", undefined])("rejects custom tolerance %s", (value) => {
    expect(validPitchTolerance(value)).toBe(false);
    expect(validPiecePracticeInputConfiguration({ mode: "microphone", instrument: "violin", pitchToleranceCents: value })).toBe(false);
  });
  it.each([1, 15, 25, 40, 49])("allows integer tolerance %s", (value) => expect(validPitchTolerance(value)).toBe(true));
  it("never authorizes raw evidence from retained or smoothed display pitch", () => {
    const envelope = { observedAtMs: 120, audioSeconds: 0.12, captureGeneration: 1,
      observation: { frequencyHz: 440 * 2 ** (55 / 1200), quality: 0.99, levelDbfs: -20, reason: "usable" as const },
      snapshot: { state: "stable" as const, fresh: true, ageMs: 0, pitch: { semitone: 69, frequencyHz: 440 } } };
    expect(reliableAcousticObservation(envelope)).toBe(true);
    expect(gradeAcousticPitch(envelope.observation.frequencyHz, 69, 25)?.accepted).toBe(false);
    expect(reliableAcousticObservation({ ...envelope, snapshot: { ...envelope.snapshot, fresh: false } })).toBe(false);
    expect(reliableAcousticObservation({ ...envelope, observation: { ...envelope.observation, frequencyHz: null } })).toBe(false);
  });
});
