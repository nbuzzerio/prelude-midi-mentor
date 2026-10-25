import type { StaffBuilderRenderAnchors } from "@/features/staff-builder/notation/render-staff-builder-measure";
import { projectStaffBuilderMeasure } from "@/features/staff-builder/notation/staff-builder-notation";
import { getStaffBuilderLyricCues, STAFF_BUILDER_LYRIC_LANE_RESERVATION } from "@/features/staff-builder/notation/staff-builder-lyric-cues";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";

export const CONTINUOUS_READING_SCALE = 1.35;

export function continuousReadingScrollLeft(center: number, viewport: number, content: number, opening: number) {
  // Showing the opening signatures/onset must not jump when Next becomes Active.
  return Math.max(0, Math.min(Math.max(0, content - viewport), center - Math.max(viewport * .55, opening)));
}

export function continuousReadingEnvelope(score: StaffBuilderScore, start: number, end: number) {
  const projections = Array.from({ length: end - start + 1 }, (_, i) => projectStaffBuilderMeasure(score, start + i));
  const pitchSources = projections.flatMap(p => [...p.staves.treble, ...p.staves.bass]
    .flatMap(e => e.kind === "notes" ? [{ staff: e.staff, clef: p.clefs[e.staff], pitches: e.pitches }] : []));
  const ids = new Set(score.measures.slice(start, end + 1).flatMap(m => m.events.map(e => e.id)));
  return { pitchSources, topLaneReservation: getStaffBuilderLyricCues(score, ids).length ? STAFF_BUILDER_LYRIC_LANE_RESERVATION : 0 };
}

/** Upcoming keeps its physical slot and keyed SVG when it becomes current. */
export function continuousReadingSlots(start: number, end: number, current: number, review = false) {
  return Array.from({ length: Math.min(review ? 1 : 3, end - current + 1) }, (_, i) => ({
    measureIndex: current + i, slot: (current + i - start) % 2, prepared: i === 2,
  }));
}

/** Union of both staves' actual engraved onset anchors, never uniform time/X. */
export function resolveContinuousReadingPosition(anchors: StaffBuilderRenderAnchors,
  events: StaffBuilderScore["measures"][number]["events"], tick: number | undefined) {
  if (tick === undefined || !Number.isFinite(tick)) return null;
  const { rhythmicStartX, rhythmicEndX, capacityTicks, y, height } = anchors.timeline;
  if (![rhythmicStartX, rhythmicEndX, capacityTicks, y, height].every(Number.isFinite)
    || capacityTicks <= 0 || height <= 0 || rhythmicEndX < rhythmicStartX || !events.length) return null;
  const points: { tick: number; x: number }[] = [];
  for (const event of [...events].sort((a, b) => a.startTick - b.startTick)) {
    const a = anchors.authoritativeEvents.get(event.id);
    if (!a || a.eventId !== event.id || a.staff !== event.staff || a.startTick !== event.startTick
      || !Number.isFinite(a.onsetX) || a.onsetX < rhythmicStartX || a.onsetX > rhythmicEndX
      || event.startTick < 0 || event.startTick >= capacityTicks) return null;
    const last = points.at(-1);
    // VexFlow may differ by subpixel rounding for aligned voices.
    if (last && (a.onsetX < last.x - 0.5 || event.startTick === last.tick && Math.abs(a.onsetX - last.x) > 0.5)) return null;
    if (!last || last.tick !== event.startTick) points.push({ tick: event.startTick, x: a.onsetX });
  }
  if (points[0]!.tick > 0) points.unshift({ tick: 0, x: rhythmicStartX });
  points.push({ tick: capacityTicks, x: rhythmicEndX });
  const value = Math.max(0, Math.min(capacityTicks, tick));
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]!, to = points[i]!;
    if (value <= to.tick) return { x: from.x + (to.x - from.x) * (value - from.tick) / (to.tick - from.tick), y, height };
  }
  return null;
}
