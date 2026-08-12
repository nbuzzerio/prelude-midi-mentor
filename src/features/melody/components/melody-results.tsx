import { forwardRef } from "react";
import type { MelodyAttemptResult } from "../melody-scoring";

export const MelodyResults = forwardRef<HTMLHeadingElement, Readonly<{ result: MelodyAttemptResult; onRetrySame: () => void; onTryAnother: () => void; onSettings: () => void }>>(function MelodyResults({ result, onRetrySame, onTryAnother, onSettings }, ref) {
  return <section className="space-y-5"><h2 ref={ref} tabIndex={-1}>Melody results</h2><div className="grid gap-3 sm:grid-cols-3">
    <article><h3>Pitch</h3><strong>{result.pitchScorePercent}%</strong><p>How close your played notes were to the written pitches.</p></article>
    <article><h3>Movement</h3><strong>{result.movementScorePercent === null ? "Not enough notes" : `${result.movementScorePercent}%`}</strong><p>How closely your hand moved by the written intervals.</p></article>
    <article><h3>Timing</h3><strong>{result.timingScorePercent}%</strong><p>How close your note attacks were to the beat.</p></article>
  </div><p>Missed: {result.missedAttackCount} · Extra: {result.extraAttackCount}</p><div className="flex flex-wrap gap-2"><button onClick={onRetrySame}>Retry Same</button><button onClick={onTryAnother}>Try Another</button><button onClick={onSettings}>Settings</button></div></section>;
});
