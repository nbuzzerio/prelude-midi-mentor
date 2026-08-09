import { useState } from "react";

export function StaffBuilderTempoControl({ tempoBpm, onTempoChange }: Readonly<{
  tempoBpm: number;
  onTempoChange: (tempoBpm: number) => unknown;
}>) {
  return <StaffBuilderTempoDraftControl key={tempoBpm} onTempoChange={onTempoChange} tempoBpm={tempoBpm} />;
}

function StaffBuilderTempoDraftControl({ tempoBpm, onTempoChange }: Readonly<{
  tempoBpm: number;
  onTempoChange: (tempoBpm: number) => unknown;
}>) {
  const [draft, setDraft] = useState(String(tempoBpm));

  const commit = () => {
    const nextTempo = Number(draft);
    if (!/^\d+$/.test(draft) || !Number.isInteger(nextTempo) || nextTempo < 40 || nextTempo > 240) {
      setDraft(String(tempoBpm));
      return;
    }
    if (nextTempo !== tempoBpm) onTempoChange(nextTempo);
  };

  return <label className="staff-builder-tempo-control">
    <span>Tempo</span>
    <span className="staff-builder-tempo-input">
      <input
        aria-label="Tempo"
        aria-describedby="staff-builder-tempo-unit"
        inputMode="numeric"
        max={240}
        min={40}
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); commit(); }
          if (event.key === "Escape") { event.preventDefault(); setDraft(String(tempoBpm)); }
        }}
        step={1}
        type="number"
        value={draft}
      />
      <span id="staff-builder-tempo-unit">BPM</span>
    </span>
  </label>;
}
