import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { preloadGrandPianoSamples } from "@/lib/audio/grand-piano";
import { createMusicalEventPlayer, type PlayableMusicalEvent } from "@/lib/audio/musical-event-player";
import { projectStaffBuilderEventAudition, projectStaffBuilderPlayback, type StaffBuilderPlaybackPosition } from "../staff-builder-playback";
import type { StaffBuilderEvent, StaffBuilderScoreV1 } from "../staff-builder-types";

export type StaffBuilderPlaybackScopeName = "selected-event" | "current-measure" | "from-position" | "entire-piece";
export type StaffBuilderPlaybackState = Readonly<{
  status: "idle" | "playing" | "complete" | "failed";
  scope: StaffBuilderPlaybackScopeName | null;
  message: string;
}>;

const INITIAL_STATE: StaffBuilderPlaybackState = { status: "idle", scope: null, message: "Playback ready." };

export function useStaffBuilderPlayback(score: StaffBuilderScoreV1) {
  const player = useMemo(() => createMusicalEventPlayer(), []);
  const requestGeneration = useRef(0);
  const scoreFingerprint = JSON.stringify(score);
  const previousScoreFingerprint = useRef(scoreFingerprint);
  const [state, setState] = useState<StaffBuilderPlaybackState>(INITIAL_STATE);

  useEffect(() => preloadGrandPianoSamples(), []);
  useEffect(() => {
    if (previousScoreFingerprint.current === scoreFingerprint) return;
    previousScoreFingerprint.current = scoreFingerprint;
    requestGeneration.current += 1;
    player.cancel();
    setState((current) => current.status === "playing"
      ? { status: "idle", scope: null, message: "Playback stopped because the score changed." }
      : current);
  }, [player, scoreFingerprint]);
  useEffect(() => () => {
    requestGeneration.current += 1;
    player.cancel();
  }, [player]);

  const start = useCallback((scope: StaffBuilderPlaybackScopeName, message: string, events: readonly PlayableMusicalEvent[], minimumDurationMs?: number) => {
    const generation = requestGeneration.current + 1;
    requestGeneration.current = generation;
    const playback = player.play(events, minimumDurationMs === undefined ? {} : { minimumDurationMs });
    setState({ status: "playing", scope, message });
    void playback.completion.then((result) => {
      if (requestGeneration.current !== generation) return;
      if (result === "completed") setState({ status: "complete", scope: null, message: "Playback complete." });
      else if (result === "failed") setState({ status: "failed", scope: null, message: "Audio could not start. Check browser audio permissions and try again." });
      else setState({ status: "idle", scope: null, message: "Playback stopped." });
    });
  }, [player]);

  const auditionSelectedEvent = useCallback((event: StaffBuilderEvent | null) => {
    const projected = projectStaffBuilderEventAudition(event);
    if (!projected) return false;
    start("selected-event", "Playing selected event.", [projected], projected.durationMs);
    return true;
  }, [start]);

  const playCurrentMeasure = useCallback((measureIndex: number) => {
    const projection = projectStaffBuilderPlayback(score, { kind: "measure", measureIndex });
    start("current-measure", `Playing measure ${measureIndex + 1}.`, projection.events, projection.durationMs);
  }, [score, start]);

  const playFromHere = useCallback((position: StaffBuilderPlaybackPosition) => {
    const projection = projectStaffBuilderPlayback(score, { kind: "from-position", position });
    start("from-position", `Playing from measure ${position.measureIndex + 1}.`, projection.events, projection.durationMs);
  }, [score, start]);

  const playEntirePiece = useCallback(() => {
    const projection = projectStaffBuilderPlayback(score, { kind: "entire-piece" });
    start("entire-piece", "Playing entire piece.", projection.events, projection.durationMs);
  }, [score, start]);

  const stop = useCallback(() => {
    requestGeneration.current += 1;
    player.cancel();
    setState({ status: "idle", scope: null, message: "Playback stopped." });
  }, [player]);

  return { state, auditionSelectedEvent, playCurrentMeasure, playFromHere, playEntirePiece, stop };
}
