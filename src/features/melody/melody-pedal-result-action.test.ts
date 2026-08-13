import { describe, expect, it } from "vitest";

import type { MelodyAttemptResult } from "./melody-scoring";
import { shouldTryAnotherFromPedal } from "./melody-pedal-result-action";

function result(
  status: "correct" | "wrong-pitch" | "missing" = "correct",
  extras = 0,
): MelodyAttemptResult {
  return {
    attacks: [{ status }] as unknown as MelodyAttemptResult["attacks"],
    exerciseId: "exercise",
    extraAttackCount: extras,
    extras: Array.from({ length: extras }) as unknown as MelodyAttemptResult["extras"],
    missedAttackCount: status === "missing" ? 1 : 0,
    movementScorePercent: 0,
    movements: [],
    pitchScorePercent: 100,
    timingScorePercent: 0,
  };
}

describe("shouldTryAnotherFromPedal", () => {
  it("ignores timing and movement when every pitch is exact", () => {
    expect(shouldTryAnotherFromPedal(result())).toBe(true);
  });

  it.each([
    ["wrong pitch", result("wrong-pitch")],
    ["missed pitch", result("missing")],
    ["extra attack", result("correct", 1)],
  ])("retries for %s even when the rounded pitch score is 100", (_label, attempt) => {
    expect(shouldTryAnotherFromPedal(attempt)).toBe(false);
  });
});
