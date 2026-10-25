import { createMelodyBrowserAudioContext, type MelodyOwnedAudioContext } from "@/features/melody/melody-browser-audio";
import type { MidiInputInfo, RawMidiMessage } from "@/lib/midi/midi-transport";
import { assessContinuous } from "./continuous-assessment";
import { createContinuousClock, type ContinuousClock } from "./continuous-clock";
import { createContinuousMidiCapture } from "./continuous-midi";
import { admitContinuousPassage, continuousBudget, continuousAttackBytes, CONTINUOUS_MAX_ATTACKS, CONTINUOUS_MAX_RECORD_BYTES } from "./continuous-budget";
import type { ContinuousAttempt, ContinuousPassage, ContinuousStore } from "./continuous-types";

export type ContinuousView = Readonly<{
  phase: "ready" | "starting" | "count-in" | "playing" | "results";
  elapsedMs: number; pulse: number; attempt: ContinuousAttempt | null;
  save: "idle" | "pending" | "saved" | "failed"; error: string | null;
  /** Ephemeral selected-input verification, never part of saved performance evidence. */
  midiNote: number | null;
}>;

/** Feature-local session authority. All async continuations are fenced by generation. */
export class ContinuousSession {
  private view: ContinuousView = { phase: "ready", elapsedMs: 0, pulse: 0, attempt: null, save: "idle", error: null, midiNote: null };
  private listeners = new Set<() => void>();
  private generation = 0;
  private audio: MelodyOwnedAudioContext | null = null;
  private clock: ContinuousClock | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastCheckpoint = 0;
  private ownership = false;
  private connected = true;
  private performanceCutoffMs = Infinity;
  private capture: ReturnType<typeof createContinuousMidiCapture>;
  private retainedBytes = 0;
  private terminalBytes: number;
  constructor(readonly passage: ContinuousPassage, readonly input: MidiInputInfo, private store: ContinuousStore,
    private audioFactory = createMelodyBrowserAudioContext, private calendar = () => new Date().toISOString(),
    private identity: () => string = () => crypto.randomUUID(), private monotonic = () => performance.now()) {
    this.input = Object.freeze({ ...input });
    this.capture = createContinuousMidiCapture(this.input);
    this.terminalBytes = continuousBudget(passage, this.input).terminalBytes;
  }
  snapshot = () => this.view;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(next: Partial<ContinuousView>) { this.view = { ...this.view, ...next }; this.listeners.forEach((f) => f()); }
  ownershipChanged = (active: boolean) => {
    this.ownership = active;
    if (!active) { this.invalidateInput(); this.interrupt("MIDI ownership was lost."); }
    if (this.view.phase === "ready") this.publish({ error: active ? null : "MIDI ownership is unavailable. Return to range selection and prepare again." });
  };
  hasOwnership = () => this.ownership;
  invalidateInput = () => { if (this.view.midiNote !== null) this.publish({ midiNote: null }); };
  private releaseAudio() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.clock?.cancel(); this.clock = null;
    const audio = this.audio; this.audio = null;
    if (audio) void audio.close?.().catch(() => undefined);
  }
  begin = () => {
    if (this.view.phase !== "ready" || !this.ownership || !this.connected || !this.input.id || this.view.midiNote === null
      || document.visibilityState === "hidden") return;
    try { admitContinuousPassage(this.passage, this.input); }
    catch (error) { this.publish({ error: error instanceof Error ? error.message : "Select a shorter range." }); return; }
    const token = ++this.generation;
    const attempt = this.view.attempt ?? { version: 1, id: this.identity(), revision: 0, passage: this.passage,
      input: { ...this.input }, status: "started", startedAt: this.calendar(), endedAt: null,
      performanceStartedAt: null, observedThroughMs: 0, reason: null, attacks: [], assessment: null, terminalSaveAttempts: 0 } satisfies ContinuousAttempt;
    this.publish({ phase: "starting", attempt, save: "pending", error: null });
    let audio: MelodyOwnedAudioContext;
    let activated: Promise<void>;
    try {
      audio = this.audioFactory(); this.audio = audio;
      activated = audio.state === "suspended" ? audio.resume() : Promise.resolve();
    } catch { this.finish("failed", "Browser audio activation failed. Enable audio and replay."); return; }
    // Resume is invoked before any persistence await to preserve user activation.
    void Promise.allSettled([this.store.save(attempt), activated]).then(([saved, activation]) => {
      if (token !== this.generation) return;
      if (saved.status === "rejected") {
        this.releaseAudio();
        this.publish({ phase: "ready", save: "failed", error: "Attempt start was not acknowledged. Retry Start; no performance has begun." });
        return;
      }
      if (activation.status === "rejected" || audio.state !== "running") {
        this.finish("failed", "Browser audio activation was denied or suspended. Enable audio and replay."); return;
      }
      try {
        if (!this.ownership) throw Error("MIDI ownership was lost.");
        this.clock = createContinuousClock(this.passage, audio);
        this.performanceCutoffMs = this.monotonic() + (this.clock.performanceSeconds - audio.currentTime) * 1000;
        this.lastCheckpoint = 0;
        this.publish({ phase: "count-in", save: "saved" });
        this.timer = setInterval(this.tick, 40);
      } catch { this.finish("failed", "The continuous audio clock could not start."); }
    });
  };
  tick = () => {
    const clock = this.clock;
    if (!clock) return;
    if (this.audio?.state !== "running") { this.interrupt("Audio was suspended or interrupted."); return; }
    const now = clock.now();
    const elapsedMs = Math.max(0, Math.min(this.passage.durationMs + this.passage.tailMs, (now - clock.performanceSeconds) * 1000));
    let attempt = this.view.attempt!;
    if (now >= clock.performanceSeconds && attempt.performanceStartedAt === null) {
      attempt = { ...attempt, performanceStartedAt: this.calendar() };
    }
    attempt = { ...attempt, observedThroughMs: elapsedMs };
    this.publish({ phase: now < clock.performanceSeconds ? "count-in" : "playing", elapsedMs, attempt,
      pulse: now < clock.startSeconds ? 0 : Math.floor((now - clock.startSeconds) * 1000 / this.passage.pulseMs) % this.passage.pulsesPerBar + 1 });
    if (now >= clock.endSeconds) { this.finish("completed", null); return; }
    if (elapsedMs - this.lastCheckpoint >= 2000) {
      this.lastCheckpoint = elapsedMs;
      const checkpoint = { ...attempt, revision: attempt.revision + 1 };
      this.publish({ attempt: checkpoint });
      const token = this.generation;
      void this.store.save(checkpoint).catch(() => {
        if (token === this.generation) this.interrupt("A checkpoint could not be stored. Evidence remains in memory for terminal Retry.");
      });
    }
  };
  rawMessage = (message: RawMidiMessage) => {
    if (!this.ownership || !this.connected || document.visibilityState === "hidden") return;
    if (message.input.id === this.input.id && message.input.name !== this.input.name) { this.disconnect(this.input.id); return; }
    if (this.view.phase === "ready") {
      // Use the same validation as performance capture, with an isolated collector.
      // Testing cannot advance the performance collector or create an attempt.
      const note = createContinuousMidiCapture(this.input)(message, 0, 0);
      if (note && this.view.midiNote !== note.midi) this.publish({ midiNote: note.midi });
      return;
    }
    const clock = this.clock;
    if (!clock || !this.ownership) return;
    const now = clock.now();
    const source = message.sourceTimeStampMs;
    if (source !== null && Number.isFinite(source) && source >= 0 && source <= message.receivedAtMs + 1
      && source < this.performanceCutoffMs - 5) return;
    const attack = this.capture(message, now, clock.performanceSeconds);
    // Count-in notes, including delayed deliveries with pre-downbeat timestamps, never grade.
    if (!attack || now < clock.performanceSeconds || now > clock.endSeconds || attack.timeMs < 0
      || attack.timeMs > this.passage.durationMs + this.passage.tailMs) return;
    const attempt = this.view.attempt!;
    if (attempt.attacks.length >= CONTINUOUS_MAX_ATTACKS) { this.finish("interrupted", "The 2,048-attack evidence limit was reached."); return; }
    const bytes = continuousAttackBytes(attack);
    if (this.terminalBytes + this.retainedBytes + bytes > CONTINUOUS_MAX_RECORD_BYTES) {
      this.finish("interrupted", "The 2 MiB evidence budget was reached. Captured notes are retained; select a shorter range before replaying."); return;
    }
    this.retainedBytes += bytes;
    this.publish({ attempt: { ...attempt, attacks: [...attempt.attacks, attack] } });
  };
  private finish(status: ContinuousAttempt["status"], reason: string | null) {
    if (this.view.phase === "results" || this.view.phase === "ready" || !this.view.attempt) return;
    const elapsed = status === "completed" ? this.passage.durationMs + this.passage.tailMs : this.clock ? Math.max(0, Math.min(this.passage.durationMs + this.passage.tailMs,
      (this.clock.now() - this.clock.performanceSeconds) * 1000)) : 0;
    const hadPerformance = this.clock && this.clock.now() >= this.clock.performanceSeconds;
    ++this.generation;
    this.releaseAudio();
    const attempt: ContinuousAttempt = { ...this.view.attempt, status, reason,
      revision: this.view.attempt.revision + 1, endedAt: this.calendar(), observedThroughMs: elapsed,
      performanceStartedAt: this.view.attempt.performanceStartedAt ?? (hadPerformance ? this.calendar() : null),
      assessment: assessContinuous(this.passage, this.view.attempt.attacks, elapsed), terminalSaveAttempts: 1 };
    this.publish({ phase: "results", attempt, elapsedMs: elapsed, error: reason, save: "pending" });
    this.persistTerminal(attempt);
  }
  private persistTerminal(attempt: ContinuousAttempt) {
    const token = this.generation;
    void this.store.save(attempt).then(() => {
      if (token === this.generation) this.publish({ save: "saved" });
    }, () => { if (token === this.generation) this.publish({ save: "failed", error: "The result is not safely stored. Evidence remains here; use Retry Save before Replay or Exit." }); });
  }
  retrySave = () => {
    if (this.view.phase !== "results" || this.view.save !== "failed") return;
    const attempt = { ...this.view.attempt!, revision: this.view.attempt!.revision + 1,
      terminalSaveAttempts: this.view.attempt!.terminalSaveAttempts + 1 };
    this.publish({ attempt, save: "pending", error: attempt.reason });
    this.persistTerminal(attempt);
  };
  stop = () => this.finish("stopped", "Stopped by the player.");
  interrupt = (reason: string) => this.finish("interrupted", reason);
  disconnect = (id: string | null) => { if (id === this.input.id) { this.connected = false; this.invalidateInput(); this.interrupt("The selected MIDI piano disconnected. Reconnect before replaying."); } };
  reconnect = (id: string | null) => { if (id === this.input.id) this.connected = true; };
  replay = () => {
    if (this.view.phase !== "results" || this.view.save !== "saved") return;
    ++this.generation;
    this.capture = createContinuousMidiCapture(this.input);
    this.retainedBytes = 0;
    this.publish({ phase: "ready", elapsedMs: 0, pulse: 0, attempt: null, error: null, save: "idle" });
  };
  canExit = () => {
    if (this.view.phase === "ready" && this.view.save !== "pending") return true;
    return this.view.phase === "results" && this.view.save === "saved";
  };
}
