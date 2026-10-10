import { useMemo } from "react";
import { summarizeImprovTake } from "../improv-performance";
import type { ImprovLoadedTake } from "../improv-library";
import { IMPROV_BUTTON } from "./improv-library-view";

export function ImprovTakeReview({ take, playing, disabled, error, onPlay, onStop, onMidi }: Readonly<{
  take: ImprovLoadedTake | null; playing: boolean; disabled: boolean; error: string;
  onPlay: () => void; onStop: () => void; onMidi: () => void;
}>) {
  const summary = useMemo(() => take ? summarizeImprovTake(take) : null, [take]);
  if (!take || !summary) return null;
  return <details className="rounded-xl border border-white/10 bg-white/5 p-3" open>
    <summary className="cursor-pointer py-2 font-semibold">Review Take {take.record.number}{take.record.number === 1 ? " · Original first attempt" : ""}</summary>
    <p className="mt-2 text-sm text-zinc-300">{take.record.status === "recording" ? "Saved prefix of an unfinished capture" : take.record.status} · Descriptive observations, without a reference score or accuracy grade.</p>
    {take.record.captureFailure && <p className="mt-2 text-amber-200">Capture stopped at the unsaved-data safety limit. Review contains the committed prefix.</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      <button className={`${IMPROV_BUTTON} bg-sky-700`} disabled={disabled || playing} onClick={onPlay}>Replay take</button>
      <button className={IMPROV_BUTTON} disabled={!playing} onClick={onStop}>Stop Playback</button>
      <button className={IMPROV_BUTTON} disabled={disabled} onClick={onMidi}>Download MIDI</button>
    </div>
    {error && <p className="mt-2 text-red-200" role="alert">{error}</p>}
    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
      <div><dt className="text-zinc-400">Recorded duration</dt><dd>{summary.observedBoundaryDurationMs === null ? "Unknown end · saved prefix" : `${(summary.observedBoundaryDurationMs / 1000).toFixed(1)} s`}</dd></div>
      <div><dt className="text-zinc-400">Note attacks</dt><dd>{summary.noteAttacks}</dd></div>
      <div><dt className="text-zinc-400">Pitch range (MIDI)</dt><dd>{summary.lowestPitch === null ? "No attacks" : `${summary.lowestPitch}–${summary.highestPitch}`}</dd></div>
      <div><dt className="text-zinc-400">Velocity (1–127)</dt><dd>{summary.velocity.minimum === null ? "No attacks" : `${summary.velocity.minimum}–${summary.velocity.maximum}; mean ${summary.velocity.mean!.toFixed(1)}`}</dd></div>
      <div><dt className="text-zinc-400">Pedal observations</dt><dd>{summary.pedalEvents}</dd></div>
      <div><dt className="text-zinc-400">Maximum key-down polyphony</dt><dd>{summary.maximumKeyDownPolyphony}</dd></div>
    </dl>
    <p className="mt-3 text-xs text-zinc-400">Sampled piano replay approximates the performance. Velocity is not acoustic loudness; sustain uses CC64 ≥ 64, without realistic half-pedal sound. MIDI is a musical projection; JSON preserves the full committed evidence.</p>
    <details className="mt-3 text-sm"><summary className="cursor-pointer py-2">Timing and continuity details</summary>
      <p>{summary.timingIssues.length ? `${summary.timingIssues.length} timing/uncertainty observations. Playback/export may use approximate timing.` : "Receipt timing is usable; exact physical key-contact timing remains unknown."}</p>
      <p>{summary.unreleasedAttacks} unmatched attacks; {summary.unmatchedReleases} unmatched releases. Replay/export cleanup does not add releases to captured evidence.</p>
      <p>{take.record.capture.terminal ? `Capture ended: ${take.record.capture.terminal.reason.replaceAll("-", " ")}.` : "No captured terminal boundary."} {take.record.recovery ? "Recovery/import status is separate from original boundaries." : ""}</p>
    </details>
  </details>;
}
