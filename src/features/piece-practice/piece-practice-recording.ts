import type { CaptureStreamLease } from "@/lib/audio/monophonic/microphone-capture";

const MAX_DURATION_MS = 20 * 60 * 1000;
const STOP_BYTES = 14 * 1024 * 1024;
const SOFT_BYTES = 16 * 1024 * 1024;
const FINALIZE_TIMEOUT_MS = 10_000;
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/ogg;codecs=opus"] as const;

export type RecordingPhase = "off" | "armed" | "starting" | "recording" | "finalizing" | "stopped" | "limited" | "unsupported" | "error";
export type RecordingSegment = Readonly<{
  ownerInstanceId: string; runId: string; analysisSessionId: string | null; sequence: number; captureGeneration: number;
  source: "room-microphone";
  startedAt: string; startedAtMs: number; endedAtMs: number;
  durationMs: number; size: number; mimeType: string; filename: string; blob: Blob; url: string;
}>;
export type RecordingSnapshot = Readonly<{
  enabled: boolean; phase: RecordingPhase; message: string; elapsedMs: number;
  segments: readonly RecordingSegment[]; retainedBytes: number; limitReached: boolean;
}>;

type RecordingOptions = Readonly<{
  runId: string; instrument: "piano" | "violin" | "ocarina"; analysisSessionId: string | null; originMs: number;
  now?: () => number; wallNow?: () => Date; Recorder?: typeof MediaRecorder;
  createObjectURL?: (blob: Blob) => string; revokeObjectURL?: (url: string) => void;
  onChange?: (snapshot: RecordingSnapshot) => void;
}>;
type Active = {
  ownerInstanceId: string; recorder: MediaRecorder; lease: CaptureStreamLease; sequence: number; requestedMime: string;
  chunks: Blob[]; bytes: number; startedAtMs: number | null; startedAt: string;
  durationMs: number; endingAtMs: number | null; timeout: ReturnType<typeof setTimeout> | null;
};

export function recordingExtension(mime: string): string | null {
  const container = mime.toLowerCase().split(";")[0].trim();
  if (container === "audio/webm") return "webm";
  if (container === "audio/mp4") return "m4a";
  if (container === "audio/ogg") return "ogg";
  return null;
}

