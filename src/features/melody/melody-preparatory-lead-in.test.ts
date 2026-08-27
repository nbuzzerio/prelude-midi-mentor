import { describe, expect, it } from "vitest";

import { STAFF_BUILDER_TICKS_PER_QUARTER } from "@/features/staff-builder/staff-builder-time";
import { getMelodyPreparatoryLeadIn } from "./melody-preparatory-lead-in";

describe("Melody preparatory lead-in", () => {
  it("uses two quarter-note beats in 4/4", () => {
    expect(getMelodyPreparatoryLeadIn("4/4")).toEqual({
      durationTicks: STAFF_BUILDER_TICKS_PER_QUARTER * 2,
      pulseCount: 2,
      pulseTicks: STAFF_BUILDER_TICKS_PER_QUARTER,
      restDuration: "half",
    });
  });

  it("uses a stable two-quarter pickup in 3/4", () => {
    expect(getMelodyPreparatoryLeadIn("3/4")).toMatchObject({
      durationTicks: STAFF_BUILDER_TICKS_PER_QUARTER * 2,
      pulseCount: 2,
      restDuration: "half",
    });
  });

  it("uses one dotted-quarter pulse in 6/8", () => {
    expect(getMelodyPreparatoryLeadIn("6/8")).toEqual({
      durationTicks: STAFF_BUILDER_TICKS_PER_QUARTER * 1.5,
      pulseCount: 1,
      pulseTicks: STAFF_BUILDER_TICKS_PER_QUARTER * 1.5,
      restDuration: "dotted-quarter",
    });
  });

  it("uses one quarter-note pulse in the remaining supported 2/4 meter", () => {
    expect(getMelodyPreparatoryLeadIn("2/4")).toMatchObject({
      durationTicks: STAFF_BUILDER_TICKS_PER_QUARTER,
      pulseCount: 1,
      restDuration: "quarter",
    });
  });
});
