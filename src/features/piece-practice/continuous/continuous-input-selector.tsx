import { useEffect, useState } from "react";
import type { MidiInputInfo } from "@/lib/midi/midi-transport";
import { loadContinuousInputPreference, resolveContinuousInput, saveContinuousInputPreference } from "./continuous-input-preference";

export function ContinuousInputSelector({ inputs, onSelection, disabled = false }: Readonly<{
  inputs: readonly MidiInputInfo[]; onSelection: (input: MidiInputInfo | null) => void; disabled?: boolean;
}>) {
  const [preference, setPreference] = useState(() => loadContinuousInputPreference());
  const selected = resolveContinuousInput(preference.input, inputs);
  useEffect(() => { onSelection(selected); }, [selected, onSelection]);
  return <div className="grid min-w-0 max-w-xl gap-2">
    <label className="grid gap-1">Physical MIDI Input<select className="min-h-11 w-full min-w-0 rounded border border-zinc-500 bg-zinc-950 p-2"
      value={selected?.id ?? ""} disabled={disabled} onChange={e => {
        const input = inputs.find(i => i.id === e.target.value) ?? null;
        setPreference(saveContinuousInputPreference(input));
        onSelection(input); // Keep Prepare in the same commit as an explicit device change.
      }}>
      <option value="">Select a physical MIDI input</option>
      {inputs.map((input, index) => <option key={`${input.id}-${index}`} value={input.id ?? `unavailable-${index}`}
        disabled={!input.id || inputs.filter(i => i.id === input.id).length !== 1}>
        {input.name ?? "Unnamed MIDI input"} · {input.id || "browser identity unavailable"}
      </option>)}
    </select></label>
    {preference.input && !selected && <p role="alert">The selected MIDI input ({preference.input.name ?? preference.input.id}) is unavailable or its identity changed. Reconnect it or deliberately select an input. No other port has been substituted.</p>}
    {preference.message && <p role="status">{preference.message}</p>}
    {!inputs.length && <p>No MIDI inputs available. Connect your piano and allow MIDI access.</p>}
  </div>;
}
