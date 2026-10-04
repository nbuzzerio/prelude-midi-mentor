import { createPitchDetector } from "./pitch-detector";
import { createPitchStabilizer, type TunerSnapshot } from "./pitch-stabilizer";
import { TUNER_CONFIG } from "./tuner-pitch";

export type CaptureState = "idle" | "requesting" | "starting" | "listening" | "paused" | "denied" | "unavailable" | "error";
export type CaptureStatus = Readonly<{ state: CaptureState; message: string }>;
type Timer = ReturnType<typeof setTimeout>;
type Resource = {
  context: AudioContext | null; stream: MediaStream | null;
  source: MediaStreamAudioSourceNode | null; analyser: AnalyserNode | null;
  timer: Timer | null; startupTimer: Timer | null; disposed: boolean;
  listeners: { target: EventTarget; name: string; listener: EventListener }[];
  tracker: ReturnType<typeof createPitchStabilizer>;
};
type CaptureOptions = Readonly<{
  mediaDevices?: Pick<MediaDevices, "getUserMedia">; Context?: typeof AudioContext;
  secure?: boolean; eligible: () => boolean; now?: () => number;
  onStatus: (status: CaptureStatus) => void; onPitch: (snapshot: TunerSnapshot) => void;
}>;

// Retired contexts outlive a controller/unmount. They never own microphone tracks.
// Retry only on explicit Start/Stop; an unresolved attempt prevents new allocation.
const retiredContexts = new Map<AudioContext, { inFlight: boolean }>();
function attemptClosure(context: AudioContext) {
  const retirement = retiredContexts.get(context);
  if (!retirement) return;
  if (context.state === "closed") { retiredContexts.delete(context); return; }
  if (retirement.inFlight) return;
  retirement.inFlight = true;
  const settled = () => {
    retirement.inFlight = false;
    if (context.state === "closed" && retiredContexts.get(context) === retirement) retiredContexts.delete(context);
  };
  try { void Promise.resolve(context.close()).then(settled, settled); }
  catch { settled(); }
}
function hasUnclosedContexts() {
  for (const context of retiredContexts.keys()) if (context.state === "closed") retiredContexts.delete(context);
  return retiredContexts.size > 0;
}

