import { createPiecePracticeRecording, recordingExtension, type RecordingSegment, type RecordingSnapshot } from "../piece-practice/piece-practice-recording";
import { createPiecePracticeRecordingCapture } from "../piece-practice/piece-practice-recording-capture";
import { downloadImprovBlob, improvFilename } from "./improv-file-browser";
import type { ImprovObservation } from "./improv-take";

export type ImprovRoomAudioState = Readonly<{
  phase: "disabled" | "preparing" | "ready" | "starting" | "recording" | "finalizing" | "available" | "failed" | "discarded";
  message: string; segment: RecordingSegment | null; downloadRequested: boolean;
  timing: Readonly<{ timeOriginMs: number | null; requestedAtMs: number | null; preparedAtMs: number | null; audioStartedAtMs: number | null;
    stopRequestedAtMs: number | null; finalizedAtMs: number | null; midiStart: ImprovObservation | null;
    midiTerminal: ImprovObservation | null; takeId: string | null }>;
}>;
const emptyTiming = () => ({ timeOriginMs: globalThis.performance?.timeOrigin ?? null, requestedAtMs: null, preparedAtMs: null, audioStartedAtMs: null, stopRequestedAtMs: null,
  finalizedAtMs: null, midiStart: null, midiTerminal: null, takeId: null } satisfies ImprovRoomAudioState["timing"]);
const BYTE_LIMIT = 16 * 1024 * 1024;

