import type { StaffBuilderNotationControlAnchor, StaffBuilderNotationControlAnchors } from "../notation/render-staff-builder-measure";
import { getStaffBuilderInternalTouchSize, type StaffBuilderInternalPoint } from "./staff-builder-interaction-geometry";

export type StaffBuilderNotationControlName = keyof StaffBuilderNotationControlAnchors;

const SEMANTIC_PRIORITY: readonly StaffBuilderNotationControlName[] = ["trebleClef", "grandStaff", "bassClef", "keySignature", "timeSignature"];

function contains(anchor: StaffBuilderNotationControlAnchor, point: StaffBuilderInternalPoint): boolean {
  return point.x >= anchor.x && point.x <= anchor.x + anchor.width && point.y >= anchor.y && point.y <= anchor.y + anchor.height;
}

function expanded(anchor: StaffBuilderNotationControlAnchor, presentationScale: number): StaffBuilderNotationControlAnchor {
  const width = getStaffBuilderInternalTouchSize(anchor.width, presentationScale);
  const height = getStaffBuilderInternalTouchSize(anchor.height, presentationScale);
  return { x: anchor.x + anchor.width / 2 - width / 2, y: anchor.y + anchor.height / 2 - height / 2, width, height };
}

function distanceToRect(anchor: StaffBuilderNotationControlAnchor, point: StaffBuilderInternalPoint): number {
  const dx = Math.max(anchor.x - point.x, 0, point.x - (anchor.x + anchor.width));
  const dy = Math.max(anchor.y - point.y, 0, point.y - (anchor.y + anchor.height));
  return Math.hypot(dx, dy);
}

function centerDistance(anchor: StaffBuilderNotationControlAnchor, point: StaffBuilderInternalPoint): number {
  return Math.hypot(point.x - (anchor.x + anchor.width / 2), point.y - (anchor.y + anchor.height / 2));
}

export function resolveStaffBuilderNotationControl(
  anchors: StaffBuilderNotationControlAnchors,
  applicable: ReadonlySet<StaffBuilderNotationControlName>,
  presentationScale: number,
  point: StaffBuilderInternalPoint,
): StaffBuilderNotationControlName | null {
  return resolveStaffBuilderOriginalNotationControl(anchors, applicable, point)
    ?? resolveStaffBuilderExpandedNotationControl(anchors, applicable, presentationScale, point);
}

export function resolveStaffBuilderOriginalNotationControl(
  anchors: StaffBuilderNotationControlAnchors,
  applicable: ReadonlySet<StaffBuilderNotationControlName>,
  point: StaffBuilderInternalPoint,
): StaffBuilderNotationControlName | null {
  const candidates = SEMANTIC_PRIORITY.filter((name) => applicable.has(name)).map((name, priority) => ({ anchor: anchors[name], name, priority }));
  const original = candidates.filter(({ anchor }) => contains(anchor, point));
  if (original.length > 0) {
    original.sort((left, right) => left.anchor.width * left.anchor.height - right.anchor.width * right.anchor.height
      || centerDistance(left.anchor, point) - centerDistance(right.anchor, point)
      || left.priority - right.priority);
    return original[0]!.name;
  }
  return null;
}

export function resolveStaffBuilderExpandedNotationControl(
  anchors: StaffBuilderNotationControlAnchors,
  applicable: ReadonlySet<StaffBuilderNotationControlName>,
  presentationScale: number,
  point: StaffBuilderInternalPoint,
): StaffBuilderNotationControlName | null {
  if (resolveStaffBuilderOriginalNotationControl(anchors, applicable, point)) return null;
  const candidates = SEMANTIC_PRIORITY.filter((name) => applicable.has(name)).map((name, priority) => ({ anchor: anchors[name], name, priority }));
  const touch = candidates.filter(({ anchor }) => contains(expanded(anchor, presentationScale), point));
  touch.sort((left, right) => distanceToRect(left.anchor, point) - distanceToRect(right.anchor, point)
    || centerDistance(left.anchor, point) - centerDistance(right.anchor, point)
    || left.priority - right.priority);
  return touch[0]?.name ?? null;
}
