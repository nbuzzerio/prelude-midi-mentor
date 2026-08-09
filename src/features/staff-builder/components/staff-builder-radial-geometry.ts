export type StaffBuilderDisplayedAnchor = Readonly<{ x: number; y: number; width: number; height: number }>;
export type StaffBuilderOverlayBounds = Readonly<{ left: number; top: number; width: number; height: number }>;

export function getStaffBuilderRadialPlacement(anchor: StaffBuilderDisplayedAnchor, bounds: StaffBuilderOverlayBounds, wheelSize: number) {
  const preferredLeft = anchor.x + anchor.width / 2 - wheelSize / 2;
  const preferredTop = anchor.y + anchor.height / 2 - wheelSize / 2;
  const maximumLeft = bounds.left + Math.max(0, bounds.width - wheelSize);
  const maximumTop = bounds.top + Math.max(0, bounds.height - wheelSize);
  return {
    left: Math.max(bounds.left, Math.min(preferredLeft, maximumLeft)),
    top: Math.max(bounds.top, Math.min(preferredTop, maximumTop)),
  };
}

export function getStaffBuilderRadialRingPosition(index: number, count: number, radius: number, wheelSize: number) {
  const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
  return { left: wheelSize / 2 + Math.cos(angle) * radius, top: wheelSize / 2 + Math.sin(angle) * radius };
}
