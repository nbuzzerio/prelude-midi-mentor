import {
  playGrandPianoChord,
  type PianoPlaybackHandle,
} from "./grand-piano";

export type PlayableMusicalEvent = Readonly<{
  durationMs: number;
  notes: readonly number[];
  startTimeMs: number;
}>;

export type MusicalEventPlaybackResult = "completed" | "cancelled" | "failed";

export type MusicalEventPlayback = Readonly<{
  cancel: () => void;
  completion: Promise<MusicalEventPlaybackResult>;
}>;

type NotePlayer = (
  notes: readonly number[],
  durationMs: number,
) => PianoPlaybackHandle;

export function createMusicalEventPlayer(
  notePlayer: NotePlayer = playGrandPianoChord,
) {
  let activeCancel: (() => void) | null = null;

  const cancel = () => {
    activeCancel?.();
    activeCancel = null;
  };

  const play = (events: readonly PlayableMusicalEvent[]): MusicalEventPlayback => {
    cancel();

    const stableEvents = events.map((event) => ({ ...event, notes: [...event.notes] }));
    const timers = new Set<number>();
    const handles = new Set<PianoPlaybackHandle>();
    let settled = false;
    let resolveCompletion!: (result: MusicalEventPlaybackResult) => void;
    const completion = new Promise<MusicalEventPlaybackResult>((resolve) => {
      resolveCompletion = resolve;
    });

    const finish = (result: MusicalEventPlaybackResult) => {
      if (settled) return;
      settled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
      if (result !== "completed") handles.forEach((handle) => handle.stop());
      handles.clear();
      if (activeCancel === cancelCurrent) activeCancel = null;
      resolveCompletion(result);
    };

    const cancelCurrent = () => finish("cancelled");
    activeCancel = cancelCurrent;

    if (stableEvents.length === 0) {
      finish("completed");
      return { cancel: cancelCurrent, completion };
    }

    const startEvent = (event: PlayableMusicalEvent) => {
      if (settled) return;
      const handle = notePlayer(event.notes, event.durationMs);
      handles.add(handle);
      void handle.started.then((started) => {
        if (!settled && !started) finish("failed");
      });
    };

    stableEvents.forEach((event) => {
      if (event.startTimeMs <= 0) {
        startEvent(event);
        return;
      }
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        startEvent(event);
      }, event.startTimeMs);
      timers.add(timer);
    });

    const endTimeMs = Math.max(
      ...stableEvents.map((event) => event.startTimeMs + event.durationMs),
    );
    const completionTimer = window.setTimeout(() => {
      timers.delete(completionTimer);
      finish("completed");
    }, Math.max(0, endTimeMs));
    timers.add(completionTimer);

    return { cancel: cancelCurrent, completion };
  };

  return { cancel, play };
}
