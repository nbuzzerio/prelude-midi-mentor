import { STAFF_BUILDER_TICKS_PER_QUARTER } from "@/features/staff-builder/staff-builder-time";
import { MELODY_PHASE_ONE_METER } from "./melody-meter";
import { getMelodyPreparatoryLeadIn } from "./melody-preparatory-lead-in";
import type { MelodyExercise, MelodyExpectedAttack } from "./melody-types";

export const MELODY_AUDIO_START_LEAD_SECONDS = 0.1;
export const MELODY_EVALUATION_TAIL_BEATS = 0.5;

export type MelodyPerformancePhase = "count-in" | "performing" | "evaluation-tail" | "complete";
export type MelodyTimedExpectedAttack = MelodyExpectedAttack & Readonly<{
  expectedTimeSeconds: number;
  expectedTimeMs: number;
}>;

export function getMelodyQuarterBeatSeconds(tempoBpm: number): number {
  if (!Number.isFinite(tempoBpm) || tempoBpm <= 0) throw new Error("Melody tempo must be positive.");
  return 60 / tempoBpm;
}

export function melodyTicksToSeconds(ticks: number, tempoBpm: number): number {
  if (!Number.isFinite(ticks) || ticks < 0) throw new Error("Melody ticks must be non-negative.");
  return (ticks / STAFF_BUILDER_TICKS_PER_QUARTER) * getMelodyQuarterBeatSeconds(tempoBpm);
}

export function melodyTicksToMilliseconds(ticks: number, tempoBpm: number): number {
  return melodyTicksToSeconds(ticks, tempoBpm) * 1000;
}

export function getMelodyCountInDurationSeconds(tempoBpm: number): number {
  return melodyTicksToSeconds(
    getMelodyPreparatoryLeadIn(MELODY_PHASE_ONE_METER.timeSignature).durationTicks,
    tempoBpm,
  );
}

export function getMelodyExerciseDurationSeconds(exercise: MelodyExercise): number {
  return melodyTicksToSeconds(exercise.measures.reduce((sum, measure) => sum + measure.capacityTicks, 0), exercise.settings.tempoBpm);
}

export function getMelodyEvaluationTailSeconds(tempoBpm: number): number {
  return getMelodyQuarterBeatSeconds(tempoBpm) * MELODY_EVALUATION_TAIL_BEATS;
}

export function getMelodyTimedExpectedAttacks(exercise: MelodyExercise): readonly MelodyTimedExpectedAttack[] {
  return Object.freeze(exercise.expectedAttacks.map((attack) => {
    const expectedTimeSeconds = melodyTicksToSeconds(attack.absoluteTick, exercise.settings.tempoBpm);
    return Object.freeze({ ...attack, expectedTimeSeconds, expectedTimeMs: expectedTimeSeconds * 1000 });
  }));
}

export type MelodyClockBoundaries = Readonly<{
  countInStartedAtSeconds: number;
  performanceStartedAtSeconds: number;
  performanceEndsAtSeconds: number;
  evaluationEndsAtSeconds: number;
}>;

export function getMelodyRelativePerformanceTimeMs(clock: Pick<MelodyClockBoundaries, "performanceStartedAtSeconds"> & Readonly<{ nowSeconds: () => number }>): number {
  return (clock.nowSeconds() - clock.performanceStartedAtSeconds) * 1000;
}

export function getMelodyPerformancePhase(clock: MelodyClockBoundaries, nowSeconds: number): MelodyPerformancePhase {
  if (nowSeconds < clock.performanceStartedAtSeconds) return "count-in";
  if (nowSeconds < clock.performanceEndsAtSeconds) return "performing";
  if (nowSeconds < clock.evaluationEndsAtSeconds) return "evaluation-tail";
  return "complete";
}
