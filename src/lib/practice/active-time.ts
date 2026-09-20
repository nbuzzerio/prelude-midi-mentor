export type ActiveTimeAccumulator = Readonly<{
  accumulatedMs: number;
  runningSinceMs: number | null;
}>;

function requireTimestamp(atMs: number): void {
  if (!Number.isFinite(atMs) || atMs < 0) throw new Error("Active-time timestamps must be finite non-negative numbers.");
}

export function createActiveTimeAccumulator(atMs: number, running: boolean): ActiveTimeAccumulator {
  requireTimestamp(atMs);
  return Object.freeze({ accumulatedMs: 0, runningSinceMs: running ? atMs : null });
}

export function getActiveTimeMs(clock: ActiveTimeAccumulator, atMs: number): number {
  requireTimestamp(atMs);
  return clock.accumulatedMs + (clock.runningSinceMs === null ? 0 : Math.max(0, atMs - clock.runningSinceMs));
}

export function pauseActiveTime(clock: ActiveTimeAccumulator, atMs: number): ActiveTimeAccumulator {
  if (clock.runningSinceMs === null) return clock;
  return Object.freeze({ accumulatedMs: getActiveTimeMs(clock, atMs), runningSinceMs: null });
}

export function resumeActiveTime(clock: ActiveTimeAccumulator, atMs: number): ActiveTimeAccumulator {
  requireTimestamp(atMs);
  return clock.runningSinceMs === null
    ? Object.freeze({ ...clock, runningSinceMs: atMs })
    : clock;
}
