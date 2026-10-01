import { describe, expect, it } from "vitest";
import type { PiecePracticeAttackedPitch, PiecePracticeTarget } from "./piece-practice-types";
import { gradePiecePracticeTarget } from "./piece-practice-validation";

function attacked(sourcePitchId: string, midiNumber: number, letter: PiecePracticeAttackedPitch["letter"]): PiecePracticeAttackedPitch {
  return {
    sourceEventId: "event",
    sourcePitchId,
    staff: "treble",
    midiNumber,
    letter,
    accidental: "natural",
    octave: 4,
    duration: "quarter",
    durationTicks: 480,
    incomingTieIds: [],
    outgoingTieIds: [],
  };
}

function target(expectedMidiNumbers: readonly number[] = [60], attackedPitches: readonly PiecePracticeAttackedPitch[] = [attacked("c", 60, "C")]): PiecePracticeTarget {
  const base = {
    id: "m1:attack:0",
    measureIndex: 0,
    sourceMeasureId: "m1",
    startTick: 0,
    absoluteStartTick: 0,
    sourceEventIds: ["event"],
    expectedMidiNumbers,
    attackedPitches,
  };
  return { ...base, checks: [{ id: `${base.id}:normal`, kind: "normal", sourceEventIds: base.sourceEventIds, expectedMidiNumbers, attackedPitches }] };
}

describe("Piece Practice target grading", () => {
  it("grades submitted attacks strictly; focused optional input is classified before grading", () => {
    const chord = target([34, 38, 41]);
    const attempt = { attackMidiNumbers: [81, 34, 38], heldMidiNumbers: [99] };
    expect(gradePiecePracticeTarget(chord, attempt)).toMatchObject({ correct: false, missingMidiNumbers: [41], extraMidiNumbers: [81], unexpectedHeldMidiNumbers: [99] });
    expect(gradePiecePracticeTarget(chord, { attackMidiNumbers: [34, 38, 41] })).toMatchObject({ correct: true, receivedMidiNumbers: [34, 38, 41], extraMidiNumbers: [], unexpectedHeldMidiNumbers: [] });
  });

  it("allows predecessor A5 only as held, never as a new extra or a substitute for G5", () => {
    const current = target([79], [{ ...attacked("g5", 79, "G"), octave: 5 }]);
    const base = { heldMidiNumbers: [81, 79], allowedHeldMidiNumbers: [81] };
    expect(gradePiecePracticeTarget(current, { ...base, attackMidiNumbers: [79] })).toMatchObject({ correct: true });
    expect(gradePiecePracticeTarget(current, { ...base, attackMidiNumbers: [81, 79] })).toMatchObject({ correct: false, extraMidiNumbers: [81], unexpectedHeldMidiNumbers: [] });
    expect(gradePiecePracticeTarget(current, { ...base, attackMidiNumbers: [] })).toMatchObject({ correct: false, missingMidiNumbers: [79] });
  });
  it("accepts an exact single pitch", () => {
    expect(gradePiecePracticeTarget(target(), { attackMidiNumbers: [60] }).correct).toBe(true);
  });

  it("rejects a wrong single pitch", () => {
    expect(gradePiecePracticeTarget(target(), { attackMidiNumbers: [61] })).toMatchObject({ correct: false, missingMidiNumbers: [60], extraMidiNumbers: [61] });
  });

  it("accepts an exact chord independently of input ordering", () => {
    expect(gradePiecePracticeTarget(target([60, 64, 67]), { attackMidiNumbers: [67, 60, 64] }).correct).toBe(true);
  });

  it("reports a missing chord pitch", () => {
    expect(gradePiecePracticeTarget(target([60, 64, 67]), { attackMidiNumbers: [60, 67] })).toMatchObject({ correct: false, missingMidiNumbers: [64], extraMidiNumbers: [] });
  });

  it("reports an extra chord pitch", () => {
    expect(gradePiecePracticeTarget(target([60, 64, 67]), { attackMidiNumbers: [60, 64, 67, 69] })).toMatchObject({ correct: false, missingMidiNumbers: [], extraMidiNumbers: [69] });
  });

  it("deduplicates repeated note-ons", () => {
    expect(gradePiecePracticeTarget(target([60, 64]), { attackMidiNumbers: [60, 60, 64, 64] })).toMatchObject({ correct: true, receivedMidiNumbers: [60, 64] });
  });

  it("requires an identical cross-staff MIDI target only once", () => {
    const crossStaff = [attacked("treble-c", 60, "C"), { ...attacked("bass-c", 60, "C"), sourceEventId: "bass", staff: "bass" as const }];
    const grade = gradePiecePracticeTarget(target([60], crossStaff), { attackMidiNumbers: [60] });
    expect(grade.correct).toBe(true);
    expect(grade.expectedWrittenPitches).toHaveLength(2);
  });

  it("returns deterministic expected, received, missing, and extra details", () => {
    expect(gradePiecePracticeTarget(target([60, 64, 67]), { attackMidiNumbers: [72, 67, 60, 72] })).toMatchObject({
      expectedMidiNumbers: [60, 64, 67],
      receivedMidiNumbers: [60, 67, 72],
      missingMidiNumbers: [64],
      extraMidiNumbers: [72],
    });
  });

  it("returns source written spelling without using it for sounding-pitch correctness", () => {
    const dFlat = { ...attacked("db", 61, "D"), accidental: "flat" as const };
    const grade = gradePiecePracticeTarget(target([61], [dFlat]), { attackMidiNumbers: [61] });
    expect(grade.correct).toBe(true);
    expect(grade.expectedWrittenPitches[0]).toMatchObject({ midiNumber: 61, letter: "D", accidental: "flat" });
  });

  it("allows only explicitly approved held pitches without treating them as attacks", () => {
    expect(gradePiecePracticeTarget(target(), { attackMidiNumbers: [60], heldMidiNumbers: [48, 60], allowedHeldMidiNumbers: [48] })).toMatchObject({ correct: true, unexpectedHeldMidiNumbers: [] });
    expect(gradePiecePracticeTarget(target(), { attackMidiNumbers: [60], heldMidiNumbers: [49, 60], allowedHeldMidiNumbers: [48] })).toMatchObject({ correct: false, unexpectedHeldMidiNumbers: [49] });
  });

  it("does not let an allowed held pitch satisfy a missing attack", () => {
    expect(gradePiecePracticeTarget(target(), { attackMidiNumbers: [], heldMidiNumbers: [60], allowedHeldMidiNumbers: [60] })).toMatchObject({ correct: false, missingMidiNumbers: [60] });
  });
});
