import { MELODY_KEY_IDS, MELODY_MEASURE_COUNTS, MELODY_STAFFS, MELODY_TEMPOS, type MelodyKeyId, type MelodyMeasureCount, type MelodyStaff, type MelodyTempoBpm } from "@/features/melody/melody-types";
import { MELODY_CONTINUOUS_DURATION_MINUTES, type MelodyContinuousDurationMinutes } from "@/features/melody/melody-continuous-practice";
import { SCALE_REPERTOIRE_CATALOG, type ScaleRepertoireId } from "@/features/sequences/scale-repertoire";
import { CHORD_PROGRESSION_TEMPLATES, SUPPORTED_CHORD_PROGRESSION_KEYS, type ChordProgressionKeyId, type ChordProgressionTemplateId } from "@/lib/music/chord-progressions";
import { MUSICAL_INTERVALS, type IntervalDirection, type MusicalInterval } from "@/lib/music/intervals";
import { PRACTICE_CLEF_MODES, PRACTICE_NOTE_CATEGORIES, PRACTICE_TRIAD_POSITIONS, PRACTICE_TRIAD_QUALITIES, SEQUENCE_ARPEGGIO_DIRECTIONS, SEQUENCE_ARPEGGIOS, SEQUENCE_DIRECTIONS, SEQUENCE_SCALE_DIRECTIONS, SEQUENCE_SCALES, type PracticeClefMode, type PracticeNoteCategory, type PracticeTriadPosition, type PracticeTriadQuality, type SequenceArpeggio, type SequenceArpeggioDirection, type SequenceScale, type SequenceScaleDirection } from "@/types/practice";
import { PRACTICE_SESSION_CURRICULUM_LIMITS, PRACTICE_SESSION_WEEKDAYS, type PracticeSessionWeekday } from "../practice-session-types";

export const WEEKLY_PRACTICE_FORMAT = "prelude-weekly-practice" as const;
export const WEEKLY_PRACTICE_SCHEMA_VERSION = 1 as const;
export const WEEKLY_PRACTICE_EXERCISE_TYPES = ["note-recognition", "triads", "melodic-intervals", "random-scales", "scale-repertoire", "arpeggios", "chord-progressions", "ear-intervals", "reading-flow"] as const;
export type WeeklyPracticeExerciseType = (typeof WEEKLY_PRACTICE_EXERCISE_TYPES)[number];

export const WEEKLY_PRACTICE_LIMITS = Object.freeze({
  jsonBytes: 256 * 1024,
  titleCharacters: PRACTICE_SESSION_CURRICULUM_LIMITS.titleCharacters,
  instructionsCharacters: PRACTICE_SESSION_CURRICULUM_LIMITS.instructionsCharacters,
  dayNameCharacters: 120,
  dayNotesCharacters: PRACTICE_SESSION_CURRICULUM_LIMITS.dayNotesCharacters,
  exerciseLabelCharacters: 100,
  exercisesPerDay: 24,
  totalExercises: 100,
  targetCount: 1_000,
  estimatedDurationMinutes: PRACTICE_SESSION_CURRICULUM_LIMITS.estimatedDurationMinutes,
  reportedIssues: 100,
});

type LabeledExercise<T extends WeeklyPracticeExerciseType> = Readonly<{ type: T; label: string }>;
type CorrectAnswerTarget = Readonly<{ correctAnswers: number }>;
type CompletedSequenceTarget = Readonly<{ completedSequences: number }>;
type CorrectIdentificationTarget = Readonly<{ correctIdentifications: number }>;

export type NoteRecognitionExerciseV1 = LabeledExercise<"note-recognition"> & Readonly<{ staff: PracticeClefMode; noteCategories: readonly PracticeNoteCategory[]; showTargetName: boolean; target: CorrectAnswerTarget }>;
export type TriadsExerciseV1 = LabeledExercise<"triads"> & Readonly<{ staff: PracticeClefMode; qualities: readonly PracticeTriadQuality[]; positions: readonly PracticeTriadPosition[]; showTargetName: boolean; target: CorrectAnswerTarget }>;
export type MelodicIntervalsExerciseV1 = LabeledExercise<"melodic-intervals"> & Readonly<{ staff: PracticeClefMode; directions: readonly IntervalDirection[]; intervals: readonly MusicalInterval[]; startingNoteCategories: readonly PracticeNoteCategory[]; showTargetName: boolean; target: CompletedSequenceTarget }>;
export type RandomScalesExerciseV1 = LabeledExercise<"random-scales"> & Readonly<{ staff: PracticeClefMode; scaleTypes: readonly SequenceScale[]; directions: readonly SequenceScaleDirection[]; startingNoteCategories: readonly PracticeNoteCategory[]; showTargetName: boolean; target: CompletedSequenceTarget }>;
export type ScaleRepertoireExerciseV1 = LabeledExercise<"scale-repertoire"> & Readonly<{ staff: PracticeClefMode; order: "in-order" | "shuffle"; scales: readonly ScaleRepertoireId[]; showTargetName: boolean }>;
export type ArpeggiosExerciseV1 = LabeledExercise<"arpeggios"> & Readonly<{ staff: PracticeClefMode; arpeggioTypes: readonly SequenceArpeggio[]; directions: readonly SequenceArpeggioDirection[]; startingNoteCategories: readonly PracticeNoteCategory[]; showTargetName: boolean; target: CompletedSequenceTarget }>;
export type ChordProgressionsExerciseV1 = LabeledExercise<"chord-progressions"> & Readonly<{ staff: PracticeClefMode; keys: readonly ChordProgressionKeyId[]; progressions: readonly ChordProgressionTemplateId[]; showTargetName: boolean; target: CompletedSequenceTarget }>;
export type EarIntervalsExerciseV1 = LabeledExercise<"ear-intervals"> & Readonly<{ directions: readonly IntervalDirection[]; intervals: readonly MusicalInterval[]; target: CorrectIdentificationTarget }>;
export type ReadingFlowExerciseV1 = LabeledExercise<"reading-flow"> & Readonly<{ staff: MelodyStaff; key: MelodyKeyId; tempoBpm: MelodyTempoBpm; measureCount: MelodyMeasureCount; durationMinutes: MelodyContinuousDurationMinutes }>;

