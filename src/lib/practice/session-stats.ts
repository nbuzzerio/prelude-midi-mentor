import type { PracticeStats } from "@/types/practice";

export const INITIAL_PRACTICE_STATS: PracticeStats = {
  correct: 0,
  incorrect: 0,
  streak: 0,
  totalResponseTimeMs: 0,
};

export function applyCorrectAttempt(
  currentStats: PracticeStats,
  responseTimeMs: number,
): PracticeStats {
  return {
    ...currentStats,
    correct: currentStats.correct + 1,
    streak: currentStats.streak + 1,
    totalResponseTimeMs: currentStats.totalResponseTimeMs + responseTimeMs,
  };
}

export function applyIncorrectAttempt(
  currentStats: PracticeStats,
): PracticeStats {
  return {
    ...currentStats,
    incorrect: currentStats.incorrect + 1,
    streak: 0,
  };
}
