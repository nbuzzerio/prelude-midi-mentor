import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import type { PiecePracticeTarget } from "../piece-practice-types";
import type { MidiInputInfo } from "@/lib/midi/midi-transport";

export type ContinuousPolicy = Readonly<{
  version: 1; associationCapMs: number; associationPulse: number; associationGap: number;
  onTimeCapMs: number; onTimePulse: number; onTimeGap: number;
}>;
export type ContinuousExpected = Readonly<{
  target: PiecePracticeTarget; timeMs: number; associationMs: number; onTimeMs: number;
}>;
export type ContinuousPassage = Readonly<{
  version: 1; score: StaffBuilderScore; start: number; end: number; bpm: number;
  meter: "3/4" | "4/4" | "6/8"; pulseMs: number; pulsesPerBar: number;
  measureMs: number; durationMs: number; tailMs: number; policy: ContinuousPolicy;
  expected: readonly ContinuousExpected[];
}>;
export type ContinuousAttack = Readonly<{
  id: number; midi: number; channel: number; velocity: number; timeMs: number;
  sourceTimeStampMs: number | null; receivedAtMs: number; audioTimeSeconds: number;
  uncertaintyMs: number | null; input: MidiInputInfo; source: "physical-midi";
}>;
export type ContinuousTiming = "on-time" | "early" | "late" | "uncertain";
export type ContinuousPitchResult = Readonly<{
  midi: number; attackId: number | null; outcome: "correct" | "wrong" | "missing" | "unobserved";
  timing: ContinuousTiming | null; offsetMs: number | null;
}>;
export type ContinuousGroupResult = Readonly<{
  targetId: string; measureIndex: number; eventIds: readonly string[]; timeMs: number;
  pitches: readonly ContinuousPitchResult[]; partialChord: boolean;
}>;
export type ContinuousAssessment = Readonly<{
  groups: readonly ContinuousGroupResult[]; extras: readonly number[];
  expected: number; matched: number; wrong: number; missing: number; unobserved: number;
  early: number; late: number; onTime: number; uncertain: number;
}>;
export type ContinuousAttempt = Readonly<{
  version: 1; id: string; revision: number; passage: ContinuousPassage; input: MidiInputInfo;
  status: "started" | "completed" | "stopped" | "failed" | "interrupted";
  startedAt: string; endedAt: string | null; performanceStartedAt: string | null;
  observedThroughMs: number; reason: string | null; attacks: readonly ContinuousAttack[];
  assessment: ContinuousAssessment | null;
  terminalSaveAttempts: number;
}>;
export type ContinuousStore = Readonly<{
  save: (attempt: ContinuousAttempt) => Promise<void>;
  list: () => Promise<readonly ContinuousAttempt[]>;
}>;
