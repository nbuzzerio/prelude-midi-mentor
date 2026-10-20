import { cleanUpMelodyScheduledClick, scheduleMelodyMetronomeClick, type MelodyScheduledClick } from "@/features/melody/melody-metronome";
import type { MelodyOwnedAudioContext } from "@/features/melody/melody-browser-audio";
import type { ContinuousPassage } from "./continuous-types";

export type ContinuousClock = Readonly<{
  startSeconds: number; countInSeconds: number; performanceSeconds: number; endSeconds: number;
  now: () => number; cancel: () => void;
}>;
export function continuousBeats(p: ContinuousPassage) {
  return Array.from({ length: (p.end - p.start + 2) * p.pulsesPerBar }, (_, i) => ({
    timeMs: i * p.pulseMs, accented: i % p.pulsesPerBar === 0,
    phase: i < p.pulsesPerBar ? "count-in" : "playing" }));
}
/** Audio is created/resumed by the explicit user action, never by mount or Ready. */
export function createContinuousClock(p: ContinuousPassage, context: MelodyOwnedAudioContext): ContinuousClock {
  if (context.state !== "running") throw Error("Audio is not running. Enable browser audio and try again.");
  const startSeconds = context.currentTime + 0.1;
  const performanceSeconds = startSeconds + p.measureMs / 1000;
  const endSeconds = performanceSeconds + (p.durationMs + p.tailMs) / 1000;
  const clicks: MelodyScheduledClick[] = [];
  let cancelled = false;
  const cancel = () => { if (cancelled) return; cancelled = true; clicks.forEach(cleanUpMelodyScheduledClick); };
  try { for (const beat of continuousBeats(p)) clicks.push(scheduleMelodyMetronomeClick(context, startSeconds + beat.timeMs / 1000, beat.accented)); }
  catch (error) { cancel(); throw error; }
  return { startSeconds, countInSeconds: p.measureMs / 1000, performanceSeconds, endSeconds,
    now: () => context.currentTime, cancel };
}
