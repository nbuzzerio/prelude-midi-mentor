import { describe, expect, it } from "vitest";
import { DEFAULT_EAR_TRAINING_CONFIG, parseEarTrainingConfig, earTrainingConfigToSettings, earTrainingSettingsToConfig } from "./ear-training-config";

const defaults = DEFAULT_EAR_TRAINING_CONFIG;
describe("EarTraining configuration", () => {
  it("preserves the exact standalone defaults", () => {
    expect(defaults).toEqual({"schemaVersion": 1, "enabledIntervals": ["minor-second", "major-second", "minor-third", "major-third"], "enabledDirections": ["ascending"]});
  });
  it("round trips JSON through detached runtime Sets without callbacks", () => {
    const runtime = earTrainingConfigToSettings(defaults);
    const plain = earTrainingSettingsToConfig(runtime);
    expect(plain).toEqual(defaults);
    expect(JSON.parse(JSON.stringify(plain))).toEqual(defaults);
    for (const field of ["enabledIntervals", "enabledDirections"] as const) {
      expect(runtime[field]).toBeInstanceOf(Set);
      expect(Array.isArray(plain[field])).toBe(true);
      expect(plain[field]).not.toBe(defaults[field]);
    }
    const parsed = parseEarTrainingConfig(JSON.parse(JSON.stringify(plain)));
    expect(parsed).toEqual({ ok: true, value: defaults });
  });
  it.each(["enabledIntervals", "enabledDirections"])("rejects invalid values for %s", (field) => {
    expect(parseEarTrainingConfig({ ...defaults, [field]: "invalid" })).toEqual({ ok: false, reason: "corrupt" });
  });
  it.each(["enabledIntervals", "enabledDirections"])("rejects empty, duplicate, and unknown selections for %s", (field) => {
    for (const selection of [[], ["unknown"], ["major", "major"]]) {
      expect(parseEarTrainingConfig({ ...defaults, [field]: selection }).ok).toBe(false);
    }
  });
  it("distinguishes unsupported versions from malformed configuration", () => {
    expect(parseEarTrainingConfig({ ...defaults, schemaVersion: 2 })).toEqual({ ok: false, reason: "unsupported" });
    for (const value of [null, [], {}, { ...defaults, schemaVersion: "1" }, { ...defaults, quota: 10 }]) {
      expect(parseEarTrainingConfig(value)).toEqual({ ok: false, reason: "corrupt" });
    }
  });
  it("does not share mutable selections between settings instances", () => {
    const first = earTrainingConfigToSettings(defaults);
    const second = earTrainingConfigToSettings(defaults);
    expect(first.enabledIntervals).not.toBe(second.enabledIntervals);
  });
});
