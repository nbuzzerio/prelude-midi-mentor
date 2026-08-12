import { describe, expect, it } from "vitest";
import { alignMelodyAttacks, getMelodyAlignmentCandidateWindowMs } from "./melody-alignment";
import type { MelodyPerformedAttack } from "./melody-performance";
import type { MelodyTimedExpectedAttack } from "./melody-timing";

function expected(midis: readonly number[], times: readonly number[] = midis.map((_, index) => index * 1000)): MelodyTimedExpectedAttack[] {
  return midis.map((midiNumber, index) => ({
    id: `e${index}`, exerciseId: "exercise", eventId: `event${index}`, measureId: index < 4 ? "m0" : "m1",
    measureIndex: index < 4 ? 0 : 1, staff: "treble", startTick: (index % 4) * 480,
    absoluteTick: index * 480, durationTicks: 480, midiNumber,
    writtenPitch: { letter: "C", accidental: "natural", octave: 4 },
    expectedTimeSeconds: times[index]! / 1000, expectedTimeMs: times[index]!,
  }));
}

function performed(midis: readonly number[], times: readonly number[]): MelodyPerformedAttack[] {
  return midis.map((midiNumber, index) => Object.freeze({
    id: `p${index}`, midiNumber, source: "midi", audioTimeSeconds: times[index]! / 1000,
    relativeTimeMs: times[index]!, sequenceIndex: index,
  }));
}

const kinds = (value: ReturnType<typeof alignMelodyAttacks>) => value.map((item) => item.kind);

describe("Melody monotonic alignment", () => {
  it("aligns a perfect performance", () => {
    expect(kinds(alignMelodyAttacks(expected([60, 62, 64, 65]), performed([60, 62, 64, 65], [0, 1000, 2000, 3000]), 60))).toEqual(["matched", "matched", "matched", "matched"]);
  });

  it("keeps a timing-aligned wrong pitch as a match", () => {
    const result = alignMelodyAttacks(expected([60, 62, 64]), performed([60, 64, 64], [0, 1000, 2000]), 60);
    expect(kinds(result)).toEqual(["matched", "matched", "matched"]);
    expect(result[1]).toMatchObject({ kind: "matched", expected: { midiNumber: 62 }, performed: { midiNumber: 64 } });
  });

  it("recovers after a missing expected attack", () => {
    const result = alignMelodyAttacks(expected([60, 62, 64, 65]), performed([60, 62, 65], [0, 1000, 3000]), 60);
    expect(kinds(result)).toEqual(["matched", "matched", "missing", "matched"]);
    expect(result.at(-1)).toMatchObject({ expected: { midiNumber: 65 }, performed: { midiNumber: 65 } });
  });

  it("recovers after an extra performed attack", () => {
    const result = alignMelodyAttacks(expected([60, 62, 64, 65]), performed([60, 62, 61, 64, 65], [0, 1000, 1500, 2000, 3000]), 60);
    expect(kinds(result)).toEqual(["matched", "matched", "extra", "matched", "matched"]);
  });

  it.each([50, 60, 70, 80])("scales its candidate window at %i BPM", (bpm) => {
    expect(getMelodyAlignmentCandidateWindowMs(bpm)).toBeCloseTo((60_000 / bpm) * 0.75);
    const window = getMelodyAlignmentCandidateWindowMs(bpm);
    expect(kinds(alignMelodyAttacks(expected([60], [0]), performed([60], [window]), bpm))).toEqual(["matched"]);
    expect(kinds(alignMelodyAttacks(expected([60], [0]), performed([60], [window + 0.01]), bpm))).toEqual(["extra", "missing"]);
  });

  it.each([60, 80])("prefers a quick correct correction at %i BPM", (bpm) => {
    const beatMs = 60_000 / bpm;
    const result = alignMelodyAttacks(expected([60, 62], [0, beatMs]), performed([60, 64, 62], [0, beatMs - 100, beatMs + 50]), bpm);
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "extra", performed: expect.objectContaining({ midiNumber: 64 }) }),
      expect.objectContaining({ kind: "matched", expected: expect.objectContaining({ midiNumber: 62 }), performed: expect.objectContaining({ midiNumber: 62 }) }),
    ]));
  });

  it("recovers through a two-measure barline", () => {
    const result = alignMelodyAttacks(expected([60, 62, 64, 65, 67, 69], [0, 1000, 2000, 3000, 4000, 5000]), performed([60, 62, 61, 65, 67, 69], [0, 1000, 2900, 3000, 4000, 5000]), 60);
    expect(result.filter(({ kind }) => kind === "missing")).toHaveLength(1);
    expect(result.filter(({ kind }) => kind === "extra")).toHaveLength(1);
    expect(result.at(-1)).toMatchObject({ kind: "matched", expected: { id: "e5" }, performed: { id: "p5" } });
  });

  it("is deterministic for equivalent-cost inputs", () => {
    const args = [expected([60, 62]), performed([61, 61], [0, 1000]), 60] as const;
    expect(alignMelodyAttacks(...args)).toEqual(alignMelodyAttacks(...args));
    expect(Object.isFrozen(alignMelodyAttacks(...args))).toBe(true);
  });
});
