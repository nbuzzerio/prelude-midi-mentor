import { useEffect, useId, useRef, useState } from "react";
import type { FreeplayNotationContext } from "@/features/freeplay/freeplay-notation";
import { IMPROV_WINDOW_MS, timelinePitch, timelineWindow, type ImprovTimeline } from "../improv-timeline";

const LEFT = 52;
const EMPTY = { notes: [], atMs: 0, leftMs: 0, rightMs: IMPROV_WINDOW_MS, recording: false,
  knownEnd: false, pedalActive: false, issueCount: 0, crowded: false, omitted: 0, unmatchedReleases: 0, retainedNotes: 0, version: 0 };
const browserTimelineClock = {
  now: () => performance.now(), request: (callback: FrameRequestCallback) => requestAnimationFrame(callback),
  cancel: (id: number) => cancelAnimationFrame(id),
};

/** React updates bounded note slices at 10 Hz. RAF only moves existing SVG geometry. */
export function ImprovPerformanceStaff({ source, context, positionMs, clock = browserTimelineClock }: Readonly<{
  source: () => ImprovTimeline | null; context: FreeplayNotationContext; positionMs?: number;
  clock?: typeof browserTimelineClock;
}>) {
  const description = useId(); const svg = useRef<SVGSVGElement>(null);
  const group = useRef<SVGGElement>(null); const head = useRef<SVGLineElement>(null);
  const [width, setWidth] = useState(960);
  const windowMs = width < 500 ? 6000 : IMPROV_WINDOW_MS;
  const scale = (width - LEFT - 12) / windowMs;
  const [snapshot, setSnapshot] = useState(() => { const model = source(); return { model, view: model?.view(clock.now(), positionMs, windowMs) ?? EMPTY }; });
  const view = snapshot.view;
  useEffect(() => {
    const element = svg.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries => {
      const measured = entries[0]?.contentRect.width;
      if (measured) setWidth(Math.max(240, Math.min(960, Math.round(measured))));
    });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true;
    const sync = () => {
      if (!active) return;
      const model = source(); const next = model?.view(clock.now(), positionMs, windowMs) ?? EMPTY;
      setSnapshot(previous => previous.model === model && previous.view.atMs === next.atMs && previous.view.leftMs === next.leftMs
        && previous.view.rightMs === next.rightMs && previous.view.version === next.version && previous.view.recording === next.recording
        ? previous : { model, view: next });
    };
    sync(); const timer = setInterval(sync, 100);
    return () => { active = false; clearInterval(timer); };
  }, [source, positionMs, clock, windowMs]);
  useEffect(() => {
    let frame = 0; let active = true;
    const animate = () => {
      if (!active) return;
      const model = source(); const now = model?.elapsed(clock.now()) ?? 0;
      group.current?.setAttribute("visibility", model === snapshot.model ? "visible" : "hidden");
      const left = positionMs ?? timelineWindow(now, windowMs).leftMs;
      group.current?.setAttribute("transform", `translate(${-(left - view.leftMs) * scale} 0)`);
      const x = Math.max(LEFT, Math.min(width - 12, LEFT + (now - left) * scale));
      head.current?.setAttribute("x1", String(x)); head.current?.setAttribute("x2", String(x));
      head.current?.setAttribute("visibility", now >= left && now <= left + windowMs ? "visible" : "hidden");
      svg.current?.setAttribute("data-playhead-ms", String(now));
      svg.current?.setAttribute("data-window-start-ms", String(left));
      group.current?.querySelectorAll<SVGLineElement>("[data-held-onset]").forEach(line => {
        line.setAttribute("x2", String(Math.min(width - 12, LEFT + (now - view.leftMs) * scale)));
      });
      if (positionMs === undefined && model && view.recording && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) frame = clock.request(animate);
    };
    animate();
    return () => { active = false; clock.cancel(frame); };
  }, [source, positionMs, view, snapshot.model, clock, windowMs, scale, width]);
  const notes = view.notes.map(note => ({ note, pitch: timelinePitch(note.pitch, context) }));
  const guides = Array.from({ length: 8 }, (_, i) => Math.floor(view.leftMs / 2000) * 2000 + i * 2000);
  return <div className="improv-performance min-w-0">
    <p id={description} className="px-3 pt-2 text-xs text-zinc-300">Elapsed seconds; blue line = playhead. Trails show key-down time, not musical note values or acoustic sustain.</p>
    <svg ref={svg} role="img" aria-label="Time-based performance grand staff" aria-describedby={description}
      className="improv-timeline w-full" viewBox={`0 0 ${width} 316`} preserveAspectRatio="none"
      data-note-count={view.notes.length} data-recording={view.recording} data-known-end={view.knownEnd}>
      <defs><clipPath id={`${description}-clip`}><rect x={LEFT} y="20" width={width - LEFT - 12} height="284" /></clipPath></defs>
      {[90, 102, 114, 126, 138, 210, 222, 234, 246, 258].map(y => <line key={y} x1="12" x2={width - 12} y1={y} y2={y} stroke="#71717a" strokeWidth="1" />)}
      <line x1="12" x2="12" y1="90" y2="258" stroke="#a1a1aa" />
      <text x="20" y="132" fontSize="54" fill="#e4e4e7">𝄞</text><text x="20" y="235" fontSize="43" fill="#e4e4e7">𝄢</text>
      <g clipPath={`url(#${description}-clip)`}>
        <g ref={group}>
          {guides.map(at => <g key={at}><line x1={LEFT + (at - view.leftMs) * scale} x2={LEFT + (at - view.leftMs) * scale} y1="42" y2="286" stroke="#a1a1aa" opacity=".16" />
            <text x={LEFT + (at - view.leftMs) * scale + 4} y="35" fill="#a1a1aa" fontSize="12">{at / 1000} s</text></g>)}
          {notes.map(({ note, pitch }) => {
            if (!pitch) return null;
            const x = LEFT + (note.onsetMs - view.leftMs) * scale;
            const end = Math.min(width - 12, LEFT + ((note.releaseMs ?? view.atMs) - view.leftMs) * scale);
            return <g key={note.sequence} data-attack={note.sequence} data-pitch={note.pitch} data-onset-ms={note.onsetMs} data-release-ms={note.releaseMs ?? "unreleased"}>
              <title>{pitch.name}, attack {(note.onsetMs / 1000).toFixed(2)} seconds; {note.releaseMs === null ? "no recorded release" : `key-down ${((note.releaseMs - note.onsetMs) / 1000).toFixed(2)} seconds`}</title>
              <line x1={Math.max(LEFT, x)} x2={end} y1={pitch.y} y2={pitch.y} stroke="#7dd3fc" strokeWidth="4" opacity=".45"
                strokeDasharray={note.releaseMs === null && !view.recording ? "4 3" : undefined} data-held-onset={note.releaseMs === null ? note.onsetMs : undefined} />
              {x >= LEFT && <>
                {pitch.ledgers.map(y => <line key={y} x1={x - 11} x2={x + 11} y1={y} y2={y} stroke="#d4d4d8" />)}
                {pitch.accidental && <text x={x - 18} y={pitch.y + 5} fontSize="17" fill="#e4e4e7">{pitch.accidental}</text>}
                <ellipse cx={x} cy={pitch.y} rx="6" ry="4.3" transform={`rotate(-18 ${x} ${pitch.y})`} fill="#e4e4e7" />
                {!!pitch.displacement && <text x={x + 8} y={pitch.y - 8} fontSize="11" fill="#fcd34d">{pitch.name} ({pitch.displacement > 0 ? "+" : ""}{pitch.displacement} oct)</text>}
              </>}
              {x < LEFT && <text x={LEFT + 4} y={pitch.y - 7} fontSize="12" fill="#e4e4e7">{pitch.name}</text>}
            </g>;
          })}
        </g>
        <line ref={head} x1={LEFT + (view.atMs - view.leftMs) * scale} x2={LEFT + (view.atMs - view.leftMs) * scale} y1="44" y2="288" stroke="#38bdf8" strokeWidth="3" aria-label="Blue elapsed-time playhead" />
      </g>
    </svg>
    <p className="px-3 pb-1 text-xs text-zinc-400">{windowMs / 1000}-second window. Extreme notes use labeled octave displacement; names retain actual pitch. Dashed frozen trails have no recorded release.</p>
    <p className="px-3 pb-2 text-xs text-zinc-400" aria-live="off">{source() ? view.recording ? "Recording performance" : `Frozen performance · ${view.knownEnd ? "observed end" : "uncertain end / retained prefix"}` : "Ready · press Start Take to begin"}
      {view.pedalActive ? " · CC64 pedal observed down" : ""}{view.issueCount ? " · approximate timing contains anomalies" : ""}
      {(view.crowded || view.omitted > 0) && " · display detail limited; accepted MIDI remains in the take"}</p>
  </div>;
}
