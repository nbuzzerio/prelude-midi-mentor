import { useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AppMidiContext } from "@/components/midi/midi-context";
import MidiStatus from "@/components/midi/midi-status";
import { STAFF_BUILDER_TICKS_PER_QUARTER } from "@/features/staff-builder/staff-builder-time";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import type { MidiInputInfo } from "@/lib/midi/midi-transport";
import { formatPiecePracticeMidiPitch } from "../piece-practice-evidence";
import { projectContinuousPassage } from "./continuous-projection";
import { ContinuousSession } from "./continuous-session";
import { continuousStore } from "./continuous-store";
import { ContinuousScore } from "./continuous-score";
import type { ContinuousAttempt, ContinuousPassage, ContinuousStore } from "./continuous-types";

const button = "min-h-11 rounded-lg border border-zinc-500 px-4 py-2 font-semibold disabled:opacity-40";
const primary = `${button} bg-sky-700 hover:bg-sky-600`;
const field = "min-h-11 rounded border border-zinc-500 bg-zinc-950 p-2";

export function ContinuousWorkspace({ score, onExit, onPitchFirst, onGuardChange, store = continuousStore }: Readonly<{
  score: StaffBuilderScore; onExit: () => void; onPitchFirst: () => void;
  onGuardChange?: (guard: (() => boolean) | null) => void; store?: ContinuousStore;
}>) {
  const midi = useContext(AppMidiContext);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(Math.min(1, score.measures.length - 1));
  const [bpm, setBpm] = useState(Math.max(40, Math.min(120, score.tempoBpm)));
  const [inputId, setInputId] = useState("");
  const [frozen, setFrozen] = useState<ContinuousPassage | null>(null);
  const [history, setHistory] = useState<readonly ContinuousAttempt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = midi?.connectedInputs.filter((i) => i.id !== null) ?? [];
  const selectedInput = inputs.find((i) => i.id === inputId) ?? (inputId === "" ? inputs[0] : undefined);
  if (frozen) return <ContinuousPlayer passage={frozen} input={selectedInput ?? { id: inputId || null, name: null }} store={store}
    onExit={() => { setFrozen(null); setHistory(null); }} onGuardChange={onGuardChange} />;
  return <section className="mx-auto grid w-full min-w-0 max-w-6xl gap-4 rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-zinc-100 sm:p-5" aria-labelledby="continuous-title">
    <header><h1 className="text-2xl font-bold" id="continuous-title">Continuous tempo · {score.title}</h1>
      <p>The music keeps going through mistakes. Read first, then begin a one-bar count-in.</p></header>
    <div className="flex flex-wrap gap-3"><button className={button} onClick={onPitchFirst} type="button">Pitch-first</button><strong className="self-center">Continuous tempo selected</strong></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="grid gap-1">Start measure<select className={field} value={start} onChange={(e) => {
        const value = Number(e.target.value); setStart(value); setEnd(Math.max(value, Math.min(end, value + 3)));
      }}>{score.measures.map((m, i) => <option value={i} key={m.id}>{i + 1}</option>)}</select></label>
      <label className="grid gap-1">End measure (inclusive)<select className={field} value={end} onChange={(e) => setEnd(Number(e.target.value))}>
        {score.measures.slice(start, start + 4).map((m, i) => <option value={start + i} key={m.id}>{start + i + 1}</option>)}</select></label>
      <label className="grid gap-1">Quarter-note BPM (40–120)<input className={field} type="number" min={40} max={120} step={1} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} /></label>
    </div>
    <p>3/4: three quarter pulses. 4/4: four quarter pulses. 6/8: two dotted-quarter pulses; at {bpm} quarter BPM, dotted-quarter tempo is {Number((bpm / 1.5).toFixed(1))}.</p>
    {midi && <MidiStatus deviceName={midi.deviceName} error={midi.error} status={midi.status} onConnect={() => { void midi.connectMidi(); }} />}
    <label className="grid max-w-lg gap-1">Physical MIDI piano<select className={field} value={selectedInput?.id ?? ""} onChange={(e) => setInputId(e.target.value)}>
      {!inputs.length && <option value="">No MIDI piano connected</option>}
      {inputs.map((i) => <option key={i.id} value={i.id!}>{i.name ?? i.id}</option>)}
    </select></label>
    <p>Connect a MIDI piano by USB, select its input, and allow MIDI access. Microphone, simulation and virtual keys cannot start a scored continuous run.</p>
    {error && <p role="alert">{error}</p>}
    <div className="flex flex-wrap gap-3"><button className={primary} disabled={!selectedInput || midi?.status !== "connected"} onClick={() => {
      try { const p = projectContinuousPassage(score, start, end, bpm); setInputId(selectedInput!.id!); setFrozen(p); setError(null); }
      catch (e) { setError(e instanceof Error ? e.message : "This range is unavailable."); }
    }} type="button">Prepare Range</button><button className={button} onClick={onExit} type="button">Exit Piece Practice</button></div>
    <details><summary className="cursor-pointer py-2">Local continuous history</summary>
      <p>Up to 64 attempts, separate from pitch-first history. Failed writes preserve earlier records. Unfinished starts show only the last acknowledged checkpoint; they are never called completed.</p>
      <button className={button} type="button" onClick={() => {
        void store.list().then((records) => { setHistory(records.filter((r) => r.passage.score.id === score.id)); setError(null); }, () => setError("Continuous history could not be read. Earlier records have been preserved."));
      }}>Load Saved Attempts</button>
      {history?.length === 0 && <p>No saved continuous attempts for this piece.</p>}
      {history?.map((r) => <details className="my-3 rounded border border-zinc-600 p-3" key={r.id}>
        <summary>{new Date(r.startedAt).toLocaleString()} · Measures {r.passage.start + 1}–{r.passage.end + 1} · {r.passage.bpm} BPM · {r.status === "started" ? "Unfinished / interruption possible — last checkpoint" : r.status}</summary>
        {r.assessment ? <ContinuousResults attempt={r} /> : <p>{r.attacks.length} recorded attacks in the last saved checkpoint; no terminal acknowledgement or complete result.</p>}
        <button className={button} disabled={!selectedInput} type="button" onClick={() => { setInputId(selectedInput!.id!); setFrozen(projectContinuousPassage(r.passage.score, r.passage.start, r.passage.end, r.passage.bpm, r.passage.policy)); }}>Prepare This Frozen Range</button>
      </details>)}
    </details>
  </section>;
}

