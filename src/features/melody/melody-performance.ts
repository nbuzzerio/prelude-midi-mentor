import type { MelodyPerformanceClock } from "./melody-clock";
import { getMelodyAlignmentCandidateWindowMs } from "./melody-alignment";
import type { MelodyExercise } from "./melody-types";

export type MelodyInputSource = "midi" | "virtual";

export type MelodyPerformedAttack = Readonly<{
  id: string;
  midiNumber: number;
  source: MelodyInputSource;
  audioTimeSeconds: number;
  relativeTimeMs: number;
  sequenceIndex: number;
}>;

export type MelodyPerformanceRecorder = Readonly<{
  recordAttack: (midiNumber: number, source: MelodyInputSource) => MelodyPerformedAttack | null;
  getAttacks: () => readonly MelodyPerformedAttack[];
  getLockedSource: () => MelodyInputSource | null;
  reset: () => void;
}>;

type MelodyCaptureClock = Pick<
  MelodyPerformanceClock,
  "performanceStartedAtSeconds" | "evaluationEndsAtSeconds" | "nowSeconds"
>;

export function createMelodyPerformanceRecorder(
  exercise: MelodyExercise,
  clock: MelodyCaptureClock,
): MelodyPerformanceRecorder {
  let attacks: MelodyPerformedAttack[] = [];
  let lockedSource: MelodyInputSource | null = null;
  const captureStartsAtSeconds = clock.performanceStartedAtSeconds
    - getMelodyAlignmentCandidateWindowMs(exercise.settings.tempoBpm) / 1000;

  return Object.freeze({
    recordAttack(midiNumber, source) {
      const audioTimeSeconds = clock.nowSeconds();
      if (audioTimeSeconds < captureStartsAtSeconds || audioTimeSeconds >= clock.evaluationEndsAtSeconds) return null;
      if (lockedSource !== null && lockedSource !== source) return null;
      if (lockedSource === null) lockedSource = source;
      const sequenceIndex = attacks.length;
      const attack = Object.freeze({
        id: `${exercise.id}-performed-${sequenceIndex}`,
        midiNumber,
        source,
        audioTimeSeconds,
        relativeTimeMs: (audioTimeSeconds - clock.performanceStartedAtSeconds) * 1000,
        sequenceIndex,
      });
      attacks = [...attacks, attack];
      return attack;
    },
    getAttacks: () => Object.freeze([...attacks]),
    getLockedSource: () => lockedSource,
    reset() {
      attacks = [];
      lockedSource = null;
    },
  });
}
