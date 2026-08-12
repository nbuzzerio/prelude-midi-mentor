import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MidiStatus from "@/components/midi/midi-status";
import PianoKeyboard from "@/components/notation/piano-keyboard";
import { StaffBuilderScoreView } from "@/features/staff-builder/components/staff-builder-score-view";
import { STAFF_BUILDER_TICKS_PER_QUARTER } from "@/features/staff-builder/staff-builder-time";
import { useAppMidiInput } from "@/hooks/use-app-midi-input";
import { createMelodyBrowserAudioContext, type MelodyOwnedAudioContext } from "../melody-browser-audio";
import { createMelodyPerformanceClock, type MelodyPerformanceClock } from "../melody-clock";
import { projectMelodyExerciseToDisplayScore } from "../melody-display-score";
import { generateMelodyExercise } from "../melody-generator";
import { MELODY_PHASE_ONE_METER } from "../melody-meter";
import { createMelodyPerformanceRecorder, type MelodyPerformanceRecorder } from "../melody-performance";
import { evaluateMelodyAttempt, type MelodyAttemptResult } from "../melody-scoring";
import { getMelodyPerformancePhase } from "../melody-timing";
import { DEFAULT_MELODY_SETTINGS, type MelodyExercise, type MelodySeed, type MelodySettings } from "../melody-types";
import { MelodyCountGuide } from "./melody-count-guide";
import { MelodyResults } from "./melody-results";

type MelodyPresentationState = "setup" | "starting" | "count-in" | "performing" | "results";
type MelodyAudioFactory = typeof createMelodyBrowserAudioContext;
let runtimeSeedCounter = 0;
const defaultSeedFactory = (): MelodySeed => `melody-runtime-${Date.now()}-${runtimeSeedCounter++}`;
const EMPTY = new Set<number>();

