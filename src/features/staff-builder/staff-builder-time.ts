export const STAFF_BUILDER_TICKS_PER_QUARTER = 480;

export const STAFF_BUILDER_TIME_SIGNATURES = ["2/4", "3/4", "4/4", "6/8"] as const;
export type StaffBuilderTimeSignature = (typeof STAFF_BUILDER_TIME_SIGNATURES)[number];

export const STAFF_BUILDER_STEP_DURATIONS = ["quarter", "eighth", "sixteenth"] as const;
export type StaffBuilderStepDuration = (typeof STAFF_BUILDER_STEP_DURATIONS)[number];

export const STAFF_BUILDER_DURATIONS = [
  "whole", "dotted-half", "half", "dotted-quarter", "quarter", "dotted-eighth", "eighth", "sixteenth",
] as const;
export type StaffBuilderDuration = (typeof STAFF_BUILDER_DURATIONS)[number];

const STEP_TICKS: Readonly<Record<StaffBuilderStepDuration, number>> = {
  quarter: 480, eighth: 240, sixteenth: 120,
};
const DURATION_TICKS: Readonly<Record<StaffBuilderDuration, number>> = {
  whole: 1920, "dotted-half": 1440, half: 960, "dotted-quarter": 720,
  quarter: 480, "dotted-eighth": 360, eighth: 240, sixteenth: 120,
};
const CAPACITY_TICKS: Readonly<Record<StaffBuilderTimeSignature, number>> = {
  "2/4": 960, "3/4": 1440, "4/4": 1920, "6/8": 1440,
};

function requireOwn<T extends string>(record: Readonly<Record<T, number>>, value: T, label: string): number {
  if (!Object.prototype.hasOwnProperty.call(record, value)) throw new Error(`Unsupported ${label}: ${String(value)}.`);
  return record[value];
}

export function stepDurationToTicks(value: StaffBuilderStepDuration): number {
  return requireOwn(STEP_TICKS, value, "Staff Builder step duration");
}
export function durationToTicks(value: StaffBuilderDuration): number {
  return requireOwn(DURATION_TICKS, value, "Staff Builder duration");
}
export function getMeasureCapacityTicks(value: StaffBuilderTimeSignature): number {
  return requireOwn(CAPACITY_TICKS, value, "Staff Builder time signature");
}

export type StaffBuilderPosition = Readonly<{ measureIndex: number; offsetTicks: number }>;

export function isValidStaffBuilderPosition(position: StaffBuilderPosition, capacities: readonly number[]): boolean {
  const capacity = capacities[position.measureIndex];
  return Number.isInteger(position.measureIndex) && position.measureIndex >= 0
    && Number.isInteger(position.offsetTicks) && position.offsetTicks >= 0
    && capacity !== undefined && Number.isInteger(capacity) && capacity > 0
    && position.offsetTicks < capacity;
}

function requireCapacities(capacities: readonly number[]): void {
  if (capacities.length === 0 || capacities.some((value) => !Number.isInteger(value) || value <= 0)) {
    throw new Error("Measure capacities must be positive integers.");
  }
}

export function normalizeStaffBuilderPosition(position: StaffBuilderPosition, capacities: readonly number[]): StaffBuilderPosition {
  requireCapacities(capacities);
  if (!Number.isInteger(position.measureIndex) || !Number.isInteger(position.offsetTicks)) {
    throw new Error("Staff Builder positions must use integer ticks.");
  }
  let measureIndex = position.measureIndex;
  let offsetTicks = position.offsetTicks;
  while (offsetTicks < 0 && measureIndex > 0) {
    measureIndex -= 1;
    offsetTicks += capacities[measureIndex] as number;
  }
  while (measureIndex < capacities.length && offsetTicks >= (capacities[measureIndex] as number)) {
    offsetTicks -= capacities[measureIndex] as number;
    measureIndex += 1;
  }
  if (measureIndex < 0 || measureIndex >= capacities.length || offsetTicks < 0) {
    throw new Error("Staff Builder position is outside the available measures.");
  }
  return { measureIndex, offsetTicks };
}

export function moveStaffBuilderPosition(position: StaffBuilderPosition, deltaTicks: number, capacities: readonly number[]): StaffBuilderPosition {
  if (!Number.isInteger(deltaTicks)) throw new Error("Cursor movement must use integer ticks.");
  return normalizeStaffBuilderPosition({ ...position, offsetTicks: position.offsetTicks + deltaTicks }, capacities);
}

export function moveStaffBuilderPositionForward(position: StaffBuilderPosition, step: StaffBuilderStepDuration, capacities: readonly number[]): StaffBuilderPosition {
  return moveStaffBuilderPosition(position, stepDurationToTicks(step), capacities);
}

export function moveStaffBuilderPositionBackward(position: StaffBuilderPosition, step: StaffBuilderStepDuration, capacities: readonly number[]): StaffBuilderPosition {
  return moveStaffBuilderPosition(position, -stepDurationToTicks(step), capacities);
}

export function getMeasureStartTick(capacities: readonly number[], measureIndex: number): number {
  requireCapacities(capacities);
  if (!Number.isInteger(measureIndex) || measureIndex < 0 || measureIndex >= capacities.length) {
    throw new Error("Measure index is outside the available measures.");
  }
  return capacities.slice(0, measureIndex).reduce((sum, value) => sum + value, 0);
}

export function ticksToMilliseconds(absoluteTicks: number, tempoBpm: number): number {
  if (!Number.isInteger(absoluteTicks) || absoluteTicks < 0) throw new Error("Absolute ticks must be a non-negative integer.");
  if (!Number.isInteger(tempoBpm) || tempoBpm <= 0) throw new Error("Tempo must be a positive integer.");
  return Math.round((absoluteTicks * 60_000) / (tempoBpm * STAFF_BUILDER_TICKS_PER_QUARTER));
}

export function tickBoundaryDurationMilliseconds(startTick: number, endTick: number, tempoBpm: number): number {
  if (!Number.isInteger(endTick) || endTick < startTick) throw new Error("End tick must be an integer at or after start tick.");
  return ticksToMilliseconds(endTick, tempoBpm) - ticksToMilliseconds(startTick, tempoBpm);
}
