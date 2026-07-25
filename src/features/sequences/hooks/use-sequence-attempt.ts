import { SequenceTarget } from "@/types/practice";
import { useCallback, useEffect, useRef, useState } from "react";

export type SequenceAttemptState =
  | "waiting-for-step"
  | "showing-correct-feedback"
  | "waiting-for-release"
  | "showing-incorrect-feedback"
  | "sequence-complete";

export type CompleteSequenceStepResult = Readonly<{
  sequenceComplete: boolean;
  completedStepIndex: number;
  nextStepIndex: number | null;
}>;

type UseSequenceAttemptOptions = Readonly<{
  sequenceTarget: SequenceTarget;
}>;

export function useSequenceAttempt({
  sequenceTarget,
}: UseSequenceAttemptOptions) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const [state, setState] = useState<SequenceAttemptState>("waiting-for-step");

  const currentStepIndexRef = useRef(currentStepIndex);
  const stateRef = useRef(state);

  const setAttemptState = useCallback((nextState: SequenceAttemptState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const setStepIndex = useCallback((nextStepIndex: number) => {
    currentStepIndexRef.current = nextStepIndex;
    setCurrentStepIndex(nextStepIndex);
  }, []);

  const resetAttempt = useCallback(() => {
    setStepIndex(0);
    setAttemptState("waiting-for-step");
  }, [setAttemptState, setStepIndex]);

  useEffect(() => {
    resetAttempt();
  }, [resetAttempt, sequenceTarget]);

  const getCurrentStepIndex = useCallback(
    () => currentStepIndexRef.current,
    [],
  );

  const getState = useCallback(() => stateRef.current, []);

  const isWaitingForStep = useCallback(
    () => stateRef.current === "waiting-for-step",
    [],
  );

  const showCorrectFeedback = useCallback(() => {
    if (stateRef.current !== "waiting-for-step") {
      return false;
    }

    setAttemptState("showing-correct-feedback");

    return true;
  }, [setAttemptState]);

  const waitForRelease = useCallback(() => {
    if (stateRef.current !== "showing-correct-feedback") {
      return false;
    }

    setAttemptState("waiting-for-release");

    return true;
  }, [setAttemptState]);

  const showIncorrectFeedback = useCallback(() => {
    if (stateRef.current !== "waiting-for-step") {
      return false;
    }

    setAttemptState("showing-incorrect-feedback");

    return true;
  }, [setAttemptState]);

  const completeCurrentStep = useCallback((): CompleteSequenceStepResult => {
    const completedStepIndex = currentStepIndexRef.current;

    const isFinalStep = completedStepIndex >= sequenceTarget.steps.length - 1;

    if (isFinalStep) {
      setAttemptState("sequence-complete");

      return {
        sequenceComplete: true,
        completedStepIndex,
        nextStepIndex: null,
      };
    }

    const nextStepIndex = completedStepIndex + 1;

    setStepIndex(nextStepIndex);

    return {
      sequenceComplete: false,
      completedStepIndex,
      nextStepIndex,
    };
  }, [sequenceTarget.steps.length, setAttemptState, setStepIndex]);

  const beginNextStep = useCallback(() => {
    if (
      stateRef.current !== "showing-correct-feedback" &&
      stateRef.current !== "waiting-for-release"
    ) {
      return false;
    }

    setAttemptState("waiting-for-step");

    return true;
  }, [setAttemptState]);

  const retrySequence = useCallback(() => {
    if (stateRef.current !== "showing-incorrect-feedback") {
      return false;
    }

    resetAttempt();

    return true;
  }, [resetAttempt]);

  const currentStep = sequenceTarget.steps[currentStepIndex] ?? null;

  return {
    beginNextStep,
    completeCurrentStep,
    currentStep,
    currentStepIndex,
    getCurrentStepIndex,
    getState,
    isWaitingForStep,
    resetAttempt,
    retrySequence,
    showCorrectFeedback,
    showIncorrectFeedback,
    state,
    waitForRelease,
  };
}