export type WeeklyPracticeExerciseV1 = NoteRecognitionExerciseV1 | TriadsExerciseV1 | MelodicIntervalsExerciseV1 | RandomScalesExerciseV1 | ScaleRepertoireExerciseV1 | ArpeggiosExerciseV1 | ChordProgressionsExerciseV1 | EarIntervalsExerciseV1 | ReadingFlowExerciseV1;
export type WeeklyPracticeDayV1 = Readonly<{ day: PracticeSessionWeekday; kind: "rest"; notes?: string }> | Readonly<{ day: PracticeSessionWeekday; kind: "practice"; name: string; notes?: string; estimatedDurationMinutes?: number; exercises: readonly WeeklyPracticeExerciseV1[] }>;
export type WeeklyPracticeCurriculumV1 = Readonly<{ format: typeof WEEKLY_PRACTICE_FORMAT; schemaVersion: typeof WEEKLY_PRACTICE_SCHEMA_VERSION; title: string; instructions?: string; days: readonly WeeklyPracticeDayV1[] }>;

export const SELECTABLE_SCALE_REPERTOIRE_IDS = Object.freeze(SCALE_REPERTOIRE_CATALOG.filter(({ disabledReason }) => !disabledReason).map(({ id }) => id));

export const WEEKLY_PRACTICE_CAPABILITIES = Object.freeze({
  weekdays: PRACTICE_SESSION_WEEKDAYS,
  clefs: PRACTICE_CLEF_MODES,
  noteCategories: PRACTICE_NOTE_CATEGORIES,
  triadQualities: PRACTICE_TRIAD_QUALITIES,
  triadPositions: PRACTICE_TRIAD_POSITIONS,
  intervalDirections: SEQUENCE_DIRECTIONS,
  intervals: MUSICAL_INTERVALS,
  scales: SEQUENCE_SCALES,
  scaleDirections: SEQUENCE_SCALE_DIRECTIONS,
  repertoireScales: SELECTABLE_SCALE_REPERTOIRE_IDS,
  arpeggios: SEQUENCE_ARPEGGIOS,
  arpeggioDirections: SEQUENCE_ARPEGGIO_DIRECTIONS,
  chordProgressionKeys: SUPPORTED_CHORD_PROGRESSION_KEYS.map(({ id }) => id),
  chordProgressions: CHORD_PROGRESSION_TEMPLATES.map(({ id }) => id),
  melodyStaffs: MELODY_STAFFS,
  melodyKeys: MELODY_KEY_IDS,
  melodyTempos: MELODY_TEMPOS,
  melodyMeasureCounts: MELODY_MEASURE_COUNTS,
  melodyDurations: MELODY_CONTINUOUS_DURATION_MINUTES,
});

export const WEEKLY_PRACTICE_EXERCISE_DESCRIPTIONS: Readonly<Record<WeeklyPracticeExerciseType, string>> = Object.freeze({
  "note-recognition": "Read isolated staff notes and play the matching piano keys.",
  triads: "Read notated major, minor, diminished, or augmented triads in selected inversions.",
  "melodic-intervals": "Play two-note ascending or descending melodic interval sequences.",
  "random-scales": "Practice randomly generated scale forms and directions.",
  "scale-repertoire": "Traverse a chosen named scale list once, in order or shuffled, one octave ascending and descending.",
  arpeggios: "Play generated triad or seventh-chord arpeggio sequences.",
  "chord-progressions": "Play root-position Roman-numeral chord progressions in compatible major or minor keys.",
  "ear-intervals": "Hear an ascending or descending melodic interval and identify it by sound.",
  "reading-flow": "Practice timed, continuous one- or two-measure monophonic sight-reading.",
});
