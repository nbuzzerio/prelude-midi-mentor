import { STAFF_BUILDER_TICKS_PER_QUARTER } from "@/features/staff-builder/staff-builder-time";

/** Audio-clock ticks since preparation began, never an independent UI timer. */
export function getMelodyPreparationCue(tick: number | undefined) {
  if (tick === undefined || !Number.isFinite(tick) || tick < 0 || tick >= 3 * STAFF_BUILDER_TICKS_PER_QUARTER) return null;
  const beat = tick / STAFF_BUILDER_TICKS_PER_QUARTER;
  return { remaining: 3 - Math.floor(beat), pulsing: beat % 1 < 0.25 };
}
