import type { MusicKeyId } from "@/lib/music/keys";
import type { NoteLetter } from "@/lib/music/note-utils";
import type { StaffBuilderDuration, StaffBuilderTimeSignature } from "./staff-builder-time";

export type StaffBuilderStaff = "treble" | "bass";
export type StaffBuilderAccidental = "flat" | "natural" | "sharp";
export type StaffBuilderArpeggiation = "up";

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
  arpeggiation?: StaffBuilderArpeggiation;
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

export type StaffBuilderAnnotationAnchor =
  | Readonly<{ kind: "event"; eventId: string }>
  | Readonly<{ kind: "measure"; measureId: string }>;

type StaffBuilderAnnotationBase = Readonly<{
  id: string;
  anchor: StaffBuilderAnnotationAnchor;
}>;

export type StaffBuilderStudyNoteAnnotation = StaffBuilderAnnotationBase & Readonly<{
  kind: "study-note";
  text: string;
}>;

export type StaffBuilderPracticeMarkCategory =
  | "needs-work"
  | "rhythm"
  | "hands-separate"
  | "check-fingering"
  | "other";

export type StaffBuilderPracticeMarkAnnotation = StaffBuilderAnnotationBase & Readonly<{
  kind: "practice-mark";
  category: StaffBuilderPracticeMarkCategory;
  text?: string;
}>;

export type StaffBuilderBookmarkCategory = "interesting" | "needs-work" | "question" | "revisit";

export type StaffBuilderBookmarkAnnotation = StaffBuilderAnnotationBase & Readonly<{
  kind: "bookmark";
  category: StaffBuilderBookmarkCategory;
}>;

export type StaffBuilderAnnotation =
  | StaffBuilderStudyNoteAnnotation
  | StaffBuilderPracticeMarkAnnotation
  | StaffBuilderBookmarkAnnotation;

type LegacyStaffBuilderNoteEvent = Omit<StaffBuilderNoteEvent, "arpeggiation">;
type LegacyStaffBuilderEvent = LegacyStaffBuilderNoteEvent | StaffBuilderRestEvent;
type LegacyStaffBuilderMeasure = Omit<StaffBuilderMeasure, "events"> & Readonly<{
  events: readonly LegacyStaffBuilderEvent[];
}>;

type StaffBuilderScoreBase<TSchemaVersion extends number, TMeasure> = Readonly<{
  schemaVersion: TSchemaVersion;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  tempoBpm: number;
  initialKeySignatureId: MusicKeyId;
  initialTimeSignature: StaffBuilderTimeSignature;
  measures: readonly TMeasure[];
  ties: readonly StaffBuilderTie[];
}>;

export type StaffBuilderScoreV1 = StaffBuilderScoreBase<1, LegacyStaffBuilderMeasure>;

export type StaffBuilderScoreV2 = StaffBuilderScoreBase<2, LegacyStaffBuilderMeasure> & Readonly<{
  annotations: readonly StaffBuilderAnnotation[];
}>;

export type StaffBuilderScoreV3 = StaffBuilderScoreBase<3, StaffBuilderMeasure> & Readonly<{
  annotations: readonly StaffBuilderAnnotation[];
}>;

export type StaffBuilderScore = StaffBuilderScoreV3;

export type StaffBuilderMeasureContext = Readonly<{
  keySignatureId: MusicKeyId;
  timeSignature: StaffBuilderTimeSignature;
  capacityTicks: number;
}>;
