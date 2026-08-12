import { describe, expect, it } from "vitest";
import { getMelodyResultDetails, getMelodyResultEventHighlights } from "./melody-result-highlights";
import type { MelodyAttemptResult } from "./melody-scoring";

function result(): MelodyAttemptResult {
  const attack = (id: string, status: "correct" | "wrong-pitch" | "missing", timingDeltaMs: number | null, performedMidi: number | null, measureIndex = 0) => ({
    expectedAttack: { id: `${id}-attack`, exerciseId: "exercise", eventId: id, measureId: `m${measureIndex}`, measureIndex, staff: "treble" as const, startTick: id === "wrong" ? 480 : 0, absoluteTick: measureIndex * 1920, durationTicks: 480, midiNumber: 60, writtenPitch: { letter: "C" as const, accidental: "natural" as const, octave: 4 }, expectedTimeSeconds: 0, expectedTimeMs: 0 },
    performedAttack: performedMidi === null ? null : { id: `played-${id}`, sequenceIndex: 0, audioTimeSeconds: 1, relativeTimeMs: timingDeltaMs ?? 0, midiNumber: performedMidi, source: "virtual" as const },
    status, pitchDistanceSemitones: performedMidi === null ? null : Math.abs(60 - performedMidi), pitchCredit: status === "correct" ? 1 : 0, timingDeltaMs, timingErrorBeats: timingDeltaMs === null ? null : Math.abs(timingDeltaMs) / 1000, timingCredit: timingDeltaMs === null ? 0 : 1,
  });
  return { exerciseId: "exercise", attacks: [attack("late-correct", "correct", 300, 60), attack("wrong", "wrong-pitch", 0, 64), attack("missed", "missing", null, null, 1)], movements: [], extras: [{ id: "extra", sequenceIndex: 3, audioTimeSeconds: 4, relativeTimeMs: 3000, midiNumber: 67, source: "virtual" }], pitchScorePercent: 33, movementScorePercent: 0, timingScorePercent: 67, missedAttackCount: 1, extraAttackCount: 1 };
}

describe("Melody result highlights", () => {
  it("maps pitch outcomes by expected event ID independently from timing and extras", () => {
    const source = result();
    const before = JSON.stringify(source);
    expect(getMelodyResultEventHighlights(source)).toEqual([
      { eventId: "late-correct", status: "correct" },
      { eventId: "wrong", status: "wrong-pitch" },
      { eventId: "missed", status: "missed" },
    ]);
    expect(getMelodyResultEventHighlights(source)).toHaveLength(source.attacks.length);
    expect(JSON.stringify(source)).toBe(before);
  });

  it("describes correct, wrong, and missed expected attacks without fabricating extras", () => {
    const details = getMelodyResultDetails(result());
    expect(details.map(({ text }) => text)).toEqual([
      "Measure 1, beat 1: C4, correct.",
      "Measure 1, beat 2: expected C4, played E4.",
      "Measure 2, beat 1: missed C4.",
    ]);
    expect(details.some(({ text }) => text.includes("extra"))).toBe(false);
  });
});
