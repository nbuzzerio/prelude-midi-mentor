import { describe, expect, it } from "vitest";
import { generateMelodyExercise } from "./melody-generator";
import type { MelodyPerformedAttack } from "./melody-performance";
import { evaluateMelodyAttempt } from "./melody-scoring";
import { getMelodyTimedExpectedAttacks } from "./melody-timing";
import { DEFAULT_MELODY_SETTINGS, type MelodyExercise } from "./melody-types";

function exercise(tempoBpm: 50 | 60 | 70 | 80 = 60, measureCount: 1 | 2 = 1) {
  return generateMelodyExercise({ ...DEFAULT_MELODY_SETTINGS, tempoBpm, measureCount }, `score-${tempoBpm}-${measureCount}`);
}

function performance(source: MelodyExercise, midiTransform: (midi: number, index: number) => number = (midi) => midi, offsetBeats = 0): MelodyPerformedAttack[] {
  const beatMs = 60_000 / source.settings.tempoBpm;
  return getMelodyTimedExpectedAttacks(source).map((attack, index) => Object.freeze({
    id: `p${index}`, midiNumber: midiTransform(attack.midiNumber, index), source: "midi",
    audioTimeSeconds: (attack.expectedTimeMs + offsetBeats * beatMs) / 1000,
    relativeTimeMs: attack.expectedTimeMs + offsetBeats * beatMs, sequenceIndex: index,
  }));
}

describe("Melody attempt scoring", () => {
  it("scores a perfect performance at 100/100/100", () => {
    const source = exercise();
    const result = evaluateMelodyAttempt(source, performance(source));
    expect(result).toMatchObject({ pitchScorePercent: 100, movementScorePercent: 100, timingScorePercent: 100, missedAttackCount: 0, extraAttackCount: 0 });
    expect(result.attacks.every(({ status }) => status === "correct")).toBe(true);
  });

  it("scores empty performance without crashing", () => {
    const result = evaluateMelodyAttempt(exercise(), []);
    expect(result.pitchScorePercent).toBe(0);
    expect(result.movementScorePercent).toBe(0);
    expect(result.timingScorePercent).toBe(0);
    expect(result.missedAttackCount).toBe(result.attacks.length);
    expect(result.extras).toEqual([]);
  });

  it.each([[1, 11 / 12], [6, 0.5], [12, 0]] as const)("awards pitch credit for a %i-semitone error", (distance, credit) => {
    const source = exercise();
    const result = evaluateMelodyAttempt(source, performance(source, (midi, index) => index === 0 ? midi + distance : midi));
    expect(result.attacks[0]!.pitchDistanceSemitones).toBe(distance);
    expect(result.attacks[0]!.pitchCredit).toBeCloseTo(credit);
    expect(result.attacks[0]!.status).toBe("wrong-pitch");
  });

  it("can award perfect movement for uniformly wrong absolute pitches", () => {
    const source = exercise();
    const result = evaluateMelodyAttempt(source, performance(source, (midi) => midi + 2));
    expect(result.movementScorePercent).toBe(100);
    expect(result.pitchScorePercent).toBeLessThan(100);
    expect(result.timingScorePercent).toBe(100);
    expect(result.movements.every(({ expectedSemitones, performedSemitones }) => expectedSemitones === performedSemitones)).toBe(true);
  });

  it("retains signed movement and penalizes wrong direction", () => {
    const source = exercise();
    const expected = getMelodyTimedExpectedAttacks(source);
    const firstMovement = expected[1]!.midiNumber - expected[0]!.midiNumber;
    const played = performance(source);
    played[1] = Object.freeze({ ...played[1]!, midiNumber: played[0]!.midiNumber - firstMovement });
    const movement = evaluateMelodyAttempt(source, played).movements[0]!;
    expect(movement.expectedSemitones).toBe(firstMovement);
    expect(movement.performedSemitones).toBe(-firstMovement);
    expect(movement.errorSemitones).toBe(Math.abs(firstMovement * 2));
  });

  it("handles unison movement and missing movement endpoints", () => {
    const source = exercise();
    const played = performance(source);
    played[1] = Object.freeze({ ...played[1]!, midiNumber: played[0]!.midiNumber });
    const sourceClone = { ...source, expectedAttacks: source.expectedAttacks.map((attack, index) => index === 1 ? { ...attack, midiNumber: source.expectedAttacks[0]!.midiNumber } : attack) } as MelodyExercise;
    expect(evaluateMelodyAttempt(sourceClone, played).movements[0]).toMatchObject({ expectedSemitones: 0, performedSemitones: 0, credit: 1 });
    const missing = played.filter((_, index) => index !== 1);
    expect(evaluateMelodyAttempt(source, missing).movements.slice(0, 2).every(({ credit }) => credit === 0)).toBe(true);
  });

  it.each([50, 60, 70, 80] as const)("scales timing credit by beat fraction at %i BPM", (bpm) => {
    const source = exercise(bpm);
    const quarter = evaluateMelodyAttempt(source, performance(source, undefined, 0.25));
    for (const { timingDeltaMs, timingErrorBeats, timingCredit } of quarter.attacks) {
      expect(timingDeltaMs).toBeGreaterThan(0);
      expect(timingErrorBeats).toBeCloseTo(0.25);
      expect(timingCredit).toBeCloseTo(0.5);
    }
    const half = evaluateMelodyAttempt(source, performance(source, undefined, -0.5));
    for (const { timingDeltaMs, timingCredit } of half.attacks) {
      expect(timingDeltaMs).toBeLessThan(0);
      expect(timingCredit).toBeCloseTo(0);
    }
  });

  it("penalizes extras without shifting later matches", () => {
    const source = exercise();
    const played = performance(source);
    played.splice(2, 0, Object.freeze({ ...played[1]!, id: "extra", midiNumber: 1, relativeTimeMs: (played[1]!.relativeTimeMs + played[2]!.relativeTimeMs) / 2, sequenceIndex: 2 }));
    played.forEach((attack, index) => { played[index] = Object.freeze({ ...attack, sequenceIndex: index }); });
    const result = evaluateMelodyAttempt(source, played);
    expect(result.extraAttackCount).toBe(1);
    expect(result.extras[0]!.id).toBe("extra");
    expect(result.attacks.at(-1)!.status).toBe("correct");
    expect(result.pitchScorePercent).toBeLessThan(100);
    expect(result.movementScorePercent).toBeLessThan(100);
  });

  it("recovers across a two-measure exercise and preserves source immutability", () => {
    const source = exercise(60, 2);
    const before = JSON.stringify(source);
    const played = performance(source).filter((_, index) => index !== 3);
    const result = evaluateMelodyAttempt(source, played);
    expect(result.missedAttackCount).toBe(1);
    expect(result.attacks.at(-1)!.status).toBe("correct");
    expect(JSON.stringify(source)).toBe(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.attacks)).toBe(true);
    expect(evaluateMelodyAttempt(source, played)).toEqual(result);
  });
});
