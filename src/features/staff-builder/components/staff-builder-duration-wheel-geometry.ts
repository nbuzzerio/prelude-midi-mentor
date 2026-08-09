export const STAFF_BUILDER_DURATION_WHEEL_SIZE = 268;
const RING_RADIUS = 88;

export type StaffBuilderDisplayedAnchor = Readonly<{ x: number; y: number; width: number; height: number }>;
export type StaffBuilderOverlayBounds = Readonly<{ left: number; top: number; width: number; height: number }>;

export function getStaffBuilderDurationWheelPlacement(anchor: StaffBuilderDisplayedAnchor, bounds: StaffBuilderOverlayBounds) {
  const preferredLeft = anchor.x + anchor.width / 2 - STAFF_BUILDER_DURATION_WHEEL_SIZE / 2;
  const preferredTop = anchor.y + anchor.height / 2 - STAFF_BUILDER_DURATION_WHEEL_SIZE / 2;
  const maximumLeft = bounds.left + Math.max(0, bounds.width - STAFF_BUILDER_DURATION_WHEEL_SIZE);
  const maximumTop = bounds.top + Math.max(0, bounds.height - STAFF_BUILDER_DURATION_WHEEL_SIZE);
  return {
    left: Math.max(bounds.left, Math.min(preferredLeft, maximumLeft)),
    top: Math.max(bounds.top, Math.min(preferredTop, maximumTop)),
  };
}

export function getStaffBuilderDurationRingPosition(index: number) {
  const angle = -Math.PI / 2 + index * Math.PI / 4;
  return { left: STAFF_BUILDER_DURATION_WHEEL_SIZE / 2 + Math.cos(angle) * RING_RADIUS, top: STAFF_BUILDER_DURATION_WHEEL_SIZE / 2 + Math.sin(angle) * RING_RADIUS };
}
