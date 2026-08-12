import { alignMelodyAttacks } from "./melody-alignment";
import type { MelodyPerformedAttack } from "./melody-performance";
import { getMelodyQuarterBeatSeconds, getMelodyTimedExpectedAttacks, type MelodyTimedExpectedAttack } from "./melody-timing";
import type { MelodyExercise } from "./melody-types";

export type MelodyAttackEvaluation = Readonly<{
  expectedAttack: MelodyTimedExpectedAttack;
  performedAttack: MelodyPerformedAttack | null;
  status: "correct" | "wrong-pitch" | "missing";
  pitchDistanceSemitones: number | null;
  pitchCredit: number;
  timingDeltaMs: number | null;
  timingErrorBeats: number | null;
  timingCredit: number;
}>;

export type MelodyMovementEvaluation = Readonly<{
  fromExpectedId: string;
  toExpectedId: string;
  expectedSemitones: number;
  performedSemitones: number | null;
  errorSemitones: number | null;
  credit: number;
}>;

export type MelodyAttemptResult = Readonly<{
  exerciseId: string;
  attacks: readonly MelodyAttackEvaluation[];
  movements: readonly MelodyMovementEvaluation[];
  extras: readonly MelodyPerformedAttack[];
  pitchScorePercent: number;
  movementScorePercent: number | null;
  timingScorePercent: number;
  missedAttackCount: number;
  extraAttackCount: number;
}>;

const creditForSemitoneError = (error: number) => Math.max(0, 1 - Math.min(error, 12) / 12);
const percent = (credit: number, denominator: number) => denominator === 0 ? 0 : Math.round((credit / denominator) * 100);

export function evaluateMelodyAttempt(
  exercise: MelodyExercise,
  performedAttacks: readonly MelodyPerformedAttack[],
): MelodyAttemptResult {
  const expected = getMelodyTimedExpectedAttacks(exercise);
  const alignment = alignMelodyAttacks(expected, performedAttacks, exercise.settings.tempoBpm);
  const matchedByExpectedId = new Map<string, MelodyPerformedAttack>();
  const extras: MelodyPerformedAttack[] = [];
  for (const item of alignment) {
    if (item.kind === "matched") matchedByExpectedId.set(item.expected.id, item.performed);
    if (item.kind === "extra") extras.push(item.performed);
  }
  const quarterBeatMs = getMelodyQuarterBeatSeconds(exercise.settings.tempoBpm) * 1000;
  const attacks = expected.map((expectedAttack): MelodyAttackEvaluation => {
    const performedAttack = matchedByExpectedId.get(expectedAttack.id) ?? null;
    if (!performedAttack) return Object.freeze({
      expectedAttack, performedAttack: null, status: "missing", pitchDistanceSemitones: null, pitchCredit: 0,
      timingDeltaMs: null, timingErrorBeats: null, timingCredit: 0,
    });
    const pitchDistanceSemitones = Math.abs(expectedAttack.midiNumber - performedAttack.midiNumber);
    const timingDeltaMs = performedAttack.relativeTimeMs - expectedAttack.expectedTimeMs;
    const timingErrorBeats = Math.abs(timingDeltaMs) / quarterBeatMs;
    return Object.freeze({
      expectedAttack, performedAttack,
      status: pitchDistanceSemitones === 0 ? "correct" : "wrong-pitch",
      pitchDistanceSemitones,
      pitchCredit: creditForSemitoneError(pitchDistanceSemitones),
      timingDeltaMs,
      timingErrorBeats,
      timingCredit: Math.max(0, 1 - timingErrorBeats / 0.5),
    });
  });
  const movements = attacks.slice(1).map((to, index): MelodyMovementEvaluation => {
    const from = attacks[index]!;
    const expectedSemitones = to.expectedAttack.midiNumber - from.expectedAttack.midiNumber;
    if (!from.performedAttack || !to.performedAttack) return Object.freeze({
      fromExpectedId: from.expectedAttack.id, toExpectedId: to.expectedAttack.id, expectedSemitones,
      performedSemitones: null, errorSemitones: null, credit: 0,
    });
    const performedSemitones = to.performedAttack.midiNumber - from.performedAttack.midiNumber;
    const errorSemitones = Math.abs(expectedSemitones - performedSemitones);
    return Object.freeze({
      fromExpectedId: from.expectedAttack.id, toExpectedId: to.expectedAttack.id, expectedSemitones,
      performedSemitones, errorSemitones, credit: creditForSemitoneError(errorSemitones),
    });
  });
  const denominator = expected.length + extras.length;
  const movementDenominator = movements.length + extras.length;
  return Object.freeze({
    exerciseId: exercise.id,
    attacks: Object.freeze(attacks),
    movements: Object.freeze(movements),
    extras: Object.freeze(extras),
    pitchScorePercent: percent(attacks.reduce((sum, attack) => sum + attack.pitchCredit, 0), denominator),
    movementScorePercent: movementDenominator === 0 ? null : percent(movements.reduce((sum, movement) => sum + movement.credit, 0), movementDenominator),
    timingScorePercent: percent(attacks.reduce((sum, attack) => sum + attack.timingCredit, 0), denominator),
    missedAttackCount: attacks.filter(({ status }) => status === "missing").length,
    extraAttackCount: extras.length,
  });
}
