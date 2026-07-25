import type { SequenceStats } from "../../types/practice";

export const INITIAL_SEQUENCE_STATS: SequenceStats = {
  completed: 0,
  incorrectAttempts: 0,
  streak: 0,
  totalSequenceTimeMs: 0,
};

export function applyCompletedSequence(
  currentStats: SequenceStats,
  responseTimeMs: number,
): SequenceStats {
  return {
    ...currentStats,
    completed: currentStats.completed + 1,
    streak: currentStats.streak + 1,
    totalSequenceTimeMs: currentStats.totalSequenceTimeMs + responseTimeMs,
  };
}

export function applyIncorrectSequenceAttempt(
  currentStats: SequenceStats,
): SequenceStats {
  return {
    ...currentStats,
    incorrectAttempts: currentStats.incorrectAttempts + 1,
    streak: 0,
  };
}

export function getAverageSequenceTimeMs(stats: SequenceStats): number {
  if (stats.completed === 0) {
    return 0;
  }

  return Math.round(stats.totalSequenceTimeMs / stats.completed);
}

export function getSequenceAccuracy(stats: SequenceStats): number {
  const attempts = stats.completed + stats.incorrectAttempts;

  if (attempts === 0) {
    return 100;
  }

  return Math.round((stats.completed / attempts) * 100);
}
