import { describe, expect, it } from "vitest";
import { getStaffBuilderInternalTouchSize, getStaffBuilderPresentationScale, getStaffBuilderTemporalRegion, resolveStaffBuilderPositionTick, resolveStaffBuilderStepPositionTick, staffBuilderClientPointToInternal, staffBuilderTickToX } from "./staff-builder-interaction-geometry";

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

  it("maps ticks continuously and changes region width without moving its onset", () => {
    const timeline = { rhythmicStartX: 100, rhythmicEndX: 580, y: 40, height: 220, capacityTicks: 1920 };
    expect(staffBuilderTickToX(timeline, 480)).toBe(220);
    expect(getStaffBuilderTemporalRegion(timeline, 480, 480)).toEqual({ x: 220, y: 40, width: 120, height: 220 });
    expect(getStaffBuilderTemporalRegion(timeline, 480, 240)).toEqual({ x: 220, y: 40, width: 60, height: 220 });
    expect(getStaffBuilderTemporalRegion(timeline, 480, 120)).toEqual({ x: 220, y: 40, width: 30, height: 220 });
  });

  it.each([
    [960, 480, [0, 480]],
    [1440, 480, [0, 480, 960]],
    [1920, 480, [0, 480, 960, 1440]],
    [1440, 240, [0, 240, 480, 720, 960, 1200]],
    [1440, 120, [0, 120, 240, 360, 480, 600, 720, 840, 960, 1080, 1200, 1320]],
  ])("derives only active-step positions for capacity %i and step %i", (capacityTicks, stepTicks, expected) => {
    const timeline = { rhythmicStartX: 100, rhythmicEndX: 580, y: 40, height: 220, capacityTicks };
    const regionWidth = (timeline.rhythmicEndX - timeline.rhythmicStartX) * stepTicks / capacityTicks;
    const resolved = expected.map((_tick, index) => resolveStaffBuilderStepPositionTick(timeline, { x: timeline.rhythmicStartX + regionWidth * (index + 0.5), y: 100 }, stepTicks));
    expect(resolved).toEqual(expected);
  });

  it("cannot select a sixteenth-only onset while Quarter Step is active", () => {
    const timeline = { rhythmicStartX: 100, rhythmicEndX: 580, y: 40, height: 220, capacityTicks: 1920 };
    expect(resolveStaffBuilderStepPositionTick(timeline, { x: 175, y: 100 }, 480)).toBe(0);
    expect(resolveStaffBuilderStepPositionTick(timeline, { x: 175, y: 100 }, 120)).toBe(240);
  });

  it.each([
    ["2/4", 960], ["3/4", 1440], ["4/4", 1920], ["6/8", 1440],
  ] as const)("offers quarter, eighth, and sixteenth cells across %s", (_meter, capacityTicks) => {
    const timeline = { rhythmicStartX: 100, rhythmicEndX: 580, y: 40, height: 220, capacityTicks };
    for (const stepTicks of [480, 240, 120]) {
      const expected = Array.from({ length: capacityTicks / stepTicks }, (_unused, index) => index * stepTicks);
      const actual = expected.map((_tick, index) => resolveStaffBuilderStepPositionTick(timeline, {
        x: timeline.rhythmicStartX + (timeline.rhythmicEndX - timeline.rhythmicStartX) * (index + 0.5) * stepTicks / capacityTicks,
        y: 100,
      }, stepTicks));
      expect(actual).toEqual(expected);
    }
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
