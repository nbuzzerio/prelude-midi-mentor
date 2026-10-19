import { forwardRef } from "react";

import { PracticeDiagnosticChips } from "@/components/practice-diagnostic-chips";
import { selectMelodyAttemptDiagnosticChips } from "../melody-practice-result";
import type { MelodyAttemptResult } from "../melody-scoring";
import type { MelodyExercise } from "../melody-types";
import { MelodyResultDetail, MelodyResultMetrics } from "./melody-result-detail";

type MelodyResultsProps = Readonly<{
  exercise: MelodyExercise;
  result: MelodyAttemptResult;
  continuousProgress?: string;
  showRetrySame?: boolean;
  compact?: boolean;
  onRetrySame: () => void;
  onTryAnother: () => void;
  onSettings: () => void;
}>;

export const MelodyResults = forwardRef<HTMLHeadingElement, MelodyResultsProps>(
  function MelodyResults(
    { exercise, result, continuousProgress, showRetrySame = true, compact = false, onRetrySame, onTryAnother, onSettings },
    ref,
  ) {
    const actions = <div aria-label="Melody primary result actions" className={`melody-result-primary-actions grid gap-2 ${showRetrySame ? "grid-cols-2" : "grid-cols-1"}`} role="group">
      {showRetrySame && <button className="min-h-11 rounded-lg border border-sky-400 px-4 py-2 font-semibold text-sky-100 hover:bg-sky-400/15 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-300" onClick={onRetrySame} type="button">Retry Same</button>}
      <button className="min-h-11 rounded-lg bg-sky-400 px-4 py-2 font-bold text-zinc-950 hover:bg-sky-300 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-200" onClick={onTryAnother} type="button">Try Another</button>
    </div>;
    return (
      <section className="melody-results space-y-5">
        <header className="melody-result-header flex items-center justify-between gap-3">
          <div>
            <h2 ref={ref} tabIndex={-1}>
              {compact ? "Reading trial complete" : "Melody results"}
            </h2>
            {continuousProgress && <p>{continuousProgress}</p>}
          </div>

          <button
            className="melody-result-settings min-h-11 rounded-lg border border-zinc-600 px-3 py-2 font-medium text-zinc-200 hover:bg-zinc-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-zinc-300"
            onClick={onSettings}
            type="button"
          >
            Settings
          </button>
        </header>

        {compact && actions}
        <details open={!compact} className={compact ? "rounded-lg border border-white/10 px-3" : "contents"}><summary className="min-h-11 cursor-pointer py-3 text-sm text-zinc-400" hidden={!compact}>Native reading diagnostics</summary>
        <PracticeDiagnosticChips chips={selectMelodyAttemptDiagnosticChips(result)} label="Melody result shorthand and neutral metrics" />
        <MelodyResultMetrics result={result} />
        <MelodyResultDetail
          exercise={exercise}
          legendActions={compact ? undefined : actions}
          result={result}
        /></details>
      </section>
    );
  },
);
