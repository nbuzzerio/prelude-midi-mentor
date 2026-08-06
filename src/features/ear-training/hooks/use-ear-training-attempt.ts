import { useCallback, useEffect, useRef, useState } from "react";
import { playIncorrectFeedback, playSuccessChirp } from "@/lib/audio/feedback";
import type { MusicalInterval } from "@/lib/music/intervals";
import {
  INITIAL_EAR_TRAINING_STATS,
  applyEarTrainingCompletion,
  applyEarTrainingIncorrectAttempt,
} from "../ear-training-stats";
import {
  EAR_TRAINING_FEEDBACK_DELAY_MS,
  EAR_TRAINING_INCORRECT_SOUND_MS,
} from "../ear-training-timing";
import { isEarTrainingAnswerCorrect } from "../ear-training-validation";
import type { EarTrainingTarget } from "../ear-training-types";
import type { EarTrainingPromptState } from "./use-ear-training-prompt";

type Options = Readonly<{
  cancelPrompt: () => void;
  generateNextTarget: () => void;
  getCurrentTarget: () => EarTrainingTarget;
  getResponseTimeMs: () => number;
  isTargetLocked: () => boolean;
  lockTarget: () => boolean;
  promptState: EarTrainingPromptState;
  resetPrompt: () => void;
}>;

export type EarTrainingFeedback = "idle" | "correct" | "incorrect";

export function useEarTrainingAttempt({
  cancelPrompt,
  generateNextTarget,
  getCurrentTarget,
  getResponseTimeMs,
  isTargetLocked,
  lockTarget,
  promptState,
  resetPrompt,
}: Options) {
  const [stats, setStats] = useState(INITIAL_EAR_TRAINING_STATS);
  const [feedback, setFeedback] = useState<EarTrainingFeedback>("idle");
  const [wrongAnswers, setWrongAnswers] = useState<ReadonlySet<MusicalInterval>>(
    new Set(),
  );
  const [canReplay, setCanReplay] = useState(true);
  const hadIncorrectRef = useRef(false);
  const attemptVersionRef = useRef(0);
  const incorrectFeedbackTimerRef = useRef<number | null>(null);
  const advancementTimerRef = useRef<number | null>(null);

  const clearAttemptTimers = useCallback(() => {
    if (incorrectFeedbackTimerRef.current !== null) {
      window.clearTimeout(incorrectFeedbackTimerRef.current);
      incorrectFeedbackTimerRef.current = null;
    }
    if (advancementTimerRef.current !== null) {
      window.clearTimeout(advancementTimerRef.current);
      advancementTimerRef.current = null;
    }
  }, []);

  const clearTargetAttempt = useCallback(() => {
    attemptVersionRef.current += 1;
    clearAttemptTimers();
    resetPrompt();
    hadIncorrectRef.current = false;
    setWrongAnswers(new Set());
    setFeedback("idle");
    setCanReplay(true);
  }, [clearAttemptTimers, resetPrompt]);

  const prepareNextTarget = useCallback(() => {
    clearTargetAttempt();
    generateNextTarget();
  }, [clearTargetAttempt, generateNextTarget]);

  const resetSession = useCallback(() => {
    setStats(INITIAL_EAR_TRAINING_STATS);
    prepareNextTarget();
  }, [prepareNextTarget]);

  const answer = useCallback(
    (answerInterval: MusicalInterval) => {
      if (
        !canReplay ||
        isTargetLocked() ||
        promptState !== "heard" ||
        wrongAnswers.has(answerInterval)
      ) {
        return;
      }

      const currentTarget = getCurrentTarget();
      if (!isEarTrainingAnswerCorrect(answerInterval, currentTarget)) {
        const alreadyIncorrect = hadIncorrectRef.current;
        setStats((current) =>
          applyEarTrainingIncorrectAttempt(current, alreadyIncorrect),
        );
        hadIncorrectRef.current = true;
        setWrongAnswers((current) => new Set(current).add(answerInterval));
        setFeedback("incorrect");
        setCanReplay(false);
        playIncorrectFeedback();

        const attemptVersion = attemptVersionRef.current;
        incorrectFeedbackTimerRef.current = window.setTimeout(() => {
          incorrectFeedbackTimerRef.current = null;
          if (attemptVersionRef.current === attemptVersion) {
            setCanReplay(true);
          }
        }, EAR_TRAINING_INCORRECT_SOUND_MS);
        return;
      }

      if (!lockTarget()) return;

      cancelPrompt();
      setFeedback("correct");
      setStats((current) =>
        applyEarTrainingCompletion(
          current,
          getResponseTimeMs(),
          hadIncorrectRef.current,
        ),
      );
      playSuccessChirp();

      const attemptVersion = attemptVersionRef.current;
      advancementTimerRef.current = window.setTimeout(() => {
        advancementTimerRef.current = null;
        if (attemptVersionRef.current === attemptVersion) {
          prepareNextTarget();
        }
      }, EAR_TRAINING_FEEDBACK_DELAY_MS);
    },
    [
      cancelPrompt,
      canReplay,
      getCurrentTarget,
      getResponseTimeMs,
      isTargetLocked,
      lockTarget,
      prepareNextTarget,
      promptState,
      wrongAnswers,
    ],
  );

  useEffect(
    () => () => {
      attemptVersionRef.current += 1;
      clearAttemptTimers();
      cancelPrompt();
    },
    [cancelPrompt, clearAttemptTimers],
  );

  return {
    answer,
    canReplay,
    feedback,
    prepareNextTarget,
    resetSession,
    stats,
    wrongAnswers,
  };
}
