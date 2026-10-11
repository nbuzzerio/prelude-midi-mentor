import type { ImprovTakeControl } from "./improv-take";

/** Inject projected elapsed positions. No raw timestamp is changed or sorted. */
export function createImprovMusicalClock() {
  let wall = 0, removed = 0, pauseAt: number | null = null, musical = 0;
  const advance = (value: number) => {
    if (Number.isFinite(value) && value >= 0) wall = Math.max(wall, value);
    musical = Math.max(musical, (pauseAt ?? wall) - removed);
    return musical;
  };
  return {
    position: advance,
    elapsed: (value: number) => pauseAt !== null ? musical : Math.max(musical, (Number.isFinite(value) ? Math.max(wall, value) : wall) - removed),
    paused: () => pauseAt !== null,
    control(control: ImprovTakeControl, atMs: number) {
      advance(atMs);
      if (control.kind === "pause" && pauseAt === null) pauseAt = wall;
      if (control.kind === "resume" && pauseAt !== null) { removed += wall - pauseAt; pauseAt = null; }
      return advance(wall);
    },
  };
}

/** FIFO channel/pitch interpretation. Ghost counts prevent a release belonging to an
 * excluded attack from releasing a newer rendered attack. State is bounded to 2048 keys. */
export function createImprovPerformanceFilter() {
  const ghosts = new Map<string, number>(), active = new Map<string, number>();
  const pedal = new Map<number, number>();
  return {
    pause() {
      for (const [key, count] of active) ghosts.set(key, (ghosts.get(key) ?? 0) + count);
      active.clear();
    },
    pedals: () => [...pedal.entries()],
    accept(bytes: readonly number[], paused: boolean) {
      const command = bytes[0] & 0xf0, channel = bytes[0] & 15;
      const [, pitch, value] = bytes; const key = `${channel}:${pitch}`;
      if (command === 0xb0 && pitch === 64) pedal.set(channel, value);
      if (command === 0x90 && value > 0) {
        const map = paused ? ghosts : active; map.set(key, (map.get(key) ?? 0) + 1);
        return !paused;
      }
      if (command === 0x80 || (command === 0x90 && value === 0)) {
        const ghost = ghosts.get(key) ?? 0;
        if (ghost) { if (ghost === 1) ghosts.delete(key); else ghosts.set(key, ghost - 1); return false; }
        const count = active.get(key) ?? 0;
        if (count > 1) active.set(key, count - 1); else active.delete(key);
      }
      return !paused;
    },
  };
}