export function createPiecePracticeRecording(options: RecordingOptions) {
  const now = options.now ?? (() => performance.now());
  const wallNow = options.wallNow ?? (() => new Date());
  const Recorder = options.Recorder ?? globalThis.MediaRecorder;
  const createURL = options.createObjectURL ?? ((blob: Blob) => URL.createObjectURL(blob));
  const revokeURL = options.revokeObjectURL ?? ((url: string) => URL.revokeObjectURL(url));
  const ownerInstanceId = crypto.randomUUID();
  let enabled = false, eligible = false, disposed = false, limited = false, failed = false, unsupported = false;
  let phase: RecordingPhase = "off", message = "Performance recording off.";
  let lease: CaptureStreamLease | null = null, active: Active | null = null, finalizing: Active | null = null;
  let segments: RecordingSegment[] = [], sequence = 0, durationMs = 0, retainedBytes = 0;
  let ticker: ReturnType<typeof setInterval> | null = null;

  const elapsed = () => durationMs + (active?.startedAtMs === null || active?.startedAtMs === undefined ? 0 : Math.max(0, now() - active.startedAtMs));
  const snapshot = (): RecordingSnapshot => ({ enabled, phase, message, elapsedMs: elapsed(), segments: [...segments],
    retainedBytes: retainedBytes + (active?.bytes ?? 0) + (finalizing?.bytes ?? 0), limitReached: limited });
  const publish = () => { if (!disposed) options.onChange?.(snapshot()); };
  const setPhase = (next: RecordingPhase, nextMessage: string) => { phase = next; message = nextMessage; publish(); };
  const clearTicker = () => { if (ticker !== null) clearInterval(ticker); ticker = null; };
  const detach = (item: Active) => {
    item.recorder.onstart = null; item.recorder.ondataavailable = null; item.recorder.onstop = null; item.recorder.onerror = null;
    if (item.timeout !== null) clearTimeout(item.timeout);
    item.timeout = null;
  };
  const fail = (reason: string) => {
    failed = true;
    setPhase("error", `${reason} Ordinary practice can continue. Earlier recordings are retained.`);
  };
  const totalBytes = () => retainedBytes + (active?.bytes ?? 0) + (finalizing?.bytes ?? 0);
  const markLimit = (reason: string) => {
    if (limited) return;
    limited = true;
    setPhase("limited", reason);
    requestStop();
  };
  const maybeStart = () => {
    if (disposed || !enabled || !eligible || !lease || active || finalizing || limited || failed || unsupported) return;
    if (!Recorder) { unsupported = true; setPhase("unsupported", "This browser does not support local performance recording. Practice continues."); return; }
    const currentLease = lease;
    let recorder: MediaRecorder | null = null;
    let requestedMime = "";
    for (const mimeType of MIME_CANDIDATES) {
      try {
        if (typeof Recorder.isTypeSupported === "function" && !Recorder.isTypeSupported(mimeType)) continue;
        recorder = new Recorder(currentLease.stream, { mimeType, audioBitsPerSecond: 64_000 });
        requestedMime = mimeType;
        break;
      } catch { /* Try the next native format. */ }
    }
    if (!recorder) {
      try { recorder = new Recorder(currentLease.stream, { audioBitsPerSecond: 64_000 }); }
      catch { unsupported = true; setPhase("unsupported", "This browser cannot start a supported audio format. Practice continues."); return; }
    }
    const item: Active = { ownerInstanceId, recorder, lease: currentLease, sequence: ++sequence, requestedMime,
      chunks: [], bytes: 0, startedAtMs: null, startedAt: "", durationMs: 0, endingAtMs: null, timeout: null };
    active = item;
    recorder.onstart = () => {
      if (disposed || item.ownerInstanceId !== ownerInstanceId || (active !== item && finalizing !== item)) return;
      item.startedAtMs = now(); item.startedAt = wallNow().toISOString();
      if (active === item) {
        setPhase("recording", "● Recording performance audio locally.");
        ticker = setInterval(() => {
          if (elapsed() >= MAX_DURATION_MS) markLimit("Recording stopped at the 20-minute limit. Practice continues.");
          else publish();
        }, 1000);
      }
    };
    recorder.ondataavailable = (event: BlobEvent) => {
      if (disposed || item.ownerInstanceId !== ownerInstanceId || (active !== item && finalizing !== item) || !event.data?.size) return;
      item.chunks.push(event.data); item.bytes += event.data.size;
      if (totalBytes() >= STOP_BYTES) markLimit("Recording stopped near the 16 MiB data budget. Practice continues.");
      publish();
    };
    recorder.onerror = () => { if (!disposed) { fail("Performance recording failed."); requestStop(); } };
    recorder.onstop = () => {
      if (disposed || item.ownerInstanceId !== ownerInstanceId || (active !== item && finalizing !== item)) return;
      if (active === item) { failed = true; requestStop(); }
      detach(item); finalizing = null;
      const reported = item.recorder.mimeType || item.chunks.find((chunk) => chunk.type)?.type || item.requestedMime;
      const extension = recordingExtension(reported);
      const conflictingChunk = item.chunks.some((chunk) => chunk.type && recordingExtension(chunk.type) !== extension);
      if (item.startedAtMs === null || !item.chunks.length || !extension || conflictingChunk) {
        item.chunks = [];
        fail("The browser did not provide a usable recording format.");
        return;
      }
      try {
        const blob = new Blob(item.chunks, { type: reported });
        const url = createURL(blob);
        const stamp = item.startedAt.replace(/[-:.]/g, "").replace(/Z$/, "Z");
        segments = [...segments, { ownerInstanceId, runId: options.runId, analysisSessionId: options.analysisSessionId, source: "room-microphone",
          sequence: item.sequence, captureGeneration: item.lease.generation,
          startedAt: item.startedAt, startedAtMs: Math.max(0, (item.startedAtMs ?? now()) - options.originMs),
          endedAtMs: Math.max(0, (item.endingAtMs ?? now()) - options.originMs), durationMs: item.durationMs,
          size: blob.size, mimeType: reported, blob, url,
          filename: `prelude-${options.instrument}-${options.runId.slice(0, 8)}-${stamp}-segment-${String(item.sequence).padStart(3, "0")}.${extension}` }];
        retainedBytes += blob.size;
        item.chunks = [];
        if (retainedBytes > SOFT_BYTES) limited = true;
        if (limited) setPhase("limited", retainedBytes > SOFT_BYTES
          ? `Recording exceeded the soft 16 MiB budget by ${((retainedBytes - SOFT_BYTES) / (1024 * 1024)).toFixed(2)} MiB. Audio was retained; practice continues.`
          : "Recording limit reached. Audio was retained; practice continues.");
        else if (failed) setPhase("error", "Recording stopped after an error. Earlier audio is available.");
        else setPhase(enabled ? "stopped" : "off", "Recording stopped. Download audio before leaving this run.");
        maybeStart();
      } catch {
        item.chunks = [];
        fail("Performance recording could not be retained in this browser.");
      }
    };
    setPhase("starting", "Starting local performance recording…");
    try { recorder.start(1000); }
    catch { detach(item); active = null; fail("Performance recording could not start."); }
  };
  function requestStop() {
    if (!active) return;
    const item = active;
    active = null; finalizing = item; clearTicker();
    item.endingAtMs = now();
    item.durationMs = item.startedAtMs === null ? 0 : Math.max(0, item.endingAtMs - item.startedAtMs);
    durationMs += item.durationMs;
    setPhase("finalizing", "Finishing previous recording.");
    item.timeout = setTimeout(() => {
      if (finalizing !== item || disposed) return;
      detach(item); finalizing = null; item.chunks = [];
      fail("Recording finalization timed out; this segment may be lost.");
    }, FINALIZE_TIMEOUT_MS);
    try { if (item.recorder.state !== "inactive") item.recorder.stop(); }
    catch { detach(item); finalizing = null; item.chunks = []; fail("Recording could not be finalized."); }
  }
  return {
    snapshot,
    setEnabled(value: boolean) {
      if (disposed || enabled === value) return;
      enabled = value;
      if (!value) {
        requestStop();
        if (!finalizing) setPhase(limited ? "limited" : failed ? "error" : "off",
          limited ? message : failed ? message : "Performance recording off. Existing audio remains available.");
      }
      else if (limited) setPhase("limited", "Recording limit reached for this run.");
      else if (failed) setPhase("error", "Recording failed for this run. Practice continues.");
      else if (unsupported) setPhase("unsupported", "This browser does not support local performance recording. Practice continues.");
      else { setPhase("armed", "Recording armed. Audio starts when eligible practice and microphone capture begin."); maybeStart(); }
    },
    setEligible(value: boolean) {
      if (disposed) return;
      eligible = value;
      if (!value) requestStop(); else maybeStart();
    },
    onStreamReady(value: CaptureStreamLease) { if (disposed) return; lease = value; maybeStart(); },
    onStreamEnding(value: CaptureStreamLease) {
      if (disposed) return;
      if (lease?.generation === value.generation && lease.stream === value.stream) lease = null;
      if (active?.lease.generation === value.generation && active.lease.stream === value.stream) requestStop();
    },
    hasUnsavedAudio: () => !disposed && Boolean(active || finalizing || segments.length),
    dispose() {
      if (disposed) return;
      disposed = true; clearTicker();
      for (const item of [active, finalizing]) if (item) {
        detach(item); try { if (item.recorder.state !== "inactive") item.recorder.stop(); } catch { /* Capture still owns its tracks. */ }
        item.chunks = [];
      }
      active = null; finalizing = null; lease = null;
      for (const segment of segments) revokeURL(segment.url);
      segments = [];
    },
  };
}
