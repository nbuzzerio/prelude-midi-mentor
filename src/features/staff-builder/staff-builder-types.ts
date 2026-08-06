import type { MusicKeyId } from "@/lib/music/keys";
import type { NoteLetter } from "@/lib/music/note-utils";
import type { StaffBuilderDuration, StaffBuilderTimeSignature } from "./staff-builder-time";

export type StaffBuilderStaff = "treble" | "bass";
export type StaffBuilderAccidental = "flat" | "natural" | "sharp";

export type StaffBuilderPitch = Readonly<{
  id: string;
  midiNumber: number;
  letter: NoteLetter;
  accidental: StaffBuilderAccidental;
  octave: number;
}>;

export type StaffBuilderEventRhythm =
  | Readonly<{ status: "unresolved" }>
  | Readonly<{
      status: "final";
      duration: StaffBuilderDuration;
    }>;

type StaffBuilderEventBase = Readonly<{
  id: string;
  staff: StaffBuilderStaff;
  startTick: number;
  rhythm: StaffBuilderEventRhythm;
}>;

export type StaffBuilderNoteEvent = StaffBuilderEventBase & Readonly<{
  kind: "notes";
  pitches: readonly StaffBuilderPitch[];
}>;

export type StaffBuilderRestEvent = StaffBuilderEventBase & Readonly<{
  kind: "rest";
  rhythm: Extract<StaffBuilderEventRhythm, { status: "final" }>;
}>;

export type StaffBuilderEvent = StaffBuilderNoteEvent | StaffBuilderRestEvent;

export type StaffBuilderMeasure = Readonly<{
  id: string;
  keySignatureChange?: MusicKeyId;
  timeSignatureChange?: StaffBuilderTimeSignature;
  events: readonly StaffBuilderEvent[];
}>;

export type StaffBuilderTie = Readonly<{
  id: string;
  fromEventId: string;
  fromPitchId: string;
  toEventId: string;
  toPitchId: string;
}>;

export type StaffBuilderScoreV1 = Readonly<{
  schemaVersion: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  tempoBpm: number;
  initialKeySignatureId: MusicKeyId;
  initialTimeSignature: StaffBuilderTimeSignature;
  measures: readonly StaffBuilderMeasure[];
  ties: readonly StaffBuilderTie[];
}>;

export type StaffBuilderMeasureContext = Readonly<{
  keySignatureId: MusicKeyId;
  timeSignature: StaffBuilderTimeSignature;
  capacityTicks: number;
}>;
