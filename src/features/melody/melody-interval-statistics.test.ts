import { describe, expect, it } from "vitest";

import type { MelodyContinuousDiagnosticTrial } from "./melody-continuous-practice";
import {
  aggregateMelodyIntervalResults,
  classifyMelodyWrittenInterval,
  deriveMelodyIntervalOpportunities,
  getMelodyIntervalAccessibleLabel,
  getMelodyIntervalSemanticKey,
  getMelodyIntervalShortLabel,
  summarizeMelodyRepairIntervals,
  summarizeMelodySightReadIntervals,
} from "./melody-interval-statistics";
import type { MelodyAttemptResult, MelodyAttackEvaluation } from "./melody-scoring";
import type { MelodyExercise, MelodyWrittenPitch } from "./melody-types";

type Pitch = MelodyWrittenPitch & Readonly<{ midiNumber: number }>;

const pitch = (letter: Pitch["letter"], accidental: Pitch["accidental"], octave: number, midiNumber: number): Pitch =>
  Object.freeze({ letter, accidental, octave, midiNumber });

const C4 = pitch("C", "natural", 4, 60);

function result(
  pitches: readonly Pitch[],
  statuses: readonly MelodyAttackEvaluation["status"][],
  measureBreakAt = Number.POSITIVE_INFINITY,
  extras = 0,
): MelodyAttemptResult {
  const attacks = pitches.map((written, index): MelodyAttackEvaluation => Object.freeze({
    expectedAttack: Object.freeze({
      id: `expected-${index}`,
      exerciseId: "exercise",
      eventId: `event-${index}`,
      measureId: index >= measureBreakAt ? "measure-2" : "measure-1",
      measureIndex: index >= measureBreakAt ? 1 : 0,
      staff: "treble",
      startTick: index >= measureBreakAt ? 0 : index * 480,
      absoluteTick: index * 480,
      durationTicks: 480,
      midiNumber: written.midiNumber,
      writtenPitch: Object.freeze({ letter: written.letter, accidental: written.accidental, octave: written.octave }),
      expectedTimeSeconds: index,
      expectedTimeMs: index * 1000,
    }),
    performedAttack: null,
    status: statuses[index]!,
    pitchDistanceSemitones: statuses[index] === "missing" ? null : 0,
    pitchCredit: statuses[index] === "correct" ? 1 : 0,
    timingDeltaMs: statuses[index] === "missing" ? null : 0,
    timingErrorBeats: statuses[index] === "missing" ? null : 0,
    timingCredit: statuses[index] === "missing" ? 0 : 1,
  }));
  return Object.freeze({
    exerciseId: "exercise",
    attacks: Object.freeze(attacks),
    movements: Object.freeze([]),
    extras: Object.freeze(Array.from({ length: extras }, (_, index) => Object.freeze({
      id: `extra-${index}`, midiNumber: 61, source: "midi" as const,
      audioTimeSeconds: index, relativeTimeMs: index * 1000, sequenceIndex: index,
    }))),
    pitchScorePercent: 100,
    movementScorePercent: 0,
    timingScorePercent: 0,
    missedAttackCount: statuses.filter((status) => status === "missing").length,
    extraAttackCount: extras,
  });
}

function trial(originalResult: MelodyAttemptResult, retryResults: readonly MelodyAttemptResult[] = []): MelodyContinuousDiagnosticTrial {
  return Object.freeze({
    id: "trial",
    originalOrder: 1,
    exercise: Object.freeze({ id: "exercise" }) as MelodyExercise,
    originalResult,
    retryResults: Object.freeze([...retryResults]),
  });
}

describe("written Melody interval classification", () => {
  it.each([
    [C4, C4, { direction: "repeated", quality: "perfect", number: 1 }],
    [C4, pitch("D", "flat", 4, 61), { direction: "ascending", quality: "minor", number: 2 }],
    [C4, pitch("D", "natural", 4, 62), { direction: "ascending", quality: "major", number: 2 }],
    [pitch("C", "natural", 5, 72), pitch("B", "natural", 4, 71), { direction: "descending", quality: "minor", number: 2 }],
    [pitch("C", "natural", 5, 72), pitch("B", "flat", 4, 70), { direction: "descending", quality: "major", number: 2 }],
    [C4, pitch("E", "flat", 4, 63), { direction: "ascending", quality: "minor", number: 3 }],
    [C4, pitch("E", "natural", 4, 64), { direction: "ascending", quality: "major", number: 3 }],
    [C4, pitch("F", "natural", 4, 65), { direction: "ascending", quality: "perfect", number: 4 }],
    [C4, pitch("G", "natural", 4, 67), { direction: "ascending", quality: "perfect", number: 5 }],
    [C4, pitch("C", "natural", 5, 72), { direction: "ascending", quality: "perfect", number: 8 }],
  ] as const)("classifies supported simple intervals", (source, destination, expected) => {
    expect(classifyMelodyWrittenInterval(source, destination)).toEqual(expected);
  });

  it("distinguishes enharmonic augmented fourth and diminished fifth spellings", () => {
    const augmented = classifyMelodyWrittenInterval(C4, pitch("F", "sharp", 4, 66));
    const diminished = classifyMelodyWrittenInterval(C4, pitch("G", "flat", 4, 66));
    expect(augmented).toEqual({ direction: "ascending", quality: "augmented", number: 4 });
    expect(diminished).toEqual({ direction: "ascending", quality: "diminished", number: 5 });
    expect(getMelodyIntervalSemanticKey(augmented)).toBe("ascending|augmented|4");
    expect(getMelodyIntervalShortLabel(augmented)).toBe("↑ A4");
    expect(getMelodyIntervalAccessibleLabel(diminished)).toBe("Ascending diminished fifth");
  });

  it("labels repeated pitch accessibly and rejects enharmonic repeats and compounds", () => {
    const repeated = classifyMelodyWrittenInterval(C4, C4);
    expect(getMelodyIntervalShortLabel(repeated)).toBe("P1");
    expect(getMelodyIntervalAccessibleLabel(repeated)).toBe("Repeated pitch, perfect unison");
    expect(() => classifyMelodyWrittenInterval(
      pitch("C", "sharp", 4, 61), pitch("D", "flat", 4, 61),
    )).toThrow(/written as a unison/i);
    expect(() => classifyMelodyWrittenInterval(C4, pitch("D", "natural", 5, 74))).toThrow(/compound/i);
  });
});

