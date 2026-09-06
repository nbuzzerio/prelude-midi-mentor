import type { ReactNode } from "react";
import { MELODY_TEMPOS, type MelodySettings } from "../melody-types";
import { MELODY_CONTINUOUS_DURATION_MINUTES, type MelodyContinuousDurationMinutes } from "../melody-continuous-practice";

/** Controlled generation fields; children keep optional standalone practice options in the same layout. */
export function MelodySettingsControls({ settings, onChange, children }: Readonly<{
  settings: MelodySettings;
  onChange: <K extends keyof MelodySettings>(key: K, value: MelodySettings[K]) => void;
  children?: ReactNode;
}>) {
  return <fieldset className="melody-settings grid gap-3 rounded-xl bg-zinc-900 p-4 sm:grid-cols-4"><legend>Exercise settings</legend>
      <label>Staff<select aria-label="Staff" onChange={(event) => onChange("staff", event.target.value as MelodySettings["staff"])} value={settings.staff}><option value="treble">Treble</option><option value="bass">Bass</option></select></label>
      <label>Key<select aria-label="Key" onChange={(event) => onChange("keyId", event.target.value as MelodySettings["keyId"])} value={settings.keyId}><option value="c-major">C major</option><option value="g-major">G major</option><option value="f-major">F major</option><option value="a-minor">A minor</option><option value="d-minor">D minor</option></select></label>
      <label>Tempo<select aria-label="Tempo" onChange={(event) => onChange("tempoBpm", Number(event.target.value) as MelodySettings["tempoBpm"])} value={settings.tempoBpm}>{MELODY_TEMPOS.map((bpm) => <option key={bpm} value={bpm}>{bpm} BPM</option>)}</select></label>
      <label>Length<select aria-label="Length" onChange={(event) => onChange("measureCount", Number(event.target.value) as 1 | 2)} value={settings.measureCount}><option value={1}>1 measure</option><option value={2}>2 measures</option></select></label>
    {children}
  </fieldset>;
}

/** Static timed-practice options, independent of the clock and diagnostic lifecycle. */
export function MelodyPracticeOptions({ continuousPractice, continuousDurationMinutes, onContinuousPracticeChange, onDurationChange }: Readonly<{
  continuousPractice: boolean;
  continuousDurationMinutes: MelodyContinuousDurationMinutes;
  onContinuousPracticeChange: (value: boolean) => void;
  onDurationChange: (value: MelodyContinuousDurationMinutes) => void;
}>) {
  return <>
      <label className="flex items-center gap-2"><input checked={continuousPractice} onChange={(event) => onContinuousPracticeChange(event.target.checked)} type="checkbox" />Continuous Practice</label>
      {continuousPractice && <label>Session duration<select aria-label="Session duration" onChange={(event) => onDurationChange(Number(event.target.value) as MelodyContinuousDurationMinutes)} value={continuousDurationMinutes}>{MELODY_CONTINUOUS_DURATION_MINUTES.map((minutes) => <option key={minutes} value={minutes}>{minutes} {minutes === 1 ? "minute" : "minutes"}</option>)}</select></label>}
  </>;
}
