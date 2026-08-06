import type { MusicalInterval } from "@/lib/music/intervals";
import type { EarTrainingTarget } from "./ear-training-types";

export function isEarTrainingAnswerCorrect(
  answer: MusicalInterval,
  target: EarTrainingTarget,
): boolean {
  return answer === target.interval;
}
