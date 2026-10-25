import { useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AppMidiContext } from "@/components/midi/midi-context";
import MidiStatus from "@/components/midi/midi-status";
import { useMobilePlay } from "@/hooks/use-mobile-play";
import { STAFF_BUILDER_TICKS_PER_QUARTER } from "@/features/staff-builder/staff-builder-time";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import type { MidiInputInfo } from "@/lib/midi/midi-transport";
import { formatPiecePracticeMidiPitch } from "../piece-practice-evidence";
import { projectContinuousPassage } from "./continuous-projection";
import { ContinuousSession, type ContinuousView } from "./continuous-session";
import { continuousStore } from "./continuous-store";
import { ContinuousReadingView } from "./continuous-reading-view";
import { admitContinuousPassage, CONTINUOUS_MAX_MEASURES } from "./continuous-budget";
import { ContinuousInputSelector } from "./continuous-input-selector";
import { ContinuousInputDiagnostic } from "./continuous-input-diagnostic";
import { resolveContinuousInput } from "./continuous-input-preference";
import type { ContinuousAttempt, ContinuousPassage, ContinuousStore, ContinuousHistoryPage, ContinuousHistoryCursor } from "./continuous-types";
import { createEntry, parseEntry, ROLODEX_MAX_MEASURES } from "../rolodex/rolodex-model";
import { RolodexEditor } from "../rolodex/rolodex-editor";
import type { RolodexEntry } from "../rolodex/rolodex-types";

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
  const [inputChoice, setSelectedInput] = useState<MidiInputInfo | null>(null);
  const [frozenInput, setFrozenInput] = useState<MidiInputInfo | null>(null);
  const [frozen, setFrozen] = useState<ContinuousPassage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveDraft, setSaveDraft] = useState<RolodexEntry | null>(null);
  const [saveNotice, setSaveNotice] = useState("");
  const inputs = midi?.connectedInputs ?? [];
  const selectedInput = resolveContinuousInput(inputChoice, inputs);
  const validRange = end >= start && end - start < CONTINUOUS_MAX_MEASURES;
  const rolodexRange = validRange && end - start < ROLODEX_MAX_MEASURES;
  if (saveDraft) return <RolodexEditor entry={saveDraft} onCancel={() => setSaveDraft(null)} onSaved={result => { setSaveDraft(null); setSaveNotice(result.duplicate ? "This passage already exists in Practice Rolodex." : "Passage saved to Practice Rolodex. Open it from the Staff Builder library."); }} />;
  if (frozen && frozenInput) return <ContinuousPlayer passage={frozen} input={frozenInput} store={store}
    onExit={() => { setFrozen(null); }} onGuardChange={onGuardChange} />;
  return <section className="mx-auto grid w-full min-w-0 max-w-6xl gap-4 rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-zinc-100 sm:p-5" aria-labelledby="continuous-title">
    <header><h1 className="text-2xl font-bold" id="continuous-title">Continuous tempo · {score.title}</h1>
      <p>The music keeps going through mistakes. Read first, then begin a one-bar count-in.</p></header>
    <div className="flex flex-wrap gap-3"><button className={button} onClick={onPitchFirst} type="button">Pitch-first</button><strong className="self-center">Continuous tempo selected</strong></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="grid gap-1">Start measure<select className={field} value={start} onChange={(e) => {
        setStart(Number(e.target.value));
      }}>{score.measures.map((m, i) => <option value={i} key={m.id}>{i + 1}</option>)}</select></label>
      <label className="grid gap-1">End measure (inclusive)<select className={field} value={end} onChange={(e) => setEnd(Number(e.target.value))}>
        {score.measures.map((m, i) => <option value={i} disabled={i < start || i - start >= CONTINUOUS_MAX_MEASURES} key={m.id}>{i + 1}</option>)}</select></label>
      <label className="grid gap-1">Quarter-note BPM (40–120)<input className={field} type="number" min={40} max={120} step={1} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} /></label>
    </div>
    <div className="flex flex-wrap items-center gap-2" aria-label="Passage length shortcuts"><span>From selected start:</span>{[4, 8, 16].map(length =>
      <button className={button} type="button" key={length} disabled={start + length > score.measures.length} onClick={() => setEnd(start + length - 1)}>{length} measures</button>)}</div>
    {!validRange && <p role="alert">Choose an end at or after the start, within 16 complete measures. Your selected endpoints have not been shortened.</p>}
    <p>3/4: three quarter pulses. 4/4: four quarter pulses. 6/8: two dotted-quarter pulses; at {bpm} quarter BPM, dotted-quarter tempo is {Number((bpm / 1.5).toFixed(1))}.</p>
    {midi && <MidiStatus deviceName={selectedInput?.name ?? "MIDI access enabled — choose an input"} error={midi.error} status={midi.status} onConnect={() => { void midi.connectMidi(); }} />}
    <ContinuousInputSelector inputs={inputs} onSelection={setSelectedInput} />
    <p>Connect a MIDI piano by USB, select its input, and allow MIDI access. Microphone, simulation and virtual keys cannot start a scored continuous run.</p>
    {error && <p role="alert">{error}</p>}
    {saveNotice && <p role="status">{saveNotice}</p>}
    {!rolodexRange && <p>Piano Rolodex and lesson repertoire currently support 1–4 measures. This longer standalone attempt can be saved in continuous history; choose a separate shorter range for Rolodex.</p>}
    <button className={button} disabled={!rolodexRange} type="button" onClick={() => {
      try { setSaveDraft(createEntry(score, "piano", start, end, bpm)); setError(null); }
      catch (e) { setError(e instanceof Error ? e.message : "Check the selected passage."); }
    }}>Save to Practice Rolodex</button>
    <div className="flex flex-wrap gap-3"><button className={primary} disabled={!validRange || !selectedInput || midi?.status !== "connected"} onClick={() => {
      try { const p = projectContinuousPassage(score, start, end, bpm); admitContinuousPassage(p, selectedInput!); setFrozenInput({ ...selectedInput! }); setFrozen(p); setError(null); }
      catch (e) { setError(e instanceof Error ? e.message : "This range is unavailable."); }
    }} type="button">Prepare Range</button><button className={button} onClick={onExit} type="button">Exit Piece Practice</button></div>
    <ContinuousHistory scoreId={score.id} store={store} canPrepare={Boolean(selectedInput)} onPrepare={r => {
      try { const p = projectContinuousPassage(r.passage.score, r.passage.start, r.passage.end, r.passage.bpm, r.passage.policy);
        admitContinuousPassage(p, selectedInput!); setFrozenInput({ ...selectedInput! }); setFrozen(p); setError(null); }
      catch (e) { setError(e instanceof Error ? e.message : "This saved range is unavailable."); }
    }} />
  </section>;
}

