import { describe, expect, it } from "vitest";

import { SEQUENCE_DEFAULT_TIMING } from "@/lib/music/sequence-timing";
import type { SequenceTarget } from "@/types/practice";
import { getSequenceMeasureWindow } from "./sequence-measure-window";

function target(durations: ReadonlyArray<number>): SequenceTarget {
  return {
    clef: "treble",
    name: { primary: "Windowed sequence" },
    steps: durations.map((durationTicks, index) => ({
      durationTicks,
      notes: [{ midiNumber: 60 + index, name: "C", octave: 4 }],
    })),
    timing: SEQUENCE_DEFAULT_TIMING,
  };
}

describe("getSequenceMeasureWindow", () => {
  const threeMeasures = target(Array.from({ length: 10 }, () => 480));

  it("derives first, middle, and final partial windows", () => {
    expect(getSequenceMeasureWindow(threeMeasures, 2)).toMatchObject({
      currentMeasureIndex: 0,
      firstGlobalStepIndex: 0,
      lastGlobalStepIndex: 3,
      localCurrentStepIndex: 2,
      measureCapacityTicks: 1920,
      measureCount: 3,
    });
    expect(getSequenceMeasureWindow(threeMeasures, 5)).toMatchObject({
      currentMeasureIndex: 1,
      firstGlobalStepIndex: 4,
      lastGlobalStepIndex: 7,
      localCurrentStepIndex: 1,
    });
    const finalWindow = getSequenceMeasureWindow(threeMeasures, 9);
    expect(finalWindow).toMatchObject({
      currentMeasureIndex: 2,
      firstGlobalStepIndex: 8,
      lastGlobalStepIndex: 9,
      localCurrentStepIndex: 1,
    });
    expect(finalWindow.visibleSteps).toEqual(threeMeasures.steps.slice(8, 10));
  });

  it("moves a barline step to the next measure at local index zero", () => {
    expect(getSequenceMeasureWindow(threeMeasures, 4)).toMatchObject({
      currentMeasureIndex: 1,
      firstGlobalStepIndex: 4,
      localCurrentStepIndex: 0,
    });
  });

  it.each([-1, 10, 1.5])("rejects invalid current index %s", (index) => {
    expect(() => getSequenceMeasureWindow(threeMeasures, index)).toThrow(
      "outside the target",
    );
  });
});
