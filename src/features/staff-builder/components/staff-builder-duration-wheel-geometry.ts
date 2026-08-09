export const STAFF_BUILDER_DURATION_WHEEL_SIZE = 268;
const RING_RADIUS = 88;

import { getStaffBuilderRadialPlacement, getStaffBuilderRadialRingPosition } from "./staff-builder-radial-geometry";
export type { StaffBuilderDisplayedAnchor, StaffBuilderOverlayBounds } from "./staff-builder-radial-geometry";
import type { StaffBuilderDisplayedAnchor, StaffBuilderOverlayBounds } from "./staff-builder-radial-geometry";

export function getStaffBuilderDurationWheelPlacement(anchor: StaffBuilderDisplayedAnchor, bounds: StaffBuilderOverlayBounds) {
  return getStaffBuilderRadialPlacement(anchor, bounds, STAFF_BUILDER_DURATION_WHEEL_SIZE);
}

export function getStaffBuilderDurationRingPosition(index: number) {
  return getStaffBuilderRadialRingPosition(index, 8, RING_RADIUS, STAFF_BUILDER_DURATION_WHEEL_SIZE);
}
