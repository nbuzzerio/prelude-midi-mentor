import { describe, expect, it } from "vitest";
import { DEFAULT_SEQUENCE_CONFIG, parseSequenceConfig, sequenceConfigToSettings, sequenceSettingsToConfig } from "./sequence-config";

const defaults = DEFAULT_SEQUENCE_CONFIG;
describe("Sequence configuration", () => {
  it("preserves the exact standalone defaults", () => {
    expect(defaults).toEqual({"schemaVersion": 1, "exerciseType": "intervals", "mode": "treble", "showTargetName": false, "enabledDirections": ["ascending"], "enabledIntervals": ["minor-second", "major-second", "minor-third", "major-third"], "enabledNoteCategories": ["naturals"], "enabledScales": ["major"], "enabledScaleDirections": ["ascending"], "enabledArpeggios": ["major"], "enabledArpeggioDirections": ["ascending-descending"], "enabledChordProgressionKeyIds": ["c-major"], "enabledChordProgressionTemplateIds": ["major-1451"]});
  });
  it("round trips JSON through detached runtime Sets without callbacks", () => {
    const runtime = sequenceConfigToSettings(defaults);
    const plain = sequenceSettingsToConfig(runtime);
    expect(plain).toEqual(defaults);
    expect(JSON.parse(JSON.stringify(plain))).toEqual(defaults);
    for (const field of ["enabledDirections", "enabledIntervals", "enabledNoteCategories", "enabledScales", "enabledScaleDirections", "enabledArpeggios", "enabledArpeggioDirections", "enabledChordProgressionKeyIds", "enabledChordProgressionTemplateIds"] as const) {
      expect(runtime[field]).toBeInstanceOf(Set);
      expect(Array.isArray(plain[field])).toBe(true);
      expect(plain[field]).not.toBe(defaults[field]);
    }
    const parsed = parseSequenceConfig(JSON.parse(JSON.stringify(plain)));
    expect(parsed).toEqual({ ok: true, value: defaults });
  });
  it.each(["exerciseType", "mode", "showTargetName", "enabledDirections", "enabledIntervals", "enabledNoteCategories", "enabledScales", "enabledScaleDirections", "enabledArpeggios", "enabledArpeggioDirections", "enabledChordProgressionKeyIds", "enabledChordProgressionTemplateIds"])("rejects invalid values for %s", (field) => {
    expect(parseSequenceConfig({ ...defaults, [field]: "invalid" })).toEqual({ ok: false, reason: "corrupt" });
  });
  it.each(["enabledDirections", "enabledIntervals", "enabledNoteCategories", "enabledScales", "enabledScaleDirections", "enabledArpeggios", "enabledArpeggioDirections", "enabledChordProgressionKeyIds", "enabledChordProgressionTemplateIds"])("rejects empty, duplicate, and unknown selections for %s", (field) => {
    for (const selection of [[], ["unknown"], ["major", "major"]]) {
      expect(parseSequenceConfig({ ...defaults, [field]: selection }).ok).toBe(false);
    }
  });
  it("distinguishes unsupported versions from malformed configuration", () => {
    expect(parseSequenceConfig({ ...defaults, schemaVersion: 2 })).toEqual({ ok: false, reason: "unsupported" });
    for (const value of [null, [], {}, { ...defaults, schemaVersion: "1" }, { ...defaults, quota: 10 }]) {
      expect(parseSequenceConfig(value)).toEqual({ ok: false, reason: "corrupt" });
    }
  });
  it("does not share mutable selections between settings instances", () => {
    const first = sequenceConfigToSettings(defaults);
    const second = sequenceConfigToSettings(defaults);
    expect(first.enabledDirections).not.toBe(second.enabledDirections);
  });
});

it.each(["intervals", "scales", "arpeggios", "chord-progressions"] as const)("validates the complete %s prescription including retained subtype settings", (exerciseType) => {
  expect(parseSequenceConfig({ ...defaults, exerciseType }).ok).toBe(true);
  expect(parseSequenceConfig({ ...defaults, exerciseType, enabledScales: ["dominant-seventh"] }).ok).toBe(false);
  expect(parseSequenceConfig({ ...defaults, exerciseType, enabledArpeggios: ["harmonic-minor"] }).ok).toBe(false);
  expect(parseSequenceConfig({ ...defaults, exerciseType, enabledDirections: ["ascending-descending"] }).ok).toBe(false);
});
it("rejects incompatible progressions and preserves the existing at-least-one-compatible-pair rule", () => {
  expect(parseSequenceConfig({ ...defaults, exerciseType: "chord-progressions", enabledChordProgressionKeyIds: ["a-minor"] }).ok).toBe(false);
  expect(parseSequenceConfig({ ...defaults, enabledChordProgressionKeyIds: ["a-minor", "c-major"] }).ok).toBe(true);
});
