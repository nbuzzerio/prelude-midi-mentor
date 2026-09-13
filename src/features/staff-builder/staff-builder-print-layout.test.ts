import { describe, expect, it } from "vitest";
import type { StaffBuilderSystemLayout } from "./notation/staff-builder-system-layout";
import type { StaffBuilderScore } from "./staff-builder-types";
import {
  composeStaffBuilderPrintPages,
  getStaffBuilderPrintPageContentHeight,
  projectStaffBuilderPrintSystems,
  STAFF_BUILDER_PRINT_CSS_PIXELS_PER_INCH,
  STAFF_BUILDER_PRINT_MILLIMETERS_PER_INCH,
  STAFF_BUILDER_PRINT_PAGE_HEIGHT_MM,
  STAFF_BUILDER_PRINT_PAGE_MARGIN_MM,
  STAFF_BUILDER_PRINT_SYSTEM_GAP_PX,
  STAFF_BUILDER_PRINT_TITLE_ALLOWANCE_PX,
  STAFF_BUILDER_PRINT_USABLE_PAGE_HEIGHT_PX,
  STAFF_BUILDER_PRINT_MEASURE_LABEL_LANE_HEIGHT_PX,
  type StaffBuilderPrintSystem,
} from "./staff-builder-print-layout";

function systems(count: number, occupancyHeight = 220, renderHeight = occupancyHeight): StaffBuilderPrintSystem[] {
  return Array.from({ length: count }, (_value, systemIndex) => {
    const system: StaffBuilderSystemLayout = { systemIndex, x: 0, y: systemIndex * renderHeight, width: 696, height: renderHeight, measures: [{ measureId: `m${systemIndex}`, measureIndex: systemIndex, x: 0, y: 0, width: 340, height: renderHeight - 20 }] };
    return { system, occupancyHeight, renderOffsetY: 0, disconnected: false };
  });
}

describe("Staff Builder print page composition", () => {
  it("models conservative Letter portrait height with the same 12mm CSS page margins", () => {
    expect(STAFF_BUILDER_PRINT_PAGE_HEIGHT_MM).toBe(279.4);
    expect(STAFF_BUILDER_PRINT_PAGE_MARGIN_MM).toBe(12);
    expect(STAFF_BUILDER_PRINT_USABLE_PAGE_HEIGHT_PX).toBeCloseTo((279.4 - 24) * STAFF_BUILDER_PRINT_CSS_PIXELS_PER_INCH / STAFF_BUILDER_PRINT_MILLIMETERS_PER_INCH, 8);
  });

  it("composes ordinary systems four per page and counts title and gaps exactly once", () => {
    const twelve = composeStaffBuilderPrintPages(systems(12));
    const eight = composeStaffBuilderPrintPages(systems(8));
    expect(twelve.map(({ systems: pageSystems }) => pageSystems.length)).toEqual([4, 4, 4]);
    expect(eight.map(({ systems: pageSystems }) => pageSystems.length)).toEqual([4, 4]);
    expect(getStaffBuilderPrintPageContentHeight(twelve[0]!)).toBe(4 * 220 + 3 * STAFF_BUILDER_PRINT_SYSTEM_GAP_PX + STAFF_BUILDER_PRINT_TITLE_ALLOWANCE_PX);
    expect(getStaffBuilderPrintPageContentHeight(twelve[1]!)).toBe(4 * 220 + 3 * STAFF_BUILDER_PRINT_SYSTEM_GAP_PX);
  });

  it("uses three systems when title or tall geometry makes four unsafe", () => {
    expect(composeStaffBuilderPrintPages(systems(8, 230))[0]?.systems).toHaveLength(3);
    expect(composeStaffBuilderPrintPages(systems(8, 300))[0]?.systems).toHaveLength(3);
  });

  it("allows genuinely tall systems to force fewer than three and allows a partial final page", () => {
    expect(composeStaffBuilderPrintPages(systems(5, 400)).map(({ systems: pageSystems }) => pageSystems.length)).toEqual([2, 2, 1]);
    expect(composeStaffBuilderPrintPages(systems(6)).map(({ systems: pageSystems }) => pageSystems.length)).toEqual([4, 2]);
  });

  it("rebalances only a pathological one-system final page from four to three and two", () => {
    expect(composeStaffBuilderPrintPages(systems(9)).map(({ systems: pageSystems }) => pageSystems.length)).toEqual([4, 3, 2]);
    expect(composeStaffBuilderPrintPages(systems(7)).map(({ systems: pageSystems }) => pageSystems.length)).toEqual([4, 3]);
  });

  it("separates conservative render height from low-note visible occupancy while retaining lyrics and footer", () => {
    const lowEvent = { id: "low", kind: "notes" as const, staff: "bass" as const, startTick: 0, rhythm: { status: "final" as const, duration: "whole" as const }, pitches: [{ id: "low-pitch", midiNumber: 26, letter: "D" as const, accidental: "natural" as const, octave: 1 }] };
    const current: StaffBuilderScore = { schemaVersion: 3, annotations: [{ id: "cue", kind: "lyric-cue", anchor: { kind: "event", eventId: "low" }, text: "Low" }], id: "score", title: "Occupancy", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", ties: [], measures: [{ id: "m1", events: [lowEvent] }] };
    const renderSystem = systems(1, 320, 360)[0]!.system;
    const placementY = 24;
    const projected = projectStaffBuilderPrintSystems(current, [{ ...renderSystem, measures: [{ ...renderSystem.measures[0]!, measureId: "m1", y: placementY }] }])[0]!;
    expect(projected.occupancyHeight).toBeLessThan(projected.system.height);
    expect(projected.occupancyHeight).toBeGreaterThan(200 + STAFF_BUILDER_PRINT_MEASURE_LABEL_LANE_HEIGHT_PX);
    expect(projected.renderOffsetY).toBe(0);
  });
});
