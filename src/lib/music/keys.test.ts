import { describe, expect, it } from "vitest";

import { getPitchClass } from "./note-utils";
import {
  MUSIC_KEYS,
  getMusicKeyDefinition,
  getMusicKeysByMode,
} from "./keys";

const EXPECTED_KEYS = [
  ["c-major", "C major", "major", "C", 0, "C", "neutral", ["C", "D", "E", "F", "G", "A", "B"]],
  ["g-major", "G major", "major", "G", 7, "G", "sharp", ["G", "A", "B", "C", "D", "E", "F♯"]],
  ["d-major", "D major", "major", "D", 2, "D", "sharp", ["D", "E", "F♯", "G", "A", "B", "C♯"]],
  ["f-major", "F major", "major", "F", 5, "F", "flat", ["F", "G", "A", "B♭", "C", "D", "E"]],
  ["b-flat-major", "B♭ major", "major", "B♭", 10, "Bb", "flat", ["B♭", "C", "D", "E♭", "F", "G", "A"]],
  ["e-flat-major", "E♭ major", "major", "E♭", 3, "Eb", "flat", ["E♭", "F", "G", "A♭", "B♭", "C", "D"]],
  ["a-minor", "A minor", "minor", "A", 9, "Am", "neutral", ["A", "B", "C", "D", "E", "F", "G"]],
  ["e-minor", "E minor", "minor", "E", 4, "Em", "sharp", ["E", "F♯", "G", "A", "B", "C", "D"]],
  ["b-minor", "B minor", "minor", "B", 11, "Bm", "sharp", ["B", "C♯", "D", "E", "F♯", "G", "A"]],
  ["d-minor", "D minor", "minor", "D", 2, "Dm", "flat", ["D", "E", "F", "G", "A", "B♭", "C"]],
  ["g-minor", "G minor", "minor", "G", 7, "Gm", "flat", ["G", "A", "B♭", "C", "D", "E♭", "F"]],
  ["c-minor", "C minor", "minor", "C", 0, "Cm", "flat", ["C", "D", "E♭", "F", "G", "A♭", "B♭"]],
] as const;

describe("shared music keys", () => {
  it("defines the exact approved keys and notation metadata", () => {
    expect(
      MUSIC_KEYS.map((key) => [
        key.id,
        key.name,
        key.mode,
        key.tonicName,
        key.tonicPitchClass,
        key.vexflowKeySignature,
        key.orientation,
        key.diatonicScale.map((degree) => degree.name),
      ]),
    ).toEqual(EXPECTED_KEYS);
  });

  it("has unique stable IDs and filters keys by mode", () => {
    expect(new Set(MUSIC_KEYS.map((key) => key.id))).toHaveLength(12);
    expect(getMusicKeysByMode("major").map((key) => key.id)).toEqual(
      EXPECTED_KEYS.slice(0, 6).map(([id]) => id),
    );
    expect(getMusicKeysByMode("minor").map((key) => key.id)).toEqual(
      EXPECTED_KEYS.slice(6).map(([id]) => id),
    );
  });

  it("keeps every definition internally coherent", () => {
    for (const key of MUSIC_KEYS) {
      expect(key.diatonicScale).toHaveLength(7);
      expect(key.diatonicScale[0]?.name).toBe(key.tonicName);
      expect(key.diatonicScale[0]?.letter).toBe(key.tonicLetter);
      expect(key.diatonicScale[0]?.pitchClass).toBe(key.tonicPitchClass);
      expect(new Set(key.diatonicScale.map((degree) => degree.letter))).toHaveLength(7);
      expect(new Set(key.diatonicScale.map((degree) => degree.pitchClass))).toHaveLength(7);

      for (const degree of key.diatonicScale) {
        expect(degree.pitchClass).toBe(getPitchClass(degree.pitchClass));
        expect(degree.name.startsWith(degree.letter)).toBe(true);
        expect(degree.name).not.toMatch(/♯♯|♭♭/);
      }

      expect(getMusicKeyDefinition(key.id)).toBe(key);
    }
  });

  it("rejects an unknown key ID", () => {
    expect(() =>
      getMusicKeyDefinition("not-a-key" as Parameters<typeof getMusicKeyDefinition>[0]),
    ).toThrow("Unknown music key not-a-key.");
  });
});
