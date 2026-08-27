import { useId, type ReactNode } from "react";

import { StaffBuilderScoreView } from "@/features/staff-builder/components/staff-builder-score-view";

import { projectMelodyExerciseToDisplayScore } from "../melody-display-score";
import {
  getMelodyResultDetails,
  getMelodyResultEventHighlights,
} from "../melody-result-highlights";
import type { MelodyAttemptResult } from "../melody-scoring";
import type { MelodyExercise } from "../melody-types";

export function MelodyResultMetrics({ headingLevel = 3, result }: Readonly<{
  headingLevel?: 3 | 5;
  result: MelodyAttemptResult;
}>) {
  const MetricHeading: "h3" | "h5" = headingLevel === 5 ? "h5" : "h3";

  return (
    <div className="melody-results-grid grid gap-3 sm:grid-cols-3">
      <article>
        <MetricHeading>Pitch</MetricHeading>
        <strong>{result.pitchScorePercent}%</strong>
        <p>How close your played notes were to the written pitches.</p>
      </article>
      <article>
        <MetricHeading>Movement</MetricHeading>
        <strong>
          {result.movementScorePercent === null
            ? "Not enough notes"
            : `${result.movementScorePercent}%`}
        </strong>
        <p>How closely your hand moved by the written intervals.</p>
      </article>
      <article>
        <MetricHeading>Timing</MetricHeading>
        <strong>{result.timingScorePercent}%</strong>
        <p>How close your note attacks were to the beat.</p>
      </article>
    </div>
  );
}

export function MelodyResultDetail({ exercise, result, legendActions }: Readonly<{
  exercise: MelodyExercise;
  result: MelodyAttemptResult;
  legendActions?: ReactNode;
}>) {
  const pitchResultsTitleId = useId();
  const score = projectMelodyExerciseToDisplayScore(exercise);
  const highlights = getMelodyResultEventHighlights(result);
  const details = getMelodyResultDetails(result);

  return (
    <section aria-labelledby={pitchResultsTitleId} className="space-y-3">
      <div>
        <h3 id={pitchResultsTitleId}>Pitch results on the staff</h3>
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
        {legendActions}
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
      <p>
        Missed: {result.missedAttackCount} · Extra: {result.extraAttackCount}
      </p>
    </section>
  );
}
