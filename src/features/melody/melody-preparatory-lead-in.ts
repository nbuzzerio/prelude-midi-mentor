import {
  STAFF_BUILDER_TICKS_PER_QUARTER,
  type StaffBuilderDuration,
  type StaffBuilderTimeSignature,
} from "@/features/staff-builder/staff-builder-time";

export type MelodyPreparatoryLeadIn = Readonly<{
  durationTicks: number;
  pulseCount: number;
  pulseTicks: number;
  restDuration: StaffBuilderDuration;
}>;

export function getMelodyPreparatoryLeadIn(
  timeSignature: StaffBuilderTimeSignature,
): MelodyPreparatoryLeadIn {
  if (timeSignature === "6/8") {
    return Object.freeze({
      durationTicks: STAFF_BUILDER_TICKS_PER_QUARTER * 1.5,
      pulseCount: 1,
      pulseTicks: STAFF_BUILDER_TICKS_PER_QUARTER * 1.5,
      restDuration: "dotted-quarter",
    });
  }
  if (timeSignature === "3/4" || timeSignature === "4/4") {
    return Object.freeze({
      durationTicks: STAFF_BUILDER_TICKS_PER_QUARTER * 2,
      pulseCount: 2,
      pulseTicks: STAFF_BUILDER_TICKS_PER_QUARTER,
      restDuration: "half",
    });
  }
  return Object.freeze({
    durationTicks: STAFF_BUILDER_TICKS_PER_QUARTER,
    pulseCount: 1,
    pulseTicks: STAFF_BUILDER_TICKS_PER_QUARTER,
    restDuration: "quarter",
  });
}
