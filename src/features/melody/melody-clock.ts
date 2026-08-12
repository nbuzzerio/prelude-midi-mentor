import type { MelodyExercise } from "./melody-types";
import { cleanUpMelodyScheduledClick, createMelodyMetronomeSchedule, scheduleMelodyMetronomeClick, type MelodyAudioContextLike, type MelodyScheduledClick } from "./melody-metronome";
import {
  MELODY_AUDIO_START_LEAD_SECONDS,
  getMelodyCountInDurationSeconds,
  getMelodyEvaluationTailSeconds,
  getMelodyExerciseDurationSeconds,
  getMelodyQuarterBeatSeconds,
  type MelodyClockBoundaries,
} from "./melody-timing";

export type MelodyPerformanceClock = MelodyClockBoundaries & Readonly<{
  quarterBeatSeconds: number;
  countInDurationSeconds: number;
  exerciseDurationSeconds: number;
  evaluationTailSeconds: number;
  nowSeconds: () => number;
  cancel: () => void;
}>;

function cleanUpScheduledClicks(scheduledClicks: readonly MelodyScheduledClick[]): void {
  for (const click of scheduledClicks) cleanUpMelodyScheduledClick(click);
}

export async function createMelodyPerformanceClock(
  exercise: MelodyExercise,
  context: MelodyAudioContextLike,
  options: Readonly<{ startLeadSeconds?: number }> = {},
): Promise<MelodyPerformanceClock> {
  if (context.state === "suspended") await context.resume();
  const startLeadSeconds = options.startLeadSeconds ?? MELODY_AUDIO_START_LEAD_SECONDS;
  if (!Number.isFinite(startLeadSeconds) || startLeadSeconds < 0) throw new Error("Melody audio start lead must be non-negative.");

  const quarterBeatSeconds = getMelodyQuarterBeatSeconds(exercise.settings.tempoBpm);
  const countInDurationSeconds = getMelodyCountInDurationSeconds(exercise.settings.tempoBpm);
  const exerciseDurationSeconds = getMelodyExerciseDurationSeconds(exercise);
  const evaluationTailSeconds = getMelodyEvaluationTailSeconds(exercise.settings.tempoBpm);
  const countInStartedAtSeconds = context.currentTime + startLeadSeconds;
  const performanceStartedAtSeconds = countInStartedAtSeconds + countInDurationSeconds;
  const performanceEndsAtSeconds = performanceStartedAtSeconds + exerciseDurationSeconds;
  const evaluationEndsAtSeconds = performanceEndsAtSeconds + evaluationTailSeconds;
  const scheduledClicks: MelodyScheduledClick[] = [];

  try {
    for (const beat of createMelodyMetronomeSchedule(exercise)) {
      scheduledClicks.push(scheduleMelodyMetronomeClick(context, countInStartedAtSeconds + beat.relativeTimeSeconds, beat.accented));
    }
  } catch (error) {
    cleanUpScheduledClicks(scheduledClicks);
    throw error;
  }

  let cancelled = false;
  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    cleanUpScheduledClicks(scheduledClicks);
  };

  return Object.freeze({
    quarterBeatSeconds, countInDurationSeconds, exerciseDurationSeconds, evaluationTailSeconds,
    countInStartedAtSeconds, performanceStartedAtSeconds, performanceEndsAtSeconds, evaluationEndsAtSeconds,
    nowSeconds: () => context.currentTime,
    cancel,
  });
}