describe("Melody interval opportunities", () => {
  it("excludes the first attack and preserves authored adjacency across a barline", () => {
    const opportunities = deriveMelodyIntervalOpportunities(result([
      C4, pitch("D", "natural", 4, 62), pitch("E", "natural", 4, 64),
    ], ["correct", "correct", "correct"], 2));
    expect(opportunities).toHaveLength(2);
    expect(opportunities.map(({ sourceExpectedAttackId, destinationExpectedAttackId }) =>
      [sourceExpectedAttackId, destinationExpectedAttackId])).toEqual([
      ["expected-0", "expected-1"], ["expected-1", "expected-2"],
    ]);
  });

  it("uses only destination pitch status and excludes extras, timing, and movement", () => {
    const opportunities = deriveMelodyIntervalOpportunities(result([
      C4, pitch("D", "natural", 4, 62), pitch("E", "natural", 4, 64), pitch("F", "natural", 4, 65),
    ], ["missing", "correct", "missing", "wrong-pitch"], Number.POSITIVE_INFINITY, 3));
    expect(opportunities.map(({ outcome }) => outcome)).toEqual(["correct", "error", "error"]);
    expect(opportunities).toHaveLength(3);
  });
});

describe("Melody interval aggregation", () => {
  const cToEError = result([C4, pitch("E", "natural", 4, 64)], ["correct", "missing"]);
  const gToBError = result([
    pitch("G", "natural", 4, 67), pitch("B", "natural", 4, 71),
  ], ["correct", "wrong-pitch"]);
  const cToECorrect = result([C4, pitch("E", "natural", 4, 64)], ["correct", "correct"]);

  it("aggregates the same written interval across keys and marks recurring evidence", () => {
    const report = aggregateMelodyIntervalResults([cToEError, gToBError, cToECorrect]);
    expect(report.needsAttention[0]).toMatchObject({
      opportunities: 3, correct: 1, errors: 2, errorRate: 2 / 3, sampleStatus: "recurring",
    });
  });

  it("keeps original Sight Read separate and includes every Repair retry", () => {
    const history = [trial(cToEError, [cToEError, cToECorrect])];
    expect(summarizeMelodySightReadIntervals(history).needsAttention[0]).toMatchObject({ opportunities: 1, errors: 1 });
    expect(summarizeMelodyRepairIntervals(history).needsAttention[0]).toMatchObject({ opportunities: 2, errors: 1 });
    expect(summarizeMelodySightReadIntervals(history).needsAttention[0]?.sampleStatus).toBe("limited-sample");
  });

  it("separates strong rows and ranks recurring, rate, counts, and identity deterministically", () => {
    const recurringM3 = [cToEError, cToEError];
    const recurringM2 = [
      result([C4, pitch("D", "natural", 4, 62)], ["correct", "missing"]),
      result([C4, pitch("D", "natural", 4, 62)], ["correct", "missing"]),
    ];
    const limitedP4 = result([C4, pitch("F", "natural", 4, 65)], ["correct", "missing"]);
    const report = aggregateMelodyIntervalResults([...recurringM3, ...recurringM2, limitedP4, cToECorrect]);
    expect(report.needsAttention.map(({ interval, sampleStatus }) =>
      [getMelodyIntervalSemanticKey(interval), sampleStatus])).toEqual([
      ["ascending|major|2", "recurring"],
      ["ascending|major|3", "recurring"],
      ["ascending|perfect|4", "limited-sample"],
    ]);
    expect(report.strong).toEqual([]);
  });

  it("returns safe frozen empty and strong reports without mutating input", () => {
    const input = [cToECorrect];
    const snapshot = JSON.stringify(input);
    const report = aggregateMelodyIntervalResults(input);
    expect(report.needsAttention).toEqual([]);
    expect(report.strong[0]).toMatchObject({ opportunities: 1, errors: 0, sampleStatus: "strong" });
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.needsAttention)).toBe(true);
    expect(Object.isFrozen(report.strong)).toBe(true);
    expect(aggregateMelodyIntervalResults([])).toEqual({ needsAttention: [], strong: [], totalOpportunities: 0, totalErrors: 0 });
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