export default function MelodySession({ seedFactory = defaultSeedFactory, createAudioContext = createMelodyBrowserAudioContext }: Readonly<{ seedFactory?: () => MelodySeed; createAudioContext?: MelodyAudioFactory }>) {
  const [settings, setSettings] = useState<MelodySettings>(DEFAULT_MELODY_SETTINGS);
  const [exercise, setExercise] = useState<MelodyExercise>(() => generateMelodyExercise(DEFAULT_MELODY_SETTINGS, seedFactory()));
  const [presentation, setPresentation] = useState<MelodyPresentationState>("setup");
  const [result, setResult] = useState<MelodyAttemptResult | null>(null);
  const [statusMessage, setStatusMessage] = useState("Ready to start.");
  const [audioError, setAudioError] = useState<string | null>(null);
  const [activeTick, setActiveTick] = useState<number | undefined>();
  const [countInBeat, setCountInBeat] = useState(1);
  const [activeVirtual, setActiveVirtual] = useState<ReadonlySet<number>>(EMPTY);
  const [lockedSource, setLockedSource] = useState<"midi" | "virtual" | null>(null);
  const clockRef = useRef<MelodyPerformanceClock | null>(null);
  const audioContextRef = useRef<MelodyOwnedAudioContext | null>(null);
  const recorderRef = useRef<MelodyPerformanceRecorder | null>(null);
  const animationRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const score = useMemo(() => projectMelodyExerciseToDisplayScore(exercise), [exercise]);
  const reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cancelAttempt = useCallback(() => {
    generationRef.current += 1;
    clockRef.current?.cancel();
    clockRef.current = null;
    recorderRef.current = null;
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    setActiveTick(undefined);
    setActiveVirtual(EMPTY);
    setLockedSource(null);
  }, []);

  useEffect(() => () => {
    cancelAttempt();
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (!context?.close) return;
    try { void context.close().catch(() => undefined); } catch { /* Browser audio teardown is best-effort. */ }
  }, [cancelAttempt]);
  useEffect(() => { if (presentation === "results") resultsHeadingRef.current?.focus(); }, [presentation]);

  function sampleClock(generation: number) {
    const clock = clockRef.current;
    if (!clock || generation !== generationRef.current) return;
    const now = clock.nowSeconds();
    const phase = getMelodyPerformancePhase(clock, now);
    if (phase === "complete") {
      const recorder = recorderRef.current;
      if (!recorder) return;
      const nextResult = evaluateMelodyAttempt(exercise, recorder.getAttacks());
      clock.cancel();
      clockRef.current = null;
      recorderRef.current = null;
      setActiveTick(undefined);
      setResult(nextResult);
      setPresentation("results");
      setStatusMessage("Exercise complete. Results are ready.");
      return;
    }
    if (phase === "count-in") {
      setPresentation("count-in");
      setStatusMessage("Count in started.");
      setCountInBeat(Math.max(1, Math.min(4, Math.floor((now - clock.countInStartedAtSeconds) / clock.quarterBeatSeconds) + 1)));
      setActiveTick(undefined);
    } else {
      setPresentation("performing");
      setStatusMessage("Performance started.");
      const rawTick = ((now - clock.performanceStartedAtSeconds) / clock.quarterBeatSeconds) * STAFF_BUILDER_TICKS_PER_QUARTER;
      const clamped = Math.max(0, Math.min(exercise.measures.length * MELODY_PHASE_ONE_METER.capacityTicks, rawTick));
      setActiveTick(reducedMotion ? Math.floor(clamped / MELODY_PHASE_ONE_METER.subdivisionTicks) * MELODY_PHASE_ONE_METER.subdivisionTicks : clamped);
    }
    animationRef.current = requestAnimationFrame(() => sampleClock(generation));
  }

  const start = async () => {
    cancelAttempt();
    const generation = generationRef.current;
    setAudioError(null);
    setResult(null);
    setPresentation("starting");
    try {
      let audioContext = audioContextRef.current;
      if (!audioContext) {
        audioContext = createAudioContext();
        audioContextRef.current = audioContext;
      }
      const clock = await createMelodyPerformanceClock(exercise, audioContext);
      if (generation !== generationRef.current) { clock.cancel(); return; }
      clockRef.current = clock;
      recorderRef.current = createMelodyPerformanceRecorder(exercise, clock);
      setPresentation("count-in");
      setStatusMessage("Count in started.");
      animationRef.current = requestAnimationFrame(() => sampleClock(generation));
    } catch {
      if (generation !== generationRef.current) return;
      setPresentation("setup");
      setAudioError("Prelude couldn't start the Melody audio clock. Try again.");
      setStatusMessage("Melody audio could not start.");
    }
  };

  const record = useCallback((midiNumber: number, source: "midi" | "virtual") => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorder.recordAttack(midiNumber, source);
    setLockedSource(recorder.getLockedSource());
  }, []);
  const midi = useAppMidiInput({ onNotePlayed: (midiNumber) => record(midiNumber, "midi") });

  const replaceExercise = (nextSettings: MelodySettings, seed: MelodySeed) => {
    cancelAttempt();
    setSettings(nextSettings);
    setExercise(generateMelodyExercise(nextSettings, seed));
    setResult(null);
    setPresentation("setup");
    setStatusMessage("Ready to start.");
  };
  const changeSetting = <K extends keyof MelodySettings>(key: K, value: MelodySettings[K]) => replaceExercise({ ...settings, [key]: value }, seedFactory());
  const retrySame = () => { cancelAttempt(); setResult(null); setPresentation("setup"); setStatusMessage("Ready to retry the same melody."); };
  const tryAnother = () => replaceExercise(settings, seedFactory());
  const returnSettings = () => { cancelAttempt(); setResult(null); setPresentation("setup"); setStatusMessage("Settings ready."); };

  const currentMeasureIndex = activeTick === undefined ? 0 : Math.min(exercise.measures.length - 1, Math.floor(activeTick / MELODY_PHASE_ONE_METER.capacityTicks));
  const measureTick = activeTick === undefined ? undefined : activeTick - currentMeasureIndex * MELODY_PHASE_ONE_METER.capacityTicks;
  const range = settings.staff === "treble" ? { min: 60, max: 72 } : { min: 48, max: 60 };

  return <section className="mx-auto max-w-6xl space-y-5 text-zinc-100" data-testid="melody-session">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Melody</h1><p>Read ahead, keep the pulse, and play through mistakes.</p></div><MidiStatus deviceName={midi.deviceName} error={midi.error} onConnect={midi.connectMidi} status={midi.status} /></header>
    <p aria-live="polite" className="sr-only">{statusMessage}</p>
    {presentation === "setup" && <fieldset className="grid gap-3 rounded-xl bg-zinc-900 p-4 sm:grid-cols-4"><legend>Exercise settings</legend>
      <label>Staff<select aria-label="Staff" onChange={(event) => changeSetting("staff", event.target.value as MelodySettings["staff"])} value={settings.staff}><option value="treble">Treble</option><option value="bass">Bass</option></select></label>
      <label>Key<select aria-label="Key" onChange={(event) => changeSetting("keyId", event.target.value as MelodySettings["keyId"])} value={settings.keyId}><option value="c-major">C major</option><option value="g-major">G major</option><option value="f-major">F major</option><option value="a-minor">A minor</option><option value="d-minor">D minor</option></select></label>
      <label>Tempo<select aria-label="Tempo" onChange={(event) => changeSetting("tempoBpm", Number(event.target.value) as MelodySettings["tempoBpm"])} value={settings.tempoBpm}>{[50, 60, 70, 80].map((bpm) => <option key={bpm} value={bpm}>{bpm} BPM</option>)}</select></label>
      <label>Length<select aria-label="Length" onChange={(event) => changeSetting("measureCount", Number(event.target.value) as 1 | 2)} value={settings.measureCount}><option value={1}>1 measure</option><option value={2}>2 measures</option></select></label>
    </fieldset>}
    {presentation !== "results" && <><div className="overflow-x-auto"><div className="grid min-w-[42rem] gap-3" style={{ gridTemplateColumns: `repeat(${exercise.measures.length}, minmax(0, 1fr))` }}>{exercise.measures.map((measure) => <StaffBuilderScoreView key={measure.id} measureIndex={measure.measureIndex} playbackPosition={currentMeasureIndex === measure.measureIndex && measureTick !== undefined ? { offsetTicks: measureTick } : undefined} score={score} visibleStaff={settings.staff} />)}</div><MelodyCountGuide activeAbsoluteTick={activeTick} measureCount={settings.measureCount} /></div>
      {presentation === "setup" && <button className="rounded bg-sky-500 px-4 py-2 font-semibold" onClick={() => void start()} type="button">Start Exercise</button>}
      {presentation === "starting" && <p>Starting audio…</p>}
      {presentation === "count-in" && <p className="text-xl"><strong>Count in</strong> {countInBeat}</p>}
      {presentation === "performing" && <p className="text-xl"><strong>Play</strong>{lockedSource ? ` · Input: ${lockedSource === "midi" ? "MIDI" : "On-screen keyboard"}` : ""}</p>}
      {audioError && <p role="alert" className="text-red-300">{audioError}</p>}
      <PianoKeyboard activeMidiNumbers={activeVirtual} failedMidiNumbers={EMPTY} lastAnswer={null} maxMidi={range.max} minMidi={range.min} onNotePress={(note) => { setActiveVirtual((current) => new Set(current).add(note)); record(note, "virtual"); }} onNoteRelease={(note) => setActiveVirtual((current) => { const next = new Set(current); next.delete(note); return next; })} onNoteToggle={(note) => record(note, "virtual")} targetMidiNumbers={EMPTY} visualMode="freeplay" /></>}
    {presentation === "results" && result && <MelodyResults onRetrySame={retrySame} onSettings={returnSettings} onTryAnother={tryAnother} ref={resultsHeadingRef} result={result} />}
  </section>;
}
