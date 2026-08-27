import { MELODY_PHASE_ONE_METER } from "./melody-meter";
import { getMelodyPreparatoryLeadIn } from "./melody-preparatory-lead-in";
import { getMelodyQuarterBeatSeconds } from "./melody-timing";
import type { MelodyExercise } from "./melody-types";

export type MelodyScheduledBeat = Readonly<{
  phase: "count-in" | "performance";
  measureIndex: number | null;
  beatIndex: number;
  relativeTimeSeconds: number;
  accented: boolean;
}>;

export function createMelodyMetronomeSchedule(exercise: MelodyExercise): readonly MelodyScheduledBeat[] {
  const beatSeconds = getMelodyQuarterBeatSeconds(exercise.settings.tempoBpm);
  const leadIn = getMelodyPreparatoryLeadIn(MELODY_PHASE_ONE_METER.timeSignature);
  const leadInPulseSeconds = (leadIn.pulseTicks / MELODY_PHASE_ONE_METER.beatTicks) * beatSeconds;
  const countIn = Array.from({ length: leadIn.pulseCount }, (_, beatIndex) => Object.freeze({
    phase: "count-in" as const, measureIndex: null, beatIndex, relativeTimeSeconds: beatIndex * leadInPulseSeconds, accented: beatIndex === 0,
  }));
  const performance = exercise.measures.flatMap((measure) => Array.from({ length: 4 }, (_, beatIndex) => Object.freeze({
    phase: "performance" as const, measureIndex: measure.measureIndex, beatIndex,
    relativeTimeSeconds: leadIn.durationTicks / MELODY_PHASE_ONE_METER.beatTicks * beatSeconds + (measure.measureIndex * 4 + beatIndex) * beatSeconds,
    accented: beatIndex === 0,
  })));
  return Object.freeze([...countIn, ...performance]);
}

export type MelodyAudioParamLike = Readonly<{
  setValueAtTime: (value: number, startTime: number) => unknown;
  exponentialRampToValueAtTime: (value: number, endTime: number) => unknown;
}>;
export type MelodyOscillatorNodeLike = {
  frequency: MelodyAudioParamLike;
  type: OscillatorType;
  connect: (destination: unknown) => unknown;
  disconnect: () => void;
  start: (when?: number) => void;
  stop: (when?: number) => void;
};
export type MelodyGainNodeLike = Readonly<{
  gain: MelodyAudioParamLike;
  connect: (destination: unknown) => unknown;
  disconnect: () => void;
}>;
export type MelodyAudioContextLike = Readonly<{
  currentTime: number;
  state: AudioContextState;
  destination: unknown;
  createOscillator: () => MelodyOscillatorNodeLike;
  createGain: () => MelodyGainNodeLike;
  resume: () => Promise<void>;
}>;

export type MelodyScheduledClick = Readonly<{ oscillator: MelodyOscillatorNodeLike; gain: MelodyGainNodeLike }>;

const CLICK_DURATION_SECONDS = 0.045;
const CLICK_END_GAIN = 0.0001;

function cleanUpMelodyAudioNodes(
  oscillator: MelodyOscillatorNodeLike | undefined,
  gain: MelodyGainNodeLike | undefined,
): void {
  try { oscillator?.stop(); } catch { /* A node may reject a stop after scheduling or completion. */ }
  try { oscillator?.disconnect(); } catch { /* Cleanup must preserve the original scheduling failure. */ }
  try { gain?.disconnect(); } catch { /* Cleanup must preserve the original scheduling failure. */ }
}

export function cleanUpMelodyScheduledClick(click: MelodyScheduledClick): void {
  cleanUpMelodyAudioNodes(click.oscillator, click.gain);
}

export function scheduleMelodyMetronomeClick(context: MelodyAudioContextLike, atSeconds: number, accented: boolean): MelodyScheduledClick {
  let oscillator: MelodyOscillatorNodeLike | undefined;
  let gain: MelodyGainNodeLike | undefined;
  try {
    oscillator = context.createOscillator();
    gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(accented ? 1320 : 880, atSeconds);
    gain.gain.setValueAtTime(accented ? 0.22 : 0.13, atSeconds);
    gain.gain.exponentialRampToValueAtTime(CLICK_END_GAIN, atSeconds + CLICK_DURATION_SECONDS);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(atSeconds);
    oscillator.stop(atSeconds + CLICK_DURATION_SECONDS);
    return { oscillator, gain };
  } catch (error) {
    cleanUpMelodyAudioNodes(oscillator, gain);
    throw error;
  }
}
