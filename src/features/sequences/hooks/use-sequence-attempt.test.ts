import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SequenceTarget } from "@/types/practice";

import { useSequenceAttempt } from "./use-sequence-attempt";

const TARGET: SequenceTarget = {
  clef: "treble",
  name: {
    primary: "Major third",
    secondary: "Ascending melodic interval",
  },
  steps: [
    {
      notes: [
        {
          midiNumber: 60,
          name: "C",
          octave: 4,
        },
      ],
    },
    {
      notes: [
        {
          midiNumber: 64,
          name: "E",
          octave: 4,
        },
      ],
    },
  ],
};

describe("useSequenceAttempt", () => {
  it("starts on the first step waiting for input", () => {
    const { result } = renderHook(() =>
      useSequenceAttempt({
        sequenceTarget: TARGET,
      }),
    );

    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.currentStep).toEqual(TARGET.steps[0]);
    expect(result.current.state).toBe("waiting-for-step");
    expect(result.current.isWaitingForStep()).toBe(true);
  });

  it("shows correct feedback only while waiting for a step", () => {
    const { result } = renderHook(() =>
      useSequenceAttempt({
        sequenceTarget: TARGET,
      }),
    );

    act(() => {
      expect(result.current.showCorrectFeedback()).toBe(true);
    });

    expect(result.current.state).toBe("showing-correct-feedback");

    act(() => {
      expect(result.current.showCorrectFeedback()).toBe(false);
    });
  });

  it("shows incorrect feedback only while waiting for a step", () => {
    const { result } = renderHook(() =>
      useSequenceAttempt({
        sequenceTarget: TARGET,
      }),
    );

    act(() => {
      expect(result.current.showIncorrectFeedback()).toBe(true);
    });

    expect(result.current.state).toBe("showing-incorrect-feedback");

    act(() => {
      expect(result.current.showIncorrectFeedback()).toBe(false);
    });
  });

  it("waits for release after correct feedback", () => {
    const { result } = renderHook(() =>
      useSequenceAttempt({
        sequenceTarget: TARGET,
      }),
    );

    act(() => {
      result.current.showCorrectFeedback();
    });

    act(() => {
      expect(result.current.waitForRelease()).toBe(true);
    });

    expect(result.current.state).toBe("waiting-for-release");
  });

  it("advances to the next step", () => {
    const { result } = renderHook(() =>
      useSequenceAttempt({
        sequenceTarget: TARGET,
      }),
    );

    act(() => {
      result.current.showCorrectFeedback();
    });

    act(() => {
      const completion = result.current.completeCurrentStep();

      expect(completion).toEqual({
        completedStepIndex: 0,
        nextStepIndex: 1,
        sequenceComplete: false,
      });
    });

    expect(result.current.currentStepIndex).toBe(1);

    act(() => {
      expect(result.current.beginNextStep()).toBe(true);
    });

    expect(result.current.state).toBe("waiting-for-step");
  });

  it("marks the final step as sequence complete", () => {
    const { result } = renderHook(() =>
      useSequenceAttempt({
        sequenceTarget: TARGET,
      }),
    );

    act(() => {
      result.current.showCorrectFeedback();
      result.current.completeCurrentStep();
      result.current.beginNextStep();
      result.current.showCorrectFeedback();
    });

    act(() => {
      const completion = result.current.completeCurrentStep();

      expect(completion).toEqual({
        completedStepIndex: 1,
        nextStepIndex: null,
        sequenceComplete: true,
      });
    });

    expect(result.current.state).toBe("sequence-complete");
  });

  it("retries the sequence after incorrect feedback", () => {
    const { result } = renderHook(() =>
      useSequenceAttempt({
        sequenceTarget: TARGET,
      }),
    );

    act(() => {
      result.current.showIncorrectFeedback();
    });

    act(() => {
      expect(result.current.retrySequence()).toBe(true);
    });

    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.state).toBe("waiting-for-step");
  });

  it("resets the attempt manually", () => {
    const { result } = renderHook(() =>
      useSequenceAttempt({
        sequenceTarget: TARGET,
      }),
    );

    act(() => {
      result.current.showCorrectFeedback();
      result.current.completeCurrentStep();
    });

    expect(result.current.currentStepIndex).toBe(1);

    act(() => {
      result.current.resetAttempt();
    });

    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.state).toBe("waiting-for-step");
  });

  it("resets automatically when the sequence target changes", () => {
    const { result, rerender } = renderHook(
      ({ target }) =>
        useSequenceAttempt({
          sequenceTarget: target,
        }),
      {
        initialProps: {
          target: TARGET,
        },
      },
    );

    act(() => {
      result.current.showCorrectFeedback();
      result.current.completeCurrentStep();
    });

    expect(result.current.currentStepIndex).toBe(1);

    const nextTarget: SequenceTarget = {
      ...TARGET,
      name: {
        primary: "Perfect fifth",
      },
    };

    rerender({
      target: nextTarget,
    });

    expect(result.current.currentStepIndex).toBe(0);
    expect(result.current.state).toBe("waiting-for-step");
  });

  it("exposes the current state through the getters", () => {
    const { result } = renderHook(() =>
      useSequenceAttempt({
        sequenceTarget: TARGET,
      }),
    );

    expect(result.current.getCurrentStepIndex()).toBe(0);
    expect(result.current.getState()).toBe("waiting-for-step");

    act(() => {
      result.current.showCorrectFeedback();
    });

    expect(result.current.getState()).toBe("showing-correct-feedback");
  });
});
