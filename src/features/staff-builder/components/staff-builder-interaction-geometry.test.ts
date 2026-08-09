import { describe, expect, it } from "vitest";
import { getStaffBuilderInternalTouchSize, getStaffBuilderPresentationScale, resolveStaffBuilderPositionTick, staffBuilderClientPointToInternal } from "./staff-builder-interaction-geometry";

const positions = new Map([
  [0, { tick: 0, x: 100, y: 40, width: 30, height: 220 }],
  [120, { tick: 120, x: 130, y: 40, width: 30, height: 220 }],
  [240, { tick: 240, x: 160, y: 40, width: 30, height: 220 }],
  [1800, { tick: 1800, x: 610, y: 40, width: 30, height: 220 }],
]);

describe("Staff Builder interaction geometry", () => {
  it("translates displayed coordinates into the fixed internal plane", () => {
    expect(staffBuilderClientPointToInternal({ left: 20, top: 10, width: 380, height: 150 }, { width: 760, height: 300 }, { x: 210, y: 85 })).toEqual({ x: 380, y: 150 });
    expect(staffBuilderClientPointToInternal({ left: -80, top: 10, width: 380, height: 150 }, { width: 760, height: 300 }, { x: 110, y: 85 })).toEqual({ x: 380, y: 150 });
  });

  it("resolves containing and nearest valid sixteenth positions deterministically", () => {
    expect(resolveStaffBuilderPositionTick(positions, { x: 101, y: 100 })).toBe(0);
    expect(resolveStaffBuilderPositionTick(positions, { x: 145, y: 100 })).toBe(120);
    expect(resolveStaffBuilderPositionTick(positions, { x: 175, y: 100 })).toBe(240);
    expect(resolveStaffBuilderPositionTick(positions, { x: 625, y: 100 })).toBe(1800);
    expect(resolveStaffBuilderPositionTick(positions, { x: 175, y: 300 })).toBeNull();
  });

  it("scales down to a readable minimum and never enlarges the internal plane", () => {
    expect(getStaffBuilderPresentationScale(760, 760)).toBe(1);
    expect(getStaffBuilderPresentationScale(570, 760)).toBe(0.75);
    expect(getStaffBuilderPresentationScale(320, 760)).toBeCloseTo(480 / 760);
  });

  it("compensates internal hit geometry to retain a 44px displayed target", () => {
    expect(getStaffBuilderInternalTouchSize(20, 1)).toBe(44);
    const scale = 480 / 760;
    expect(getStaffBuilderInternalTouchSize(20, scale) * scale).toBeCloseTo(44);
    expect(getStaffBuilderInternalTouchSize(90, scale)).toBe(90);
  });
});
