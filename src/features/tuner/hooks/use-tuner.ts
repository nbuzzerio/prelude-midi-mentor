import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createMicrophoneCapture, type CaptureStatus } from "../microphone-capture";
import type { TunerSnapshot } from "../pitch-stabilizer";

const emptyPitch: TunerSnapshot = { state: "listening", pitch: null, fresh: false, ageMs: null };
export function useTuner(available: boolean) {
  const [status, setStatus] = useState<CaptureStatus>({ state: "idle", message: "Microphone off." });
  const [reading, setReading] = useState<TunerSnapshot>(emptyPitch);
  const captureRef = useRef<ReturnType<typeof createMicrophoneCapture> | null>(null);
  const eligibleRef = useRef(false);
  useLayoutEffect(() => {
    eligibleRef.current = available;
    if (!available) captureRef.current?.stop("paused", "End the active Practice Session before listening.");
  }, [available]);
  useEffect(() => {
    let mounted = true;
    const capture = createMicrophoneCapture({
      eligible: () => mounted && eligibleRef.current && document.visibilityState !== "hidden",
      onStatus: (next) => { if (mounted) setStatus(next); },
      onPitch: (next) => { if (mounted) setReading(next); },
    });
    captureRef.current = capture;
    const background = () => capture.stop("paused", "Listening stopped in the background. Press Start Listening to restart.");
    const visibility = () => { if (document.visibilityState === "hidden") background(); };
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("freeze", background);
    window.addEventListener("pagehide", background);
    // Freshness ages even when capture callbacks stop arriving.
    const watchdog = window.setInterval(() => { if (mounted) setReading(capture.snapshot()); }, 50);
    return () => {
      mounted = false; eligibleRef.current = false;
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("freeze", background);
      window.removeEventListener("pagehide", background);
      window.clearInterval(watchdog); capture.stop(); captureRef.current = null;
    };
  }, []);
  const start = useCallback(() => { void captureRef.current?.start(); }, []);
  const stop = useCallback(() => captureRef.current?.stop(), []);
  return { status, reading, start, stop };
}
