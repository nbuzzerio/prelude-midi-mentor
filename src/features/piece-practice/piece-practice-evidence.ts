import { STAFF_BUILDER_TICKS_PER_QUARTER } from "@/features/staff-builder/staff-builder-time";
import type { PracticeDiagnosticChip } from "@/components/practice-diagnostic-chips";
import type { PiecePracticeAttackedPitch, PiecePracticePiece, PiecePracticeTarget } from "./piece-practice-types";
import { getFullNoteName } from "@/lib/music/note-utils";
import { spellKeyAwareMidiNumber } from "@/lib/music/key-aware-spelling";
import type { MusicKeyId } from "@/lib/music/keys";
import type { MidiReleaseObservation } from "@/hooks/use-midi";
import type { AcousticAttack, AcousticPitchGrade } from "./piece-practice-acoustic-types";

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

/** One physical Note On, before chord collection can deduplicate pitches. Not grading input. */
export type PiecePracticeAttackEvidence = Readonly<{
  sequence: number;
  measureIndex: number;
  sourceMeasureId: string;
  targetId: string;
  midiNumber: number;
  attackVelocity: number;
  occurredAtActiveMs: number;
  sourceTimeStampMs?: number;
}>;

/** Observed releases only: no instance pairing, duration inference, or grading. */
export type PiecePracticeReleaseEvidence = MidiReleaseObservation & Readonly<{
  sequence: number;
  occurredAtActiveMs: number;
}>;

type PiecePracticeEvidenceLocation = Readonly<{
  sequence: number;
  measureIndex: number;
  sourceMeasureId: string;
  targetId: string;
  checkId: string;
  occurredAtActiveMs: number;
}>;

/** Discrete scalar evidence only; no audio, detector history, or browser clock origins. */
export type PiecePracticeAcousticEvidence = PiecePracticeEvidenceLocation & AcousticPitchGrade & Readonly<{
  source: "microphone";
  expectedPitches: readonly PiecePracticeExpectedPitchSnapshot[];
  articulation: AcousticAttack["articulation"];
  confirmationDelayMs: number;
}>;

