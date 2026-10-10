import { describe, expect, it } from "vitest";
import { getInstrumentLiveContext, type InstrumentPitchContext } from "./instrument-pitch-context";
import { getOcarinaFingering, getOcarinaLiveFingering, OCARINA_HOLES, OCARINA_PROFILE, OCARINA_PITCHES, ocarinaFingeringInstruction } from "./ocarina-fingering";
import { describeFrequency, equalTemperedFrequency } from "@/lib/audio/monophonic/pitch-math";
import type { PitchSnapshot } from "@/lib/audio/monophonic/pitch-analysis-types";

const ids = ["LI", "LM", "LR", "LP", "RI", "RM", "RR", "RP", "LT", "RT", "SL", "SR"];
// Independently specified COVERED holes, rather than copying production open-hole data.
const cases = [
  [69, "A4", ids], [71, "B4", ids.filter((id) => id !== "SL")],
  [72, "C5", ids.slice(0, 10)], [74, "D5", ["LI", "LM", "LR", "LP", "RI", "RM", "RR", "LT", "RT"]],
  [76, "E5", ["LI", "LM", "LR", "LP", "RI", "RM", "LT", "RT"]],
  [77, "F5", ["LI", "LM", "LR", "LP", "RI", "LT", "RT"]],
  [79, "G5", ["LI", "LM", "LR", "LP", "LT", "RT"]], [81, "A5", ["LI", "LM", "LP", "LT", "RT"]],
  [83, "B5", ["LI", "LP", "LT", "RT"]], [84, "C6", ["LP", "LT", "RT"]],
  [86, "D6", ["LP", "RT"]], [88, "E6", ["LP"]], [89, "F6", []],
] as const;
const context = (detected = 76): InstrumentPitchContext => ({ expected: { semitone: 72, label: "C5" },
  live: { state: "live", pitch: describeFrequency(equalTemperedFrequency(detected)) }, pitchLabels: { 76: "E5", 75: "E♭5" } });

describe("provisional standard Alto C ocarina profile", () => {
  it("has exactly twelve stable, named logical holes with explicit hands, thumbs and subholes", () => {
    expect(OCARINA_HOLES.map(({ id }) => id)).toEqual(ids);
    expect(OCARINA_HOLES.filter(({ group }) => group === "left").map(({ id }) => id)).toEqual(ids.slice(0, 4));
    expect(OCARINA_HOLES.filter(({ group }) => group === "right").map(({ id }) => id)).toEqual(ids.slice(4, 8));
    expect(OCARINA_HOLES.filter(({ group }) => group === "thumb").map(({ id }) => id)).toEqual(["LT", "RT"]);
    expect(OCARINA_HOLES.filter(({ group }) => group === "subhole").map(({ id }) => id)).toEqual(["SL", "SR"]);
    expect(OCARINA_HOLES.every(({ label }) => !!label)).toBe(true);
  });
  it.each(cases)("maps concert MIDI %s / %s to the supplied covered holes", (midi, note, covered) => {
    const fingering = getOcarinaFingering(midi)!;
    expect(fingering.note).toBe(note);
    expect(Object.keys(fingering.covered)).toEqual(ids);
    for (const id of OCARINA_HOLES.map(({ id }) => id)) expect(fingering.covered[id], id).toBe((covered as readonly string[]).includes(id));
  });
  it("bounds the immutable profile to thirteen notes without manufacturer verification", () => {
    expect(OCARINA_PITCHES).toEqual(cases.map(([midi]) => midi));
    expect(OCARINA_PROFILE.name).toBe("Standard 12-hole Alto C — provisional profile");
    expect(OCARINA_PROFILE.verification).toContain("not verified");
    for (const item of [OCARINA_PROFILE, OCARINA_PROFILE.fingerings, OCARINA_HOLES, OCARINA_PITCHES,
      ...OCARINA_HOLES, ...OCARINA_PROFILE.fingerings, ...OCARINA_PROFILE.fingerings.map(({ covered }) => covered)]) expect(Object.isFrozen(item)).toBe(true);
  });
  it.each([null, NaN, Infinity, -1, 68, 70, 73, 75, 78, 80, 82, 85, 87, 90, 128, 72.5])("offers no invented fingering for %s", (midi) => {
    expect(getOcarinaFingering(midi)).toBeNull();
  });
  it("derives correct finger, thumb and subhole instructions including low and high boundaries", () => {
    expect(ocarinaFingeringInstruction(getOcarinaFingering(69)!)).toContain("both subholes");
    expect(ocarinaFingeringInstruction(getOcarinaFingering(71)!)).toContain("Cover the right subhole; leave the other subhole open");
    expect(ocarinaFingeringInstruction(getOcarinaFingering(76)!)).toContain("lift your right ring and pinky fingers");
    expect(ocarinaFingeringInstruction(getOcarinaFingering(76)!)).toContain("Keep both thumbs covered");
    expect(ocarinaFingeringInstruction(getOcarinaFingering(86)!)).toContain("Lift your left thumb; keep your right thumb covered");
    expect(ocarinaFingeringInstruction(getOcarinaFingering(88)!)).toContain("Lift both thumbs");
    expect(ocarinaFingeringInstruction(getOcarinaFingering(89)!)).toContain("Lift all eight fingers and both thumbs");
  });
  it("keeps live suggestions independent from the expected pitch and uses score-aware spelling", () => {
    expect(getOcarinaLiveFingering(context()).fingering?.semitone).toBe(76);
    expect(getOcarinaLiveFingering({ ...context(), expected: { semitone: 89, label: "F6" } })).toEqual(getOcarinaLiveFingering(context()));
    expect(getOcarinaLiveFingering(context(75))).toMatchObject({ label: "E♭5", fingering: null });
    expect(getOcarinaLiveFingering({ ...context(), pitchLabels: { 76: "F♭5" } }).label).toBe("F♭5");
  });
  it.each(["absent", "uncertain", "stale"] as const)("ignores retained pitch when context is %s", (state) => {
    expect(getOcarinaLiveFingering({ ...context(), live: { ...context().live, state } }).fingering).toBeNull();
  });
  it("uses the existing capture freshness boundary rather than history or graded attempts", () => {
    const reading: PitchSnapshot = { state: "stable", fresh: true, ageMs: 120, pitch: { semitone: 76, frequencyHz: equalTemperedFrequency(76) } };
    expect(getOcarinaLiveFingering({ ...context(), live: getInstrumentLiveContext("listening", reading) }).fingering?.semitone).toBe(76);
    for (const snapshot of [{ ...reading, ageMs: 121 }, { ...reading, fresh: false }, { ...reading, state: "uncertain" as const }, { ...reading, pitch: null }]) {
      expect(getOcarinaLiveFingering({ ...context(), live: getInstrumentLiveContext("listening", snapshot) }).fingering).toBeNull();
    }
    expect(getOcarinaLiveFingering({ ...context(), live: getInstrumentLiveContext("paused", reading) }).fingering).toBeNull();
  });
});
