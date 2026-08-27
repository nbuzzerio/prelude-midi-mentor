import { STAFF_BUILDER_TICKS_PER_QUARTER } from "@/features/staff-builder/staff-builder-time";
import type { StaffBuilderTimeSignature } from "@/features/staff-builder/staff-builder-time";

export type MelodyCountToken = Readonly<{ tick: number; label: string }>;
export type MelodyMeterProfile = Readonly<{
  timeSignature: StaffBuilderTimeSignature;
  capacityTicks: number;
  beatTicks: number;
  subdivisionTicks: number;
  countTokens: readonly MelodyCountToken[];
}>;

export const MELODY_PHASE_ONE_METER: MelodyMeterProfile = Object.freeze({
  timeSignature: "4/4",
  capacityTicks: STAFF_BUILDER_TICKS_PER_QUARTER * 4,
  beatTicks: STAFF_BUILDER_TICKS_PER_QUARTER,
  subdivisionTicks: STAFF_BUILDER_TICKS_PER_QUARTER / 2,
  countTokens: Object.freeze(["1", "&", "2", "&", "3", "&", "4", "&"].map((label, index) => Object.freeze({
    tick: index * (STAFF_BUILDER_TICKS_PER_QUARTER / 2),
    label,
  }))),
});
