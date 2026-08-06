import type { EarTrainingStats } from "./ear-training-types";

export const INITIAL_EAR_TRAINING_STATS: EarTrainingStats = {
  completed: 0,
  incorrectAttempts: 0,
  streak: 0,
  totalResponseTimeMs: 0,
};

export function applyEarTrainingIncorrectAttempt(
  stats: EarTrainingStats,
  alreadyIncorrect: boolean,
): EarTrainingStats {
  if (alreadyIncorrect) return stats;
  return { ...stats, incorrectAttempts: stats.incorrectAttempts + 1, streak: 0 };
}

export function applyEarTrainingCompletion(
  stats: EarTrainingStats,
  responseTimeMs: number,
  hadIncorrectAttempt: boolean,
): EarTrainingStats {
  return {
    ...stats,
    completed: stats.completed + 1,
    streak: hadIncorrectAttempt ? 0 : stats.streak + 1,
    totalResponseTimeMs: stats.totalResponseTimeMs + responseTimeMs,
  };
}

export function getEarTrainingAccuracy(stats: EarTrainingStats): number {
  const attempts = stats.completed + stats.incorrectAttempts;
  return attempts === 0 ? 100 : Math.round((stats.completed / attempts) * 100);
}

export function getAverageEarTrainingResponseTimeMs(stats: EarTrainingStats): number {
  return stats.completed === 0 ? 0 : Math.round(stats.totalResponseTimeMs / stats.completed);
}
