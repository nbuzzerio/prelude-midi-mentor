import type { StaffBuilderPositionAnchor } from "../notation/render-staff-builder-measure";

export type StaffBuilderInternalPoint = Readonly<{ x: number; y: number }>;

export function staffBuilderClientPointToInternal(
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  coordinateSpace: Readonly<{ width: number; height: number }>,
  client: Readonly<{ x: number; y: number }>,
): StaffBuilderInternalPoint | null {
  if (rect.width <= 0 || rect.height <= 0 || coordinateSpace.width <= 0 || coordinateSpace.height <= 0) return null;
  return {
    x: (client.x - rect.left) * coordinateSpace.width / rect.width,
    y: (client.y - rect.top) * coordinateSpace.height / rect.height,
  };
}

export function resolveStaffBuilderPositionTick(
  positions: ReadonlyMap<number, StaffBuilderPositionAnchor>,
  point: StaffBuilderInternalPoint,
): number | null {
  const ordered = [...positions.values()].sort((left, right) => left.tick - right.tick);
  if (ordered.length === 0) return null;
  const minY = Math.min(...ordered.map(({ y }) => y));
  const maxY = Math.max(...ordered.map(({ y, height }) => y + height));
  const minX = Math.min(...ordered.map(({ x }) => x));
  const maxX = Math.max(...ordered.map(({ x, width }) => x + width));
  if (point.y < minY || point.y > maxY || point.x < minX || point.x > maxX) return null;
  const containing = ordered.find(({ x, width }) => point.x >= x && point.x <= x + width);
  return (containing ?? ordered.reduce((nearest, candidate) => {
    const candidateDistance = Math.abs(point.x - (candidate.x + candidate.width / 2));
    const nearestDistance = Math.abs(point.x - (nearest.x + nearest.width / 2));
    return candidateDistance < nearestDistance ? candidate : nearest;
  })).tick;
}

export function getStaffBuilderPresentationScale(availableWidth: number, internalWidth: number, minimumWidth = 480): number {
  if (availableWidth <= 0 || internalWidth <= 0) return 1;
  return Math.min(1, Math.max(minimumWidth, availableWidth) / internalWidth);
}

export function getStaffBuilderInternalTouchSize(anchorSize: number, presentationScale: number, minimumDisplayedSize = 44): number {
  const scale = presentationScale > 0 ? presentationScale : 1;
  return Math.max(anchorSize, minimumDisplayedSize / scale);
}
