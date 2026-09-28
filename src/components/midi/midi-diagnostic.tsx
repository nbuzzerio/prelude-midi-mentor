import { formatMidiDiagnosticReport } from "./midi-diagnostic-report";
import { formatMidiDiagnosticMusicalEvent, formatMidiDiagnosticSeconds, MIDI_DIAGNOSTIC_PARTIAL_WARNING, MIDI_DIAGNOSTIC_OVERLAP_WARNING, projectMidiDiagnosticMusicalEvents, type MidiDiagnosticMusicalProjection } from "./midi-diagnostic-musical";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { version } from "../../../package.json";
import MidiStatus from "./midi-status";
import { advanceMidiDiagnosticContinuity, appendMidiDiagnosticEvent, EMPTY_MIDI_DIAGNOSTIC_CAPTURE, formatMidiDiagnosticCapture, type MidiDiagnosticCapture, type MidiDiagnosticInputIdentity } from "./midi-diagnostic-capture";
import { decodeMidiDiagnosticMessage, formatMidiDiagnosticData, formatMidiDiagnosticRawBytes } from "./midi-diagnostic-message";

type ClipboardWriter = (text: string) => Promise<void>;
const browserClipboardWriter: ClipboardWriter = (text) => navigator.clipboard?.writeText ? navigator.clipboard.writeText(text) : Promise.reject(new Error("Clipboard unavailable"));

function identity(input: MIDIInput): MidiDiagnosticInputIdentity {
  return Object.freeze({ id: input.id || "Unknown input ID", name: input.name || "Unknown MIDI input" });
}

