import type { StaffBuilderSystemLayout } from "./notation/staff-builder-system-layout";
import type { StaffBuilderScore } from "./staff-builder-types";
import { getStaffBuilderVerticalGeometry } from "./notation/staff-builder-vertical-geometry";
import { getStaffBuilderLyricCues, STAFF_BUILDER_LYRIC_LANE_RESERVATION } from "./notation/staff-builder-lyric-cues";

export const STAFF_BUILDER_PRINT_PAGE_HEIGHT_MM = 279.4;
export const STAFF_BUILDER_PRINT_PAGE_MARGIN_MM = 12;
export const STAFF_BUILDER_PRINT_CSS_PIXELS_PER_INCH = 96;
export const STAFF_BUILDER_PRINT_MILLIMETERS_PER_INCH = 25.4;
export const STAFF_BUILDER_PRINT_SYSTEM_GAP_PX = 8;
export const STAFF_BUILDER_PRINT_TITLE_ALLOWANCE_PX = 48;
export const STAFF_BUILDER_PRINT_TARGET_SYSTEMS_PER_PAGE = 4;
export const STAFF_BUILDER_PRINT_MINIMUM_SYSTEMS_PER_PAGE = 3;
export const STAFF_BUILDER_PRINT_MINIMUM_RHYTHMIC_WIDTH_PX = 96;
export const STAFF_BUILDER_PRINT_MINIMUM_COMPRESSION_RATIO = 0.65;
export const STAFF_BUILDER_PRINT_PARTIAL_MAXIMUM_MEASURE_WIDTH_PX = 340;
export const STAFF_BUILDER_PRINT_CANVAS_WIDTH_PX = 720;
export const STAFF_BUILDER_PRINT_HORIZONTAL_SAFETY_INSET_PX = 12;
export const STAFF_BUILDER_PRINT_CONTENT_WIDTH_PX = STAFF_BUILDER_PRINT_CANVAS_WIDTH_PX - 2 * STAFF_BUILDER_PRINT_HORIZONTAL_SAFETY_INSET_PX;
export const STAFF_BUILDER_PRINT_BASE_MUSIC_HEIGHT_PX = 200;
export const STAFF_BUILDER_PRINT_MEASURE_LABEL_LANE_HEIGHT_PX = 20;
export const STAFF_BUILDER_PRINT_VISIBLE_INK_EXTENT_PX = 20;
export const STAFF_BUILDER_PRINT_DISCONNECTED_RUN_GAP_PX = 8;
/** CSS uses the same 12mm margins and 8px (2.1167mm at 96dpi) system gap. Letter height is the conservative common denominator versus A4 portrait. */
export const STAFF_BUILDER_PRINT_USABLE_PAGE_HEIGHT_PX = (STAFF_BUILDER_PRINT_PAGE_HEIGHT_MM - 2 * STAFF_BUILDER_PRINT_PAGE_MARGIN_MM)
  * STAFF_BUILDER_PRINT_CSS_PIXELS_PER_INCH / STAFF_BUILDER_PRINT_MILLIMETERS_PER_INCH;

export type StaffBuilderPrintSystem = Readonly<{
  system: StaffBuilderSystemLayout;
  occupancyHeight: number;
  renderOffsetY: number;
  disconnected: boolean;
}>;
export type StaffBuilderPrintPage = Readonly<{ pageIndex: number; includesTitle: boolean; systems: readonly StaffBuilderPrintSystem[] }>;

