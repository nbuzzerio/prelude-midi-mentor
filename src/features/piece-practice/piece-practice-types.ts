import type { MusicKeyId } from "@/lib/music/keys";
import type { StaffBuilderDuration, StaffBuilderTimeSignature } from "@/features/staff-builder/staff-builder-time";
import type { StaffBuilderIssue } from "@/features/staff-builder/staff-builder-validation";
import type { StaffBuilderAccidental, StaffBuilderStaff } from "@/features/staff-builder/staff-builder-types";
import type { NoteLetter } from "@/lib/music/note-utils";

export type PiecePracticeSourcePitch = Readonly<{
  sourcePitchId: string;
  midiNumber: number;
  letter: NoteLetter;
  accidental: StaffBuilderAccidental;
  octave: number;
  incomingTieIds: readonly string[];
  outgoingTieIds: readonly string[];
  requiresAttack: boolean;
}>;

type PiecePracticeSourceEventBase = Readonly<{
  sourceEventId: string;
  staff: StaffBuilderStaff;
  startTick: number;
  absoluteStartTick: number;
  duration: StaffBuilderDuration;
  durationTicks: number;
}>;

export type PiecePracticeSourceEvent =
  | (PiecePracticeSourceEventBase & Readonly<{
      kind: "notes";
      pitches: readonly PiecePracticeSourcePitch[];
    }>)
  | (PiecePracticeSourceEventBase & Readonly<{ kind: "rest" }>);

export type PiecePracticeAttackedPitch = Readonly<{
  sourceEventId: string;
  sourcePitchId: string;
  staff: StaffBuilderStaff;
  midiNumber: number;
  letter: NoteLetter;
  accidental: StaffBuilderAccidental;
  octave: number;
  duration: StaffBuilderDuration;
  durationTicks: number;
  incomingTieIds: readonly string[];
  outgoingTieIds: readonly string[];
}>;

export type PiecePracticeTarget = Readonly<{
  id: string;
  measureIndex: number;
  sourceMeasureId: string;
  startTick: number;
  absoluteStartTick: number;
  sourceEventIds: readonly string[];
  expectedMidiNumbers: readonly number[];
  attackedPitches: readonly PiecePracticeAttackedPitch[];
}>;

export type PiecePracticeMeasure = Readonly<{
  measureIndex: number;
  sourceMeasureId: string;
  absoluteStartTick: number;
  capacityTicks: number;
  keySignatureId: MusicKeyId;
  timeSignature: StaffBuilderTimeSignature;
  sourceEvents: readonly PiecePracticeSourceEvent[];
  restEventIds: readonly string[];
  targets: readonly PiecePracticeTarget[];
}>;

export type PiecePracticePiece = Readonly<{
  sourceScoreId: string;
  sourceScoreUpdatedAt: string;
  title: string;
  tempoBpm: number;
  measures: readonly PiecePracticeMeasure[];
}>;

export type PiecePracticeProjectionResult =
  | Readonly<{ ok: true; piece: PiecePracticePiece }>
  | Readonly<{ ok: false; issues: readonly StaffBuilderIssue[] }>;
