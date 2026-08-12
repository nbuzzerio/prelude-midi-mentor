import { deriveSequenceTimeline } from "@/lib/music/sequence-timing";
import type { SequenceStep, SequenceTarget } from "@/types/practice";

export type SequenceMeasureWindow = Readonly<{
  currentMeasureIndex: number;
  firstGlobalStepIndex: number;
  lastGlobalStepIndex: number;
  localCurrentStepIndex: number;
  measureCapacityTicks: number;
  measureCount: number;
  temporalSteps: ReturnType<typeof deriveSequenceTimeline>["steps"];
  visibleSteps: ReadonlyArray<SequenceStep>;
}>;

export function getSequenceMeasureWindow(
  target: SequenceTarget,
  currentStepIndex: number,
): SequenceMeasureWindow {
  if (
    !Number.isInteger(currentStepIndex) ||
    currentStepIndex < 0 ||
    currentStepIndex >= target.steps.length
  ) {
    throw new Error("Current Sequence step index is outside the target.");
  }

  const timeline = deriveSequenceTimeline(target);
  const currentStep = timeline.steps[currentStepIndex];

  if (!currentStep) {
    throw new Error("Current Sequence step has no temporal projection.");
  }

  const stepsInMeasure = timeline.steps.filter(
    (step) => step.measureIndex === currentStep.measureIndex,
  );
  const firstStep = stepsInMeasure[0];
  const lastStep = stepsInMeasure.at(-1);

  if (!firstStep || !lastStep) {
    throw new Error("Current Sequence measure contains no steps.");
  }

  return {
    currentMeasureIndex: currentStep.measureIndex,
    firstGlobalStepIndex: firstStep.globalStepIndex,
    lastGlobalStepIndex: lastStep.globalStepIndex,
    localCurrentStepIndex:
      currentStep.globalStepIndex - firstStep.globalStepIndex,
    measureCapacityTicks: timeline.measureCapacityTicks,
    measureCount: timeline.measureCount,
    temporalSteps: timeline.steps,
    visibleSteps: target.steps.slice(
      firstStep.globalStepIndex,
      lastStep.globalStepIndex + 1,
    ),
  };
}
