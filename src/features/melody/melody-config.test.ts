import { describe, expect, it } from "vitest";
import { DEFAULT_MELODY_CONFIG, parseMelodyConfig, melodyConfigToSettings, melodySettingsToConfig } from "./melody-config";

describe("Melody configuration", () => {
  it("preserves generation and timed setup defaults", () => {
    expect(DEFAULT_MELODY_CONFIG).toEqual({ schemaVersion: 1, staff: "treble", keyId: "c-major", tempoBpm: 60, measureCount: 1, pitchDifficulty: "easy", rhythmDifficulty: "easy", continuousPractice: false, continuousDurationMinutes: 5 });
  });
  it("separates generation settings from timed options and round trips a nondefault prescription", () => {
    const config = { ...DEFAULT_MELODY_CONFIG, staff: "bass" as const, continuousPractice: true, continuousDurationMinutes: 2 as const };
    const settings = melodyConfigToSettings(config);
    expect(settings).toEqual({ staff: "bass", keyId: "c-major", tempoBpm: 60, measureCount: 1, pitchDifficulty: "easy", rhythmDifficulty: "easy" });
    const plain = melodySettingsToConfig(settings, config);
    expect(JSON.parse(JSON.stringify(plain))).toEqual(config);
    expect(parseMelodyConfig(plain)).toEqual({ ok: true, value: config });
  });
  it.each(["staff", "keyId", "tempoBpm", "measureCount", "pitchDifficulty", "rhythmDifficulty", "continuousPractice", "continuousDurationMinutes"])("rejects invalid %s", (field) => {
    expect(parseMelodyConfig({ ...DEFAULT_MELODY_CONFIG, [field]: "invalid" })).toEqual({ ok: false, reason: "corrupt" });
  });
  it("rejects runtime fields and reports unsupported versions", () => {
    expect(parseMelodyConfig({ ...DEFAULT_MELODY_CONFIG, deadlineMs: 1 }).ok).toBe(false);
    expect(parseMelodyConfig({ ...DEFAULT_MELODY_CONFIG, schemaVersion: 2 })).toEqual({ ok: false, reason: "unsupported" });
    expect(parseMelodyConfig({ ...DEFAULT_MELODY_CONFIG, tempoBpm: 55 }).ok).toBe(false);
  });
});
