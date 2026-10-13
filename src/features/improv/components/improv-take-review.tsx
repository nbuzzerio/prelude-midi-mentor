import { useCallback, useMemo, useState } from "react";
import { summarizeImprovTake } from "../improv-performance";
import type { ImprovLoadedTake } from "../improv-library";
import { IMPROV_BUTTON } from "./improv-library-view";
import type { FreeplayNotationContext } from "@/features/freeplay/freeplay-notation";
import { timelineFromTake } from "../improv-timeline";
import { ImprovPerformanceStaff } from "./improv-performance-staff";
import type { ImprovReplayTransport } from "../improv-replay";

function ReviewTimeline({ take, context, playing, transport }: { take: ImprovLoadedTake; context: FreeplayNotationContext; playing: boolean; transport?: ImprovReplayTransport | null }) {
  const model = useMemo(() => timelineFromTake(take), [take]);
  const source = useCallback(() => model, [model]);
  const [position, setPosition] = useState(0);
  const [detached, setDetached] = useState<ImprovReplayTransport | null>(null);
  const following = transport && transport.takeId === take.record.takeId && detached !== transport ? transport : null;
  const windowChanged = useCallback((left: number) => setPosition(left), []);
  const navigate = (left: number) => { if (!playing) { setDetached(transport ?? null); setPosition(left); } };
  const duration = model.elapsed(0); const maximum = Math.max(0, duration - 1000);
  return <div className="mt-3 rounded-lg border border-white/10">
    <ImprovPerformanceStaff source={source} context={context} positionMs={following ? undefined : position} replay={following} onWindowChange={windowChanged} />
    <label className="block px-3 pb-3 text-sm">Review window start: {(position / 1000).toFixed(1)} s
      <input className="mt-2 block w-full accent-sky-400" type="range" aria-label="Review time position" min="0" max={maximum} step="100" value={Math.min(maximum, position)} disabled={playing}
        aria-valuetext={`${(position / 1000).toFixed(1)} seconds into ${(duration / 1000).toFixed(1)} seconds`} onChange={e => navigate(Number(e.target.value))} />
    </label>
    <div className="flex flex-wrap gap-2 px-3 pb-3">
      <button className={IMPROV_BUTTON} disabled={playing || position === 0} onClick={() => navigate(Math.max(0, position - 10_000))}>Earlier 10 seconds</button>
      <button className={IMPROV_BUTTON} disabled={playing || position >= maximum} onClick={() => navigate(Math.min(maximum, position + 10_000))}>Later 10 seconds</button>
    </div>
    {playing && <p className="px-3 pb-3 text-xs text-zinc-400">Review window follows playback. Stop Playback to navigate manually.</p>}
  </div>;
}

export function ImprovTakeReview({ take, context, playing, disabled, error, onPlay, onStop, onMidi, transport }: Readonly<{
  take: ImprovLoadedTake | null; playing: boolean; disabled: boolean; error: string;
  context: FreeplayNotationContext;
  transport?: ImprovReplayTransport | null;
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
    <ReviewTimeline key={take.record.takeId} take={take} context={context} playing={playing} transport={transport} />
    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
      <div><dt className="text-zinc-400">Musical duration</dt><dd>{(summary.projectedDurationMs / 1000).toFixed(1)} s{summary.observedBoundaryDurationMs === null ? " · uncertain end / saved prefix" : ""}</dd></div>
      <div><dt className="text-zinc-400">Actual elapsed duration</dt><dd>{summary.observedBoundaryDurationMs === null ? "Unknown end · saved prefix" : `${(summary.observedBoundaryDurationMs / 1000).toFixed(1)} s`}</dd></div>
      <div><dt className="text-zinc-400">Intentional pauses</dt><dd>{summary.pauseCount}</dd></div>
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
      {summary.pauseCutoffAttacks > 0 && <p>{summary.pauseCutoffAttacks} active attacks end at an intentional pause in the musical projection. Their original MIDI releases remain unchanged.</p>}
      <p>{take.record.capture.terminal ? `Capture ended: ${take.record.capture.terminal.reason.replaceAll("-", " ")}.` : "No captured terminal boundary."} {take.record.recovery ? "Recovery/import status is separate from original boundaries." : ""}</p>
    </details>
  </details>;
}
