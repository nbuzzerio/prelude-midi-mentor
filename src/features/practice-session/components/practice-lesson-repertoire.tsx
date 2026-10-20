import { useCallback, useEffect, useState } from "react";
import { RolodexPractice } from "../../piece-practice/rolodex/rolodex-practice";
import type { ContinuousView } from "../../piece-practice/continuous/continuous-session";
import type { ContinuousAttempt } from "../../piece-practice/continuous/continuous-types";
import { acknowledgeRepertoire, type LessonRepertoire, type RepertoireEvidence } from "../practice-lesson-repertoire";

/** Owns only this lesson's conversation. Native performance and date writes stay in their existing owners. */
export function PracticeLessonRepertoire({ occurrence, active, finished, onFinish, onChange, onPlaying }: Readonly<{
  occurrence: LessonRepertoire; active: boolean; finished: boolean; onFinish: () => void;
  onChange: (evidence: RepertoireEvidence) => void; onPlaying: (playing: boolean) => void;
}>) {
  const [view, setView] = useState<ContinuousView | null>(null);
  const [attempts, setAttempts] = useState<readonly ContinuousAttempt[]>([]);
  const [skipped, setSkipped] = useState(false);
  const [dates, setDates] = useState({ pending: 0, failed: 0 });
  const acknowledged = useCallback((attempt: ContinuousAttempt) => {
    setAttempts(old => old.some(value => value.id === attempt.id) ? old : acknowledgeRepertoire(old, attempt));
  }, []);
  const dateChanged = useCallback((pending: number, failed: number) => setDates(old => old.pending === pending && old.failed === failed ? old : { pending, failed }), []);
  const pending = !!view && (view.phase === "starting" || view.phase === "count-in" || view.phase === "playing"
    || view.phase === "results" && (view.save !== "saved" || !attempts.some(a => a.id === view.attempt?.id)));
  useEffect(() => { onChange({ occurrence, skipped, attempts, pending, datePending: dates.pending, dateFailed: dates.failed }); }, [occurrence, skipped, attempts, pending, dates, onChange]);
  useEffect(() => { onPlaying(view?.phase === "playing" && active && !finished); return () => onPlaying(false); }, [view?.phase, active, finished, onPlaying]);
  const finish = () => { if (!pending) onFinish(); };
  const skip = () => {
    setSkipped(true);
    // Publish the deliberate outcome in the same event as Finish, without an intermediate unperformed report.
    onChange({ occurrence, skipped: true, attempts, pending, datePending: dates.pending, dateFailed: dates.failed });
    onFinish();
  };
  return <div className="min-w-0 space-y-3">
    <RolodexPractice entry={occurrence.entry} onExit={finish} lessonHost={{ active, finished, onView: setView, onAcknowledged: acknowledged, onDates: dateChanged }} />
    {!finished && (!view || view.phase === "ready") && !attempts.length && !pending && <button className="min-h-11 rounded border border-zinc-600 px-3 py-2" disabled={!active} onClick={skip} type="button">Skip Repertoire</button>}
  </div>;
}