export function ContinuousPlayer({ passage, input, store, onExit, onGuardChange, createSession, onAcknowledgedAttempt, lessonHost, onView }: Readonly<{
  passage: ContinuousPassage; input: MidiInputInfo; store: ContinuousStore; onExit: () => void;
  onGuardChange?: (guard: (() => boolean) | null) => void;
  createSession?: () => ContinuousSession;
  onAcknowledgedAttempt?: (attempt: ContinuousAttempt) => void;
  onView?: (view: ContinuousView) => void;
  lessonHost?: Readonly<{ active: boolean; onView: (view: ContinuousView) => void; finishLabel?: string; entryFocusAllowed?: () => boolean }>;
}>) {
  const midi = useContext(AppMidiContext);
  const [session] = useState(() => createSession?.() ?? new ContinuousSession(passage, input, store));
  const playerRef = useRef<HTMLElement>(null);
  const focus = useMobilePlay();
  const { exitMobilePlay } = focus;
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitMobilePlay();
      if (e.key !== "Tab" || !focus.isMobilePlayMode) return;
      const controls = [...(playerRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? [])]
        .filter(el => !el.closest("[inert]") && el.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (first && last && (e.shiftKey && document.activeElement === first || !e.shiftKey && document.activeElement === last
        || !playerRef.current?.contains(document.activeElement))) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [exitMobilePlay, focus.isMobilePlayMode]);
  const view = useSyncExternalStore(session.subscribe, session.snapshot);
  const active = lessonHost?.active ?? true;
  const [foreground, setForeground] = useState(() => document.visibilityState !== "hidden");
  const notifyView = lessonHost?.onView;
  useEffect(() => { notifyView?.(view); onView?.(view); }, [notifyView, onView, view]);
  const [saveDraft, setSaveDraft] = useState<RolodexEntry | null>(null);
  const [saveNotice, setSaveNotice] = useState("");
  useEffect(() => {
    if (view.phase === "results" && view.save === "saved" && view.attempt) onAcknowledgedAttempt?.(view.attempt);
  }, [view.phase, view.save, view.attempt, onAcknowledgedAttempt]);
  const [reviewMeasure, setReviewMeasure] = useState(passage.start);
  const connected = Boolean(midi?.status === "connected" && resolveContinuousInput(session.input, midi.connectedInputs));
  const registerConsumer = midi?.registerConsumer;
  const entryFocusAllowed = lessonHost?.entryFocusAllowed;
  useEffect(() => { if (!entryFocusAllowed || entryFocusAllowed()) playerRef.current?.scrollIntoView?.({ block: "start" }); }, [entryFocusAllowed]);
  useEffect(() => {
    if (!active || !foreground) { session.invalidateInput(); session.interrupt("Practice left the foreground. Replay when ready."); }
    // Keep this one registration through results/Replay: an intervening owner must
    // invalidate verification even when no scored capture is running.
    const unregister = active && foreground ? registerConsumer?.({ rawInputId: session.input.id ?? undefined, onRawMessage: session.rawMessage,
      onOwnershipChange: session.ownershipChanged,
      onInputConnectionChange: (change) => {
        if (change.state === "disconnected") session.disconnect(change.input.id);
        else if (change.input.name === session.input.name) session.reconnect(change.input.id);
      } }) : undefined;
    const hidden = () => {
      const visible = document.visibilityState !== "hidden";
      if (!visible) { session.invalidateInput(); session.interrupt("Browser background interruption. Replay when ready."); }
      setForeground(visible);
    };
    const leaving = () => { session.invalidateInput(); session.interrupt("The page was closed, frozen or left."); setForeground(false); };
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
  }, [registerConsumer, session, active, foreground]);
  useEffect(() => {
    onGuardChange?.(() => {
      if (session.canExit()) return true;
      if (session.snapshot().phase === "results" && session.snapshot().save === "failed") return lessonHost ? false : window.confirm("This result is not saved. Leave and lose its pending in-memory evidence? Retry Save keeps the same attempt.");
      session.stop();
      return false; // First navigation stops and saves; the next follows its acknowledgement.
    });
    return () => onGuardChange?.(null);
  }, [onGuardChange, session, lessonHost]);
  useEffect(() => { if (!connected) session.disconnect(session.input.id); else session.reconnect(session.input.id); }, [connected, session]);
  const playing = view.phase === "playing";
  const activeIndex = Math.min(passage.end, passage.start + Math.floor(view.elapsedMs / passage.measureMs));
  const measureIndex = view.phase === "results" ? reviewMeasure : activeIndex;
  const offsetTicks = playing ? Math.min(passage.measureMs, view.elapsedMs - (activeIndex - passage.start) * passage.measureMs) * passage.bpm * STAFF_BUILDER_TICKS_PER_QUARTER / 60000 : 0;
  const assessment = view.attempt?.assessment;
  const highlights = useMemo(() => (assessment?.groups.filter((g) => g.measureIndex === measureIndex) ?? []).flatMap((g) => g.eventIds.map((eventId) => ({ eventId,
    status: g.pitches.every((p) => p.outcome === "correct" && p.timing === "on-time") ? "correct" as const
      : g.pitches.every((p) => p.outcome === "unobserved") ? "complete" as const : "incorrect" as const }))), [assessment, measureIndex]);
  return <section ref={playerRef} role={focus.isMobilePlayMode ? "dialog" : undefined} aria-modal={focus.isMobilePlayMode || undefined} className={`continuous-player mx-auto grid w-full min-w-0 max-w-6xl gap-3 rounded-xl bg-zinc-900 p-3 text-zinc-100${focus.isMobilePlayMode ? " continuous-player-focus" : ""}`} aria-labelledby="continuous-player-title">
    <header className="min-w-0"><h1 id="continuous-player-title" className="truncate text-xl font-bold" title={passage.score.title}>{passage.score.title}</h1>
      <p>Measures {passage.start + 1}–{passage.end + 1} · {passage.meter} · ♩ = {passage.bpm}{passage.meter === "6/8" ? ` · dotted-quarter = ${Number((passage.bpm / 1.5).toFixed(1))} (two pulses per bar)` : ""}</p>
      <p className="break-words">Physical MIDI Input: <strong>{session.input.name ?? "Unnamed MIDI input"}</strong> <span className="text-sm">({session.input.id})</span></p></header>
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 bg-zinc-900 py-1">
      <button className={button} type="button" aria-pressed={focus.isMobilePlayMode} onClick={focus.isMobilePlayMode ? focus.exitMobilePlay : focus.enterMobilePlay}>{focus.isMobilePlayMode ? "Exit Focus Staff" : "Focus Staff"}</button>
      {view.phase === "ready" && <button className={primary} disabled={!connected || !session.hasOwnership() || view.midiNote === null || !active || !foreground} onClick={() => { playerRef.current?.scrollIntoView?.({ block: "start" }); session.begin(); }} type="button">{view.save === "failed" ? "Retry Start — Begin Count-in" : "Ready — Begin Count-in"}</button>}
      {view.phase === "starting" && <p role="status">Preparing audio and waiting for attempt-start acknowledgement…</p>}
      {view.phase === "count-in" && <p className="text-xl font-bold" role="status">Count-in · {view.pulse || "Ready"} / {passage.pulsesPerBar}</p>}
      {playing && <p className="text-xl font-bold">Playing · Measure {activeIndex + 1} · Pulse {view.pulse} {view.elapsedMs >= passage.durationMs ? "· final association tail" : ""}</p>}
      {["starting", "count-in", "playing"].includes(view.phase) && <button className={button} type="button" onClick={session.stop}>{lessonHost ? "Stop Repertoire" : "Stop Attempt"}</button>}
      {view.phase === "results" && <>
        <button className={primary} type="button" disabled={view.save !== "saved" || !connected} onClick={() => { setReviewMeasure(passage.start); session.replay(); }}>Replay Same Range</button>
        {view.save === "failed" && <button className={primary} onClick={session.retrySave} type="button">Retry Save</button>}
        <span role="status">{view.save === "saved" ? "Result saved locally" : view.save === "failed" ? "Result not saved" : "Saving result…"}</span>
      </>}
      <button className={button} type="button" disabled={!session.canExit() && !(!lessonHost && view.phase === "results" && view.save === "failed")} onClick={() => {
        if (session.canExit() || window.confirm("This result is not saved. Exit and lose its pending in-memory evidence?")) { session.invalidateInput(); onExit(); }
      }}>{lessonHost ? lessonHost.finishLabel ?? "Finish Lesson" : "Exit Continuous Practice"}</button>
    </div>
    {view.phase === "ready" && <p role="status">Ready — read first. The clock and scoring begin after count-in.</p>}
    {view.phase === "ready" && <div aria-live="polite" role="status">
      {view.midiNote !== null ? <p>MIDI received: {formatPiecePracticeMidiPitch(view.midiNote)}</p> : <>
        <p>{connected ? "Input available — play a note to test connection." : "Selected input unavailable."}</p>
        <p>No notes received from this input yet. Check the selected port, piano power and MIDI connection, then play a note. Test notes are not scored.</p>
      </>}
    </div>}
    {!connected && <p role="alert">Reconnect the selected physical MIDI piano ({session.input.name ?? session.input.id}). Return to range selection to choose a different input.</p>}
    {view.error && <p role="alert">{view.error}</p>}
    {saveNotice && <p role="status">{saveNotice}</p>}
    {view.phase === "results" && passage.end - passage.start >= ROLODEX_MAX_MEASURES && <p>Piano Rolodex and lesson repertoire remain limited to 1–4 measures. This complete longer attempt is retained in continuous history.</p>}
    {view.phase === "results" && view.save === "saved" && view.attempt?.status === "completed" && !onAcknowledgedAttempt && passage.end - passage.start < ROLODEX_MAX_MEASURES && <button type="button" className={button} onClick={() => {
      setSaveDraft(parseEntry({ ...createEntry(passage.score, "piano", passage.start, passage.end, passage.bpm), policy: passage.policy }));
    }}>Save to Practice Rolodex</button>}
    {saveDraft && <RolodexEditor entry={saveDraft} onCancel={() => setSaveDraft(null)} onSaved={result => { setSaveDraft(null); setSaveNotice(result.duplicate ? "This passage already exists in Practice Rolodex." : "Passage saved to Practice Rolodex."); }} />}
    {view.phase === "results" && view.attempt && <ContinuousResults attempt={view.attempt} />}
    {view.phase === "results" && <nav aria-label="Review measure" className="flex flex-wrap gap-2">{Array.from({ length: passage.end - passage.start + 1 }, (_, i) =>
      <button type="button" className={button} aria-pressed={reviewMeasure === passage.start + i} key={i} onClick={() => setReviewMeasure(passage.start + i)}>Measure {passage.start + i + 1}</button>)}</nav>}
    <ContinuousReadingView passage={passage} measureIndex={measureIndex} offsetTicks={playing ? offsetTicks : undefined} highlights={highlights} review={view.phase === "results"} />
  </section>;
}