export type PiecePracticeMistakeEvidence =
  | (PiecePracticeEvidenceLocation & Readonly<{
      kind: "acoustic-attempt";
      expectedPitches: readonly PiecePracticeExpectedPitchSnapshot[];
      acousticSequence: number;
      frequencyHz: number;
      nearestSemitone: number;
      centsFromExpected: number;
      pitchToleranceCents: number;
      rejection: "wrong-pitch" | "outside-tolerance";
    }>)
  | (PiecePracticeEvidenceLocation & Readonly<{
      kind: "normal-attempt";
      expectedPitches: readonly PiecePracticeExpectedPitchSnapshot[];
      receivedMidiNumbers: readonly number[];
      missingMidiNumbers: readonly number[];
      extraMidiNumbers: readonly number[];
      unexpectedHeldMidiNumbers: readonly number[];
      predecessorPitches?: readonly PiecePracticeExpectedPitchSnapshot[];
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
  | Omit<Extract<PiecePracticeMistakeEvidence, { kind: "acoustic-attempt" }>, "sequence" | "occurredAtActiveMs">
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
  timingBasis: "first-attempt" | "target-activation" | "unarmed-skip";
  activatedAtActiveMs: number | null;
  completedAtActiveMs: number;
  responseDurationMs: number | null;
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

/** A deliberate Restart Measure action; distinct from retries and pitch mistakes. */
export type PiecePracticeRestartEvidence = Readonly<{
  sequence: number;
  measureIndex: number;
  sourceMeasureId: string;
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
  restartCount: number;
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
  restartEvidence?: readonly PiecePracticeRestartEvidence[];
  targetTimings: readonly PiecePracticeTargetTiming[];
}>): readonly PiecePracticeMeasureDiagnostic[] {
  return input.measureTimings.map((timing) => {
    const mistakeCount = input.mistakeEvidence.filter(({ measureIndex }) => measureIndex === timing.measureIndex).length;
    const hesitationCount = input.targetTimings.filter(({ measureIndex, isHesitation }) => measureIndex === timing.measureIndex && isHesitation).length;
    const skippedTargetCount = input.skipEvidence.filter(({ measureIndex }) => measureIndex === timing.measureIndex).length;
    const restartCount = (input.restartEvidence ?? []).filter(({ measureIndex }) => measureIndex === timing.measureIndex).length;
    return {
      ...timing,
      measureNumber: timing.measureIndex + 1,
      mistakeCount,
      hesitationCount,
      skippedTargetCount,
      restartCount,
      isProblem: mistakeCount > 0 || hesitationCount > 0 || skippedTargetCount > 0 || restartCount > 0,
      completedWithoutMistakes: mistakeCount === 0,
    };
  });
}

export function selectPiecePracticeMeasureDiagnosticChips(diagnostic: PiecePracticeMeasureDiagnostic): readonly PracticeDiagnosticChip[] {
  return Object.freeze([
    ...(diagnostic.mistakeCount > 0 ? [{ id: "pitch-problem", kind: "problem", label: "Pitch", count: diagnostic.mistakeCount, accessibleText: `Pitch problem evidence: ${diagnostic.mistakeCount} ${diagnostic.mistakeCount === 1 ? "mistake" : "mistakes"} in measure ${diagnostic.measureNumber}` } as const] : []),
    ...(diagnostic.hesitationCount > 0 ? [{ id: "hesitation", kind: "problem", label: "Hesitation", count: diagnostic.hesitationCount, accessibleText: `${diagnostic.hesitationCount} tempo-aware slow ${diagnostic.hesitationCount === 1 ? "response" : "responses"} in measure ${diagnostic.measureNumber}` } as const] : []),
    ...(diagnostic.skippedTargetCount > 0 ? [{ id: "skipped", kind: "process", label: "Skipped", count: diagnostic.skippedTargetCount, accessibleText: `${diagnostic.skippedTargetCount} ${diagnostic.skippedTargetCount === 1 ? "target was" : "targets were"} skipped in measure ${diagnostic.measureNumber}` } as const] : []),
    ...(diagnostic.restartCount > 0 ? [{ id: "restart", kind: "process", label: "Restart", count: diagnostic.restartCount, accessibleText: `${diagnostic.restartCount} deliberate measure ${diagnostic.restartCount === 1 ? "restart" : "restarts"} in measure ${diagnostic.measureNumber}` } as const] : []),
  ]);
}

export function formatPiecePracticeWrittenPitch(pitch: PiecePracticeExpectedPitchSnapshot): string {
  const accidental = pitch.accidental === "sharp" ? "♯" : pitch.accidental === "flat" ? "♭" : "";
  return `${pitch.letter}${accidental}${pitch.octave}`;
}

export type PiecePracticePitchPresentation = Readonly<{
  expectedPitches?: readonly PiecePracticeExpectedPitchSnapshot[];
  predecessorPitches?: readonly PiecePracticeExpectedPitchSnapshot[];
  keySignatureId?: MusicKeyId;
  showMidiDetails?: boolean;
}>;

/** One presentation resolver; numeric evidence and authored score data stay unchanged. */
export function formatPiecePracticeMidiPitch(midiNumber: number, context: PiecePracticePitchPresentation = {}): string {
  const authored = context.expectedPitches?.find((pitch) => pitch.midiNumber === midiNumber)
    ?? context.predecessorPitches?.find((pitch) => pitch.midiNumber === midiNumber);
  const keyAware = !authored && context.keySignatureId
    ? spellKeyAwareMidiNumber({ midiNumber, context: { type: "key", keyId: context.keySignatureId } }) : null;
  const name = authored ? formatPiecePracticeWrittenPitch(authored)
    : keyAware ? `${keyAware.name}${keyAware.octave}` : getFullNoteName(midiNumber);
  return context.showMidiDetails ? `${name} (MIDI ${midiNumber})` : name;
}
