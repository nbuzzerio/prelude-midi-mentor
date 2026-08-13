import type { MelodyAttemptResult } from "./melody-scoring";

export function shouldTryAnotherFromPedal(
  result: MelodyAttemptResult,
): boolean {
  return (
    result.attacks.length > 0 &&
    result.attacks.every(({ status }) => status === "correct") &&
    result.missedAttackCount === 0 &&
    result.extraAttackCount === 0
  );
}
