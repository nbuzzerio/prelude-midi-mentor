import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import { MelodyCountGuide } from "./melody-count-guide";
import { MelodyReadingMeasure } from "./melody-reading-measure";

/** Fixed visual windows into the unchanged native score; preview never owns grading. */
export function MelodyActiveScore({ score, displayMeasureIndex, measureTick, activeTick, staff, measureCount, expanded }: Readonly<{
  score: StaffBuilderScore; displayMeasureIndex: number | null; measureTick?: number; activeTick?: number;
  staff: "treble" | "bass"; measureCount: 1 | 2; expanded: boolean;
}>) {
  const countIn = displayMeasureIndex === 0;
  const index = Math.max(1, displayMeasureIndex ?? 1);
  return <div className="melody-active-score" data-active-display-measure={index} data-score-id={score.id} data-measure-id={score.measures[index]?.id} data-expanded={expanded}>
    <div className="melody-reading-rows">
      {Array.from({ length: measureCount }, (_, offset) => offset + 1).map(measureIndex => <MelodyReadingMeasure
        key={score.measures[measureIndex]?.id ?? measureIndex}
        score={score} measureIndex={measureIndex} measureCount={measureCount} staff={staff} expanded={expanded}
        role={measureIndex < index ? "completed" : measureIndex === index ? "current" : "upcoming"}
        offsetTicks={!countIn && displayMeasureIndex !== null && measureIndex === index ? measureTick : undefined}
      />)}
    </div>
    <MelodyCountGuide activeAbsoluteTick={activeTick} measureCount={measureCount} showPreparatoryLeadIn={countIn} visibleDisplayMeasure={countIn ? 0 : index} />
    <p className="melody-reading-boundary">{index < measureCount ? "The next measure is visible below." : "End of phrase after this measure."}</p>
  </div>;
}
