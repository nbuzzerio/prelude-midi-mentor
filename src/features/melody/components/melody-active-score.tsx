import { StaffBuilderScoreView } from "@/features/staff-builder/components/staff-builder-score-view";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import { MelodyCountGuide } from "./melody-count-guide";

/** One visual window into the unchanged native score, not a transport or score projection. */
export function MelodyActiveScore({ score, displayMeasureIndex, measureTick, activeTick, staff, measureCount, expanded }: Readonly<{
  score: StaffBuilderScore; displayMeasureIndex: number | null; measureTick?: number; activeTick?: number;
  staff: "treble" | "bass"; measureCount: 1 | 2; expanded: boolean;
}>) {
  const index = displayMeasureIndex ?? 1;
  return <div className="melody-active-score" data-active-display-measure={index} data-score-id={score.id} data-measure-id={score.measures[index]?.id} data-expanded={expanded}>
    <h3 className="melody-active-measure-title">{index === 0 ? "Lead-in · Preparatory rests" : `Measure ${index} of ${measureCount}`}</h3>
    <StaffBuilderScoreView measureIndex={index} playbackPosition={displayMeasureIndex !== null && measureTick !== undefined ? { offsetTicks: measureTick } : undefined} readingFlow={expanded ? "expanded" : "normal"} score={score} visibleStaff={staff} />
    <MelodyCountGuide activeAbsoluteTick={activeTick} measureCount={measureCount} showPreparatoryLeadIn visibleDisplayMeasure={index} />
  </div>;
}
