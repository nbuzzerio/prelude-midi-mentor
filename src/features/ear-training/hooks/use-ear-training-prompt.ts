import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createMusicalEventPlayer } from "@/lib/audio/musical-event-player";
import { preloadGrandPianoSamples } from "@/lib/audio/grand-piano";
import type { EarTrainingTarget } from "../ear-training-types";
import {
  EAR_TRAINING_NOTE_DURATION_MS,
  EAR_TRAINING_SECOND_NOTE_OFFSET_MS,
} from "../ear-training-timing";

export type EarTrainingPromptState = "ready" | "playing" | "heard" | "failed";

export function useEarTrainingPrompt() {
  const player = useMemo(() => createMusicalEventPlayer(), []);
  const [state, setState] = useState<EarTrainingPromptState>("ready");
  const responseStartedAtRef = useRef<number | null>(null);
  const requestRef = useRef(0);

  useEffect(() => preloadGrandPianoSamples(), []);

  const cancelPrompt = useCallback(() => {
    requestRef.current += 1;
    player.cancel();
    setState((current) => current === "playing" ? "ready" : current);
  }, [player]);

  const resetPrompt = useCallback(() => {
    requestRef.current += 1;
    player.cancel();
    responseStartedAtRef.current = null;
    setState("ready");
  }, [player]);

  const playPrompt = useCallback(async (target: EarTrainingTarget) => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    setState("playing");
    const playback = player.play([
      { notes: [target.notes[0].midiNumber], startTimeMs: 0, durationMs: EAR_TRAINING_NOTE_DURATION_MS },
      { notes: [target.notes[1].midiNumber], startTimeMs: EAR_TRAINING_SECOND_NOTE_OFFSET_MS, durationMs: EAR_TRAINING_NOTE_DURATION_MS },
    ]);
    const result = await playback.completion;
    if (requestRef.current !== request) return result;
    if (result === "completed") {
      responseStartedAtRef.current ??= Date.now();
      setState("heard");
    } else if (result === "failed") {
      setState("failed");
    }
    return result;
  }, [player]);

  const getResponseTimeMs = useCallback(() =>
    responseStartedAtRef.current === null ? 0 : Date.now() - responseStartedAtRef.current,
  []);

  useEffect(() => () => player.cancel(), [player]);

  return { cancelPrompt, getResponseTimeMs, playPrompt, resetPrompt, state };
}
