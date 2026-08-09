import { describe, expect, it } from "vitest";
import { resolveStaffBuilderPlaybackGeometry } from "./staff-builder-playback-geometry";

const positions = new Map([
  [0, { tick: 0, x: 100, y: 40, width: 30, height: 220 }],
  [120, { tick: 120, x: 140, y: 40, width: 32, height: 220 }],
  [240, { tick: 240, x: 190, y: 40, width: 30, height: 220 }],
]);

describe("Staff Builder playback geometry", () => {
  it("uses exact anchors and interpolates deterministically", () => {
    expect(resolveStaffBuilderPlaybackGeometry(positions, 0)).toEqual({ x: 100, y: 40, width: 30, height: 220 });
    expect(resolveStaffBuilderPlaybackGeometry(positions, 60)).toEqual({ x: 120, y: 40, width: 31, height: 220 });
    expect(resolveStaffBuilderPlaybackGeometry(positions, 180)).toEqual({ x: 165, y: 40, width: 31, height: 220 });
  });

  it("clamps the beginning and advances deterministically through the final cell", () => {
    expect(resolveStaffBuilderPlaybackGeometry(positions, -20)?.x).toBe(100);
    expect(resolveStaffBuilderPlaybackGeometry(positions, 300)?.x).toBe(205);
    expect(resolveStaffBuilderPlaybackGeometry(positions, 360)?.x).toBe(220);
    expect(resolveStaffBuilderPlaybackGeometry(new Map(), 0)).toBeNull();
  });
});
