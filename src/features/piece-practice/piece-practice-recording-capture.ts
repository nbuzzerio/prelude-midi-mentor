import type { CaptureStatus, CaptureStreamLease } from "@/lib/audio/monophonic/microphone-capture";

type Options = Readonly<{
  eligible: () => boolean; now?: () => number;
  mediaDevices?: Pick<MediaDevices, "getUserMedia">; secure?: boolean;
  onStatus: (status: CaptureStatus) => void;
  onStreamReady: (lease: CaptureStreamLease) => void;
  onStreamEnding: (lease: CaptureStreamLease) => void;
}>;
type Resource = {
  generation: number; stream: MediaStream | null; delivered: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  listeners: { target: EventTarget; name: string; listener: EventListener }[];
};

/** Recording-only track owner. No AudioContext, analyzer or pitch observations. */
export function createPiecePracticeRecordingCapture({ eligible, now = () => performance.now(),
  mediaDevices = globalThis.navigator?.mediaDevices, secure = globalThis.isSecureContext,
  onStatus, onStreamReady, onStreamEnding }: Options) {
  let owned: Resource | null = null, generation = 0, disposed = false;
  const status = (state: CaptureStatus["state"], message: string) => { if (!disposed) onStatus({ state, message }); };
  function stop(state: CaptureStatus["state"] = "idle", message = "Recording microphone off.") {
    generation++;
    const old = owned;
    owned = null; // Clear ownership before notifications, including reentrant recorder failures.
    if (old) {
      if (old.delivered && old.stream) {
        old.delivered = false;
        try { onStreamEnding({ stream: old.stream, generation: old.generation, atMs: now() }); } catch { /* Observers cannot prevent track cleanup. */ }
      }
      if (old.timer !== null) clearTimeout(old.timer);
      old.listeners.forEach(({ target, name, listener }) => target.removeEventListener(name, listener));
      old.stream?.getTracks().forEach((track) => track.stop());
    }
    status(state, message);
  }
  async function start() {
    if (disposed || owned) return;
    if (!eligible()) { status("paused", "Recording microphone unavailable while practice is paused or in the background. Resume recording explicitly when ready."); return; }
    if (!secure || !mediaDevices?.getUserMedia) {
      status("unavailable", "Recording requires HTTPS or localhost and browser microphone support. MIDI practice can continue."); return;
    }
    const resource: Resource = { generation: ++generation, stream: null, delivered: false, timer: null, listeners: [] };
    owned = resource;
    const current = () => !disposed && owned === resource && generation === resource.generation;
    const listen = (target: EventTarget, name: string, listener: EventListener) => {
      target.addEventListener(name, listener); resource.listeners.push({ target, name, listener });
    };
    const interrupt = () => { if (current()) stop("paused", "Recording microphone interrupted. Resume recording explicitly; MIDI practice is unaffected."); };
    listen(document, "visibilitychange", () => { if (document.visibilityState === "hidden") interrupt(); });
    listen(document, "freeze", interrupt);
    listen(window, "pagehide", interrupt);
    status("requesting", "Allow microphone access to record room audio. Turning recording off cancels startup; the browser permission prompt may remain visible.");
    resource.timer = setTimeout(() => { if (current()) stop("error", "Recording microphone startup timed out. Retry recording; MIDI practice can continue."); }, 30_000);
    try {
      const stream = await mediaDevices.getUserMedia({ audio: { channelCount: { ideal: 1 },
        echoCancellation: { ideal: false }, noiseSuppression: { ideal: false }, autoGainControl: { ideal: false } }, video: false });
      if (!current()) { stream.getTracks().forEach((track) => track.stop()); return; }
      resource.stream = stream;
      if (!eligible()) { interrupt(); return; }
      const tracks = stream.getAudioTracks();
      if (!tracks.length || tracks.some((track) => track.readyState === "ended" || track.muted)) throw Error("Unavailable track");
      for (const track of tracks) { listen(track, "ended", interrupt); listen(track, "mute", interrupt); }
      if (resource.timer !== null) clearTimeout(resource.timer);
      resource.timer = null;
      resource.delivered = true;
      status("listening", "Room microphone active for performance recording. MIDI still handles grading.");
      if (current()) {
        try { onStreamReady({ stream, generation: resource.generation, atMs: now() }); } catch { /* Recorder failure must not take over track ownership. */ }
      }
    } catch (error) {
      if (!current()) return;
      const name = typeof error === "object" && error !== null && "name" in error ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") stop("denied", "Microphone permission denied. Allow access, then Retry recording. MIDI practice can continue.");
      else if (name === "NotFoundError") stop("unavailable", "No recording microphone was found. Connect one, then Retry recording. MIDI practice can continue.");
      else stop("error", "Recording microphone could not start. Retry recording; MIDI practice can continue.");
    }
  }
  return { start, stop, active: () => owned !== null, dispose() { if (disposed) return; disposed = true; stop(); } };
}
