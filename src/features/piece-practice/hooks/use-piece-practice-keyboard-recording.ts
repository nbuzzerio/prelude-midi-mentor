import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CaptureStatus } from "@/lib/audio/monophonic/microphone-capture";
import { createPiecePracticeRecording, type RecordingSnapshot } from "../piece-practice-recording";
import { createPiecePracticeRecordingCapture } from "../piece-practice-recording-capture";
import { stopPiecePracticeRecordingPlayback } from "../piece-practice-recording-playback";
import type { PiecePracticeSessionState } from "../piece-practice-session";

type Options = Readonly<{ runId: string; sessionState: PiecePracticeSessionState; available: boolean; now: () => number }>;
const OFF: RecordingSnapshot = { enabled: false, phase: "off", message: "Performance recording off.", elapsedMs: 0,
  segments: [], retainedBytes: 0, limitReached: false };
const IDLE: CaptureStatus = { state: "idle", message: "Recording microphone off. MIDI practice does not need a microphone." };

/** Companion only: never observes MIDI input or changes the practice clock/evidence. */
export function usePiecePracticeKeyboardRecording(options: Options) {
  const latest = useRef(options);
  const recorderRef = useRef<ReturnType<typeof createPiecePracticeRecording> | null>(null);
  const captureRef = useRef<ReturnType<typeof createPiecePracticeRecordingCapture> | null>(null);
  const [snapshot, setSnapshot] = useState(OFF);
  const [status, setStatus] = useState(IDLE);
  const eligible = useCallback(() => latest.current.available && document.visibilityState !== "hidden"
    && !latest.current.sessionState.clockPaused && latest.current.sessionState.status !== "piece-complete", []);
  useLayoutEffect(() => {
    latest.current = options;
    // Never acquire a microphone merely because the clock resumed.
    const allowed = eligible();
    recorderRef.current?.setEligible(allowed);
    if (!allowed && captureRef.current?.active()) captureRef.current.stop("paused", "Recording stopped because practice paused or completed. Resume recording explicitly when ready.");
  }, [options, eligible]);

  useEffect(() => {
    let mounted = true;
    let capture: ReturnType<typeof createPiecePracticeRecordingCapture> | null = null;
    const recording = createPiecePracticeRecording({ runId: options.runId, instrument: "piano", analysisSessionId: null,
      originMs: latest.current.now(), now: () => latest.current.now(), onChange: (next) => {
        if (!mounted || recorderRef.current !== recording) return;
        setSnapshot(next);
        if (capture?.active() && (next.limitReached || next.phase === "error" || next.phase === "unsupported")) {
          capture.stop("idle", "Recording microphone released after a recording limit or failure. MIDI practice can continue.");
        }
      } });
    recorderRef.current = recording;
    recording.setEligible(eligible());
    setSnapshot(recording.snapshot());
    setStatus(IDLE);
    capture = createPiecePracticeRecordingCapture({ eligible: () => mounted && eligible(), now: () => latest.current.now(),
      onStatus: (next) => { if (mounted) setStatus(next); },
      onStreamReady: (lease) => { if (mounted) recording.onStreamReady(lease); },
      onStreamEnding: (lease) => recording.onStreamEnding(lease) });
    captureRef.current = capture;
    return () => {
      mounted = false;
      capture?.dispose(); // Ending notification requests stop before the track owner releases tracks.
      if (captureRef.current === capture) captureRef.current = null;
      if (recorderRef.current === recording) recorderRef.current = null;
      recording.dispose();
    };
  }, [options.runId, eligible]);

  const resume = useCallback(() => {
    const recording = recorderRef.current;
    if (!recording || !recording.snapshot().enabled || !eligible()) return;
    const state = recording.snapshot();
    if (state.limitReached || state.phase === "error" || state.phase === "unsupported") return;
    stopPiecePracticeRecordingPlayback();
    recording.setEligible(true);
    void captureRef.current?.start();
  }, [eligible]);
  const setEnabled = useCallback((enabled: boolean) => {
    recorderRef.current?.setEnabled(enabled);
    if (enabled) resume(); else captureRef.current?.stop();
  }, [resume]);
  const hasUnsavedAudio = useCallback(() => recorderRef.current?.hasUnsavedAudio() ?? false, []);
  return { recording: { ...snapshot, setEnabled, hasUnsavedAudio }, status, resume,
    capturing: ["requesting", "starting", "listening"].includes(status.state),
    canRecord: options.available && !options.sessionState.clockPaused && options.sessionState.status !== "piece-complete" };
}
