import type { EarTrainingPracticeResultV1 } from "@/features/ear-training/ear-training-practice-result";
import type { FlashcardPracticeResultV1 } from "@/features/flashcards/flashcard-practice-result";
import type { MelodyPracticeResultV1 } from "@/features/melody/melody-practice-result";
import type { SequencePracticeResultV1 } from "@/features/sequences/sequence-practice-result";

export type PracticeSessionEngineResult = FlashcardPracticeResultV1 | SequencePracticeResultV1 | EarTrainingPracticeResultV1 | MelodyPracticeResultV1;