/** One temporary result. Reuses Piece Practice's track owner and finalizer without changing them. */
export function createImprovRoomAudio(options: Readonly<{
  eligible: () => boolean; onChange?: (state: ImprovRoomAudioState) => void; now?: () => number;
  Recorder?: typeof MediaRecorder; mediaDevices?: Pick<MediaDevices, "getUserMedia">; secure?: boolean;
  createObjectURL?: (blob: Blob) => string; revokeObjectURL?: (url: string) => void;
}>) {
  const now = options.now ?? (() => performance.now()); const Native = options.Recorder ?? globalThis.MediaRecorder;
  let state: ImprovRoomAudioState = { phase: "disabled", message: "Room audio off.", segment: null, downloadRequested: false, timing: emptyTiming() };
  let recorder: ReturnType<typeof createPiecePracticeRecording> | null = null;
  let microphone: ReturnType<typeof createPiecePracticeRecordingCapture> | null = null;
  let generation = 0, disposed = false, limited = false;
  let startup: { begin: () => { takeId: string; observation: ImprovObservation }; resolve: () => void; reject: (error: Error) => void } | null = null;
  let startupTimer: ReturnType<typeof setTimeout> | null = null;
  const publish = (patch: Partial<ImprovRoomAudioState>) => {
    state = Object.freeze({ ...state, ...patch, timing: Object.freeze(patch.timing ?? state.timing) });
    if (!disposed) options.onChange?.(state);
  };
  const rejectStartup = (message: string) => {
    if (startupTimer !== null) clearTimeout(startupTimer); startupTimer = null;
    const pending = startup; startup = null; pending?.reject(new Error(message));
  };
  function stop() {
    rejectStartup("Room audio startup canceled. No MIDI take was started.");
    if (["preparing", "ready", "starting", "recording"].includes(state.phase)) {
      publish({ timing: { ...state.timing, stopRequestedAtMs: now() } });
      recorder?.setEligible(false); recorder?.setEnabled(false); microphone?.stop();
      if (["preparing", "ready"].includes(state.phase)) publish({ phase: "disabled", message: "Room audio canceled. Start MIDI only or prepare again." });
    }
  }
  function discard() {
    generation++; rejectStartup("Room audio canceled."); microphone?.dispose(); recorder?.dispose();
    microphone = null; recorder = null; limited = false;
    publish({ phase: "discarded", message: "Temporary room audio discarded.", segment: null, downloadRequested: false, timing: emptyTiming() });
  }
  function changed(snapshot: RecordingSnapshot, token: number) {
    if (disposed || token !== generation) return;
    if (snapshot.phase === "recording") {
      const started = state.timing.audioStartedAtMs ?? now();
      publish({ phase: "recording", message: "Room audio recording", timing: { ...state.timing, audioStartedAtMs: started } });
      const pending = startup;
      if (pending) {
        startup = null; if (startupTimer !== null) clearTimeout(startupTimer); startupTimer = null;
        try {
          if (!options.eligible()) throw new Error("MIDI source or foreground ownership changed. Prepare again before starting.");
          const midi = pending.begin();
          publish({ timing: { ...state.timing, midiStart: midi.observation, takeId: midi.takeId } }); pending.resolve();
        } catch (error) { stop(); publish({ phase: "failed", message: error instanceof Error ? error.message : "Take could not start." }); pending.reject(new Error(state.message)); }
      }
    } else if (snapshot.phase === "finalizing") publish({ phase: "finalizing", message: "Room audio finalizing" });
    else if (snapshot.segments.length) {
      publish({ phase: "available", segment: snapshot.segments[0], message: limited || snapshot.limitReached
        ? "Room audio limit reached; available prefix retained. MIDI continues independently."
        : snapshot.phase === "error" ? "Room audio stopped after an error; available prefix retained." : "Room audio available temporarily. MIDI save is separate.",
      timing: { ...state.timing, finalizedAtMs: now() } });
    } else if (["error", "unsupported", "limited"].includes(snapshot.phase)) {
      rejectStartup("Room audio could not start. Choose MIDI only explicitly or prepare again.");
      publish({ phase: "failed", message: "Room audio failed or unavailable. MIDI can continue; no usable audio was provided." }); microphone?.stop();
    }
    if (snapshot.limitReached || snapshot.phase === "error" || snapshot.phase === "unsupported") microphone?.stop();
  }
  // A small facade bounds accepted chunks, including a browser's oversized final chunk.
  // A refused chunk is reported; it is never clipped into a fabricated container.
  function boundedRecorder(token: number): typeof MediaRecorder {
    class Bounded {
      static isTypeSupported(mime: string) { return typeof Native.isTypeSupported !== "function" || Native.isTypeSupported(mime); }
      private native: MediaRecorder; private bytes = 0;
      onstart: MediaRecorder["onstart"] = null; onstop: MediaRecorder["onstop"] = null;
      onerror: MediaRecorder["onerror"] = null; ondataavailable: MediaRecorder["ondataavailable"] = null;
      constructor(stream: MediaStream, config?: MediaRecorderOptions) {
        this.native = new Native(stream, config);
        if (!recordingExtension(this.native.mimeType || config?.mimeType || "")) throw new Error("Unsupported native recording container.");
        this.native.onstart = e => this.onstart?.call(this.native, e);
        this.native.onstop = e => this.onstop?.call(this.native, e);
        this.native.onerror = e => this.onerror?.call(this.native, e);
        this.native.ondataavailable = e => {
          if (disposed || token !== generation) return;
          if (e.data && this.bytes + e.data.size > BYTE_LIMIT) { limited = true; stop(); return; }
          this.bytes += e.data?.size ?? 0; this.ondataavailable?.call(this.native, e);
        };
      }
      get state() { return this.native.state; } get mimeType() { return this.native.mimeType; }
      start(timeslice?: number) { this.native.start(timeslice); } stop() { this.native.stop(); }
    }
    return Bounded as unknown as typeof MediaRecorder;
  }
  return Object.freeze({
    snapshot: () => state,
    needsGuard: () => ["preparing", "ready", "starting", "recording", "finalizing"].includes(state.phase) || state.segment !== null,
    async prepare() {
      if (disposed || ["preparing", "starting", "recording", "finalizing", "available"].includes(state.phase)) return;
      discard(); const token = generation;
      if (!Native) { publish({ phase: "failed", message: "MediaRecorder is unavailable. Choose MIDI only or use a supported browser." }); return; }
      publish({ phase: "preparing", message: "Room microphone permission pending", timing: { ...state.timing, requestedAtMs: now() } });
      recorder = createPiecePracticeRecording({ runId: crypto.randomUUID(), instrument: "piano", analysisSessionId: null, originMs: 0,
        now, Recorder: boundedRecorder(token), createObjectURL: options.createObjectURL, revokeObjectURL: options.revokeObjectURL,
        onChange: snapshot => changed(snapshot, token) });
      microphone = createPiecePracticeRecordingCapture({ eligible: options.eligible, now, secure: options.secure, mediaDevices: options.mediaDevices,
        onStatus: status => {
          if (disposed || token !== generation) return;
          if (["denied", "error", "unavailable", "paused"].includes(status.state)) {
            rejectStartup("Room microphone unavailable. No MIDI take was started during preparation.");
            if (!state.segment && state.phase !== "finalizing") publish({ phase: "failed", message: status.state === "denied"
              ? "Microphone permission denied. Choose MIDI only or prepare again." : "Room microphone interrupted or unavailable. MIDI can continue independently." });
          }
        },
        onStreamReady: lease => { if (token !== generation || disposed) return; recorder?.onStreamReady(lease);
          publish({ phase: "ready", message: "Microphone ready. Press Start Take.", timing: { ...state.timing, preparedAtMs: lease.atMs } }); },
        onStreamEnding: lease => recorder?.onStreamEnding(lease),
      });
      await microphone.start();
    },
    start(begin: () => { takeId: string; observation: ImprovObservation }) {
      if (disposed || state.phase !== "ready" || !options.eligible()) return Promise.reject(new Error("Prepare the room microphone before starting."));
      return new Promise<void>((resolve, reject) => {
        startup = { begin, resolve, reject }; publish({ phase: "starting", message: "Starting room audio before MIDI capture" });
        startupTimer = setTimeout(() => { stop(); publish({ phase: "failed", message: "Room recorder startup timed out. Prepare again or choose MIDI only." }); }, 10_000);
        recorder!.setEnabled(true); recorder!.setEligible(true);
      });
    },
    stop, discard,
    observeTerminal(observation: ImprovObservation | null) {
      if (state.timing.takeId && observation && state.timing.midiTerminal === null) publish({ timing: { ...state.timing, midiTerminal: observation } });
      stop();
    },
    download(title: string, number: number | null) {
      if (!state.segment) throw new Error("Room audio is not available yet.");
      const extension = recordingExtension(state.segment.mimeType); if (!extension) throw new Error("Unknown recording container.");
      downloadImprovBlob(state.segment.blob, improvFilename(title, `${number === null ? "take-number-pending" : `take-${number}`}.${extension}`));
      publish({ downloadRequested: true, message: "Audio download requested. Verify the file before explicitly discarding temporary audio." });
    },
    dispose() { if (disposed) return; discard(); disposed = true; },
  });
}