function ContinuousHistory({ scoreId, store, canPrepare, onPrepare }: Readonly<{
  scoreId: string; store: ContinuousStore; canPrepare: boolean; onPrepare: (attempt: ContinuousAttempt) => void;
}>) {
  const [page, setPage] = useState<ContinuousHistoryPage | null>(null);
  const [detail, setDetail] = useState<ContinuousAttempt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  const load = (before?: ContinuousHistoryCursor) => {
    const token = ++generation.current;
    setLoading(true); setDetail(null); setError(null);
    // Legacy injected stores keep their interface. The native browser owner
    // always uses cursor pages and never list()/getAll() for this screen.
    const pending = store.historyPage ? store.historyPage(scoreId, before) : store.list().then(records => ({
      entries: records.filter(r => r.passage.score.id === scoreId).slice(0, 8).map(r => ({ id: r.id, startedAt: r.startedAt,
        start: r.passage.start, end: r.passage.end, bpm: r.passage.bpm, status: r.status, unavailable: false })), next: null,
    }));
    void pending.then(result => { if (token === generation.current) { setPage(result); setLoading(false); } }, () => {
      if (token === generation.current) { setLoading(false); setError("Continuous history could not be read. Earlier records have been preserved."); }
    });
  };
  const review = (id: string) => {
    const token = ++generation.current;
    setDetail(null); setError(null); setLoading(true);
    void (store.get ? store.get(id) : store.list().then(records => records.find(r => r.id === id) ?? null)).then(record => {
      if (token !== generation.current) return;
      setLoading(false);
      if (record) setDetail(record);
      else setError("This attempt is no longer available. It may have been evicted by a newer acknowledged attempt.");
    }, () => { if (token === generation.current) { setLoading(false); setError("This attempt could not be validated. Its original evidence has been preserved."); } });
  };
  return <details><summary className="cursor-pointer py-2">Local continuous history</summary>
    <p>Up to 64 attempts. Each page checks up to eight records and shows this piece’s summaries; use Older Attempts to continue. Open one saved result at a time. Unfinished starts contain only the last acknowledged checkpoint.</p>
    <button className={button} type="button" disabled={loading} onClick={() => load()}>Load Saved Attempts</button>
    {page?.next && <button className={button} type="button" disabled={loading} onClick={() => load(page.next!)}>Older Attempts</button>}
    {loading && <p role="status">Loading saved evidence…</p>}
    {error && <p role="alert">{error}</p>}
    {page?.entries.length === 0 && <p>No saved continuous attempts for this piece on this page.</p>}
    {page?.entries.map(r => <div className="my-3 rounded border border-zinc-600 p-3" key={r.id}>
      <p>{new Date(r.startedAt).toLocaleString()} · Measures {r.start + 1}–{r.end + 1} · {r.bpm} BPM · {r.unavailable ? "Unavailable summary — original preserved" : r.status === "started" ? "Unfinished / interruption possible — last checkpoint" : r.status}</p>
      <button type="button" className={button} disabled={loading} onClick={() => review(r.id)}>Review Saved Attempt</button>
    </div>)}
    {detail && <div className="rounded border border-sky-600 p-3" aria-label="Saved attempt review">
      {detail.assessment ? <ContinuousResults attempt={detail} /> : <p>{detail.attacks.length} recorded attacks in the last saved checkpoint; no terminal acknowledgement or complete result.</p>}
      <button className={button} disabled={!canPrepare} type="button" onClick={() => onPrepare(detail)}>Prepare This Frozen Range</button>
      <button className={button} type="button" onClick={() => setDetail(null)}>Close Saved Review</button>
    </div>}
  </details>;
}

