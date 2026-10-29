import { useMemo, useState, type KeyboardEvent } from "react";
import type { ImprovInsightsState } from "../hooks/use-improv-insights";
import type { ImprovMusicalInsights } from "../insights/improv-musical-insights";
import type { ImprovReplayRange } from "../improv-replay";
import { IMPROV_BUTTON } from "./improv-library-view";

export type ImprovInsightSelection = ImprovReplayRange & Readonly<{ id: string; label: string }>;
type TimelineItem = ImprovInsightSelection & Readonly<{ evidence: readonly string[] }>;
const PAGE_SIZE = 12;
const time = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const span = (range: ImprovReplayRange) => `${time(range.startMs)} to ${time(range.endMs)}`;

function OverviewEvidence({ overview }: { overview: ImprovMusicalInsights["overview"] }) {
  return <details className="mt-3 text-sm"><summary className="cursor-pointer py-2">Pitch, rhythm, velocity, and sustain evidence</summary>
    <div className="grid gap-4 sm:grid-cols-2">
      <table className="w-full text-left"><caption className="pb-2 text-left font-medium">Observed pitch-class attacks</caption>
        <thead><tr><th scope="col">Pitch class</th><th scope="col">Attacks</th></tr></thead>
        <tbody>{overview.pitchClassDistribution.map(p => <tr key={p.pitchClass}><th scope="row" className="font-normal">{p.label}</th><td>{p.attacks}</td></tr>)}</tbody>
      </table>
      <div className="space-y-3">
        <div><h4 className="font-medium">Rhythmic activity</h4><p>{overview.rhythm.pairedInterAttackCount} consecutive attack gaps within continuous capture segments.</p>
          <p>{overview.rhythm.meanInterAttackMs === null ? "Insufficient attacks to describe timing gaps." : `Mean gap ${time(overview.rhythm.meanInterAttackMs)}; range ${time(overview.rhythm.minimumInterAttackMs!)} to ${time(overview.rhythm.maximumInterAttackMs!)}.`} Simultaneous attacks contribute zero gaps. These are not beat, tempo, or meter estimates.</p>
          <p>{overview.meanKeyDownDurationMs === null ? "No reliable paired key-down durations." : `${overview.pairedNoteCount} reliable note pairs; mean key-down duration ${time(overview.meanKeyDownDurationMs)}.`}</p>
        </div>
        <div><h4 className="font-medium">MIDI velocity distribution</h4><p>1–42: {overview.velocityDistribution.soft} attacks · 43–84: {overview.velocityDistribution.medium} · 85–127: {overview.velocityDistribution.strong}.</p><p>Velocity describes MIDI attack values, not acoustic loudness or dynamics markings.</p></div>
        <div><h4 className="font-medium">Observed sustain pedal</h4><p>Initial pedal state is unknown. {overview.sustain.observedPedalMessages} observed CC64 messages: {overview.sustain.downMessages} down (≥64), {overview.sustain.upMessages} up (&lt;64).</p><p>These observations do not estimate sustained sound or half-pedal behavior.</p></div>
      </div>
    </div>
    <p className="mt-2 text-xs text-zinc-400">Pitch-class counts describe physical MIDI note numbers on all observed channels. Tonal analysis excludes channel 10 and attacks affected by observed pitch or tuning uncertainty. These note numbers do not verify sounding pitch; display spellings do not establish a key signature or enharmonic intent.</p>
  </details>;
}

function timeline(insights: ImprovMusicalInsights): TimelineItem[] {
  return [
    ...insights.harmony.map((h, i) => ({ ...h, id: `harmony-${i}`, label: `${h.label} · ${h.kind === "held" ? "held harmony" : "arpeggiated harmony"}` })),
    ...insights.phrases.map((p, i) => ({ ...p, id: `phrase-${i}`, label: `Possible phrase ${i + 1} · ${p.noteAttacks} attacks`, evidence: [p.reason] })),
    ...insights.rests.map((r, i) => ({ ...r, id: `rest-${i}`, label: "Key-down rest", evidence: ["No observed keys held in this span. Initial held keys are unknown. Sustain may still be sounding; this is not an audio silence estimate."] })),
    ...insights.motifs.flatMap((m, i) => m.occurrences.map((o, j) => ({ ...o, id: `motif-${i}-${j}`, label: `${m.label} · occurrence ${j + 1}`,
      evidence: [...m.evidence, `Transposition: ${o.transpositionSemitones} semitones.`, `Interval contour: ${m.intervals.join(", ")} semitones.`] }))),
  ].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs || a.id.localeCompare(b.id));
}

function moveFocus(event: KeyboardEvent<HTMLOListElement>) {
  if (!(event.target instanceof HTMLButtonElement) || !event.target.hasAttribute("data-insight")) return;
  const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-insight]:not(:disabled)")];
  const index = buttons.indexOf(event.target);
  const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : event.key === "ArrowDown" ? Math.min(buttons.length - 1, index + 1) : event.key === "ArrowUp" ? Math.max(0, index - 1) : null;
  if (next !== null) { event.preventDefault(); buttons[next]?.focus(); }
}

