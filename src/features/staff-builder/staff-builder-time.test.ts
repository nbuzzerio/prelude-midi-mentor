import { describe, expect, it } from "vitest";
import {
  STAFF_BUILDER_TICKS_PER_QUARTER,
  durationToTicks,
  getMeasureCapacityTicks,
  getMeasureStartTick,
  isValidStaffBuilderPosition,
  moveStaffBuilderPositionBackward,
  moveStaffBuilderPositionForward,
  normalizeStaffBuilderPosition,
  stepDurationToTicks,
  tickBoundaryDurationMilliseconds,
  ticksToMilliseconds,
  type StaffBuilderDuration,
  type StaffBuilderStepDuration,
  type StaffBuilderTimeSignature,
} from "./staff-builder-time";

describe("Staff Builder musical time", () => {
  it("uses 480 ticks per quarter and maps every step duration", () => {
    expect(STAFF_BUILDER_TICKS_PER_QUARTER).toBe(480);
    expect(Object.fromEntries((["quarter", "eighth", "sixteenth"] as StaffBuilderStepDuration[]).map((value) => [value, stepDurationToTicks(value)])))
      .toEqual({ quarter: 480, eighth: 240, sixteenth: 120 });
  });

  it("maps every final duration", () => {
    const expected: Record<StaffBuilderDuration, number> = {
      whole: 1920, "dotted-half": 1440, half: 960, "dotted-quarter": 720,
      quarter: 480, "dotted-eighth": 360, eighth: 240, sixteenth: 120,
    };
    for (const [duration, ticks] of Object.entries(expected)) expect(durationToTicks(duration as StaffBuilderDuration)).toBe(ticks);
  });

  it("maps every supported measure capacity", () => {
    expect((["2/4", "3/4", "4/4", "6/8"] as StaffBuilderTimeSignature[]).map(getMeasureCapacityTicks))
      .toEqual([960, 1440, 1920, 1440]);
  });

  it("validates integer positions inside available measures", () => {
    expect(isValidStaffBuilderPosition({ measureIndex: 0, offsetTicks: 0 }, [960])).toBe(true);
    expect(isValidStaffBuilderPosition({ measureIndex: 0, offsetTicks: 959 }, [960])).toBe(true);
    expect(isValidStaffBuilderPosition({ measureIndex: 0, offsetTicks: 960 }, [960])).toBe(false);
    expect(isValidStaffBuilderPosition({ measureIndex: -1, offsetTicks: 0 }, [960])).toBe(false);
    expect(isValidStaffBuilderPosition({ measureIndex: 0, offsetTicks: 0.5 }, [960])).toBe(false);
  });

  it("moves by quarter, eighth, and sixteenth steps", () => {
    const capacities = [1920];
    expect(moveStaffBuilderPositionForward({ measureIndex: 0, offsetTicks: 0 }, "quarter", capacities).offsetTicks).toBe(480);
    expect(moveStaffBuilderPositionForward({ measureIndex: 0, offsetTicks: 0 }, "eighth", capacities).offsetTicks).toBe(240);
    expect(moveStaffBuilderPositionForward({ measureIndex: 0, offsetTicks: 0 }, "sixteenth", capacities).offsetTicks).toBe(120);
  });

  it("crosses measure boundaries forward and backward", () => {
    const capacities = [960, 1440];
    expect(moveStaffBuilderPositionForward({ measureIndex: 0, offsetTicks: 720 }, "quarter", capacities)).toEqual({ measureIndex: 1, offsetTicks: 240 });
    expect(moveStaffBuilderPositionBackward({ measureIndex: 1, offsetTicks: 120 }, "eighth", capacities)).toEqual({ measureIndex: 0, offsetTicks: 840 });
  });

  it("normalizes across differently sized 3/4 and 6/8 measures", () => {
    expect(normalizeStaffBuilderPosition({ measureIndex: 0, offsetTicks: 1560 }, [1440, 1440])).toEqual({ measureIndex: 1, offsetTicks: 120 });
    expect(getMeasureStartTick([1440, 1440, 960], 2)).toBe(2880);
  });

  it("uses absolute tick boundaries without cumulative rounding drift", () => {
    expect(ticksToMilliseconds(480, 120)).toBe(500);
    expect(ticksToMilliseconds(1440, 120)).toBe(1500);
    const thirds = [0, 160, 320, 480].map((tick) => ticksToMilliseconds(tick, 120));
    expect(thirds).toEqual([0, 167, 333, 500]);
    expect([0, 1, 2].reduce((sum, index) => sum + tickBoundaryDurationMilliseconds(thirds[index] === undefined ? 0 : index * 160, (index + 1) * 160, 120), 0)).toBe(500);
  });

  it("rejects unsupported values, invalid tempo, and invalid arithmetic", () => {
    expect(() => stepDurationToTicks("half" as StaffBuilderStepDuration)).toThrow(/Unsupported/);
    expect(() => durationToTicks("triplet" as StaffBuilderDuration)).toThrow(/Unsupported/);
    expect(() => getMeasureCapacityTicks("5/4" as StaffBuilderTimeSignature)).toThrow(/Unsupported/);
    expect(() => ticksToMilliseconds(480, 0)).toThrow(/Tempo/);
    expect(() => ticksToMilliseconds(0.5, 120)).toThrow(/integer/);
    expect(() => normalizeStaffBuilderPosition({ measureIndex: 0, offsetTicks: -1 }, [960])).toThrow(/outside/);
  });
});
