import { STAFF_BUILDER_TICKS_PER_QUARTER } from "@/features/staff-builder/staff-builder-time";
import type { PiecePracticeAttackedPitch, PiecePracticePiece, PiecePracticeTarget } from "./piece-practice-types";

export const PIECE_PRACTICE_HESITATION_MINIMUM_MS = 2_500;
export const PIECE_PRACTICE_HESITATION_MULTIPLIER = 3;
export const PIECE_PRACTICE_HESITATION_EXPECTED_WINDOW_CAP_MS = 2_000;

export type PiecePracticeExpectedPitchSnapshot = Readonly<{
  sourceEventId: string;
  sourcePitchId: string;
  staff: PiecePracticeAttackedPitch["staff"];
  midiNumber: number;
  letter: PiecePracticeAttackedPitch["letter"];
  accidental: PiecePracticeAttackedPitch["accidental"];
  octave: number;
}>;

type PiecePracticeEvidenceLocation = Readonly<{
  sequence: number;
  measureIndex: number;
  sourceMeasureId: string;
  targetId: string;
  checkId: string;
  occurredAtActiveMs: number;
}>;

export type PiecePracticeMistakeEvidence =
  | (PiecePracticeEvidenceLocation & Readonly<{
      kind: "normal-attempt";
      expectedPitches: readonly PiecePracticeExpectedPitchSnapshot[];
      receivedMidiNumbers: readonly number[];
      missingMidiNumbers: readonly number[];
      extraMidiNumbers: readonly number[];
      unexpectedHeldMidiNumbers: readonly number[];
    }>)
  | (PiecePracticeEvidenceLocation & Readonly<{
      kind: "rolled-unexpected-pitch";
      expectedPitches: readonly PiecePracticeExpectedPitchSnapshot[];
      receivedMidiNumber: number;
      accumulatedMidiNumbers: readonly number[];
    }>)
  | (PiecePracticeEvidenceLocation & Readonly<{
      kind: "rolled-timeout";
      expectedPitches: readonly PiecePracticeExpectedPitchSnapshot[];
      accumulatedMidiNumbers: readonly number[];
      missingMidiNumbers: readonly number[];
      windowMs: number;
    }>);

export type PiecePracticeMistakeEvidenceDraft =
  | Omit<Extract<PiecePracticeMistakeEvidence, { kind: "normal-attempt" }>, "sequence" | "occurredAtActiveMs">
  | Omit<Extract<PiecePracticeMistakeEvidence, { kind: "rolled-unexpected-pitch" }>, "sequence" | "occurredAtActiveMs">
  | Omit<Extract<PiecePracticeMistakeEvidence, { kind: "rolled-timeout" }>, "sequence" | "occurredAtActiveMs">;

export type PiecePracticeTargetTiming = Readonly<{
  sequence: number;
  measureIndex: number;
  sourceMeasureId: string;
  targetId: string;
  sourceEventIds: readonly string[];
  expectedPitches: readonly PiecePracticeExpectedPitchSnapshot[];
  activatedAtActiveMs: number;
  completedAtActiveMs: number;
  responseDurationMs: number;
  expectedWindowMs: number;
  hesitationThresholdMs: number;
  isHesitation: boolean;
  outcome: "completed" | "skipped";
}>;

export type PiecePracticeSkipEvidence = Readonly<{
  sequence: number;
  measureIndex: number;
  sourceMeasureId: string;
  targetId: string;
  occurredAtActiveMs: number;
}>;

export type PiecePracticeMeasureTiming = Readonly<{
  measureIndex: number;
  sourceMeasureId: string;
  activeDurationMs: number;
}>;

export type PiecePracticeMeasureDiagnostic = Readonly<{
  measureIndex: number;
  sourceMeasureId: string;
  measureNumber: number;
  mistakeCount: number;
  hesitationCount: number;
  skippedTargetCount: number;
  activeDurationMs: number;
  isProblem: boolean;
  completedWithoutMistakes: boolean;
}>;

export function snapshotPiecePracticePitches(pitches: readonly PiecePracticeAttackedPitch[]): readonly PiecePracticeExpectedPitchSnapshot[] {
  return pitches.map(({ sourceEventId, sourcePitchId, staff, midiNumber, letter, accidental, octave }) => ({ sourceEventId, sourcePitchId, staff, midiNumber, letter, accidental, octave }));
}

export function getPiecePracticeHesitationThresholdMs(expectedWindowMs: number): number {
  return Math.max(
    PIECE_PRACTICE_HESITATION_MINIMUM_MS,
    PIECE_PRACTICE_HESITATION_MULTIPLIER * Math.min(expectedWindowMs, PIECE_PRACTICE_HESITATION_EXPECTED_WINDOW_CAP_MS),
  );
}

export function getPiecePracticeTargetExpectedWindowMs(piece: PiecePracticePiece, target: PiecePracticeTarget): number {
  const measure = piece.measures[target.measureIndex];
  if (!measure) return PIECE_PRACTICE_HESITATION_MINIMUM_MS;
  const laterTarget = measure.targets.find(({ startTick }) => startTick > target.startTick);
  const endTick = laterTarget?.startTick ?? measure.capacityTicks;
  const windowTicks = Math.max(1, endTick - target.startTick);
  return (windowTicks * 60_000) / (piece.tempoBpm * STAFF_BUILDER_TICKS_PER_QUARTER);
}

export function derivePiecePracticeMeasureDiagnostics(input: Readonly<{
  measureTimings: readonly PiecePracticeMeasureTiming[];
  mistakeEvidence: readonly PiecePracticeMistakeEvidence[];
  skipEvidence: readonly PiecePracticeSkipEvidence[];
  targetTimings: readonly PiecePracticeTargetTiming[];
}>): readonly PiecePracticeMeasureDiagnostic[] {
  return input.measureTimings.map((timing) => {
    const mistakeCount = input.mistakeEvidence.filter(({ measureIndex }) => measureIndex === timing.measureIndex).length;
    const hesitationCount = input.targetTimings.filter(({ measureIndex, isHesitation }) => measureIndex === timing.measureIndex && isHesitation).length;
    const skippedTargetCount = input.skipEvidence.filter(({ measureIndex }) => measureIndex === timing.measureIndex).length;
    return {
      ...timing,
      measureNumber: timing.measureIndex + 1,
      mistakeCount,
      hesitationCount,
      skippedTargetCount,
      isProblem: mistakeCount > 0 || hesitationCount > 0 || skippedTargetCount > 0,
      completedWithoutMistakes: mistakeCount === 0,
    };
  });
}

export function formatPiecePracticeWrittenPitch(pitch: PiecePracticeExpectedPitchSnapshot): string {
  const accidental = pitch.accidental === "sharp" ? "♯" : pitch.accidental === "flat" ? "♭" : "";
  return `${pitch.letter}${accidental}${pitch.octave}`;
}

export function formatPiecePracticeMidiPitch(midiNumber: number): string {
  const names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  return `MIDI ${midiNumber} (${names[midiNumber % 12]}${Math.floor(midiNumber / 12) - 1})`;
}
