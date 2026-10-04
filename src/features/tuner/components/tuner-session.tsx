import { useTuner } from "../hooks/use-tuner";
import { describeTunerPitch } from "../tuner-pitch";

export default function TunerSession({ available = true }: Readonly<{ available?: boolean }>) {
  const { status, reading, start, stop } = useTuner(available);
  const active = ["requesting", "starting", "listening"].includes(status.state);
  const pitch = reading.pitch ? describeTunerPitch(reading.pitch.frequencyHz, reading.pitch.semitone) : null;
  const stable = status.state === "listening" && reading.fresh;
  const cents = pitch?.cents ?? 0;
  const displayedCents = Math.round(cents * 10) / 10 || 0;
  const tuning = Math.abs(cents) <= 5 ? "In tune" : cents < 0 ? "Flat" : "Sharp";
  const stateLabel = stable ? "Stable" : pitch ? "Uncertain — last reading" : status.state === "listening" ? "Listening" : active ? "Starting" : "Microphone off";
  return <section aria-labelledby="tuner-title" className="mx-auto w-full max-w-2xl text-white">
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6">
      <h1 className="text-2xl font-bold" id="tuner-title">Chromatic Tuner</h1>
      <p className="mt-2 text-sm text-zinc-300">Play one note at a time. A4 = 440 Hz · 12-tone equal temperament.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="min-h-11 rounded bg-sky-500 px-4 font-semibold disabled:opacity-40" disabled={active || !available} onClick={start} type="button">Start Listening</button>
        <button className="min-h-11 rounded border border-zinc-500 px-4 disabled:opacity-40" disabled={!active} onClick={stop} type="button">Stop Listening</button>
      </div>
      {!available && <p className="mt-3 text-amber-200" role="status">End the active Practice Session before listening.</p>}
      <p className="mt-3 text-sm text-zinc-300" role="status">{status.message}</p>
      <div className={`mt-6 rounded-xl border p-5 text-center ${stable ? "border-emerald-400/40" : "border-zinc-600"}`}>
        <p className={stable ? "text-emerald-300" : "text-amber-200"}>{stateLabel}</p>
        <p aria-label="Detected note" className={`mt-3 text-6xl font-semibold ${stable ? "text-white" : "text-zinc-400"}`}>{pitch ? `${pitch.name}${pitch.octave}` : "—"}</p>
        <p className="mt-3 text-lg tabular-nums">{pitch ? `${pitch.frequencyHz.toFixed(1)} Hz` : "No credible pitch yet"}</p>
        <p className="mt-2 tabular-nums">{pitch ? `${displayedCents >= 0 ? "+" : ""}${displayedCents.toFixed(1)} cents · ${tuning}${stable ? "" : " (last reading)"}` : "Waiting for a sustained note"}</p>
        <div aria-label="Tuning offset" aria-valuemax={50} aria-valuemin={-50} aria-valuenow={Math.max(-50, Math.min(50, cents))} aria-valuetext={pitch ? `${displayedCents.toFixed(1)} cents, ${tuning}${stable ? "" : ", uncertain last reading"}` : "No pitch"} className="relative mt-6 h-8 rounded bg-zinc-800" role="meter">
          <span className="absolute inset-y-0 left-1/2 w-px bg-white" />
          {pitch && <span className={`absolute inset-y-1 w-1 rounded ${stable ? "bg-emerald-300" : "bg-amber-300"}`} style={{ left: `calc(${50 + Math.max(-50, Math.min(50, cents))}% - 2px)` }} />}
        </div>
        <div className="mt-2 flex justify-between text-sm text-zinc-300"><span>Flat −50</span><span>0</span><span>Sharp +50</span></div>
      </div>
      <p className="mt-4 text-sm text-zinc-400">Estimated range: 120–2300 Hz. Harmonics can produce an octave error even with a stable reading. Keep other playback quiet.</p>
      <p className="mt-2 text-sm text-zinc-400">Audio is analyzed locally and is never recorded, uploaded, or played through speakers. Backgrounding or leaving this tuner stops listening.</p>
    </div>
  </section>;
}
