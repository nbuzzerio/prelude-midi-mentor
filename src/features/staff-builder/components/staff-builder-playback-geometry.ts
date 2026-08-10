import type { StaffBuilderTemporalGeometry } from "../notation/render-staff-builder-measure";
import { STAFF_BUILDER_TICKS_PER_QUARTER } from "../staff-builder-time";
import { getStaffBuilderTemporalRegion } from "./staff-builder-interaction-geometry";

export type StaffBuilderPlaybackGeometry = Readonly<{ x: number; y: number; width: number; height: number }>;

export function resolveStaffBuilderPlaybackGeometry(timeline: StaffBuilderTemporalGeometry, tick: number): StaffBuilderPlaybackGeometry {
  return getStaffBuilderTemporalRegion(timeline, tick, STAFF_BUILDER_TICKS_PER_QUARTER / 4);
}
