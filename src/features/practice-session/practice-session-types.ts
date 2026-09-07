import type { EarTrainingConfig } from "@/features/ear-training/ear-training-config";
import type { FlashcardConfig } from "@/features/flashcards/flashcard-config";
import type { MelodyConfig } from "@/features/melody/melody-config";
import type { SequenceConfig } from "@/features/sequences/sequence-config";

export type CorrectAnswerTarget = Readonly<{ kind: "correct-answers"; count: number | null }>;
export type CompletedSequenceTarget = Readonly<{ kind: "completed-sequences"; count: number | null }>;
export type CompleteScaleRepertoireTarget = Readonly<{ kind: "complete-scale-repertoire" }>;
export type CorrectIdentificationTarget = Readonly<{ kind: "correct-identifications"; count: number | null }>;
export type ConfiguredTimedPracticeTarget = Readonly<{ kind: "configured-timed-practice" }>;

export type PracticeExerciseTarget =
  | CorrectAnswerTarget
  | CompletedSequenceTarget
  | CompleteScaleRepertoireTarget
  | CorrectIdentificationTarget
  | ConfiguredTimedPracticeTarget;

export type RandomSequenceConfig =
  | (SequenceConfig & Readonly<{ exerciseType: "intervals" | "arpeggios" | "chord-progressions" }>)
  | (SequenceConfig & Readonly<{ exerciseType: "scales"; scalePracticeMode: "random" }>);

export type RepertoireSequenceConfig = SequenceConfig & Readonly<{
  exerciseType: "scales";
  scalePracticeMode: "repertoire-in-order" | "repertoire-shuffle";
}>;

export type FlashcardPracticeExercise = Readonly<{
  id: string;
  label: string;
  engine: "flashcards";
  config: FlashcardConfig;
  target: CorrectAnswerTarget;
}>;

export type RandomSequencePracticeExercise = Readonly<{
  id: string;
  label: string;
  engine: "sequences";
  config: RandomSequenceConfig;
  target: CompletedSequenceTarget;
}>;

export type ScaleRepertoirePracticeExercise = Readonly<{
  id: string;
  label: string;
  engine: "sequences";
  config: RepertoireSequenceConfig;
  target: CompleteScaleRepertoireTarget;
}>;

export type EarTrainingPracticeExercise = Readonly<{
  id: string;
  label: string;
  engine: "ear-training";
  config: EarTrainingConfig;
  target: CorrectIdentificationTarget;
}>;

export type MelodyPracticeExercise = Readonly<{
  id: string;
  label: string;
  engine: "melody";
  config: MelodyConfig;
  target: ConfiguredTimedPracticeTarget;
}>;

export type PracticeExerciseEntry =
  | FlashcardPracticeExercise
  | RandomSequencePracticeExercise
  | ScaleRepertoirePracticeExercise
  | EarTrainingPracticeExercise
  | MelodyPracticeExercise;

export type PracticeSessionPreset = Readonly<{
  schemaVersion: 1;
  id: string;
  name: string;
  exercises: readonly PracticeExerciseEntry[];
}>;

export type PracticeSessionLibrary = Readonly<{
  schemaVersion: 1;
  presets: readonly PracticeSessionPreset[];
  lastUsedPresetId: string | null;
}>;

export type PracticeSessionIdFactory = () => string;

export type PracticeSessionRunnableIssue = Readonly<{
  exerciseId?: string;
  code: "no-exercises" | "target-required" | "empty-repertoire" | "continuous-practice-required" | "invalid-prescription";
  message: string;
}>;

export type RunnablePresetValidationResult =
  | Readonly<{ ok: true; preset: PracticeSessionPreset }>
  | Readonly<{ ok: false; issues: readonly PracticeSessionRunnableIssue[] }>;