export function ImprovInsights({ state, selection, onSelect, onReplay, playing, disabled }: Readonly<{
  state: ImprovInsightsState; selection: ImprovInsightSelection | null;
  onSelect: (selection: ImprovInsightSelection) => void; onReplay: (range: ImprovReplayRange) => void;
  playing: boolean; disabled: boolean;
}>) {
  const [page, setPage] = useState(0);
  const insights = state.status === "ready" ? state.insights : null;
  const items = useMemo(() => insights ? timeline(insights) : [], [insights]);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = items.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  return <section aria-label="Musical Insights" className="mt-4 rounded-lg border border-white/10 p-3">
    <h3 className="font-semibold">Musical Insights</h3>
    <p className="mt-1 text-sm text-zinc-300">Descriptive musical possibilities from saved MIDI evidence, without a score, accuracy grade, or audio analysis.</p>
    {!insights ? <p className="mt-3 text-sm" role="status">{state.status === "loading" ? "Analyzing this take…" : state.status === "unavailable" ? "Musical Insights is unavailable in this browser. The saved take, staff, and replay remain available." : "Musical Insights could not be calculated. The saved take, staff, and replay remain available."}</p> : <>
      {selection && <div className="mt-3 rounded border border-sky-400/30 p-3">
        <p className="text-sm" role="status">Selected: {selection.label} · {span(selection)}</p>
        <button className={`${IMPROV_BUTTON} mt-2 bg-sky-700`} disabled={disabled || playing || selection.endMs <= selection.startMs} onClick={() => onReplay({ startMs: selection.startMs, endMs: selection.endMs })}>Replay selected passage</button>
        <p className="mt-2 text-xs text-zinc-400">Only notes begun within the passage are replayed. Notes begun before its start are not retriggered. Pedal state is approximated; sustained sound and half-pedal behavior may differ.</p>
      </div>}
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><dt className="text-zinc-400">Possible phrases</dt><dd>{insights.phrases.length}</dd></div>
        <div><dt className="text-zinc-400">Harmonic spans</dt><dd>{insights.harmony.length}</dd></div>
        <div><dt className="text-zinc-400">Repeated figures</dt><dd>{insights.motifs.length}</dd></div>
        <div><dt className="text-zinc-400">Musical time</dt><dd>{time(insights.overview.durationMs)}{!insights.overview.knownEnd && " · uncertain end"}</dd></div>
      </dl>
      <OverviewEvidence overview={insights.overview} />
      <h4 className="mt-4 font-medium">Tonal possibilities</h4>
      <p className="text-sm text-zinc-300">{insights.tonal.status === "insufficient" ? "Insufficient evidence for a tonal center." : insights.tonal.status === "ambiguous" ? "Ambiguous tonal evidence; several interpretations remain possible." : "The evidence favors the first candidate; alternatives remain possible."} Candidates are ranked by descriptive evidence, without a probability or correctness score.</p>
      {insights.tonal.status !== "insufficient" && <ol className="mt-2 grid gap-2 text-sm sm:grid-cols-3">{insights.tonal.hypotheses.slice(0, 3).map((h, i) => <li className="rounded border border-white/10 p-2" key={`${h.tonicPitchClass}-${h.mode}`}><span className="font-medium">{i + 1}. {h.label}</span><span className="block text-zinc-400">Weighted {h.mode === "minor" ? "natural-minor" : "major-scale"} pitch-class coverage {Math.round(h.coverage * 100)}%</span></li>)}</ol>}
      <details className="mt-2 text-sm"><summary className="cursor-pointer py-2">Tonal evidence and alternatives</summary>
        <p className="mb-2">Coverage describes duration-weighted attack support within each candidate's scale pitch classes, not confidence in a key. Minor candidates use natural minor; raised sixth and seventh degrees in harmonic or classical melodic minor can reduce this coverage.</p>
        <ul className="list-disc space-y-1 pl-5">{insights.tonal.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul>
        {insights.tonal.hypotheses.length > 0 && <p className="mt-2">All candidates in evidence order: {insights.tonal.hypotheses.map(h => h.label).join("; ")}.</p>}
      </details>
      <h4 className="mt-4 font-medium">Musical timeline</h4>
      <p className="text-sm text-zinc-300">Times use the musical projection with intentional pauses removed. Select a passage to navigate the staff; selection does not start playback. Tab through passages, or use Up/Down and Home/End within this page.</p>
      {playing && <p className="mt-2 text-sm">Stop Playback to select another passage. The staff follows playback.</p>}
      {items.length === 0 ? <p className="mt-3 text-sm">No supported harmonic spans, phrases, rests, or repeated figures in this saved evidence.</p> : <>
        <ol aria-label="Musical passages" className="mt-3 space-y-2" onKeyDown={moveFocus} start={currentPage * PAGE_SIZE + 1}>
          {visible.map(item => <li key={item.id} className="rounded border border-white/10 p-2">
            <button data-insight className={`${IMPROV_BUTTON} w-full text-left`} disabled={playing} aria-pressed={selection?.id === item.id} onClick={() => onSelect(item)}>
              <span className="block">{item.label}</span><span className="block text-xs text-zinc-300">{span(item)}</span>
            </button>
            <details className="mt-1 text-sm text-zinc-300"><summary className="cursor-pointer py-2">Evidence for {item.label}</summary><ul className="list-disc space-y-1 pl-5">{item.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul></details>
          </li>)}
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className={IMPROV_BUTTON} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous passages</button>
          <p role="status" className="text-sm">Page {currentPage + 1} of {pageCount} · {items.length} observations</p>
          <button className={IMPROV_BUTTON} disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Next passages</button>
        </div>
      </>}
      <details className="mt-3 text-sm"><summary className="cursor-pointer py-2">Analysis evidence and limitations</summary><ul className="list-disc space-y-1 pl-5">{insights.limitations.map((limitation, i) => <li key={i}>{limitation}</li>)}</ul>
        {insights.caps.truncated.length > 0 && <p className="mt-2">Analysis detail limited: {insights.caps.truncated.join(", ")}. The saved MIDI evidence remains unchanged.</p>}
      </details>
    </>}
  </section>;
}
