import { describe, expect, it } from "vitest";
import { DEFAULT_FLASHCARD_CONFIG, parseFlashcardConfig, flashcardConfigToSettings, flashcardSettingsToConfig } from "./flashcard-config";

const defaults = DEFAULT_FLASHCARD_CONFIG;
describe("Flashcard configuration", () => {
  it("preserves the exact standalone defaults", () => {
    expect(defaults).toEqual({"schemaVersion": 1, "mode": "bass", "showTargetName": false, "replayCorrectVirtualChords": true, "enabledExerciseTypes": ["notes"], "enabledNoteCategories": ["naturals"], "enabledTriadQualities": ["major"], "enabledTriadPositions": ["root"]});
  });
  it("round trips JSON through detached runtime Sets without callbacks", () => {
    const runtime = flashcardConfigToSettings(defaults);
    const plain = flashcardSettingsToConfig(runtime);
    expect(plain).toEqual(defaults);
    expect(JSON.parse(JSON.stringify(plain))).toEqual(defaults);
    for (const field of ["enabledExerciseTypes", "enabledNoteCategories", "enabledTriadQualities", "enabledTriadPositions"] as const) {
      expect(runtime[field]).toBeInstanceOf(Set);
      expect(Array.isArray(plain[field])).toBe(true);
      expect(plain[field]).not.toBe(defaults[field]);
    }
    const parsed = parseFlashcardConfig(JSON.parse(JSON.stringify(plain)));
    expect(parsed).toEqual({ ok: true, value: defaults });
  });
  it.each(["mode", "showTargetName", "replayCorrectVirtualChords", "enabledExerciseTypes", "enabledNoteCategories", "enabledTriadQualities", "enabledTriadPositions"])("rejects invalid values for %s", (field) => {
    expect(parseFlashcardConfig({ ...defaults, [field]: "invalid" })).toEqual({ ok: false, reason: "corrupt" });
  });
  it.each(["enabledExerciseTypes", "enabledNoteCategories", "enabledTriadQualities", "enabledTriadPositions"])("rejects empty, duplicate, and unknown selections for %s", (field) => {
    for (const selection of [[], ["unknown"], ["major", "major"]]) {
      expect(parseFlashcardConfig({ ...defaults, [field]: selection }).ok).toBe(false);
    }
  });
  it("distinguishes unsupported versions from malformed configuration", () => {
    expect(parseFlashcardConfig({ ...defaults, schemaVersion: 2 })).toEqual({ ok: false, reason: "unsupported" });
    for (const value of [null, [], {}, { ...defaults, schemaVersion: "1" }, { ...defaults, quota: 10 }]) {
      expect(parseFlashcardConfig(value)).toEqual({ ok: false, reason: "corrupt" });
    }
  });
  it("does not share mutable selections between settings instances", () => {
    const first = flashcardConfigToSettings(defaults);
    const second = flashcardConfigToSettings(defaults);
    expect(first.enabledExerciseTypes).not.toBe(second.enabledExerciseTypes);
  });
});