export function ContinuousResults({ attempt }: Readonly<{ attempt: ContinuousAttempt }>) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const result = attempt.assessment;
  if (!result) return null;
  const p = attempt.passage;
  return <div className="grid min-w-0 gap-2" aria-label="Continuous results">
    <h2 className="text-xl font-bold">{attempt.status === "completed" ? "Passage complete" : `Attempt ${attempt.status}`}</h2>
    <ContinuousInputDiagnostic attempt={attempt} />
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
    <details onToggle={e => setEvidenceOpen(e.currentTarget.open)}><summary className="cursor-pointer py-2">Notes and evidence · source and policy</summary>
      {evidenceOpen && <>
      <p>Source: {p.score.title} · score {p.score.id} · revision {p.score.updatedAt}. Frozen measures {p.start + 1}–{p.end + 1}.</p>
      <p>Attempt {attempt.id} · policy {p.policy.version} · physical MIDI {attempt.input.name ?? "unnamed"} ({attempt.input.id}). Started {attempt.startedAt}; ended {attempt.endedAt}. Terminal write attempt {attempt.terminalSaveAttempts}.</p>
      <p>Timing uses the browser audio clock and MIDI event timestamps. Hardware and output latency are uncalibrated. Unavailable timestamps or uncertainty crossing a timing threshold produce “uncertain”. Repeated pitches require distinct Note On messages; simultaneous unisons count once and do not identify hands.</p>
      <p>Association: min({p.policy.associationCapMs} ms, {p.policy.associationPulse} pulse, {p.policy.associationGap} nearest distinct-onset gap). On time: min({p.policy.onTimeCapMs} ms, {p.policy.onTimePulse} pulse, {p.policy.onTimeGap} gap). These initial thresholds await physical-piano validation.</p>
      <ul className="grid gap-2 pl-4">{result.groups.map((g, i) => <li key={g.targetId}>
        Measure {g.measureIndex + 1}, tick {p.expected[i]!.target.startTick}{g.partialChord ? " · partial chord" : ""}: {g.pitches.map((pitch) => {
          const a = attempt.attacks.find((attack) => attack.id === pitch.attackId);
          return `${formatPiecePracticeMidiPitch(pitch.midi, { expectedPitches: p.expected[i]!.target.attackedPitches })}: ${pitch.outcome}${pitch.timing ? `, ${pitch.timing}` : ""}${pitch.offsetMs !== null ? ` (${Math.round(pitch.offsetMs)} ms browser offset)` : ""}${pitch.outcome === "wrong" && a ? `, played MIDI ${a.midi}` : ""}`;
        }).join("; ")}. Events: {g.eventIds.join(", ")}</li>)}</ul>
      <details onToggle={e => setRawOpen(e.currentTarget.open)}><summary className="cursor-pointer py-2">Raw retained attack evidence</summary>{rawOpen && <pre className="max-h-72 max-w-full overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify({ policy: p.policy, attacks: attempt.attacks, extraAttackIds: result.extras }, null, 2)}</pre>}</details>
      <p>Local retention: at most 64 records, 256 KiB source score, 2 MiB per record and 2,048 attacks per attempt. Old terminal records are evicted first; unfinished records become eligible after 24 hours. Only acknowledged writes are durable.</p>
      </>}
    </details>
  </div>;
}
