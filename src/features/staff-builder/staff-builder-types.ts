import { STAFF_BUILDER_SCORE_SCHEMA_VERSION, STAFF_BUILDER_STAFFS, STAFF_BUILDER_ACCIDENTALS, STAFF_BUILDER_ARPEGGIATIONS, STAFF_BUILDER_EVENT_KINDS, STAFF_BUILDER_RHYTHM_KINDS, STAFF_BUILDER_ANNOTATION_KINDS, STAFF_BUILDER_ANCHOR_KINDS, STAFF_BUILDER_PRACTICE_MARK_CATEGORIES, STAFF_BUILDER_BOOKMARK_CATEGORIES } from "./staff-builder-contract";
import type { StaffBuilderClef } from "./staff-builder-clefs";
import type { MusicKeyId } from "@/lib/music/keys";
import type { NoteLetter } from "@/lib/music/note-utils";
import type { StaffBuilderDuration, StaffBuilderTimeSignature } from "./staff-builder-time";

export type StaffBuilderStaff = (typeof STAFF_BUILDER_STAFFS)[number];
export type StaffBuilderAccidental = (typeof STAFF_BUILDER_ACCIDENTALS)[number];
export type StaffBuilderArpeggiation = (typeof STAFF_BUILDER_ARPEGGIATIONS)[number];

export type StaffBuilderPitch = Readonly<{
  id: string;
  midiNumber: number;
  letter: NoteLetter;
  accidental: StaffBuilderAccidental;
  octave: number;
}>;

export type StaffBuilderEventRhythm =
  | Readonly<{ status: typeof STAFF_BUILDER_RHYTHM_KINDS.unresolved }>
  | Readonly<{
      status: typeof STAFF_BUILDER_RHYTHM_KINDS.final;
      duration: StaffBuilderDuration;
    }>;

type StaffBuilderEventBase = Readonly<{
  id: string;
  staff: StaffBuilderStaff;
  startTick: number;
  rhythm: StaffBuilderEventRhythm;
}>;

export type StaffBuilderNoteEvent = StaffBuilderEventBase & Readonly<{
  kind: typeof STAFF_BUILDER_EVENT_KINDS.notes;
  pitches: readonly StaffBuilderPitch[];
  arpeggiation?: StaffBuilderArpeggiation;
}>;

export type StaffBuilderRestEvent = StaffBuilderEventBase & Readonly<{
  kind: typeof STAFF_BUILDER_EVENT_KINDS.rest;
  rhythm: Extract<StaffBuilderEventRhythm, { status: typeof STAFF_BUILDER_RHYTHM_KINDS.final }>;
}>;

export type StaffBuilderEvent = StaffBuilderNoteEvent | StaffBuilderRestEvent;

export type StaffBuilderMeasure = Readonly<{
  id: string;
  keySignatureChange?: MusicKeyId;
  timeSignatureChange?: StaffBuilderTimeSignature;
  clefChanges?: Readonly<Partial<Record<StaffBuilderStaff, StaffBuilderClef>>>;
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
  | Readonly<{ kind: typeof STAFF_BUILDER_ANCHOR_KINDS.event; eventId: string }>
  | Readonly<{ kind: typeof STAFF_BUILDER_ANCHOR_KINDS.measure; measureId: string }>;

type StaffBuilderAnnotationBase = Readonly<{
  id: string;
  anchor: StaffBuilderAnnotationAnchor;
}>;

export type StaffBuilderStudyNoteAnnotation = StaffBuilderAnnotationBase & Readonly<{
  kind: typeof STAFF_BUILDER_ANNOTATION_KINDS.studyNote;
  text: string;
}>;

export type StaffBuilderLyricCueAnnotation = StaffBuilderAnnotationBase & Readonly<{
  kind: typeof STAFF_BUILDER_ANNOTATION_KINDS.lyricCue;
  text: string;
}>;

export type StaffBuilderPracticeMarkCategory = (typeof STAFF_BUILDER_PRACTICE_MARK_CATEGORIES)[number];

export type StaffBuilderPracticeMarkAnnotation = StaffBuilderAnnotationBase & Readonly<{
  kind: typeof STAFF_BUILDER_ANNOTATION_KINDS.practiceMark;
  category: StaffBuilderPracticeMarkCategory;
  text?: string;
}>;

export type StaffBuilderBookmarkCategory = (typeof STAFF_BUILDER_BOOKMARK_CATEGORIES)[number];

export type StaffBuilderBookmarkAnnotation = StaffBuilderAnnotationBase & Readonly<{
  kind: typeof STAFF_BUILDER_ANNOTATION_KINDS.bookmark;
  category: StaffBuilderBookmarkCategory;
}>;

export type StaffBuilderAnnotation =
  | StaffBuilderStudyNoteAnnotation
  | StaffBuilderLyricCueAnnotation
  | StaffBuilderPracticeMarkAnnotation
  | StaffBuilderBookmarkAnnotation;

type LegacyStaffBuilderNoteEvent = Omit<StaffBuilderNoteEvent, "arpeggiation">;
type LegacyStaffBuilderEvent = LegacyStaffBuilderNoteEvent | StaffBuilderRestEvent;
type LegacyStaffBuilderMeasure = Omit<StaffBuilderMeasure, "events" | "clefChanges"> & Readonly<{
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

export type StaffBuilderScoreV3 = StaffBuilderScoreBase<3, Omit<StaffBuilderMeasure, "clefChanges">> & Readonly<{
  annotations: readonly StaffBuilderAnnotation[];
}>;

export type StaffBuilderScoreV4 = StaffBuilderScoreBase<typeof STAFF_BUILDER_SCORE_SCHEMA_VERSION, StaffBuilderMeasure> & Readonly<{
  annotations: readonly StaffBuilderAnnotation[];
}>;

export type StaffBuilderScore = StaffBuilderScoreV4;

export type StaffBuilderMeasureContext = Readonly<{
  keySignatureId: MusicKeyId;
  timeSignature: StaffBuilderTimeSignature;
  capacityTicks: number;
  clefs: Readonly<Record<StaffBuilderStaff, StaffBuilderClef>>;
}>;
