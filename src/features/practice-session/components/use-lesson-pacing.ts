import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createActiveTimeAccumulator, getActiveTimeMs, pauseActiveTime, resumeActiveTime } from "@/lib/practice/active-time";

export const LESSON_PLANNED_MS = 10 * 60 * 1000;
/** Memory-only pacing. No wall/calendar clock and no writes to attempt evidence. */
export function useLessonPacing(running: boolean, now: () => number) {
  const clock = useRef(createActiveTimeAccumulator(0, false));
  const [elapsedMs, setElapsedMs] = useState(0);
  useLayoutEffect(() => {
    clock.current = running ? resumeActiveTime(clock.current, now()) : pauseActiveTime(clock.current, now());
    return () => { clock.current = pauseActiveTime(clock.current, now()); };
  }, [running, now]);
  useEffect(() => {
    const tick = () => setElapsedMs(getActiveTimeMs(clock.current, now()));
    tick();
    if (!running) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [running, now]);
  const seconds = Math.floor(elapsedMs / 1000);
  return { elapsedMs, label: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`, plannedTimeReached: elapsedMs >= LESSON_PLANNED_MS };
}
