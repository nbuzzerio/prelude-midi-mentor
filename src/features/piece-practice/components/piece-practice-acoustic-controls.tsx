import type { ReactNode } from "react";
import type { usePiecePracticeAcousticInput } from "../hooks/use-piece-practice-acoustic-input";
import type { PiecePracticeInputConfiguration } from "../piece-practice-acoustic-types";
import { PITCH_TOLERANCE_PRESETS, validPitchTolerance } from "../piece-practice-acoustic-validation";
import { formatPiecePracticeMidiPitch } from "../piece-practice-evidence";
import { MONOPHONIC_CONFIG } from "@/lib/audio/monophonic/pitch-analysis-types";
import type { PiecePracticeTarget } from "../piece-practice-types";
import { centsBetween, describeFrequency, equalTemperedFrequency } from "@/lib/audio/monophonic/pitch-math";
import { formatAcousticHeardPitch } from "../piece-practice-report";
import { ViolinPreflight } from "@/features/instrument-learning/components/violin-preflight";
import { AcousticAnalysisExportControls } from "@/features/acoustic-analysis/components/acoustic-analysis-export-controls";
import { PiecePracticeRecordingControls } from "./piece-practice-recording-controls";

export function PiecePracticeAcousticSetup({ configuration, preset, onPreset, onChange }: Readonly<{
  configuration: PiecePracticeInputConfiguration; preset: string; onPreset: (preset: string) => void;
  onChange: (value: PiecePracticeInputConfiguration) => void;
}>) {
  return <div className="grid gap-3">
    <label className="grid gap-1">Input<select className="min-h-11 rounded border border-zinc-600 bg-zinc-950 px-3" value={configuration.mode} onChange={(event) => onChange(event.target.value === "microphone"
      ? { mode: "microphone", instrument: "violin", pitchToleranceCents: 25 } : { mode: "keyboard" })}>
      <option value="keyboard">MIDI / Keyboard</option><option value="microphone">Microphone</option>
    </select></label>
    {configuration.mode === "microphone" && <>
      <p className="text-sm text-amber-200">Microphone practice — Provisional. Violin and ocarina currently use the same acoustic detector.</p>
      <label className="grid gap-1">Instrument<select className="min-h-11 rounded border border-zinc-600 bg-zinc-950 px-3" value={configuration.instrument} onChange={(event) => onChange({ ...configuration, instrument: event.target.value === "ocarina" ? "ocarina" : "violin" })}>
        <option value="violin">Violin</option><option value="ocarina">Ocarina</option>
      </select></label>
      <label className="grid gap-1">Pitch tolerance<select className="min-h-11 rounded border border-zinc-600 bg-zinc-950 px-3" value={preset} onChange={(event) => {
        onPreset(event.target.value);
        const value = PITCH_TOLERANCE_PRESETS[event.target.value as keyof typeof PITCH_TOLERANCE_PRESETS];
        if (value) onChange({ ...configuration, pitchToleranceCents: value });
      }}>
        {Object.entries(PITCH_TOLERANCE_PRESETS).map(([label, value]) => <option key={label} value={label}>{label} · ±{value}¢</option>)}<option value="Custom">Custom</option>
      </select></label>
      {preset === "Custom" && <label className="grid gap-1">Custom pitch tolerance (cents)<input className="min-h-11 rounded border border-zinc-600 bg-zinc-950 px-3" type="number" min={1} max={49} step={1} value={Number.isNaN(configuration.pitchToleranceCents) ? "" : configuration.pitchToleranceCents}
        aria-invalid={!validPitchTolerance(configuration.pitchToleranceCents)} onChange={(event) => onChange({ ...configuration, pitchToleranceCents: event.target.value === "" ? NaN : Number(event.target.value) })} /></label>}
      {!validPitchTolerance(configuration.pitchToleranceCents) && <p role="alert">Choose a whole-number pitch tolerance from 1 to 49 cents.</p>}
      <p className="text-sm text-zinc-300">Acceptance uses A4 = 440 Hz. A note accepted within your tolerance may still be sharp or flat. Repeated notes need a new articulation; if a bow restart is missed, leave a brief gap and try again.</p>
    </>}
  </div>;
}

