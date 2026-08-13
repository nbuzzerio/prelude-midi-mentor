import { forwardRef } from "react";

import {
  summarizeMelodyContinuousPractice,
  type MelodyContinuousAttemptSummary,
} from "../melody-continuous-practice";

export const MelodySessionSummary = forwardRef<
  HTMLHeadingElement,
  Readonly<{
    history: readonly MelodyContinuousAttemptSummary[];
    onPracticeAgain: () => void;
    onSettings: () => void;
  }>
>(function MelodySessionSummary({ history, onPracticeAgain, onSettings }, ref) {
  const summary = summarizeMelodyContinuousPractice(history);
  return (
    <section className="melody-session-summary space-y-5">
      <h2 ref={ref} tabIndex={-1}>Session complete</h2>
      <div className="melody-results-grid grid gap-3 sm:grid-cols-3">
        <article><h3>Attempts completed</h3><strong>{summary.attemptsCompleted}</strong></article>
        <article><h3>Pitch-perfect attempts</h3><strong>{summary.pitchPerfectAttempts}</strong></article>
        <article><h3>Average Pitch</h3><strong>{summary.averagePitch}%</strong></article>
        <article><h3>Average Movement</h3><strong>{summary.averageMovement === null ? "Not enough notes" : `${summary.averageMovement}%`}</strong></article>
        <article><h3>Average Timing</h3><strong>{summary.averageTiming}%</strong></article>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="min-h-11 rounded-lg bg-sky-400 px-4 py-2 font-bold text-zinc-950" onClick={onPracticeAgain} type="button">Practice Again</button>
        <button className="min-h-11 rounded-lg border border-zinc-600 px-3 py-2" onClick={onSettings} type="button">Settings</button>
      </div>
    </section>
  );
});
