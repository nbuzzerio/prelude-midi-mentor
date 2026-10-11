import { useEffect, useRef } from "react";
import type { ImprovRoomAudioState } from "../improv-room-audio";
import { IMPROV_BUTTON } from "./improv-library-view";

export function ImprovRoomAudioControls({ state, onDownload, onDiscard }: Readonly<{
  state: ImprovRoomAudioState; onDownload: () => void; onDiscard: () => void;
}>) {
  const preview = useRef<HTMLAudioElement>(null);
  useEffect(() => { const element = preview.current; return () => { element?.pause(); }; }, [state.segment?.url]);
  if (!state.segment && !["failed", "finalizing"].includes(state.phase)) return null;
  const timing = state.timing;
  const offset = timing.midiStart && timing.audioStartedAtMs !== null && timing.timeOriginMs !== null && timing.midiStart.context.timeOriginMs === timing.timeOriginMs
    ? timing.audioStartedAtMs - timing.midiStart.atMs : null;
  return <section className="mt-4 min-w-0 rounded-xl border border-white/10 bg-white/5 p-3" aria-label="Temporary room audio">
    <h2 className="font-semibold">Room audio · original microphone sound</h2>
    <p className="mt-2 text-sm">{state.message}</p>
    {state.segment && <>
      <audio ref={preview} controls preload="metadata" src={state.segment.url} className="mt-3 w-full min-w-0 max-w-full" aria-label="Preview room audio" />
      <div className="mt-3 flex flex-wrap gap-2"><button className={IMPROV_BUTTON} onClick={() => preview.current?.pause()}>Stop Audio Preview</button>
        <button className={IMPROV_BUTTON} onClick={onDownload}>Download room audio</button>
        <button className={IMPROV_BUTTON} onClick={onDiscard}>Discard temporary audio</button></div>
      <p className="mt-2 text-xs text-zinc-400">Temporary until downloaded; reload or browser termination can lose it. MIDI and JSON contain no recorded sound. A download request does not confirm the file was retained.</p>
      <details className="mt-2 text-xs text-zinc-400"><summary className="cursor-pointer py-2">Audio timing and format</summary>
        <p>{state.segment.mimeType} · {state.segment.size} bytes. Browser-observed recording span {(state.segment.durationMs / 1000).toFixed(1)} s; decoded audio duration is not verified.</p>
        <p>{offset === null ? "No confirmed MIDI/audio alignment." : `Browser-observed approximate audio-start offset: ${offset.toFixed(1)} ms relative to MIDI Start.`} This is not sample-accurate synchronization or microphone latency measurement. The browser may ignore requested processing settings.</p>
      </details>
    </>}
  </section>;
}
