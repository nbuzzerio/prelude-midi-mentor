import type { ImprovLoadedTake } from "./improv-library";
import { requireLoadedTake } from "./improv-library-validation";
import { decodeImprovMessage, projectImprovTiming, type ImprovProjectionStep } from "./improv-performance";

export type ImprovReplayVoice = Readonly<{ started: Promise<boolean>; ended?: Promise<void>; release: () => void }>;
export type ImprovReplaySound = Readonly<{
  attack: (note: Readonly<{ pitch: number; channel: number; velocity: number; gain: number }>) => ImprovReplayVoice;
  dispose?: () => void;
}>;
export type ImprovReplayScheduler = Readonly<{ now: () => number; after: (delayMs: number, callback: () => void) => () => void }>;
export type ImprovReplayResult = "completed" | "cancelled" | "failed";
/** Read-only musical position; shares the event scheduler's origin and compressed projection. */
export type ImprovReplayTransport = Readonly<{ takeId: string; positionMs: () => number; active: () => boolean }>;

/** No input owner or automatic playback. The caller owns navigation/background Stop and disposal. */
export const IMPROV_REPLAY_MAX_VOICES = 512;
export function createImprovReplay(sound: ImprovReplaySound, scheduler: ImprovReplayScheduler = {
  now: () => performance.now(),
  after: (delay, callback) => { const timer = globalThis.setTimeout(callback, delay); return () => globalThis.clearTimeout(timer); },
}, options: Readonly<{ maxVoices?: number }> = {}) {
  const maxVoices = options.maxVoices ?? IMPROV_REPLAY_MAX_VOICES;
  if (!Number.isSafeInteger(maxVoices) || maxVoices < 1 || maxVoices > IMPROV_REPLAY_MAX_VOICES) throw new Error("Invalid Improv replay voice limit.");
  let disposed = false; let activeStop: (() => void) | null = null;
  const stop = () => { activeStop?.(); activeStop = null; };
  const play = (take: ImprovLoadedTake) => {
    if (disposed) throw new Error("Improv replay is disposed.");
    requireLoadedTake(take); stop();
    const timing = projectImprovTiming(take);
    const rawEvents = take.chunks.flatMap((chunk) => chunk.events);
    const projected: readonly ImprovProjectionStep[] = timing.steps ?? rawEvents.map((_, i) => ({ event: i, atMs: timing.events[i].atMs, paused: false, represented: true }));
    const ignored: { sequence: number; reason: string }[] = [];
    const events: (ImprovProjectionStep & { restore?: readonly (readonly [number, number])[] })[] = [];
    const observedPedal = new Map<number, number>();
    // Excluded context is interpreted once before the replay clock starts, never as a
    // potentially huge same-tick batch during playback after a long pause.
    for (const step of projected) {
      if ("control" in step) {
        events.push(step.control.kind === "resume" ? { ...step, restore: [...observedPedal.entries()] } : step);
      } else {
        const event = rawEvents[step.event], decoded = decodeImprovMessage(event.raw);
        if (decoded.kind === "channel" && decoded.command === 0xb0 && decoded.bytes[1] === 64) observedPedal.set(decoded.channel!, decoded.bytes[2]);
        if (!step.represented) ignored.push({ sequence: event.sequence, reason: step.paused ? "intentional-pause-context" : "cross-pause-release" });
        else events.push(step);
      }
    }
    const generated: { kind: string; atMs: number | null }[] = [];
    const startedAtMs = scheduler.now();
    if (!Number.isFinite(startedAtMs)) throw new Error("Improv replay clock is unavailable.");
    const voices = new Set<ImprovReplayVoice>(); const held = new Map<string, ImprovReplayVoice[]>();
    const sustained = new Map<number, Set<ImprovReplayVoice>>(); const pedal = new Set<number>();
    let settled = false; let cancelTimer: (() => void) | null = null; let index = 0;
    let position = 0;
    const positionMs = () => {
      if (!settled) {
        try {
          const now = scheduler.now();
          if (Number.isFinite(now) && now >= startedAtMs) position = Math.max(position, Math.min(timing.durationMs, now - startedAtMs));
        } catch { /* A read cannot reschedule or fail playback; retain the last valid position. */ }
      }
      return position;
    };
    const transport: ImprovReplayTransport = Object.freeze({ takeId: take.record.takeId, positionMs, active: () => !settled });
    let resolve!: (value: ImprovReplayResult) => void;
    const completion = new Promise<ImprovReplayResult>((done) => { resolve = done; });
    const release = (voice: ImprovReplayVoice) => { voices.delete(voice); voice.release(); };
    const finish = (result: ImprovReplayResult) => {
      if (settled) return;
      positionMs();
      if (result === "completed") position = timing.durationMs;
      settled = true; cancelTimer?.(); cancelTimer = null;
      if (take.record.schemaVersion === 2 && (voices.size || pedal.size)) generated.push({
        kind: result === "completed" ? "terminal-cleanup" : "replay-stop-cleanup",
        atMs: result === "completed" ? timing.durationMs : null,
      });
      // Continue cleanup if an injected/browser voice throws; one bad voice must not strand others.
      for (const voice of voices) { try { voice.release(); } catch { result = "failed"; } }
      voices.clear(); held.clear(); sustained.clear(); pedal.clear();
      if (activeStop === cancel) activeStop = null;
      resolve(result);
    };
    const cancel = () => finish("cancelled"); activeStop = cancel;
    const deliver = (i: number) => {
      const step = events[i];
      if ("control" in step) {
        if (step.control.kind === "pause") {
          for (const voice of [...voices]) release(voice);
          held.clear(); sustained.clear(); pedal.clear(); generated.push({ kind: "pause-boundary-cleanup", atMs: step.atMs });
        }
        if (step.control.kind === "resume") for (const [channel, value] of step.restore ?? []) if (value >= 64) {
          pedal.add(channel); generated.push({ kind: "resume-observed-controller-restore", atMs: step.atMs });
        }
        return;
      }
      const event = rawEvents[step.event]; const decoded = decodeImprovMessage(event.raw);
      if (decoded.kind !== "channel") { ignored.push({ sequence: event.sequence, reason: decoded.kind }); return; }
      const [, pitch, value] = decoded.bytes; const channel = decoded.channel!; const key = `${channel}:${pitch}`;
      if (decoded.command === 0x90 && value > 0) {
        if (voices.size >= maxVoices) { ignored.push({ sequence: event.sequence, reason: "replay-voice-limit" }); finish("failed"); return; }
        const voice = sound.attack({ pitch, channel, velocity: value, gain: value / 127 });
        voices.add(voice); const queue = held.get(key) ?? []; queue.push(voice); held.set(key, queue);
        void voice.started.then((ok) => { if (!settled && !ok) finish("failed"); }, () => { if (!settled) finish("failed"); });
        void voice.ended?.then(() => { voices.delete(voice); }, () => { if (!settled) finish("failed"); });
      } else if (decoded.command === 0x80 || (decoded.command === 0x90 && value === 0)) {
        const voice = held.get(key)?.shift();
        if (!voice) { ignored.push({ sequence: event.sequence, reason: "unmatched-release" }); return; }
        if (pedal.has(channel)) { const group = sustained.get(channel) ?? new Set(); group.add(voice); sustained.set(channel, group); }
        else release(voice);
      } else if (decoded.command === 0xb0 && pitch === 64) {
        if (value >= 64) pedal.add(channel);
        else { pedal.delete(channel); for (const voice of sustained.get(channel) ?? []) release(voice); sustained.delete(channel); }
      } else ignored.push({ sequence: event.sequence, reason: "not-rendered-by-piano-replay" });
    };
    const pump = () => {
      cancelTimer = null;
      if (settled) return;
      try {
        const now = scheduler.now();
        if (!Number.isFinite(now) || now < startedAtMs) { finish("failed"); return; }
        const elapsed = now - startedAtMs;
        while (!settled && index < events.length && events[index].atMs <= elapsed) deliver(index++);
        if (settled) return;
        if (index === events.length && elapsed >= timing.durationMs) { finish("completed"); return; }
        const nextAt = index < events.length ? events[index].atMs : timing.durationMs;
        cancelTimer = scheduler.after(Math.max(0, nextAt - elapsed), pump);
      } catch { finish("failed"); }
    };
    pump();
    return Object.freeze({ stop: cancel, completion, timing, startedAtMs, transport,
      generated: () => Object.freeze(generated.map(item => Object.freeze({ ...item }))),
      ignored: () => Object.freeze(ignored.map((item) => Object.freeze({ ...item })).sort((a, b) => a.sequence - b.sequence)) });
  };
  return Object.freeze({ play, stop, dispose: () => { if (disposed) return; disposed = true; stop(); sound.dispose?.(); } });
}
