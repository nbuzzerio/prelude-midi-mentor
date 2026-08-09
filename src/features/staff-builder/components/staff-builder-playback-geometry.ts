import type { StaffBuilderPositionAnchor } from "../notation/render-staff-builder-measure";

export type StaffBuilderPlaybackGeometry = Readonly<{ x: number; y: number; width: number; height: number }>;

function interpolate(left: StaffBuilderPositionAnchor, right: StaffBuilderPositionAnchor, progress: number): StaffBuilderPlaybackGeometry {
  const mix = (start: number, end: number) => start + (end - start) * progress;
  return { x: mix(left.x, right.x), y: mix(left.y, right.y), width: mix(left.width, right.width), height: mix(left.height, right.height) };
}

export function resolveStaffBuilderPlaybackGeometry(positions: ReadonlyMap<number, StaffBuilderPositionAnchor>, tick: number): StaffBuilderPlaybackGeometry | null {
  const ordered = [...positions.values()].sort((left, right) => left.tick - right.tick);
  if (ordered.length === 0) return null;
  const exact = positions.get(tick);
  if (exact) return { x: exact.x, y: exact.y, width: exact.width, height: exact.height };
  const first = ordered[0]!;
  if (tick <= first.tick) return { x: first.x, y: first.y, width: first.width, height: first.height };
  for (let index = 1; index < ordered.length; index += 1) {
    const right = ordered[index]!;
    if (tick < right.tick) {
      const left = ordered[index - 1]!;
      return interpolate(left, right, (tick - left.tick) / (right.tick - left.tick));
    }
  }
  const last = ordered.at(-1)!;
  const previous = ordered.at(-2);
  const stepTicks = previous ? last.tick - previous.tick : 120;
  const progress = Math.max(0, Math.min(1, (tick - last.tick) / Math.max(1, stepTicks)));
  return { x: last.x + last.width * progress, y: last.y, width: last.width, height: last.height };
}
