import type { IntervalDirection, MusicalInterval } from "@/lib/music/intervals";
import type { PracticeNote } from "@/types/practice";

export type EarTrainingTarget = Readonly<{
  direction: IntervalDirection;
  exerciseType: "melodic-interval";
  interval: MusicalInterval;
  notes: readonly [PracticeNote, PracticeNote];
}>;

export type EarTrainingStats = Readonly<{
  completed: number;
  incorrectAttempts: number;
  streak: number;
  totalResponseTimeMs: number;
}>;