export function projectStaffBuilderPrintSystems(score: StaffBuilderScore, systems: readonly StaffBuilderSystemLayout[]): readonly StaffBuilderPrintSystem[] {
  return systems.map((system, index) => {
    const pitchSources = system.measures.flatMap(({ measureIndex }) => score.measures[measureIndex]?.events.flatMap((event) => event.kind === "notes" ? [{ staff: event.staff, pitches: event.pitches }] : []) ?? []);
    const eventIds = new Set(system.measures.flatMap(({ measureIndex }) => score.measures[measureIndex]?.events.map(({ id }) => id) ?? []));
    const hasLyrics = getStaffBuilderLyricCues(score, eventIds).length > 0;
    const visible = getStaffBuilderVerticalGeometry({
      pitchSources,
      baseHeight: STAFF_BUILDER_PRINT_BASE_MUSIC_HEIGHT_PX,
      trebleStaveY: 15,
      bassStaveY: STAFF_BUILDER_PRINT_BASE_MUSIC_HEIGHT_PX - 105,
      topLaneReservation: hasLyrics ? STAFF_BUILDER_LYRIC_LANE_RESERVATION : 0,
      glyphAndStemExtent: STAFF_BUILDER_PRINT_VISIBLE_INK_EXTENT_PX,
    });
    const renderTopReservation = system.measures[0]?.y ?? 0;
    const trimmedTopReservation = Math.max(0, renderTopReservation - visible.topReservation);
    const disconnected = index > 0 && system.measures[0]!.measureIndex !== systems[index - 1]!.measures.at(-1)!.measureIndex + 1;
    return {
      system,
      occupancyHeight: Math.min(system.height, visible.height + STAFF_BUILDER_PRINT_MEASURE_LABEL_LANE_HEIGHT_PX),
      renderOffsetY: trimmedTopReservation === 0 ? 0 : -trimmedTopReservation,
      disconnected,
    };
  });
}

function requiredHeight(systems: readonly StaffBuilderPrintSystem[], includesTitle: boolean): number {
  return systems.reduce((sum, { occupancyHeight, disconnected }) => sum + occupancyHeight + (disconnected ? STAFF_BUILDER_PRINT_DISCONNECTED_RUN_GAP_PX : 0), 0)
    + Math.max(0, systems.length - 1) * STAFF_BUILDER_PRINT_SYSTEM_GAP_PX
    + (includesTitle ? STAFF_BUILDER_PRINT_TITLE_ALLOWANCE_PX : 0);
}

function fits(systems: readonly StaffBuilderPrintSystem[], includesTitle: boolean): boolean {
  return requiredHeight(systems, includesTitle) <= STAFF_BUILDER_PRINT_USABLE_PAGE_HEIGHT_PX;
}

export function composeStaffBuilderPrintPages(systems: readonly StaffBuilderPrintSystem[]): readonly StaffBuilderPrintPage[] {
  const groups: StaffBuilderPrintSystem[][] = [];
  let cursor = 0;
  while (cursor < systems.length) {
    const remaining = systems.length - cursor;
    const includesTitle = groups.length === 0;
    let count = Math.min(STAFF_BUILDER_PRINT_TARGET_SYSTEMS_PER_PAGE, remaining);
    if (remaining >= STAFF_BUILDER_PRINT_TARGET_SYSTEMS_PER_PAGE && !fits(systems.slice(cursor, cursor + count), includesTitle)) count = STAFF_BUILDER_PRINT_MINIMUM_SYSTEMS_PER_PAGE;
    if (remaining >= STAFF_BUILDER_PRINT_MINIMUM_SYSTEMS_PER_PAGE && !fits(systems.slice(cursor, cursor + count), includesTitle)) {
      count = Math.min(2, remaining);
      while (count > 1 && !fits(systems.slice(cursor, cursor + count), includesTitle)) count -= 1;
    }
    groups.push([...systems.slice(cursor, cursor + count)]);
    cursor += count;
  }
  if (groups.length >= 2 && groups.at(-1)?.length === 1 && groups.at(-2)?.length === 4) {
    const previous = groups.at(-2)!;
    const final = groups.at(-1)!;
    const moved = previous.at(-1)!;
    const previousIncludesTitle = groups.length === 2;
    if (fits(previous.slice(0, 3), previousIncludesTitle) && fits([moved, ...final], false)) {
      groups[groups.length - 2] = previous.slice(0, 3);
      groups[groups.length - 1] = [moved, ...final];
    }
  }
  return groups.map((pageSystems, pageIndex) => ({ pageIndex, includesTitle: pageIndex === 0, systems: pageSystems }));
}

export function getStaffBuilderPrintPageContentHeight(page: StaffBuilderPrintPage): number {
  return requiredHeight(page.systems, page.includesTitle);
}
