import { describe, expect, it } from "vitest";

import type { SequenceStep, SequenceTarget } from "@/types/practice";
import {
  deriveSequenceTimeline,
  getSequenceMeasureCapacityTicks,
  SEQUENCE_DEFAULT_TIMING,
} from "./sequence-timing";

const note = (midiNumber: number) => ({
  midiNumber,
  name: "C",
  octave: 4,
});

function target(
  durations: ReadonlyArray<number>,
  stepOverrides: Readonly<Record<number, SequenceStep>> = {},
): SequenceTarget {
  return {
    clef: "treble",
    name: { primary: "Timed sequence" },
    steps: durations.map(
      (durationTicks, index) =>
        stepOverrides[index] ?? {
          durationTicks,
          notes: [note(60 + index)],
        },
    ),
    timing: SEQUENCE_DEFAULT_TIMING,
  };
}

describe("Sequence timing", () => {
  it("derives a 1920-tick 4/4 measure at 480 PPQ", () => {
    expect(getSequenceMeasureCapacityTicks(SEQUENCE_DEFAULT_TIMING)).toBe(1920);
  });

  it.each([
    [1, 7680],
    [2, 3840],
    [4, 1920],
    [8, 960],
    [16, 480],
  ])("supports a conventional denominator of %i", (denominator, capacity) => {
    expect(
      getSequenceMeasureCapacityTicks({
        meter: { numerator: 4, denominator },
        ticksPerQuarter: 480,
      }),
    ).toBe(capacity);
  });

  it("rejects an empty Sequence target", () => {
    expect(() => deriveSequenceTimeline(target([]))).toThrow(
      "Sequence target must contain at least one step.",
    );
  });

  it("places four quarter-duration attacks in one measure", () => {
    const timeline = deriveSequenceTimeline(target([480, 480, 480, 480]));

    expect(timeline.steps.map(({ onsetTicks }) => onsetTicks)).toEqual([
      0, 480, 960, 1440,
    ]);
    expect(timeline.steps.map(({ measureIndex }) => measureIndex)).toEqual([
      0, 0, 0, 0,
    ]);
    expect(timeline.measureCount).toBe(1);
  });

  it("places eight synthetic eighth-duration attacks in one measure", () => {
    const timeline = deriveSequenceTimeline(
      target(Array.from({ length: 8 }, () => 240)),
    );

    expect(timeline.steps.map(({ onsetTicks }) => onsetTicks)).toEqual([
      0, 240, 480, 720, 960, 1200, 1440, 1680,
    ]);
    expect(timeline.steps.every(({ measureIndex }) => measureIndex === 0)).toBe(
      true,
    );
  });

  it("derives cumulative onsets for mixed durations", () => {
    const timeline = deriveSequenceTimeline(target([240, 240, 480, 960, 480]));

    expect(
      timeline.steps.map(({ onsetTicks, endTicks, measureIndex }) => ({
        endTicks,
        measureIndex,
        onsetTicks,
      })),
    ).toEqual([
      { onsetTicks: 0, endTicks: 240, measureIndex: 0 },
      { onsetTicks: 240, endTicks: 480, measureIndex: 0 },
      { onsetTicks: 480, endTicks: 960, measureIndex: 0 },
      { onsetTicks: 960, endTicks: 1920, measureIndex: 0 },
      { onsetTicks: 1920, endTicks: 2400, measureIndex: 1 },
    ]);
  });

  it("advances time once for a simultaneous chord step", () => {
    const chord: SequenceStep = {
      durationTicks: 480,
      notes: [note(60), note(64), note(67)],
    };
    const timeline = deriveSequenceTimeline(target([480, 480], { 0: chord }));

    expect(timeline.steps[0]).toMatchObject({ onsetTicks: 0, endTicks: 480 });
    expect(timeline.steps[1]).toMatchObject({ onsetTicks: 480 });
  });

  it("assigns an onset exactly at a barline to the following measure", () => {
    const timeline = deriveSequenceTimeline(
      target([480, 480, 480, 480, 480]),
    );

    expect(timeline.steps[3]).toMatchObject({ endTicks: 1920, measureIndex: 0 });
    expect(timeline.steps[4]).toMatchObject({ onsetTicks: 1920, measureIndex: 1 });
  });

  it("accepts a final partial measure", () => {
    const timeline = deriveSequenceTimeline(
      target([480, 480, 480, 480, 480]),
    );

    expect(timeline.measureCount).toBe(2);
    expect(timeline.totalDurationTicks).toBe(2400);
  });

  it.each([
    [[1440, 960], "crosses a measure boundary"],
    [[2400], "crosses a measure boundary"],
  ])("rejects unsupported cross-bar durations %j", (durations, message) => {
    expect(() => deriveSequenceTimeline(target(durations))).toThrow(message);
  });

  it.each([0, -1, 1.5])("rejects invalid step duration %s", (duration) => {
    expect(() => deriveSequenceTimeline(target([duration]))).toThrow(
      "duration must be a positive integer",
    );
  });

  it.each([
    [{ ...SEQUENCE_DEFAULT_TIMING, ticksPerQuarter: 0 }, "ticks per quarter"],
    [{ ...SEQUENCE_DEFAULT_TIMING, ticksPerQuarter: 1.5 }, "ticks per quarter"],
    [{ ...SEQUENCE_DEFAULT_TIMING, meter: { numerator: 0, denominator: 4 } }, "numerator"],
    [{ ...SEQUENCE_DEFAULT_TIMING, meter: { numerator: 4, denominator: 0 } }, "denominator"],
    [{ ...SEQUENCE_DEFAULT_TIMING, meter: { numerator: 4, denominator: 3 } }, "must be one of 1, 2, 4, 8, or 16"],
    [{ ...SEQUENCE_DEFAULT_TIMING, meter: { numerator: 4, denominator: 7 } }, "must be one of 1, 2, 4, 8, or 16"],
    [{ ...SEQUENCE_DEFAULT_TIMING, ticksPerQuarter: 1, meter: { numerator: 4, denominator: 16 } }, "integer beat capacity"],
  ])("rejects invalid timing %#", (timing, message) => {
    expect(() => getSequenceMeasureCapacityTicks(timing)).toThrow(message);
  });
});
