import { describe, expect, it } from "vitest";
import { MUSIC_KEYS } from "./keys";
import { spellKeyAwareMidiNumber, spellKeyAwareMidiNumbers } from "./key-aware-spelling";

describe("shared key-aware spelling", () => {
  it("preserves natural and neutral No Key spellings", () => {
    expect([60, 61, 63, 70].map((midiNumber) => spellKeyAwareMidiNumber({ midiNumber })?.name))
      .toEqual(["C", "C♯", "E♭", "B♭"]);
  });

  it("honors No Key sharp and flat preferences", () => {
    expect(spellKeyAwareMidiNumber({ midiNumber: 61, preference: "prefer-sharps" })?.name).toBe("C♯");
    expect(spellKeyAwareMidiNumber({ midiNumber: 61, preference: "prefer-flats" })?.name).toBe("D♭");
  });

  it("uses major and minor key spelling", () => {
    expect(spellKeyAwareMidiNumber({ midiNumber: 66, context: { type: "key", keyId: "g-major" } })?.name).toBe("F♯");
    expect(spellKeyAwareMidiNumber({ midiNumber: 63, context: { type: "key", keyId: "c-minor" } })?.name).toBe("E♭");
  });

  it("supports every MIDI boundary without double accidentals", () => {
    for (const key of MUSIC_KEYS) {
      for (const midiNumber of [0, 1, 126, 127]) {
        expect(spellKeyAwareMidiNumber({ midiNumber, context: { type: "key", keyId: key.id } })?.name).not.toMatch(/♯♯|♭♭/);
      }
    }
    expect(spellKeyAwareMidiNumber({ midiNumber: -1 })).toBeNull();
    expect(spellKeyAwareMidiNumber({ midiNumber: 128 })).toBeNull();
  });

  it("deduplicates and sorts collections without mutating input", () => {
    const input = [70, 60, 70];
    expect(spellKeyAwareMidiNumbers({ midiNumbers: input })?.map(({ midiNumber }) => midiNumber)).toEqual([60, 70]);
    expect(input).toEqual([70, 60, 70]);
  });
});
