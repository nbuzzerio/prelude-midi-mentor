import { describe, expect, it } from "vitest";
import { generateMelodyExercise } from "./melody-generator";
import { createMelodyPerformanceRecorder } from "./melody-performance";
import { DEFAULT_MELODY_SETTINGS } from "./melody-types";

function setup() {
  const exercise = generateMelodyExercise(DEFAULT_MELODY_SETTINGS, "capture");
  let now = 9;
  const recorder = createMelodyPerformanceRecorder(exercise, {
    performanceStartedAtSeconds: 10,
    evaluationEndsAtSeconds: 14.5,
    nowSeconds: () => now,
  });
  return { exercise, recorder, setNow: (value: number) => { now = value; } };
}

describe("Melody performance recorder", () => {
  it("ignores count-in input without claiming a source", () => {
    const { recorder } = setup();
    expect(recorder.recordAttack(60, "midi")).toBeNull();
    expect(recorder.getLockedSource()).toBeNull();
    expect(recorder.getAttacks()).toEqual([]);
  });

  it("accepts the performance origin and evaluation tail but excludes the evaluation end", () => {
    const { recorder, setNow } = setup();
    setNow(10);
    expect(recorder.recordAttack(60, "midi")?.relativeTimeMs).toBe(0);
    setNow(14.499);
    expect(recorder.recordAttack(62, "midi")?.relativeTimeMs).toBeCloseTo(4499);
    setNow(14.5);
    expect(recorder.recordAttack(64, "midi")).toBeNull();
  });

  it("locks to the first valid source and never merges the other source", () => {
    const { recorder, setNow } = setup();
    setNow(10.1);
    expect(recorder.recordAttack(60, "virtual")).not.toBeNull();
    expect(recorder.getLockedSource()).toBe("virtual");
    expect(recorder.recordAttack(62, "midi")).toBeNull();
    expect(recorder.getAttacks().map(({ midiNumber }) => midiNumber)).toEqual([60]);
  });

  it("creates deterministic sequence identities and immutable snapshots", () => {
    const { exercise, recorder, setNow } = setup();
    setNow(10.25);
    const first = recorder.recordAttack(60, "midi")!;
    setNow(10.5);
    const second = recorder.recordAttack(62, "midi")!;
    expect([first.id, second.id]).toEqual([`${exercise.id}-performed-0`, `${exercise.id}-performed-1`]);
    expect([first.sequenceIndex, second.sequenceIndex]).toEqual([0, 1]);
    expect(first.audioTimeSeconds).toBe(10.25);
    expect(first.relativeTimeMs).toBe(250);
    const snapshot = recorder.getAttacks();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("reset clears attacks, identity sequence, and source lock", () => {
    const { exercise, recorder, setNow } = setup();
    setNow(10);
    recorder.recordAttack(60, "midi");
    recorder.reset();
    expect(recorder.getAttacks()).toEqual([]);
    expect(recorder.getLockedSource()).toBeNull();
    expect(recorder.recordAttack(64, "virtual")?.id).toBe(`${exercise.id}-performed-0`);
  });
});
