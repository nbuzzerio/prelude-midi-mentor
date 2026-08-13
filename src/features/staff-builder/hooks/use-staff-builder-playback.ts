import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { preloadGrandPianoSamples } from "@/lib/audio/grand-piano";
import { createMusicalEventPlayer, type PlayableMusicalEvent } from "@/lib/audio/musical-event-player";
import { projectStaffBuilderEventAudition, projectStaffBuilderPlayback, resolveStaffBuilderPlaybackPosition, sampleStaffBuilderPlaybackTick, type StaffBuilderPlaybackClock, type StaffBuilderPlaybackPosition } from "../staff-builder-playback";
import type { StaffBuilderEvent, StaffBuilderScore } from "../staff-builder-types";

export type StaffBuilderPlaybackScopeName = "selected-event" | "current-measure" | "from-position" | "entire-piece";
export type StaffBuilderPlaybackState = Readonly<{
  status: "idle" | "playing" | "complete" | "failed";
  scope: StaffBuilderPlaybackScopeName | null;
  message: string;
}>;
type ActivePlaybackVisualization = Readonly<StaffBuilderPlaybackClock & { generation: number; reducedMotion: boolean }>;

const INITIAL_STATE: StaffBuilderPlaybackState = { status: "idle", scope: null, message: "Playback ready." };

export function useStaffBuilderPlayback(score: StaffBuilderScore) {
  const player = useMemo(() => createMusicalEventPlayer(), []);
  const requestGeneration = useRef(0);
  const scoreFingerprint = JSON.stringify(score);
  const previousScoreFingerprint = useRef(scoreFingerprint);
  const [state, setState] = useState<StaffBuilderPlaybackState>(INITIAL_STATE);
  const [position, setPosition] = useState<StaffBuilderPlaybackPosition | null>(null);
  const [activeVisualization, setActiveVisualization] = useState<ActivePlaybackVisualization | null>(null);

  useEffect(() => preloadGrandPianoSamples(), []);
  useEffect(() => {
    if (previousScoreFingerprint.current === scoreFingerprint) return;
    previousScoreFingerprint.current = scoreFingerprint;
    requestGeneration.current += 1;
    player.cancel();
    setActiveVisualization(null);
    setPosition(null);
    setState((current) => current.status === "playing"
      ? { status: "idle", scope: null, message: "Playback stopped because the score changed." }
      : current);
  }, [player, scoreFingerprint]);
  useEffect(() => () => {
    requestGeneration.current += 1;
    player.cancel();
  }, [player]);

  useEffect(() => {
    if (!activeVisualization) return;
    let frame = 0;
    const update = (sampledAtMs: number) => {
      if (requestGeneration.current !== activeVisualization.generation) return;
      const atEndpoint = sampledAtMs >= activeVisualization.startedAtMs + activeVisualization.durationMs;
      const tick = sampleStaffBuilderPlaybackTick(activeVisualization, sampledAtMs, activeVisualization.reducedMotion);
      setPosition(resolveStaffBuilderPlaybackPosition(score, tick, atEndpoint));
      if (!atEndpoint) frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [activeVisualization, score]);

  const start = useCallback((scope: StaffBuilderPlaybackScopeName, message: string, events: readonly PlayableMusicalEvent[], visualization: Readonly<{ scopeStartTick: number; scopeEndTick: number; durationMs: number }> | Readonly<{ staticPosition: StaffBuilderPlaybackPosition | null }>, minimumDurationMs?: number) => {
    const generation = requestGeneration.current + 1;
    requestGeneration.current = generation;
    const playback = player.play(events, minimumDurationMs === undefined ? {} : { minimumDurationMs });
    setState({ status: "playing", scope, message });
    if ("staticPosition" in visualization) {
      setActiveVisualization(null);
      setPosition(visualization.staticPosition);
    } else {
      setPosition(resolveStaffBuilderPlaybackPosition(score, visualization.scopeStartTick));
      setActiveVisualization({ ...visualization, generation, startedAtMs: playback.startedAtMs, reducedMotion: typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches });
    }
    void playback.completion.then((result) => {
      if (requestGeneration.current !== generation) return;
      setActiveVisualization(null);
      setPosition(null);
      if (result === "completed") setState({ status: "complete", scope: null, message: "Playback complete." });
      else if (result === "failed") setState({ status: "failed", scope: null, message: "Audio could not start. Check browser audio permissions and try again." });
      else setState({ status: "idle", scope: null, message: "Playback stopped." });
    });
  }, [player, score]);

  const auditionSelectedEvent = useCallback((event: StaffBuilderEvent | null, eventPosition?: StaffBuilderPlaybackPosition) => {
    const projected = projectStaffBuilderEventAudition(event);
    if (!projected) return false;
    start("selected-event", "Playing selected event.", [projected], { staticPosition: eventPosition ?? null }, projected.durationMs);
    return true;
  }, [start]);

  const playCurrentMeasure = useCallback((measureIndex: number) => {
    const projection = projectStaffBuilderPlayback(score, { kind: "measure", measureIndex });
    start("current-measure", `Playing measure ${measureIndex + 1}.`, projection.events, projection, projection.durationMs);
  }, [score, start]);

  const playFromHere = useCallback((position: StaffBuilderPlaybackPosition) => {
    const projection = projectStaffBuilderPlayback(score, { kind: "from-position", position });
    start("from-position", `Playing from measure ${position.measureIndex + 1}.`, projection.events, projection, projection.durationMs);
  }, [score, start]);

  const playEntirePiece = useCallback(() => {
    const projection = projectStaffBuilderPlayback(score, { kind: "entire-piece" });
    start("entire-piece", "Playing entire piece.", projection.events, projection, projection.durationMs);
  }, [score, start]);

  const stop = useCallback(() => {
    requestGeneration.current += 1;
    player.cancel();
    setActiveVisualization(null);
    setPosition(null);
    setState({ status: "idle", scope: null, message: "Playback stopped." });
  }, [player]);

  return { state, position, auditionSelectedEvent, playCurrentMeasure, playFromHere, playEntirePiece, stop };
}