export function PiecePracticeAcousticControls({ input, available, target, measureProgress }: Readonly<{
  input: ReturnType<typeof usePiecePracticeAcousticInput>; available: boolean; target?: PiecePracticeTarget | null; measureProgress?: ReactNode;
}>) {
  const active = ["requesting", "starting", "listening"].includes(input.status.state);
  const { lastAttempt, reading } = input;
  const expectedPitch = target?.attackedPitches[0];
  const expectedMidi = expectedPitch?.midiNumber ?? target?.expectedMidiNumbers[0];
  const expectedHz = expectedMidi === undefined ? null : equalTemperedFrequency(expectedMidi);
  const live = input.status.state === "listening" && reading.state === "stable" && reading.fresh && reading.ageMs !== null && reading.ageMs >= 0 && reading.ageMs <= MONOPHONIC_CONFIG.staleMs && reading.pitch
    ? describeFrequency(reading.pitch.frequencyHz) : null;
  const heard = live ? formatPiecePracticeMidiPitch(live.semitone) : null;
  const deviation = live && expectedHz ? centsBetween(live.frequencyHz, expectedHz) : null;
  const direction = deviation === null ? null : Math.abs(deviation) < 0.05 ? "CENTERED" : deviation < 0 ? "FLAT" : "SHARP";
  const pitchStatus = input.status.state !== "listening" ? "No current pitch" : reading.state === "uncertain" || reading.pitch ? "Uncertain" : "Listening";
  return <section aria-label="Microphone practice" className="grid gap-3 rounded border border-sky-400/40 p-3">
    {input.phase === "practice" && measureProgress}
    {input.phase === "practice" && <div aria-label="Live microphone pitch" className="grid min-w-0 gap-3 md:grid-cols-2">
      <div className="grid min-h-64 min-w-0 content-start gap-1 rounded-lg border-2 border-sky-300 bg-sky-950/40 p-4 text-center">
        <p className="font-bold tracking-wider">EXPECTED</p>
        <p className="break-words text-[64px] font-black leading-tight">{expectedMidi === undefined ? "—" : formatPiecePracticeMidiPitch(expectedMidi, { expectedPitches: expectedPitch ? [expectedPitch] : [] })}</p>
        <p className="break-words text-base tabular-nums">{expectedHz === null ? "No current target" : `Target frequency: ${expectedHz.toFixed(2)} Hz`}</p>
      </div>
      <div className="grid min-h-64 min-w-0 content-start gap-1 rounded-lg border-2 border-amber-300 bg-amber-950/30 p-4 text-center">
        <p className="font-bold tracking-wider">ACTUAL / HEARD</p>
        <p className="min-h-6 text-sm">{live ? "Live" : pitchStatus}</p>
        <p className="min-h-20 break-words text-[64px] font-black leading-tight">{live ? heard : "—"}</p>
        <p className="min-h-16 break-words text-2xl font-bold tabular-nums sm:text-3xl">{deviation === null ? "Cents unavailable" : `${deviation < -0.05 ? "−" : "+"}${Math.abs(deviation).toFixed(1)}¢ · ${direction}`}</p>
        <p className="min-h-6 break-words text-base tabular-nums">{live ? `Detected frequency: ${live.frequencyHz.toFixed(2)} Hz` : "Detected frequency: unavailable"}</p>
      </div>
    </div>}
    <p className="font-semibold">Microphone practice — Provisional</p>
    <div className="flex flex-wrap gap-3"><button className="min-h-11 rounded bg-sky-600 px-4 font-semibold disabled:opacity-40" type="button" disabled={active || !available} onClick={input.start}>Start Listening</button>
      <button className="min-h-11 rounded border border-zinc-500 px-4 disabled:opacity-40" type="button" disabled={!active} onClick={input.stop}>Stop Listening</button></div>
    <PiecePracticeRecordingControls listening={active} recording={input.recording} />
    <p role="status" className="min-h-12">{!available ? "End the active Practice Session before listening." : input.status.message}</p>
    {input.phase === "preflight" && <ViolinPreflight calibration={input.calibration} frequencyHz={input.calibrationHz} feedback={input.calibrationFeedback} accepted={input.calibrationAccepted}
      listening={input.status.state === "listening"} onAction={input.calibrationAction} onEnterPractice={input.enterPractice} onSkipCalibration={input.skipCalibrationAndStartPractice} />}
    {input.phase === "practice" && <p className="min-h-12 font-semibold">{input.status.state !== "listening" ? "Start Listening to play." : input.needsQuiet ? "Leave a brief quiet gap, then re-articulate." : lastAttempt && !lastAttempt.accepted && lastAttempt.targetId === target?.id ? "Outside tolerance — re-articulate to try again." : heard ? `Listening · ${heard}` : reading.pitch ? "Uncertain — waiting for a reliable pitch." : "Listening — play one note."}</p>}
    <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">Practice Details{lastAttempt ? " · Last graded attempt" : ""}</summary>
    {lastAttempt && <div className="grid gap-1 text-zinc-300">
      <p className="font-semibold">Last graded attempt</p>
      <p>Detected frequency at graded attempt: {lastAttempt.frequencyHz.toFixed(2)} Hz</p>
      <p>Expected: {lastAttempt.expectedPitches.map((pitch) => formatPiecePracticeMidiPitch(pitch.midiNumber, { expectedPitches: [pitch] })).join(", ")}</p>
      <p>Heard: {formatAcousticHeardPitch(lastAttempt)}</p>
      <p>{Math.abs(lastAttempt.centsFromExpected).toFixed(1)}¢ {lastAttempt.centsFromExpected < 0 ? "below" : "above"} expected</p>
      <p>{lastAttempt.accepted ? "✓ Accepted within" : "Outside"} ±{lastAttempt.pitchToleranceCents}¢</p>
      {!lastAttempt.accepted && <p>Re-articulate to try this target again.</p>}
    </div>}
    <p className="text-sm text-zinc-300">One note at a time. Weak bow restarts may need a brief gap. Harmonics can cause octave errors. Keep other playback quiet; use headphones if needed. Microphone audio is analyzed locally. Performance audio is recorded only when enabled, remains local until downloaded, and is never automatically uploaded by Prelude.</p>
    </details>
    <AcousticAnalysisExportControls control={input.analysis} capturing={active} />
  </section>;
}
