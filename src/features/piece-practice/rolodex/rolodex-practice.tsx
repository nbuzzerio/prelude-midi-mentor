import { useCallback, useContext, useRef, useState } from "react";
import { AppMidiContext } from "@/components/midi/midi-context";
import MidiStatus from "@/components/midi/midi-status";
import { ContinuousPlayer } from "../continuous/continuous-workspace";
import { continuousStore } from "../continuous/continuous-store";
import type { ContinuousAttempt, ContinuousStore } from "../continuous/continuous-types";
import { playablePassage, playability } from "./rolodex-model";
import { rolodexButton, rolodexField } from "./rolodex-editor";
import { rolodexStore } from "./rolodex-store";
import type { RolodexEntry, RolodexPractice as PracticeAcknowledgement, RolodexStore } from "./rolodex-types";
import type { MidiInputInfo } from "@/lib/midi/midi-transport";

export function RolodexPractice({ entry, store = rolodexStore, attempts = continuousStore, onExit, onGuardChange }: Readonly<{
  entry: RolodexEntry; store?: RolodexStore; attempts?: ContinuousStore; onExit: () => void;
  onGuardChange?: (guard: (() => boolean) | null) => void;
}>) {
  const midi = useContext(AppMidiContext);
  const [inputId, setInputId] = useState("");
  const [input, setInput] = useState<MidiInputInfo | null>(null);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState<readonly PracticeAcknowledgement[]>([]);
  const [notice, setNotice] = useState("");
  const seen = useRef(new Set<string>()), inFlight = useRef(new Set<string>());
  const retry = useCallback((practice: PracticeAcknowledgement) => {
    if (inFlight.current.has(practice.attemptId)) return;
    inFlight.current.add(practice.attemptId); setPending(n => n + 1);
    void store.acknowledge(entry.id, practice).then(() => {
      setFailed(old => old.filter(p => p.attemptId !== practice.attemptId));
      setNotice("Rolodex practice date saved locally.");
    }, () => {
      setFailed(old => old.some(p => p.attemptId === practice.attemptId) ? old : [...old, practice]);
      setNotice("A1 performance is saved. The separate Rolodex practice date was not saved.");
    }).finally(() => { inFlight.current.delete(practice.attemptId); setPending(n => n - 1); });
  }, [entry.id, store]);
  const acknowledged = useCallback((attempt: ContinuousAttempt) => {
    if (attempt.status === "started" || !attempt.endedAt || !attempt.performanceStartedAt || seen.current.has(attempt.id)) return;
    seen.current.add(attempt.id);
    retry({ attemptId: attempt.id, prescriptionRevision: entry.prescriptionRevision, endedAt: attempt.endedAt,
      outcome: attempt.status, instrument: "piano", inputSource: "physical-midi", inputId: attempt.input.id });
  }, [entry.prescriptionRevision, retry]);
  const registerGuard = useCallback((guard: (() => boolean) | null) => {
    onGuardChange?.(guard ? () => {
      if (!guard() || pending > 0) return false;
      return !failed.length || window.confirm("A1 performances are saved. Leave without retrying the separate Rolodex practice-date update?");
    } : null);
  }, [onGuardChange, pending, failed.length]);
  const exit = () => {
    if (pending) return;
    if (failed.length && !window.confirm("A1 performances are saved. Leave without retrying their separate Rolodex practice dates?")) return;
    onExit();
  };
  const unavailable = playability(entry);
  const [passage] = useState(() => { try { return playablePassage(entry); } catch { return null; } });
  const inputs = midi?.connectedInputs.filter(i => i.id !== null) ?? [];
  const selected = inputs.find(i => i.id === inputId) ?? (inputId === "" ? inputs[0] : undefined);
  return <section className="grid min-w-0 gap-3">
    <h1 className="text-2xl font-bold">Practice Rolodex · {entry.nickname || entry.sourceTitle}</h1>
    {unavailable && <p role="alert">{unavailable}</p>}
    {notice && <p role="status">{notice}</p>}
    {pending > 0 && <p role="status">Updating separate Rolodex practice date…</p>}
    {failed.length > 0 && <button type="button" className={rolodexButton} disabled={pending > 0} onClick={() => failed.forEach(retry)}>Retry Rolodex Update ({failed.length})</button>}
    {!input && <>
      <p>Measures {entry.start + 1}–{entry.end + 1} · {entry.bpm} quarter BPM · Piano Continuous Tempo. Music comes from the saved snapshot.</p>
      {midi && <MidiStatus deviceName={midi.deviceName} error={midi.error} status={midi.status} onConnect={() => { void midi.connectMidi(); }} />}
      <label className="grid gap-1">Physical MIDI piano<select className={rolodexField} value={selected?.id ?? ""} onChange={e => setInputId(e.target.value)}>
        {!inputs.length && <option value="">No MIDI piano connected</option>}{inputs.map(i => <option key={i.id} value={i.id!}>{i.name ?? i.id}</option>)}</select></label>
      <p>Connect a physical MIDI piano and allow MIDI access. Virtual keys and microphones cannot start this profile.</p>
      <button className={rolodexButton} type="button" disabled={Boolean(unavailable) || !selected || midi?.status !== "connected"} onClick={() => { if (selected && !playability(entry)) setInput(selected); }}>Prepare Saved Passage</button>
      <button className={rolodexButton} onClick={exit} type="button" disabled={pending > 0}>Return to Rolodex</button>
    </>}
    {input && passage && !unavailable && <ContinuousPlayer passage={passage} input={input} store={attempts} onExit={exit} onGuardChange={registerGuard} onAcknowledgedAttempt={acknowledged} />}
  </section>;
}
