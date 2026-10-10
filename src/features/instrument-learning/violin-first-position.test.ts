import { describe, expect, it } from "vitest";
import { describeFrequency, equalTemperedFrequency } from "@/lib/audio/monophonic/pitch-math";
import type { InstrumentPitchContext } from "./instrument-pitch-context";
import { getViolinLivePosition, selectViolinExpectedPosition, violinFirstPositionLocations, violinPositionFraction, type ViolinStringId } from "./violin-first-position";

const supplied = [
  ["G", 55, ["G3", "G♯3", "A3", "B♭3", "B3", "C4", "C♯4", "D4"]],
  ["D", 62, ["D4", "E♭4", "E4", "F4", "F♯4", "G4", "G♯4", "A4"]],
  ["A", 69, ["A4", "B♭4", "B4", "C5", "C♯5", "D5", "E♭5", "E5"]],
  ["E", 76, ["E5", "F5", "F♯5", "G5", "G♯5", "A5", "B♭5", "B5"]],
] as const;
const fingers = [0, 1, 1, 2, 2, 3, 3, 4];
const labels = ["Open", "Low 1", "1", "Low 2", "High 2", "3", "High 3", "4"];
const combinations = supplied.flatMap(([stringId, open, notes]) => notes.map((note, offset) => ({ stringId, midi: open + offset, note, offset })));
const context = (expected = 62, detected = 64): InstrumentPitchContext => ({ expected: { semitone: expected, label: "target" },
  live: { state: "live", pitch: describeFrequency(equalTemperedFrequency(detected)) }, pitchLabels: {} });

describe("owner-supplied bounded first-position profile", () => {
  it.each(combinations)("maps $note on $stringId at offset $offset", ({ stringId, midi, offset }) => {
    const found = violinFirstPositionLocations(midi).find((position) => position.stringId === stringId);
    expect(found).toMatchObject({ semitone: midi, offset, finger: fingers[offset], label: labels[offset] });
    expect(found!.fraction).toBeGreaterThanOrEqual(0); expect(found!.fraction).toBeLessThan(0.5);
  });
  it.each([[62, "D", "G"], [69, "A", "D"], [76, "E", "A"]] as const)("recommends open %s and exposes fourth-finger alternate", (midi, open, alternate) => {
    expect(violinFirstPositionLocations(midi).map(({ stringId, finger }) => [stringId, finger])).toEqual([[open, 0], [alternate, 4]]);
    expect(selectViolinExpectedPosition(midi, "auto")).toMatchObject({ stringId: open, provenance: "Suggested" });
    expect(selectViolinExpectedPosition(midi, alternate)).toMatchObject({ stringId: alternate, provenance: "User-selected", position: { finger: 4 } });
  });
  it.each([54, 84, 0, 127, 62.5, NaN])("does not invent locations for %s", (midi) => {
    expect(violinFirstPositionLocations(midi)).toEqual([]);
  });
  it("never remaps an impossible selected string or fabricates a recommendation without a target", () => {
    expect(selectViolinExpectedPosition(76, "G")).toMatchObject({ stringId: "G", position: null, provenance: "User-selected" });
    expect(selectViolinExpectedPosition(null, "auto")).toMatchObject({ stringId: null, position: null, recommended: null });
  });
  it("uses a proportional ideal-string geometry with narrowing spacing", () => {
    expect(violinPositionFraction(0)).toBe(0); expect(violinPositionFraction(12)).toBe(0.5);
    expect(violinPositionFraction(7)).toBeCloseTo(0.3325800729, 9);
    const gaps = Array.from({ length: 7 }, (_, i) => violinPositionFraction(i + 1)! - violinPositionFraction(i)!);
    expect(gaps.every((gap, i) => gap > 0 && (i === 0 || gap < gaps[i - 1]))).toBe(true);
    expect(violinPositionFraction(-0.1)).toBeNull(); expect(violinPositionFraction(NaN)).toBeNull();
  });
});

describe("pitch-derived possible positions", () => {
  it("uses actual frequency continuously on the assumed string independently of target pitch", () => {
    const initial = getViolinLivePosition(context(), "D");
    expect(initial.position).toMatchObject({ stringId: "D", semitone: 64, label: "1" });
    const shifted = { ...context(), live: { state: "live" as const, pitch: describeFrequency(equalTemperedFrequency(64) * 2 ** (20 / 1200)) } };
    expect(getViolinLivePosition(shifted, "D").position!.fraction).toBeGreaterThan(initial.position!.fraction);
    expect(initial.message).toContain("inferred from pitch only");
  });
  it.each(["uncertain", "stale", "absent"] as const)("never uses a retained pitch as a position when %s", (state) => {
    expect(getViolinLivePosition({ ...context(), live: { state, pitch: context().live.pitch } }, "D").position).toBeNull();
  });
  it.each([[76, 64, "D"], [55, 74, "A"], [62, 86, "E"]] as const)("suppresses possible harmonic/different-note pitch %s → %s", (expected, detected, stringId) => {
    expect(getViolinLivePosition(context(expected, detected), stringId).message).toContain("Possible harmonic or different note");
  });
  it.each([null, "G"] as const)("does not force a pitch onto unsupported string %s", (stringId) => {
    expect(getViolinLivePosition(context(), stringId).position).toBeNull();
  });
  it("honestly rejects pitch below the selected concert-pitch open string and invalid frequency", () => {
    const below = { ...context(), live: { state: "live" as const, pitch: describeFrequency(equalTemperedFrequency(62) * 2 ** (-10 / 1200)) } };
    expect(getViolinLivePosition(below, "D").message).toContain("below the D open-string reference");
    expect(getViolinLivePosition({ ...context(), live: { state: "live", pitch: describeFrequency(3000) } }, "E").position).toBeNull();
  });
  it.each(["G", "D", "A", "E"] as ViolinStringId[])("never invents a physical fingering assertion for %s", (stringId) => {
    expect(getViolinLivePosition(context(), stringId).message).not.toMatch(/your (actual )?(finger|string)|accepted|correct/i);
  });
});
