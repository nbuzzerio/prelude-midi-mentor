import { describe, expect, it } from "vitest";
import { resolveStaffBuilderPlaybackGeometry } from "./staff-builder-playback-geometry";

const timeline = { rhythmicStartX: 100, rhythmicEndX: 580, y: 40, height: 220, capacityTicks: 1920 };

describe("Staff Builder playback geometry", () => {
  it("uses the continuous temporal span rather than engraved anchors", () => {
    expect(resolveStaffBuilderPlaybackGeometry(timeline, 0)).toEqual({ x: 100, y: 40, width: 30, height: 220 });
    expect(resolveStaffBuilderPlaybackGeometry(timeline, 60)).toEqual({ x: 115, y: 40, width: 30, height: 220 });
    expect(resolveStaffBuilderPlaybackGeometry(timeline, 180)).toEqual({ x: 145, y: 40, width: 30, height: 220 });
  });

  it("clamps the beginning and advances deterministically through the final cell", () => {
    expect(resolveStaffBuilderPlaybackGeometry(timeline, -20).x).toBe(100);
    expect(resolveStaffBuilderPlaybackGeometry(timeline, 1920).x).toBe(580);
    expect(resolveStaffBuilderPlaybackGeometry(timeline, 2000).x).toBe(580);
  });

  it.each([960, 1440, 1920])("uses a 120-tick visual span for capacity %i", (capacityTicks) => {
    const current = { ...timeline, capacityTicks };
    const geometry = resolveStaffBuilderPlaybackGeometry(current, 0);
    expect(geometry.width / (current.rhythmicEndX - current.rhythmicStartX) * capacityTicks).toBe(120);
  });

  it("clips the sixteenth-width highlight at the final boundary", () => {
    const geometry = resolveStaffBuilderPlaybackGeometry(timeline, 1860);
    expect(geometry.x + geometry.width).toBe(timeline.rhythmicEndX);
    expect(geometry.width).toBe(15);
  });
});
