import type { RecordingSnapshot } from "../piece-practice-recording";
import type { CaptureStatus } from "@/lib/audio/monophonic/microphone-capture";

function duration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function recordingLabel(phase: RecordingSnapshot["phase"]) {
  return phase === "recording" ? "● Recording performance audio" : phase === "armed" ? "Recording armed" : phase === "finalizing" ? "Finalizing recording" : phase === "limited" ? "Recording limit reached" : phase === "unsupported" ? "Recording unsupported" : phase === "error" ? "Recording failed" : phase === "starting" ? "Starting recording" : "Recording stopped";
}

/** Compact visible notice; the full controls retain the single recording-state announcer. */
export function PiecePracticeRecordingNotice({ recording }: Readonly<{ recording: RecordingSnapshot }>) {
  const unsaved = recording.segments.length > 0 || ["starting", "recording", "finalizing"].includes(recording.phase);
  if (recording.phase === "off" && !unsaved) return null;
  return <div aria-label="Performance audio notice" className="flex flex-wrap gap-x-3 text-sm font-semibold">
    <p className={recording.phase === "recording" ? "text-red-200" : "text-amber-200"}>Audio status: {recordingLabel(recording.phase)}</p>
    {unsaved && <p className="text-amber-200">Temporary audio — download before leaving. Controls below the workspace.</p>}
    {["limited", "error", "unsupported"].includes(recording.phase) && <p>{recording.message}</p>}
  </div>;
}

export function PiecePracticeRecordingControls({ recording, listening, keyboard }: Readonly<{
  recording: RecordingSnapshot & { setEnabled: (enabled: boolean) => void };
  listening: boolean;
  keyboard?: Readonly<{ status: CaptureStatus; resume: () => void; canRecord: boolean }>;
}>) {
  const unsaved = recording.segments.length > 0 || ["starting", "recording", "finalizing"].includes(recording.phase);
  return <section aria-label="Performance audio recording" className="grid min-w-0 gap-2 rounded-lg border border-amber-400/50 bg-zinc-900 p-3">
    <label className="flex min-h-11 items-center gap-3 font-semibold"><input checked={recording.enabled} disabled={Boolean(keyboard && !keyboard.canRecord && !recording.enabled)} onChange={(event) => recording.setEnabled(event.target.checked)} type="checkbox" />Record performance audio</label>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p aria-live="polite" className={recording.phase === "recording" ? "font-bold text-red-200" : "text-zinc-200"}>
        {recordingLabel(recording.phase)}
      </p>
      <span aria-label="Captured audio time" className="tabular-nums">{duration(recording.elapsedMs)}</span>
    </div>
    <p className="text-sm text-zinc-300">{recording.message}</p>
    {keyboard && <>
      <p role="status" className="text-sm text-zinc-300">{keyboard.status.message}</p>
      {recording.enabled && !listening && keyboard.canRecord && !recording.limitReached && !["error", "unsupported"].includes(recording.phase)
        && <button className="min-h-11 justify-self-start rounded border border-sky-400 px-3 font-semibold" onClick={keyboard.resume} type="button">{["denied", "error", "unavailable"].includes(keyboard.status.state) ? "Retry recording" : "Resume recording"}</button>}
      <p className="text-sm text-zinc-300">Recording captures the piano sound heard by your microphone. MIDI still handles note grading. A room microphone may not capture a piano heard only through headphones. Virtual keys do not synthesize recorded audio.</p>
    </>}
    <p className="text-sm text-zinc-300">Opt-in audio stays in this page until downloaded. Prelude never automatically uploads it.{!keyboard && " Violin calibration is excluded."} Completion may cut off the final note's tail.</p>
    {unsaved && <p className="font-semibold text-amber-200">Audio is temporary. Download each segment before leaving, restarting, or closing this page. Browser downloads cannot be verified.</p>}
    <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">Performance Recordings ({recording.segments.length})</summary>
      <div className="grid gap-3">
        {recording.segments.length === 0 && <p>No completed recording segments yet.</p>}
        {recording.segments.map((segment) => <div className="grid min-w-0 gap-2 rounded border border-zinc-600 p-3" key={`${segment.ownerInstanceId}:${segment.sequence}`}>
          <p className="font-semibold">Segment {segment.sequence} · {duration(segment.durationMs)} · {(segment.size / (1024 * 1024)).toFixed(2)} MiB · {segment.mimeType}</p>
          <p className="text-sm text-zinc-300">Room microphone audio · Capture {segment.captureGeneration} · {segment.analysisSessionId ? `Analysis ${segment.analysisSessionId} · ` : ""}Approximately {duration(segment.startedAtMs)}–{duration(segment.endedAtMs)} from {segment.analysisSessionId ? "analysis start" : "this run's recording timeline start"}</p>
          {listening ? <p>{keyboard ? "Turn recording off" : "Stop Listening"} to play back without feeding playback into the microphone.</p>
            : <audio className="w-full min-w-0 max-w-full" data-piece-practice-recording aria-label={`Play recording segment ${segment.sequence}`} controls preload="none" src={segment.url} />}
          <a className="min-h-11 justify-self-start rounded border border-sky-400 px-3 py-2 font-semibold" download={segment.filename} href={segment.url}>Download segment {segment.sequence}</a>
        </div>)}
      </div>
    </details>
  </section>;
}
