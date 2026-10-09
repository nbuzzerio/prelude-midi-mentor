import { useEffect } from "react";
import type { RecordingSnapshot } from "../piece-practice-recording";

/** Both input owners use the same audio-loss confirmation and unload protection. */
export function usePiecePracticeRecordingGuard(recording: RecordingSnapshot & { hasUnsavedAudio: () => boolean },
  registerAudioGuard: (guard: (() => boolean) | null) => void) {
  const hasUnsavedAudio = recording.hasUnsavedAudio;
  const audioPending = recording.segments.length > 0 || ["starting", "recording", "finalizing"].includes(recording.phase);
  useEffect(() => {
    const guard = () => !hasUnsavedAudio() || window.confirm("Performance audio is temporary and will be lost if you leave this run. Download each recording segment before continuing. Discard this audio and continue?");
    registerAudioGuard(guard);
    return () => registerAudioGuard(null);
  }, [hasUnsavedAudio, registerAudioGuard]);
  useEffect(() => {
    if (!audioPending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [audioPending]);
}
