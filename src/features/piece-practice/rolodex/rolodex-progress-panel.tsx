import { useContext, useState } from "react";
import { AppMidiContext } from "@/components/midi/midi-context";
import { CONTINUOUS_POLICY } from "../continuous/continuous-projection";
import { comparableHistory } from "./rolodex-history";
import { progressState } from "./rolodex-progress";
import type { RolodexAcceptance } from "./rolodex-progress-types";
import type { RolodexEntry } from "./rolodex-types";

export function RolodexProgressPanel({ entry, acceptance }: Readonly<{ entry: RolodexEntry; acceptance?: RolodexAcceptance | null }>) {
  if (entry.practiceInstrument !== "piano" || !entry.eligibleInstruments.includes("piano")) {
    return <p className="text-sm">Qualification is unavailable for the selected {entry.practiceInstrument} profile. Only explicitly selected Piano continuous practice with physical MIDI can earn pitch-and-onset qualification. Earlier target evidence is preserved.</p>;
  }
  const state = progressState(entry, acceptance);
  return <div className="min-w-0 space-y-2" aria-label="Pitch and onset progress">
    <p>{state.stage === "mastered" ? "Mastered at the defined pitch-and-onset target" : state.stage === "retention" ? "Retention Check" : state.stage === "improving" ? "Improving" : "Needs Practice"}
      {state.restored ? " · restored historical state" : ""} · {entry.bpm} BPM · Piano Continuous Tempo</p>
    <p>{state.clean.length}/3 qualifying clean runs{state.stage === "mastered" ? " · later-day retention recorded" : ""}.</p>
    <p>{state.stage === "mastered" ? "Retired from ordinary rotation for this target. Reactivate whenever useful."
      : state.stage === "retention" ? `Next: a qualifying retention performance on a local day after ${state.dueAfter}. No missed-day penalty.`
      : "Next: another confidently clean completed performance under an accepted physical timing context."}</p>
    {!state.clean.length && <p className="text-sm">Provisional performances do not earn automatic qualification. Physical timing acceptance defaults off.</p>}
    <details><summary className="min-h-11 cursor-pointer py-2">Comparable history and qualification criteria</summary>
      {comparableHistory(entry).map(line => <p key={line} className="my-2 break-words text-sm">{line}</p>)}
      <p className="text-sm">A qualifying run completes every selected measure with at least one expected attack, all expected pitches confidently on time, and no wrong, missing, extra, uncertain or unobserved attacks. The exact music, target BPM, instrument, policy and accepted physical MIDI device must match. Stopped or inconclusive attempts do not erase credit.</p>
      <p className="text-sm">Latest 32 summaries plus up to four decisive qualification/retention summaries are retained. Raw A1 records have separate retention. These measurements do not assess fingering, hands, pedal, note duration, articulation or expression.</p>
    </details>
  </div>;
}

/** Explicit local owner action; connecting MIDI or loading this disclosure never enables it. */
export function RolodexAcceptanceControl({ acceptance, busy, onSave }: Readonly<{
  acceptance: RolodexAcceptance | null; busy: boolean; onSave: (next: RolodexAcceptance) => void;
}>) {
  const midi = useContext(AppMidiContext);
  const [inputId, setInputId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const connected = midi?.connectedInputs.filter(i => i.id) ?? [];
  return <details><summary className="min-h-11 cursor-pointer py-2">Physical timing acceptance · {acceptance?.enabled ? "enabled for the accepted context" : "automatic qualification OFF"}</summary>
    <p>Only enable after owner acceptance with a real MIDI piano. Synthetic QA is insufficient. This accepts the current default A1 policy for the explicitly selected device, in this browser. Future attempts only; earlier provisional results stay provisional.</p>
    <p>Recheck acceptance after changes to the piano, browser or audio/output setup. Device identity does not measure or calibrate latency.</p>
    {acceptance && <p className="break-words text-sm">Accepted context: {acceptance.inputId} · policy {acceptance.policy.version} · {acceptance.acceptedAt}. Historical records keep their own provenance.</p>}
    <label className="my-2 grid gap-1">Physically tested MIDI device<select className="min-h-11 rounded border bg-zinc-950 p-2" disabled={busy} value={inputId} onChange={e => { setInputId(e.target.value); setConfirmed(false); }}>
      <option value="">Choose the physically tested device</option>{connected.map(i => <option value={i.id!} key={i.id}>{i.name ?? i.id}</option>)}
    </select></label>
    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" disabled={busy} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I completed real MIDI-piano QA and accept pitch/onset timing for this device and policy.</label>
    <button type="button" className="min-h-11 rounded border px-3 py-2 disabled:opacity-40" disabled={busy || !confirmed || !connected.some(i => i.id === inputId)} onClick={() => {
      onSave({ version: 1, generation: crypto.randomUUID(), enabled: true, acceptedAt: new Date().toISOString(), inputId, policy: CONTINUOUS_POLICY }); setConfirmed(false);
    }}>Enable Future Qualification</button>
    {acceptance?.enabled && <button type="button" className="m-2 min-h-11 rounded border px-3 py-2" disabled={busy} onClick={() => onSave({ ...acceptance, enabled: false, generation: crypto.randomUUID(), acceptedAt: new Date().toISOString() })}>Disable Automatic Qualification</button>}
  </details>;
}