export function ContinuousPlayer({ passage, input, store, onExit, onGuardChange, createSession }: Readonly<{
  passage: ContinuousPassage; input: MidiInputInfo; store: ContinuousStore; onExit: () => void;
  onGuardChange?: (guard: (() => boolean) | null) => void;
  createSession?: () => ContinuousSession;
}>) {
  const midi = useContext(AppMidiContext);
  const [session] = useState(() => createSession?.() ?? new ContinuousSession(passage, input, store));
  const playerRef = useRef<HTMLElement>(null);
  const view = useSyncExternalStore(session.subscribe, session.snapshot);
  const [reviewMeasure, setReviewMeasure] = useState(passage.start);
  const connected = Boolean(midi?.status === "connected" && midi.connectedInputs.some((i) => i.id === session.input.id));
  const registerConsumer = midi?.registerConsumer;
  useEffect(() => { playerRef.current?.scrollIntoView?.({ block: "start" }); }, []);
  useEffect(() => {
    const unregister = registerConsumer?.({ rawInputId: session.input.id ?? undefined, onRawMessage: session.rawMessage,
      onOwnershipChange: session.ownershipChanged,
      onInputConnectionChange: (change) => { if (change.state === "disconnected") session.disconnect(change.input.id); } });
    const hidden = () => { if (document.visibilityState === "hidden") session.interrupt("Browser background interruption. Replay when ready."); };
    const leaving = () => session.interrupt("The page was closed, frozen or left.");
    const beforeUnload = (event: BeforeUnloadEvent) => { if (!session.canExit()) { event.preventDefault(); event.returnValue = ""; } };
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("freeze", leaving);
    window.addEventListener("pagehide", leaving);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      session.interrupt("Continuous practice exited.");
      unregister?.();
      document.removeEventListener("visibilitychange", hidden);
      document.removeEventListener("freeze", leaving);
      window.removeEventListener("pagehide", leaving);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [registerConsumer, session]);
  useEffect(() => {
    onGuardChange?.(() => {
      if (session.canExit()) return true;
      if (session.snapshot().phase === "results" && session.snapshot().save === "failed") return window.confirm("This result is not saved. Leave and lose its pending in-memory evidence? Retry Save keeps the same attempt.");
      session.stop();
      return false; // First navigation stops and saves; the next follows its acknowledgement.
    });
    return () => onGuardChange?.(null);
  }, [onGuardChange, session]);
  useEffect(() => { if (!connected) session.disconnect(session.input.id); else session.reconnect(session.input.id); }, [connected, session]);
  const playing = view.phase === "playing";
  const activeIndex = Math.min(passage.end, passage.start + Math.floor(view.elapsedMs / passage.measureMs));
  const measureIndex = view.phase === "results" ? reviewMeasure : activeIndex;
  const offsetTicks = playing ? Math.min(passage.measureMs, view.elapsedMs - (activeIndex - passage.start) * passage.measureMs) * passage.bpm * STAFF_BUILDER_TICKS_PER_QUARTER / 60000 : 0;
  const assessment = view.attempt?.assessment;
  const highlights = useMemo(() => (assessment?.groups.filter((g) => g.measureIndex === measureIndex) ?? []).flatMap((g) => g.eventIds.map((eventId) => ({ eventId,
    status: g.pitches.every((p) => p.outcome === "correct" && p.timing === "on-time") ? "correct" as const
      : g.pitches.every((p) => p.outcome === "unobserved") ? "complete" as const : "incorrect" as const }))), [assessment, measureIndex]);
  return <section ref={playerRef} className="mx-auto grid w-full min-w-0 max-w-6xl gap-3 rounded-xl bg-zinc-900 p-3 text-zinc-100" aria-labelledby="continuous-player-title">
    <header className="min-w-0"><h1 id="continuous-player-title" className="truncate text-xl font-bold" title={passage.score.title}>{passage.score.title}</h1>
      <p>Measures {passage.start + 1}–{passage.end + 1} · {passage.meter} · ♩ = {passage.bpm}{passage.meter === "6/8" ? ` · dotted-quarter = ${Number((passage.bpm / 1.5).toFixed(1))} (two pulses per bar)` : ""}</p>
      <span className="sr-only">Physical MIDI input: {session.input.name ?? session.input.id}</span></header>
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 bg-zinc-900 py-1">
      {view.phase === "ready" && <button className={primary} disabled={!connected || !session.hasOwnership()} onClick={() => { playerRef.current?.scrollIntoView?.({ block: "start" }); session.begin(); }} type="button">{view.save === "failed" ? "Retry Start — Begin Count-in" : "Ready — Begin Count-in"}</button>}
      {view.phase === "starting" && <p role="status">Preparing audio and waiting for attempt-start acknowledgement…</p>}
      {view.phase === "count-in" && <p className="text-xl font-bold" role="status">Count-in · {view.pulse || "Ready"} / {passage.pulsesPerBar}</p>}
      {playing && <p className="text-xl font-bold">Playing · Measure {activeIndex + 1} · Pulse {view.pulse} {view.elapsedMs >= passage.durationMs ? "· final association tail" : ""}</p>}
      {["starting", "count-in", "playing"].includes(view.phase) && <button className={button} type="button" onClick={session.stop}>Stop Attempt</button>}
      {view.phase === "results" && <>
        <button className={primary} type="button" disabled={view.save !== "saved" || !connected} onClick={() => { setReviewMeasure(passage.start); session.replay(); }}>Replay Same Range</button>
        {view.save === "failed" && <button className={primary} onClick={session.retrySave} type="button">Retry Save</button>}
        <span role="status">{view.save === "saved" ? "Result saved locally" : view.save === "failed" ? "Result not saved" : "Saving result…"}</span>
      </>}
      <button className={button} type="button" disabled={!session.canExit() && !(view.phase === "results" && view.save === "failed")} onClick={() => {
        if (session.canExit() || window.confirm("This result is not saved. Exit and lose its pending in-memory evidence?")) onExit();
      }}>Exit Continuous Practice</button>
    </div>
    {view.phase === "ready" && <p role="status">Ready — read first. The clock and scoring begin after count-in.</p>}
    {!connected && <p role="alert">Reconnect the selected physical MIDI piano ({session.input.name ?? session.input.id}). Return to range selection to choose a different input.</p>}
    {view.error && <p role="alert">{view.error}</p>}
    {view.phase === "results" && view.attempt && <ContinuousResults attempt={view.attempt} />}
    {view.phase === "results" && <nav aria-label="Review measure" className="flex flex-wrap gap-2">{Array.from({ length: passage.end - passage.start + 1 }, (_, i) =>
      <button type="button" className={button} aria-pressed={reviewMeasure === passage.start + i} key={i} onClick={() => setReviewMeasure(passage.start + i)}>Measure {passage.start + i + 1}</button>)}</nav>}
    <div className="min-w-0" data-continuous-active-measure={measureIndex + 1}>
      <h2 className="font-bold">{view.phase === "results" ? "Review" : "Active"} measure {measureIndex + 1}</h2>
      <ContinuousScore score={passage.score} measureIndex={measureIndex} offsetTicks={offsetTicks} highlights={highlights} />
    </div>
    {measureIndex < passage.end && view.phase !== "results" && <div className="min-w-0" data-continuous-next-measure={measureIndex + 2}>
      <h2 className="font-bold">Next · measure {measureIndex + 2}</h2>
      <ContinuousScore score={passage.score} measureIndex={measureIndex + 1} />
    </div>}
  </section>;
}

export function ContinuousResults({ attempt }: Readonly<{ attempt: ContinuousAttempt }>) {
  const result = attempt.assessment;
  if (!result) return null;
  const p = attempt.passage;
  return <div className="grid min-w-0 gap-2" aria-label="Continuous results">
    <h2 className="text-xl font-bold">{attempt.status === "completed" ? "Passage complete" : `Attempt ${attempt.status}`}</h2>
    <p>Measures {p.start + 1}–{p.end + 1} · {p.meter} · {p.bpm} quarter BPM</p>
    <p>{result.expected} expected pitch attacks · {result.matched} pitch matched · {result.wrong} wrong · {result.missing} missing · {result.extras.length} extra{result.unobserved > 0 ? ` · ${result.unobserved} not fully observed` : ""}</p>
    <p>Correct pitches: {result.onTime} on time · {result.early} early · {result.late} late · {result.uncertain} timing uncertain.</p>
    <p className="text-sm text-zinc-300">Timing describes browser MIDI arrivals; physical input and audio-output latency are uncalibrated.</p>
    {Array.from({ length: p.end - p.start + 1 }, (_, i) => {
      const index = p.start + i;
      const groups = result.groups.filter((g) => g.measureIndex === index);
      const pitches = groups.flatMap((g) => g.pitches);
      const n = (outcome: string) => pitches.filter((a) => a.outcome === outcome).length;
      const extras = attempt.attacks.filter((a) => result.extras.includes(a.id) && Math.min(p.end, p.start + Math.floor(a.timeMs / p.measureMs)) === index).length;
      return <p key={index}><strong>Measure {index + 1}:</strong> {n("missing")} missing; {n("wrong")} wrong; {pitches.filter((a) => a.timing === "early").length} correct early; {pitches.filter((a) => a.timing === "late").length} correct late; {extras} extra; {n("unobserved")} not fully observed.{groups.some((g) => g.partialChord) ? " Partially matched chord." : ""}</p>;
    })}
    <details><summary className="cursor-pointer py-2">Notes and evidence · source and policy</summary>
      <p>Source: {p.score.title} · score {p.score.id} · revision {p.score.updatedAt}. Frozen measures {p.start + 1}–{p.end + 1}.</p>
      <p>Attempt {attempt.id} · policy {p.policy.version} · physical MIDI {attempt.input.name ?? "unnamed"} ({attempt.input.id}). Started {attempt.startedAt}; ended {attempt.endedAt}. Terminal write attempt {attempt.terminalSaveAttempts}.</p>
      <p>Timing uses the browser audio clock and MIDI event timestamps. Hardware and output latency are uncalibrated. Unavailable timestamps or uncertainty crossing a timing threshold produce “uncertain”. Repeated pitches require distinct Note On messages; simultaneous unisons count once and do not identify hands.</p>
      <p>Association: min({p.policy.associationCapMs} ms, {p.policy.associationPulse} pulse, {p.policy.associationGap} nearest distinct-onset gap). On time: min({p.policy.onTimeCapMs} ms, {p.policy.onTimePulse} pulse, {p.policy.onTimeGap} gap). These initial thresholds await physical-piano validation.</p>
      <ul className="grid gap-2 pl-4">{result.groups.map((g, i) => <li key={g.targetId}>
        Measure {g.measureIndex + 1}, tick {p.expected[i]!.target.startTick}{g.partialChord ? " · partial chord" : ""}: {g.pitches.map((pitch) => {
          const a = attempt.attacks.find((attack) => attack.id === pitch.attackId);
          return `${formatPiecePracticeMidiPitch(pitch.midi, { expectedPitches: p.expected[i]!.target.attackedPitches })}: ${pitch.outcome}${pitch.timing ? `, ${pitch.timing}` : ""}${pitch.offsetMs !== null ? ` (${Math.round(pitch.offsetMs)} ms browser offset)` : ""}${pitch.outcome === "wrong" && a ? `, played MIDI ${a.midi}` : ""}`;
        }).join("; ")}. Events: {g.eventIds.join(", ")}</li>)}</ul>
      <details><summary className="cursor-pointer py-2">Raw retained attack evidence</summary><pre className="max-h-72 max-w-full overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify({ policy: p.policy, attacks: attempt.attacks, extraAttackIds: result.extras }, null, 2)}</pre></details>
      <p>Local retention: at most 64 records, 256 KiB source score, 768 KiB per record and 2,048 attacks per attempt. Old terminal records are evicted first; unfinished records become eligible after 24 hours. Only acknowledged writes are durable.</p>
    </details>
  </div>;
}
