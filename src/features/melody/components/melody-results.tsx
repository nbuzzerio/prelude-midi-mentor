import { forwardRef } from "react";

import { StaffBuilderScoreView } from "@/features/staff-builder/components/staff-builder-score-view";

import { projectMelodyExerciseToDisplayScore } from "../melody-display-score";
import {
  getMelodyResultDetails,
  getMelodyResultEventHighlights,
} from "../melody-result-highlights";
import type { MelodyAttemptResult } from "../melody-scoring";
import type { MelodyExercise } from "../melody-types";

type MelodyResultsProps = Readonly<{
  exercise: MelodyExercise;
  result: MelodyAttemptResult;
  onRetrySame: () => void;
  onTryAnother: () => void;
  onSettings: () => void;
}>;

export const MelodyResults = forwardRef<HTMLHeadingElement, MelodyResultsProps>(
  function MelodyResults(
    { exercise, result, onRetrySame, onTryAnother, onSettings },
    ref,
  ) {
    const score = projectMelodyExerciseToDisplayScore(exercise);
    const highlights = getMelodyResultEventHighlights(result);
    const details = getMelodyResultDetails(result);

    return (
      <section className="melody-results space-y-5">
        <header className="melody-result-header flex items-center justify-between gap-3">
          <h2 ref={ref} tabIndex={-1}>
            Melody results
          </h2>

          <button
            className="melody-result-settings min-h-11 rounded-lg border border-zinc-600 px-3 py-2 font-medium text-zinc-200 hover:bg-zinc-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-zinc-300"
            onClick={onSettings}
            type="button"
          >
            Settings
          </button>
        </header>

        <div className="melody-results-grid grid gap-3 sm:grid-cols-3">
          <article>
            <h3>Pitch</h3>
            <strong>{result.pitchScorePercent}%</strong>
            <p>How close your played notes were to the written pitches.</p>
          </article>
          <article>
            <h3>Movement</h3>
            <strong>
              {result.movementScorePercent === null
                ? "Not enough notes"
                : `${result.movementScorePercent}%`}
            </strong>
            <p>How closely your hand moved by the written intervals.</p>
          </article>
          <article>
            <h3>Timing</h3>
            <strong>{result.timingScorePercent}%</strong>
            <p>How close your note attacks were to the beat.</p>
          </article>
        </div>

        <section aria-labelledby="melody-pitch-results-title" className="space-y-3">
          <div>
            <h3 id="melody-pitch-results-title">Pitch results on the staff</h3>
            <p>The staff below shows pitch results. Timing is scored separately.</p>
          </div>
          <div className="melody-result-legend-row flex flex-wrap items-center justify-between gap-3">
            <div aria-label="Pitch result legend" className="melody-result-legend">
              <span>
                <i
                  aria-hidden="true"
                  className="melody-result-swatch melody-result-swatch-correct"
                />
                Correct
              </span>
              <span>
                <i
                  aria-hidden="true"
                  className="melody-result-swatch melody-result-swatch-missed"
                />
                Missed
              </span>
              <span>
                <i
                  aria-hidden="true"
                  className="melody-result-swatch melody-result-swatch-wrong-pitch"
                />
                Wrong pitch
              </span>
            </div>
            <div
              aria-label="Melody primary result actions"
              className="melody-result-primary-actions grid grid-cols-2 gap-2"
              role="group"
            >
              <button
                className="min-h-11 rounded-lg border border-sky-400 px-4 py-2 font-semibold text-sky-100 hover:bg-sky-400/15 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
                onClick={onRetrySame}
                type="button"
              >
                Retry Same
              </button>
              <button
                className="min-h-11 rounded-lg bg-sky-400 px-4 py-2 font-bold text-zinc-950 hover:bg-sky-300 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
                onClick={onTryAnother}
                type="button"
              >
                Try Another
              </button>
            </div>
          </div>
          <div
            aria-label="Melody pitch result score"
            className="melody-score-scroll"
            data-measure-count={exercise.measures.length}
            tabIndex={0}
          >
            <div className="melody-score-track">
              <div
                className="melody-score-measures grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${exercise.measures.length}, minmax(0, 1fr))`,
                }}
              >
                {exercise.measures.map((measure) => (
                  <StaffBuilderScoreView
                    eventHighlights={highlights}
                    key={measure.id}
                    measureIndex={measure.measureIndex}
                    score={score}
                    visibleStaff={exercise.settings.staff}
                  />
                ))}
              </div>
            </div>
          </div>
          <ul aria-label="Pitch result details" className="melody-result-details">
            {details.map(({ eventId, text }) => (
              <li key={eventId}>{text}</li>
            ))}
          </ul>
        </section>

        <p>
          Missed: {result.missedAttackCount} · Extra: {result.extraAttackCount}
        </p>
      </section>
    );
  },
);
