import { describe, expect, it } from "vitest";

import { MUSIC_KEYS } from "@/lib/music/keys";

import {
  DEFAULT_FREEPLAY_CHROMATIC_PREFERENCE,
  DEFAULT_FREEPLAY_NOTATION_CONTEXT,
  spellFreeplayMidiNumber,
  spellFreeplayMidiNumbers,
  type FreeplayChromaticPreference,
} from "./freeplay-notation";

function spell(
  midiNumber: number,
  options: Readonly<{
    keyId?: (typeof MUSIC_KEYS)[number]["id"];
    preference?: FreeplayChromaticPreference;
  }> = {},
) {
  return spellFreeplayMidiNumber({
    context: options.keyId
      ? { keyId: options.keyId, type: "key" }
      : { type: "no-key" },
    midiNumber,
    preference: options.preference,
  });
}

describe("Free Play notation defaults", () => {
  it("defaults to No Key with Automatic spelling", () => {
    expect(DEFAULT_FREEPLAY_NOTATION_CONTEXT).toEqual({ type: "no-key" });
    expect(DEFAULT_FREEPLAY_CHROMATIC_PREFERENCE).toBe("automatic");
    expect(spellFreeplayMidiNumber({ midiNumber: 61 })).toEqual({
      midiNumber: 61,
      name: "C♯",
      octave: 4,
    });
  });
});

describe("No Key spelling", () => {
  it("keeps every natural pitch class natural", () => {
    expect([60, 62, 64, 65, 67, 69, 71].map((midi) => spell(midi)?.name)).toEqual(
      ["C", "D", "E", "F", "G", "A", "B"],
    );
  });

  it("uses the balanced neutral chromatic convention", () => {
    expect(
      Array.from({ length: 12 }, (_, offset) => spell(60 + offset)?.name),
    ).toEqual(["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"]);
  });

  it("applies sharp and flat preferences to every chromatic pitch class", () => {
    expect([61, 63, 66, 68, 70].map((midi) => spell(midi, { preference: "prefer-sharps" })?.name)).toEqual(
      ["C♯", "D♯", "F♯", "G♯", "A♯"],
    );
    expect([61, 63, 66, 68, 70].map((midi) => spell(midi, { preference: "prefer-flats" })?.name)).toEqual(
      ["D♭", "E♭", "G♭", "A♭", "B♭"],
    );
  });

  it("matches the approved No Key examples", () => {
    expect(spell(61)?.name).toBe("C♯");
    expect(spell(61, { preference: "prefer-flats" })?.name).toBe("D♭");
    expect(spell(70, { preference: "prefer-sharps" })?.name).toBe("A♯");
    expect(spell(70)?.name).toBe("B♭");
  });
});

describe("key-aware spelling", () => {
  it("spells every diatonic pitch class correctly in every supported key", () => {
    const preferences: ReadonlyArray<FreeplayChromaticPreference> = [
      "automatic",
      "prefer-sharps",
      "prefer-flats",
    ];

    for (const key of MUSIC_KEYS) {
      for (const degree of key.diatonicScale) {
        const midiNumber = 60 + degree.pitchClass;

        for (const preference of preferences) {
          expect(
            spell(midiNumber, { keyId: key.id, preference })?.name,
            `${key.name} ${degree.name} with ${preference}`,
          ).toBe(degree.name);
        }
      }
    }
  });

  it("preserves the requested keyed examples", () => {
    for (const preference of ["automatic", "prefer-sharps", "prefer-flats"] as const) {
      expect(spell(70, { keyId: "f-major", preference })?.name).toBe("B♭");
      expect(spell(66, { keyId: "g-major", preference })?.name).toBe("F♯");
      expect(spell(65, { keyId: "g-major", preference })?.name).toBe("F");
    }

    expect(spell(66, { keyId: "f-major" })?.name).toBe("G♭");
    expect(spell(66, { keyId: "f-major", preference: "prefer-sharps" })?.name).toBe("F♯");
    expect(spell(66, { keyId: "f-major", preference: "prefer-flats" })?.name).toBe("G♭");
    expect(spell(63, { keyId: "d-major" })?.name).toBe("D♯");
    expect(spell(63, { keyId: "d-major", preference: "prefer-flats" })?.name).toBe("E♭");
    expect(spell(63, { keyId: "c-major" })?.name).toBe("E♭");
  });

  it("uses natural spellings for chromatic natural pitches in every preference", () => {
    for (const preference of ["automatic", "prefer-sharps", "prefer-flats"] as const) {
      expect(spell(65, { keyId: "g-major", preference })?.name).toBe("F");
      expect(spell(71, { keyId: "f-major", preference })?.name).toBe("B");
    }
  });
});

describe("written octave and unsupported boundaries", () => {
  it("keeps written octaves correct across B/C and E/F boundaries", () => {
    expect(spell(59)).toMatchObject({ name: "B", octave: 3 });
    expect(spell(60)).toMatchObject({ name: "C", octave: 4 });
    expect(spell(64)).toMatchObject({ name: "E", octave: 4 });
    expect(spell(65)).toMatchObject({ name: "F", octave: 4 });
    expect(spell(61, { preference: "prefer-flats" })).toMatchObject({
      name: "D♭",
      octave: 4,
    });
  });

  it("never invents double accidentals for the supported keys", () => {
    for (const key of MUSIC_KEYS) {
      for (let midiNumber = 0; midiNumber <= 127; midiNumber += 1) {
        const note = spell(midiNumber, { keyId: key.id });

        expect(note).not.toBeNull();
        expect(note?.midiNumber).toBe(midiNumber);
        expect(note?.name).not.toMatch(/♯♯|♭♭/);
      }
    }
  });

  it("returns null for an unsupported non-integer pitch instead of changing it", () => {
    expect(spell(Number.NaN)).toBeNull();
    expect(spell(60.5)).toBeNull();
  });

  it("returns null for MIDI pitches outside the 0 through 127 range", () => {
    expect(spell(-1)).toBeNull();
    expect(spell(128)).toBeNull();
  });
});

describe("multiple held pitches", () => {
  it("deduplicates, sorts, and does not mutate input", () => {
    const midiNumbers = [70, 61, 70, 60, 61];
    const original = [...midiNumbers];

    expect(
      spellFreeplayMidiNumbers({ midiNumbers })?.map((note) => note.midiNumber),
    ).toEqual([60, 61, 70]);
    expect(midiNumbers).toEqual(original);
  });

  it("returns null rather than dropping an unsupported pitch", () => {
    expect(spellFreeplayMidiNumbers({ midiNumbers: [60, Number.NaN, 64] })).toBeNull();
  });

  it("returns null when a collection contains an out-of-range MIDI pitch", () => {
    expect(spellFreeplayMidiNumbers({ midiNumbers: [60, 128, 64] })).toBeNull();
  });
});