export default function MidiDiagnostic({ writeText = browserClipboardWriter }: Readonly<{ writeText?: ClipboardWriter }>) {
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected" | "unsupported" | "error">("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);
  const [inputs, setInputs] = useState<readonly MidiDiagnosticInputIdentity[]>([]);
  const [capture, setCapture] = useState<MidiDiagnosticCapture>(EMPTY_MIDI_DIAGNOSTIC_CAPTURE);
  const [paused, setPaused] = useState(false);
  const [view, setView] = useState<"musical" | "raw">("musical");
  const [copyKind, setCopyKind] = useState<"capture" | "report">("capture");
  const [fallbackText, setFallbackText] = useState("");
  const copyInFlight = useRef(false);
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const connectPromiseRef = useRef<Promise<void> | null>(null);
  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const pausedRef = useRef(false);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (copyState === "failed") { fallbackRef.current?.focus(); fallbackRef.current?.select(); } }, [copyState]);

  useEffect(() => {
    if (!midiAccess) return;
    const attached = new Map<MIDIInput, EventListener>();
    const refreshInputs = () => {
      const available = Array.from(midiAccess.inputs.values()).filter((input) => input.state !== "disconnected");
      const availableSet = new Set(available);
      for (const [input, listener] of attached) {
        if (!availableSet.has(input)) {
          input.removeEventListener("midimessage", listener);
          attached.delete(input);
          const inputId = identity(input).id;
          setCapture((current) => advanceMidiDiagnosticContinuity(current, inputId));
        }
      }
      for (const input of available) {
        if (attached.has(input)) continue;
        const source = identity(input);
        const listener: EventListener = (rawEvent) => {
          if (pausedRef.current) return;
          const event = rawEvent as MIDIMessageEvent;
          const { decoded, rawBytes } = decodeMidiDiagnosticMessage(event.data ?? []);
          setCapture((current) => appendMidiDiagnosticEvent(current, { decoded, eventTimeStampMs: event.timeStamp, messageLength: rawBytes.length, rawBytes, source }));
        };
        input.addEventListener("midimessage", listener);
        attached.set(input, listener);
      }
      setInputs(available.map(identity));
      setStatus(available.length ? "connected" : "disconnected");
      setError(available.length ? null : "No MIDI input is currently connected.");
    };
    refreshInputs();
    midiAccess.addEventListener("statechange", refreshInputs);
    return () => {
      midiAccess.removeEventListener("statechange", refreshInputs);
      for (const [input, listener] of attached) input.removeEventListener("midimessage", listener);
    };
  }, [midiAccess]);

  const connectMidi = useCallback(() => {
    if (midiAccessRef.current) return Promise.resolve();
    if (connectPromiseRef.current) return connectPromiseRef.current;
    const operation = (async () => {
      setError(null);
      setStatus("connecting");
      if (!("requestMIDIAccess" in navigator)) { setStatus("unsupported"); setError("This browser does not support the Web MIDI API."); return; }
      try {
        const access = await navigator.requestMIDIAccess();
        midiAccessRef.current = access;
        setMidiAccess(access);
      } catch (caught: unknown) {
        setStatus("error");
        setError(caught instanceof Error ? caught.message : "MIDI access could not be granted.");
      }
    })();
    connectPromiseRef.current = operation;
    void operation.finally(() => { if (connectPromiseRef.current === operation) connectPromiseRef.current = null; });
    return operation;
  }, []);

  const copiedText = useMemo(() => formatMidiDiagnosticCapture({ capture, inputs, version }), [capture, inputs]);
  const musical = useMemo(() => projectMidiDiagnosticMusicalEvents(capture), [capture]);
  const reportText = useMemo(() => formatMidiDiagnosticReport({ capture, version }), [capture]);
  const copy = async (kind: "capture" | "report") => {
    if (copyInFlight.current) return;
    copyInFlight.current = true;
    const attemptedText = kind === "capture" ? copiedText : reportText;
    setCopyKind(kind); setFallbackText(attemptedText); setCopyState("copying");
    try { await writeText(attemptedText); setCopyState("copied"); }
    catch { setFallbackText(attemptedText); setCopyState("failed"); }
    finally { copyInFlight.current = false; }
  };
  const togglePaused = () => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    if (!next) setCapture((current) => advanceMidiDiagnosticContinuity(current));
    setPaused(next);
  };
  const clearCapture = () => { setCapture(EMPTY_MIDI_DIAGNOSTIC_CAPTURE); setCopyState("idle"); setFallbackText(""); };
  const deviceName = inputs.length === 1 ? inputs[0]!.name : inputs.length > 1 ? `${inputs.length} MIDI inputs` : null;

  return <section className="midi-diagnostic mx-auto grid w-full max-w-7xl gap-5 text-zinc-100">
    <header className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-zinc-900 p-5">
      <div><p className="text-sm font-semibold uppercase tracking-wider text-white/60">Instrument inspection</p><h1 className="text-2xl font-bold">MIDI Diagnostic</h1><p className="mt-1 max-w-3xl text-sm text-zinc-300">Capture exactly what the browser receives from connected MIDI inputs. This evidence is descriptive and is not performance grading.</p></div>
      <MidiStatus deviceName={deviceName} error={error} onConnect={() => void connectMidi()} status={status} />
    </header>
    <section aria-labelledby="midi-diagnostic-inputs" className="rounded-xl bg-zinc-900 p-4"><h2 className="font-bold" id="midi-diagnostic-inputs">Detected inputs</h2>{inputs.length ? <ul className="mt-2 grid gap-1 text-sm text-zinc-300">{inputs.map((input) => <li key={input.id}><strong className="text-zinc-100">{input.name}</strong> <span className="break-all text-zinc-400">({input.id})</span></li>)}</ul> : <p className="mt-2 text-sm text-zinc-400">No connected MIDI inputs detected.</p>}</section>
    <section aria-labelledby="midi-diagnostic-capture" className="grid gap-3 rounded-xl bg-zinc-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold" id="midi-diagnostic-capture">Raw event capture</h2><p className="text-sm text-zinc-300">{paused ? "Paused" : "Running"} · {capture.events.length.toLocaleString()} retained · {capture.totalCaptured.toLocaleString()} total · {capture.droppedCount.toLocaleString()} older dropped</p></div><div className="flex flex-wrap gap-2"><button className="min-h-11 rounded border border-zinc-600 px-4 font-semibold" onClick={clearCapture} type="button">Clear</button><button aria-pressed={paused} className="min-h-11 rounded border border-zinc-600 px-4 font-semibold" onClick={togglePaused} type="button">{paused ? "Resume Capture" : "Pause Capture"}</button><button className="min-h-11 rounded bg-sky-600 px-4 font-semibold disabled:opacity-50" disabled={copyState === "copying"} onClick={() => void copy("capture")} type="button">{copyState === "copying" && copyKind === "capture" ? "Copying…" : "Copy Capture"}</button><button className="min-h-11 rounded border border-sky-500 px-4 font-semibold disabled:opacity-50" disabled={copyState === "copying"} onClick={() => void copy("report")} type="button">{copyState === "copying" && copyKind === "report" ? "Copying…" : "Copy Report"}</button></div></div>
      <div aria-label="Diagnostic event view" className="flex flex-wrap gap-2" role="group"><button aria-pressed={view === "musical"} className="min-h-11 rounded border border-zinc-500 px-4 aria-pressed:bg-sky-700" onClick={() => setView("musical")} type="button">Musical Events</button><button aria-pressed={view === "raw"} className="min-h-11 rounded border border-zinc-500 px-4 aria-pressed:bg-sky-700" onClick={() => setView("raw")} type="button">Raw MIDI / All Messages</button></div>
      {copyState === "copied" ? <p aria-live="polite" className="text-sm text-emerald-300" role="status">{copyKind === "capture" ? "Capture copied." : "Report copied."}</p> : null}
      {copyState === "failed" ? <section className="grid gap-2"><p className="text-sm text-red-300" role="alert">Clipboard access was unavailable. Copy the selected text below manually; the captured events remain unchanged.</p><label className="font-medium" htmlFor="midi-diagnostic-copy-fallback">{copyKind === "capture" ? "MIDI diagnostic capture" : "MIDI diagnostic report"}</label><textarea className="min-h-64 w-full rounded border border-zinc-600 bg-zinc-950 p-3 font-mono text-xs" id="midi-diagnostic-copy-fallback" readOnly ref={fallbackRef} value={fallbackText} /></section> : null}
      {view === "musical" ? <>
        {musical.partialEvidence && <p className="rounded border border-amber-400 bg-amber-950/50 p-3 font-semibold text-amber-200">{MIDI_DIAGNOSTIC_PARTIAL_WARNING}</p>}
        <p className="text-sm text-zinc-300">Background observed during this capture (including evicted messages; excluding paused messages): Timing Clock {capture.backgroundCounts.timingClock}, Active Sensing {capture.backgroundCounts.activeSensing}. Only ordinary valid F8/FE rows are hidden.</p>
        <p className="text-sm text-zinc-400">Times use the raw capture origin. Durations end at the key-release message, not sustain/acoustic decay. {capture.continuityBreakCount} continuity boundaries; pairing never crosses pause/resume or input reconnection gaps.</p>
        <MusicalEventsTable musical={musical} />
      </> : <div aria-label="Captured MIDI event history" className="max-h-[60vh] overflow-auto rounded border border-zinc-700" tabIndex={0}><table className="w-full min-w-[64rem] border-collapse text-left font-mono text-xs"><thead className="sticky top-0 bg-zinc-800 text-zinc-200"><tr><th className="p-2" scope="col">#</th><th className="p-2" scope="col">Time</th><th className="p-2" scope="col">Source</th><th className="p-2" scope="col">Len</th><th className="p-2" scope="col">Type</th><th className="p-2" scope="col">Ch</th><th className="p-2" scope="col">Data</th><th className="p-2" scope="col">Raw bytes</th></tr></thead><tbody>{capture.events.length ? capture.events.map((event) => <tr className="border-t border-zinc-800" key={event.sequence}><td className="p-2">{event.sequence}</td><td className="whitespace-nowrap p-2">{Number.isFinite(event.relativeTimeMs) ? `+${event.relativeTimeMs.toFixed(3)} ms` : "unavailable"}</td><td className="max-w-64 truncate p-2" title={`${event.source.name} (${event.source.id})`}>{event.source.name}</td><td className="p-2">{event.messageLength}</td><td className="whitespace-nowrap p-2">{event.decoded.type}{event.decoded.lengthCondition === "extra" ? " (extra bytes)" : event.decoded.lengthCondition === "truncated" ? " (truncated)" : ""}</td><td className="p-2">{event.decoded.channel ?? "—"}</td><td className="whitespace-nowrap p-2">{formatMidiDiagnosticData(event.decoded)}</td><td className="whitespace-nowrap p-2">{formatMidiDiagnosticRawBytes(event.rawBytes) || "—"}</td></tr>) : <tr><td className="p-5 text-center text-zinc-400" colSpan={8}>Connect MIDI and operate the instrument to begin capturing events.</td></tr>}</tbody></table></div>}
    </section>
  </section>;
}