/** One explicit listening session. No MIDI events, recordings, or speaker connection. */
export function createMicrophoneCapture({ mediaDevices = globalThis.navigator?.mediaDevices,
  Context = globalThis.AudioContext, secure = globalThis.isSecureContext,
  eligible, now = () => performance.now(), onStatus, onPitch }: CaptureOptions) {
  let generation = 0, owned: Resource | null = null;
  function cleanup(resource: Resource | null) {
    if (!resource || resource.disposed) return;
    resource.disposed = true;
    if (resource.timer !== null) clearTimeout(resource.timer);
    if (resource.startupTimer !== null) clearTimeout(resource.startupTimer);
    resource.listeners.forEach(({ target, name, listener }) => target.removeEventListener(name, listener));
    resource.stream?.getTracks().forEach((track) => track.stop());
    try { resource.source?.disconnect(); } catch { /* Partially initialized graph. */ }
    try { resource.analyser?.disconnect(); } catch { /* Partially initialized graph. */ }
    const context = resource.context;
    if (context) {
      if (!retiredContexts.has(context)) retiredContexts.set(context, { inFlight: false });
      attemptClosure(context);
    }
    resource.tracker.reset();
  }
  function stop(state: CaptureState = "idle", message = "Microphone off.") {
    // Retry older retirements once, separately from this session's first close attempt.
    const previousRetirements = [...retiredContexts.keys()];
    generation++; const old = owned; owned = null; cleanup(old);
    previousRetirements.forEach(attemptClosure);
    onPitch({ state: "listening", pitch: null, fresh: false, ageMs: null });
    onStatus({ state, message: hasUnclosedContexts()
      ? `${message} Microphone tracks are stopped; browser audio cleanup was requested. Start Listening will retry unfinished cleanup.`
      : message });
  }
  async function start() {
    if (owned) return;
    if (!eligible()) { stop("paused", "Listening is available only in the foreground tuner, with no active Practice Session."); return; }
    if (!secure || !mediaDevices?.getUserMedia || !Context) {
      stop("unavailable", "Microphone access requires HTTPS or localhost and a browser with microphone audio support."); return;
    }
    for (const context of retiredContexts.keys()) attemptClosure(context);
    if (hasUnclosedContexts()) {
      generation++;
      onPitch({ state: "listening", pitch: null, fresh: false, ageMs: null });
      onStatus({ state: "error", message: "Microphone is off, but browser audio cleanup is unfinished. Return to this tab and press Start Listening to retry. No new microphone session was opened." });
      return;
    }
    const epoch = ++generation;
    const resource: Resource = { context: null, stream: null, source: null, analyser: null,
      timer: null, startupTimer: null, disposed: false, listeners: [], tracker: createPitchStabilizer() };
    owned = resource;
    const current = () => generation === epoch && owned === resource && !resource.disposed;
    const canContinue = () => {
      if (!current()) return false;
      if (!eligible()) { stop("paused", "Listening stopped because the tuner is no longer eligible. Press Start Listening to restart."); return false; }
      return true;
    };
    const listen = (target: EventTarget, name: string, listener: EventListener) => {
      target.addEventListener(name, listener); resource.listeners.push({ target, name, listener });
    };
    const interrupt = (message: string) => { if (current()) stop("paused", message); };
    try {
      // Resume during the click gesture, before waiting on the permission prompt.
      const context = new Context(); resource.context = context;
      let wasRunning = context.state === "running";
      listen(context, "statechange", () => {
        if (context.state === "running") { wasRunning = true; return; }
        // Initial suspension is normal while awaiting activation. Interruption is not.
        if (wasRunning || context.state === "interrupted" || context.state === "closed") interrupt("Audio interrupted. Press Start Listening to retry.");
      });
      if (context.state === "interrupted" || context.state === "closed") { interrupt("Audio interrupted. Press Start Listening to retry."); return; }
      const activation = Promise.resolve(context.resume()).then(() => {
        wasRunning = true;
        return { ok: true as const };
      }, (error: unknown) => ({ ok: false as const, error }));
      onStatus({ state: "requesting", message: "Allow microphone access in your browser. Stop Listening cancels Prelude's pending startup; the browser permission prompt may remain visible." });
      resource.startupTimer = setTimeout(() => { if (current()) stop("error", "Microphone startup timed out. Press Start Listening to try again."); }, 30000);
      const stream = await mediaDevices.getUserMedia({ audio: { channelCount: { ideal: 1 },
        echoCancellation: { ideal: false }, noiseSuppression: { ideal: false }, autoGainControl: { ideal: false } }, video: false });
      if (!current()) { stream.getTracks().forEach((track) => track.stop()); return; }
      resource.stream = stream;
      const tracks = stream.getAudioTracks();
      for (const track of tracks) {
        listen(track, "ended", () => interrupt("Microphone disconnected or access ended. Press Start Listening to retry."));
        listen(track, "mute", () => interrupt("Microphone interrupted. Press Start Listening to retry."));
      }
      const checkTracks = () => {
        if (!tracks.length || tracks.some((track) => track.readyState === "ended" || track.muted)) throw new Error("Microphone track is unavailable.");
      };
      checkTracks();
      if (!canContinue()) return;
      onStatus({ state: "starting", message: "Starting microphone audio…" });
      const activated = await activation;
      if (!canContinue()) return;
      if (!activated.ok) throw activated.error;
      if (context.state !== "running") throw new Error("AudioContext did not start.");
      wasRunning = true; checkTracks();
      const source = context.createMediaStreamSource(stream); resource.source = source;
      const analyser = context.createAnalyser(); resource.analyser = analyser;
      analyser.fftSize = TUNER_CONFIG.frameSize; analyser.channelCount = 1; analyser.channelCountMode = "explicit";
      source.connect(analyser); // Deliberately no connection to context.destination.
      const buffer = new Float32Array(TUNER_CONFIG.frameSize), detect = createPitchDetector();
      let lastClock: number | null = null, lastProgressAt = now();
      const sample = () => {
        if (!canContinue()) return;
        try {
          if (context.state !== "running") { interrupt("Audio interrupted. Press Start Listening to retry."); return; }
          const at = now(), audioSeconds = context.currentTime;
          if (lastClock !== null && audioSeconds <= lastClock) {
            onPitch(resource.tracker.update({ frequencyHz: null, quality: 0, levelDbfs: -180, reason: "clock-stalled" }, at, audioSeconds));
            if (at - lastProgressAt > 500) { interrupt("Microphone audio stopped progressing. Press Start Listening to retry."); return; }
          } else {
            analyser.getFloatTimeDomainData(buffer);
            onPitch(resource.tracker.update(detect(buffer, context.sampleRate), at, audioSeconds));
            lastClock = audioSeconds; lastProgressAt = at;
          }
          if (current()) resource.timer = setTimeout(sample, 1000 / 30);
        } catch { if (current()) stop("error", "Microphone analysis failed. Stop other audio applications and try again."); }
      };
      if (resource.startupTimer !== null) clearTimeout(resource.startupTimer);
      resource.startupTimer = null;
      onStatus({ state: "listening", message: "Microphone active. Play one sustained note." });
      if (canContinue()) resource.timer = setTimeout(sample, 1000 / 30);
    } catch (error) {
      if (!current()) { cleanup(resource); return; }
      const name = error instanceof Error ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") stop("denied", "Microphone permission was denied. Allow microphone access in your browser settings, then try again.");
      else if (name === "NotFoundError") stop("unavailable", "No microphone was found. Connect or enable a microphone, then try again.");
      else if (name === "NotReadableError" || name === "AbortError") stop("error", "The microphone could not be opened. Close other applications using it, then try again.");
      else stop("error", "Microphone audio could not start. Check your device and browser audio settings, then try again.");
    } finally { if (resource.startupTimer !== null) clearTimeout(resource.startupTimer); }
  }
  return { start, stop, snapshot: () => owned?.tracker.snapshot(now()) ?? { state: "listening" as const, pitch: null, fresh: false, ageMs: null },
    resources: () => ({ contexts: [...retiredContexts.keys()].filter((context) => context.state !== "closed").length
      + (owned?.context && owned.context.state !== "closed" ? 1 : 0),
      tracks: owned?.stream?.getTracks().filter((track) => track.readyState !== "ended").length ?? 0 }) };
}
