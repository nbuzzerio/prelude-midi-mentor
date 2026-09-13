import type { StaffBuilderScore } from "../staff-builder-types";
import { layoutStaffBuilderScoreSystems } from "../notation/staff-builder-system-layout";
import { StaffBuilderMultiSystemScore } from "./staff-builder-multi-system-score";
import type { StaffBuilderPrintMeasuresPerLine } from "./staff-builder-print-options";
import {
  composeStaffBuilderPrintPages,
  projectStaffBuilderPrintSystems,
  STAFF_BUILDER_PRINT_BASE_MUSIC_HEIGHT_PX,
  STAFF_BUILDER_PRINT_CANVAS_WIDTH_PX,
  STAFF_BUILDER_PRINT_CONTENT_WIDTH_PX,
  STAFF_BUILDER_PRINT_HORIZONTAL_SAFETY_INSET_PX,
  STAFF_BUILDER_PRINT_MEASURE_LABEL_LANE_HEIGHT_PX,
  STAFF_BUILDER_PRINT_MINIMUM_COMPRESSION_RATIO,
  STAFF_BUILDER_PRINT_MINIMUM_RHYTHMIC_WIDTH_PX,
  STAFF_BUILDER_PRINT_PARTIAL_MAXIMUM_MEASURE_WIDTH_PX,
} from "../staff-builder-print-layout";

export const STAFF_BUILDER_PRINT_MEASURE_LABEL_LANE_HEIGHT = STAFF_BUILDER_PRINT_MEASURE_LABEL_LANE_HEIGHT_PX;
const PRINT_CONSTRAINTS = { contentWidth: STAFF_BUILDER_PRINT_CONTENT_WIDTH_PX, minimumMeasureWidth: 105, maximumMeasureWidth: 340, baseMusicHeight: STAFF_BUILDER_PRINT_BASE_MUSIC_HEIGHT_PX, systemGap: 8, verticalReservations: { aboveStaff: 0, betweenStaves: 0, belowStaff: STAFF_BUILDER_PRINT_MEASURE_LABEL_LANE_HEIGHT } } as const;

export function StaffBuilderPrintScore({ score, measureIndexes, measuresPerLine }: Readonly<{ score: StaffBuilderScore; measureIndexes: readonly number[]; measuresPerLine: StaffBuilderPrintMeasuresPerLine }>) {
  const layout = layoutStaffBuilderScoreSystems(score, { ...PRINT_CONSTRAINTS, fittedSystemComposition: {
    targetMeasureCount: measuresPerLine,
    minimumRhythmicWidth: STAFF_BUILDER_PRINT_MINIMUM_RHYTHMIC_WIDTH_PX,
    minimumCompressionRatio: STAFF_BUILDER_PRINT_MINIMUM_COMPRESSION_RATIO,
    partialMaximumMeasureWidth: STAFF_BUILDER_PRINT_PARTIAL_MAXIMUM_MEASURE_WIDTH_PX,
  } }, measureIndexes);
  const pages = composeStaffBuilderPrintPages(projectStaffBuilderPrintSystems(score, layout.systems));
  return <section aria-label={`${score.title} printable score`} className="staff-builder-print-document">{pages.map((page) => <section className="staff-builder-print-page" data-print-page={page.pageIndex + 1} key={page.pageIndex}>
    {page.includesTitle && <h1>{score.title}</h1>}
    {page.systems.map(({ disconnected, occupancyHeight, renderOffsetY, system }) => {
      const normalized = { width: system.width, height: system.height, systems: [{ ...system, systemIndex: 0, x: 0, y: 0 }] };
      return <div className="staff-builder-print-system" data-disconnected={disconnected || undefined} key={`${system.measures[0]!.measureId}-${system.measures.at(-1)!.measureId}`}><StaffBuilderMultiSystemScore documentHeight={occupancyHeight} documentWidth={STAFF_BUILDER_PRINT_CANVAS_WIDTH_PX} layout={normalized} measureNumberLaneHeight={STAFF_BUILDER_PRINT_MEASURE_LABEL_LANE_HEIGHT} measureNumberTop={occupancyHeight - STAFF_BUILDER_PRINT_MEASURE_LABEL_LANE_HEIGHT} score={score} showMeasureNumbers visualOffset={{ x: STAFF_BUILDER_PRINT_HORIZONTAL_SAFETY_INSET_PX, y: renderOffsetY }} /></div>;
    })}
  </section>)}</section>;
}