function MusicalEventsTable({ musical }: Readonly<{ musical: MidiDiagnosticMusicalProjection }>) {
  return <div aria-label="Musical MIDI event history" className="max-h-[60vh] overflow-auto rounded border border-zinc-700" tabIndex={0}>
    <table className="w-full min-w-[54rem] border-collapse text-left text-sm"><thead className="sticky top-0 bg-zinc-800"><tr>{["#", "Time", "Event / Note", "MIDI", "Value / Velocity", "Duration", "Channel", "Input"].map((label) => <th className="p-2" scope="col" key={label}>{label}</th>)}</tr></thead><tbody>
      {musical.rows.length ? musical.rows.map((row, index) => {
        const event = row.kind === "note" ? row.attack : row.event;
        const decoded = event.decoded;
        const isNote = row.kind === "note" && decoded.kind === "note-on";
        return <tr className="border-t border-zinc-800" key={event.sequence}>
          <td className="p-2">{index + 1}</td><td className="whitespace-nowrap p-2">{formatMidiDiagnosticSeconds(event.relativeTimeMs)}</td>
          <td className="p-2">{isNote ? decoded.noteName : formatMidiDiagnosticMusicalEvent(event)}
            {row.kind === "note" && <details><summary className="min-h-11 cursor-pointer py-2">Note details — raw #{event.sequence}</summary><div className="space-y-1 text-xs text-zinc-300">
              <p>Release: {row.release ? formatMidiDiagnosticSeconds(row.release.relativeTimeMs) : "Release not observed"}</p>
              <p>Release velocity: {row.release?.decoded.kind === "note-release" ? row.release.decoded.releaseVelocity : "not observed"}; encoding: {row.release?.decoded.kind === "note-release" ? row.release.decoded.encoding : "not observed"}</p>
              <p>Raw sequences: attack #{event.sequence}; release {row.release ? `#${row.release.sequence}` : "not observed"}. Continuity segment: {event.continuitySegment}</p>
              {row.anomalies.map((anomaly) => <p key={anomaly}>{anomaly}</p>)}
            </div></details>}
            {row.kind === "note" && row.ambiguous && <p className="text-amber-200">{MIDI_DIAGNOSTIC_OVERLAP_WARNING}</p>}
            {row.kind === "note" && row.anomalies.length > 0 && <p className="text-amber-200">Timing unavailable/anomalous — see details.</p>}
            {row.kind === "event" && row.timingAnomalous && <p className="text-amber-200">Timing unavailable/anomalous.</p>}
          </td>
          <td className="p-2">{"noteNumber" in decoded ? decoded.noteNumber : "—"}</td>
          <td className="p-2">{isNote ? decoded.attackVelocity : formatMidiDiagnosticData(decoded)}</td>
          <td className="p-2">{row.kind === "note" ? row.release ? formatMidiDiagnosticSeconds(row.durationMs) : "Release not observed; duration unavailable" : "—"}</td>
          <td className="p-2">{decoded.channel ?? "—"}</td><td className="p-2" title={event.source.id}>{event.source.name} <span className="text-xs text-zinc-400">({event.source.id})</span></td>
        </tr>;
      }) : <tr><td className="p-5 text-center text-zinc-400" colSpan={8}>No retained musical events. Background MIDI is summarized above.</td></tr>}
    </tbody></table>
  </div>;
}
