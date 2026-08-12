import type { MusicKeyId } from "@/lib/music/keys";
import type { NoteLetter } from "@/lib/music/note-utils";
import type { StaffBuilderAccidental, StaffBuilderStaff } from "@/features/staff-builder/staff-builder-types";
import type { StaffBuilderDuration } from "@/features/staff-builder/staff-builder-time";

export const MELODY_STAFFS = ["treble", "bass"] as const satisfies readonly StaffBuilderStaff[];
export const MELODY_KEY_IDS = ["c-major", "g-major", "f-major", "a-minor", "d-minor"] as const satisfies readonly MusicKeyId[];
export const MELODY_TEMPOS = [50, 60, 70, 80] as const;
export const MELODY_MEASURE_COUNTS = [1, 2] as const;

export type MelodyStaff = (typeof MELODY_STAFFS)[number];
export type MelodyKeyId = (typeof MELODY_KEY_IDS)[number];
export type MelodyTempoBpm = (typeof MELODY_TEMPOS)[number];
export type MelodyMeasureCount = (typeof MELODY_MEASURE_COUNTS)[number];
export type MelodySeed = string | number;

export type MelodySettings = Readonly<{
  staff: MelodyStaff;
  keyId: MelodyKeyId;
  tempoBpm: MelodyTempoBpm;
  measureCount: MelodyMeasureCount;
  pitchDifficulty: "easy";
  rhythmDifficulty: "easy";
}>;

export const DEFAULT_MELODY_SETTINGS: MelodySettings = Object.freeze({
  staff: "treble",
  keyId: "c-major",
  tempoBpm: 60,
  measureCount: 1,
  pitchDifficulty: "easy",
  rhythmDifficulty: "easy",
});

export type MelodyWrittenPitch = Readonly<{
  letter: NoteLetter;
  accidental: StaffBuilderAccidental;
  octave: number;
}>;

export type MelodyNoteEvent = Readonly<{
  id: string;
  measureId: string;
  measureIndex: number;
  staff: MelodyStaff;
  startTick: number;
  absoluteTick: number;
  duration: Extract<StaffBuilderDuration, "quarter" | "half" | "eighth">;
  durationTicks: number;
  pitch: MelodyWrittenPitch & Readonly<{ midiNumber: number }>;
}>;

export type MelodyMeasure = Readonly<{
  id: string;
  measureIndex: number;
  capacityTicks: number;
  events: readonly MelodyNoteEvent[];
}>;

export type MelodyExpectedAttack = Readonly<{
  id: string;
  exerciseId: string;
  eventId: string;
  measureId: string;
  measureIndex: number;
  staff: MelodyStaff;
  startTick: number;
  absoluteTick: number;
  durationTicks: number;
  midiNumber: number;
  writtenPitch: MelodyWrittenPitch;
}>;

export type MelodyExercise = Readonly<{
  id: string;
  seed: MelodySeed;
  settings: MelodySettings;
  measures: readonly MelodyMeasure[];
  expectedAttacks: readonly MelodyExpectedAttack[];
}>;
