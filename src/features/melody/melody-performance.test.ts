import { describe, expect, it } from "vitest";
import { generateMelodyExercise } from "./melody-generator";
import { createMelodyPerformanceRecorder } from "./melody-performance";
import { evaluateMelodyAttempt } from "./melody-scoring";
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
  it("ignores preparatory lead-in input without claiming a source", () => {
    const { exercise, recorder } = setup();
    expect(recorder.recordAttack(60, "midi")).toBeNull();
    expect(recorder.getLockedSource()).toBeNull();
    expect(recorder.getAttacks()).toEqual([]);
    expect(evaluateMelodyAttempt(exercise, recorder.getAttacks()).extras).toEqual([]);
  });

  it("captures a slightly early first note within the existing alignment window", () => {
    const { exercise, recorder, setNow } = setup();
    setNow(9.5);
    const attack = recorder.recordAttack(exercise.expectedAttacks[0]!.midiNumber, "midi");

    expect(attack?.relativeTimeMs).toBe(-500);
    expect(recorder.getLockedSource()).toBe("midi");
    const result = evaluateMelodyAttempt(exercise, recorder.getAttacks());
    expect(result.attacks[0]).toMatchObject({ status: "correct", performedAttack: attack });
    expect(result.missedAttackCount).toBeLessThan(exercise.expectedAttacks.length);
  });

  it("ignores a first-note pitch before the valid early window", () => {
    const { exercise, recorder, setNow } = setup();
    setNow(9.249);

    expect(recorder.recordAttack(exercise.expectedAttacks[0]!.midiNumber, "virtual")).toBeNull();
    expect(recorder.getLockedSource()).toBeNull();
    const result = evaluateMelodyAttempt(exercise, recorder.getAttacks());
    expect(result.attacks[0]?.status).toBe("missing");
    expect(result.extraAttackCount).toBe(0);
  });

  it("evaluates a wrong pitch inside the first-note window instead of discarding it", () => {
    const { exercise, recorder, setNow } = setup();
    setNow(9.5);
    const attack = recorder.recordAttack(exercise.expectedAttacks[0]!.midiNumber + 1, "virtual");

    expect(recorder.getLockedSource()).toBe("virtual");
    expect(evaluateMelodyAttempt(exercise, recorder.getAttacks()).attacks[0]).toMatchObject({
      status: "wrong-pitch",
      performedAttack: attack,
    });
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
