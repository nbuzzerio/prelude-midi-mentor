import type {
  SequenceTarget,
  SequenceTiming,
} from "@/types/practice";

export const SEQUENCE_TICKS_PER_QUARTER = 480;
export const SEQUENCE_DEFAULT_STEP_DURATION_TICKS =
  SEQUENCE_TICKS_PER_QUARTER;
export const SEQUENCE_DEFAULT_TIMING: SequenceTiming = {
  meter: {
    denominator: 4,
    numerator: 4,
  },
  ticksPerQuarter: SEQUENCE_TICKS_PER_QUARTER,
};

const SUPPORTED_SEQUENCE_METER_DENOMINATORS: ReadonlySet<number> = new Set([
  1, 2, 4, 8, 16,
]);

export type SequenceTemporalStep = Readonly<{
  durationTicks: number;
  endTicks: number;
  globalStepIndex: number;
  measureIndex: number;
  onsetTicks: number;
}>;

export type SequenceTimeline = Readonly<{
  measureCapacityTicks: number;
  measureCount: number;
  steps: ReadonlyArray<SequenceTemporalStep>;
  totalDurationTicks: number;
}>;

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

export function getSequenceMeasureCapacityTicks(
  timing: SequenceTiming,
): number {
  requirePositiveInteger(timing.ticksPerQuarter, "Sequence ticks per quarter");
  requirePositiveInteger(timing.meter.numerator, "Sequence meter numerator");
  requirePositiveInteger(
    timing.meter.denominator,
    "Sequence meter denominator",
  );

  if (!SUPPORTED_SEQUENCE_METER_DENOMINATORS.has(timing.meter.denominator)) {
    throw new Error(
      "Sequence meter denominator must be one of 1, 2, 4, 8, or 16.",
    );
  }

  const ticksPerBeat =
    (timing.ticksPerQuarter * 4) / timing.meter.denominator;

  if (!Number.isInteger(ticksPerBeat)) {
    throw new Error("Sequence meter must produce an integer beat capacity.");
  }

  const measureCapacityTicks = timing.meter.numerator * ticksPerBeat;

  if (!Number.isInteger(measureCapacityTicks)) {
    throw new Error("Sequence meter must produce an integer measure capacity.");
  }

  return measureCapacityTicks;
}

export function deriveSequenceTimeline(
  target: SequenceTarget,
): SequenceTimeline {
  if (target.steps.length === 0) {
    throw new Error("Sequence target must contain at least one step.");
  }

  const measureCapacityTicks = getSequenceMeasureCapacityTicks(target.timing);
  let onsetTicks = 0;

  const steps = target.steps.map((step, globalStepIndex) => {
    requirePositiveInteger(
      step.durationTicks,
      `Sequence step ${globalStepIndex + 1} duration`,
    );

    const endTicks = onsetTicks + step.durationTicks;
    const measureIndex = Math.floor(onsetTicks / measureCapacityTicks);
    const measureEndTicks = (measureIndex + 1) * measureCapacityTicks;

    if (endTicks > measureEndTicks) {
      throw new Error(
        `Sequence step ${globalStepIndex + 1} crosses a measure boundary, which is unsupported.`,
      );
    }

    const temporalStep: SequenceTemporalStep = {
      durationTicks: step.durationTicks,
      endTicks,
      globalStepIndex,
      measureIndex,
      onsetTicks,
    };

    onsetTicks = endTicks;
    return temporalStep;
  });

  return {
    measureCapacityTicks,
    measureCount:
      onsetTicks === 0 ? 0 : Math.ceil(onsetTicks / measureCapacityTicks),
    steps,
    totalDurationTicks: onsetTicks,
  };
}
