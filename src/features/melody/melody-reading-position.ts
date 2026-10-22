import type { StaffBuilderRenderAnchors } from "@/features/staff-builder/notation/render-staff-builder-measure";
import type { StaffBuilderEvent, StaffBuilderStaff } from "@/features/staff-builder/staff-builder-types";

export type MelodyReadingPosition = Readonly<{ x: number; y: number; height: number }>;

/** SVG-local presentation geometry. Undefined tick hides the Ready/count-in cursor. */
export function resolveMelodyReadingPosition({ anchors, events, staff, tick }: Readonly<{
  anchors: Pick<StaffBuilderRenderAnchors, "authoritativeEvents" | "timeline">;
  events: readonly Pick<StaffBuilderEvent, "id" | "staff" | "startTick">[];
  staff: StaffBuilderStaff;
  tick: number | undefined;
}>): MelodyReadingPosition | null {
  if (tick === undefined || !Number.isFinite(tick)) return null;
  const { timeline, authoritativeEvents } = anchors;
  const { rhythmicStartX, rhythmicEndX, capacityTicks, y, height } = timeline;
  if (![rhythmicStartX, rhythmicEndX, capacityTicks, y, height].every(Number.isFinite)
    || capacityTicks <= 0 || height <= 0 || rhythmicEndX < rhythmicStartX) return null;

  const selected = events.filter(event => event.staff === staff).sort((a, b) => a.startTick - b.startTick);
  if (selected.length === 0) return null;
  const points: Array<Readonly<{ tick: number; x: number }>> = [];
  for (const event of selected) {
    const anchor = authoritativeEvents.get(event.id);
    // A stale or incomplete render must not invent a position for an authored onset.
    if (!anchor || anchor.eventId !== event.id || anchor.staff !== staff || anchor.startTick !== event.startTick
      || !Number.isFinite(event.startTick) || event.startTick < 0 || event.startTick >= capacityTicks
      || !Number.isFinite(anchor.onsetX) || anchor.onsetX < rhythmicStartX || anchor.onsetX > rhythmicEndX) return null;
    const previous = points.at(-1);
    if (previous && (anchor.onsetX < previous.x || event.startTick === previous.tick && anchor.onsetX !== previous.x)) return null;
    if (!previous || event.startTick !== previous.tick) points.push({ tick: event.startTick, x: anchor.onsetX });
  }

  if (points[0]!.tick > 0) points.unshift({ tick: 0, x: rhythmicStartX });
  points.push({ tick: capacityTicks, x: rhythmicEndX });
  const clampedTick = Math.max(0, Math.min(capacityTicks, tick));
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1]!, next = points[index]!;
    if (clampedTick > next.tick) continue;
    if (clampedTick === next.tick) return { x: next.x, y, height };
    const fraction = (clampedTick - previous.tick) / (next.tick - previous.tick);
    return { x: previous.x + (next.x - previous.x) * fraction, y, height };
  }
  return null;
}
