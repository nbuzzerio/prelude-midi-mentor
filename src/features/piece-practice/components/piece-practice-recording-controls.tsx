import type { RecordingSnapshot } from "../piece-practice-recording";

function duration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function PiecePracticeRecordingControls({ recording, listening }: Readonly<{
  recording: RecordingSnapshot & { setEnabled: (enabled: boolean) => void };
  listening: boolean;
}>) {
  const unsaved = recording.segments.length > 0 || ["starting", "recording", "finalizing"].includes(recording.phase);
  return <section aria-label="Performance audio recording" className="grid gap-2 rounded-lg border border-amber-400/50 bg-zinc-900 p-3">
    <label className="flex min-h-11 items-center gap-3 font-semibold"><input checked={recording.enabled} onChange={(event) => recording.setEnabled(event.target.checked)} type="checkbox" />Record performance audio</label>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p aria-live="polite" className={recording.phase === "recording" ? "font-bold text-red-200" : "text-zinc-200"}>
        {recording.phase === "recording" ? "● Recording performance audio" : recording.phase === "armed" ? "Recording armed" : recording.phase === "finalizing" ? "Finalizing recording" : recording.phase === "limited" ? "Recording limit reached" : recording.phase === "unsupported" ? "Recording unsupported" : recording.phase === "error" ? "Recording failed" : recording.phase === "starting" ? "Starting recording" : "Recording stopped"}
      </p>
      <span aria-label="Captured audio time" className="tabular-nums">{duration(recording.elapsedMs)}</span>
    </div>
    <p className="text-sm text-zinc-300">{recording.message}</p>
    <p className="text-sm text-zinc-300">Opt-in audio stays in this page until downloaded. Prelude never automatically uploads it. Violin calibration is excluded.</p>
    {unsaved && <p className="font-semibold text-amber-200">Audio is temporary. Download each segment before leaving, restarting, or closing this page. Browser downloads cannot be verified.</p>}
    <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">Performance Recordings ({recording.segments.length})</summary>
      <div className="grid gap-3">
        {recording.segments.length === 0 && <p>No completed recording segments yet.</p>}
        {recording.segments.map((segment) => <div className="grid min-w-0 gap-2 rounded border border-zinc-600 p-3" key={`${segment.ownerInstanceId}:${segment.sequence}`}>
          <p className="font-semibold">Segment {segment.sequence} · {duration(segment.durationMs)} · {(segment.size / (1024 * 1024)).toFixed(2)} MiB · {segment.mimeType}</p>
          <p className="text-sm text-zinc-300">Capture {segment.captureGeneration} · Analysis {segment.analysisSessionId} · Approximately {duration(segment.startedAtMs)}–{duration(segment.endedAtMs)} from analysis start</p>
          {listening ? <p>Stop Listening to play back without feeding playback into the microphone.</p>
            : <audio aria-label={`Play recording segment ${segment.sequence}`} controls preload="none" src={segment.url} />}
          <a className="min-h-11 justify-self-start rounded border border-sky-400 px-3 py-2 font-semibold" download={segment.filename} href={segment.url}>Download segment {segment.sequence}</a>
        </div>)}
      </div>
    </details>
  </section>;
}
