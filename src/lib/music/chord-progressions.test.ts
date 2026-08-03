import { describe, expect, it } from "vitest";

import {
  CHORD_PROGRESSION_TEMPLATES,
  SUPPORTED_CHORD_PROGRESSION_KEYS,
  getChordProgressionTemplate,
  getChordProgressionTemplatesForMode,
  getSupportedChordProgressionKey,
  realizeChordProgression,
  type ChordProgressionKey,
} from "./chord-progressions";

function realize(
  keyId: Parameters<typeof getSupportedChordProgressionKey>[0],
  templateId: Parameters<typeof getChordProgressionTemplate>[0],
  tonicMidiNumber: number,
) {
  return realizeChordProgression({
    key: getSupportedChordProgressionKey(keyId),
    template: getChordProgressionTemplate(templateId),
    tonicMidiNumber,
  });
}

function summarizeChords(
  progression: NonNullable<ReturnType<typeof realizeChordProgression>>,
) {
  return progression.chords.map((chord) => ({
    chordName: chord.chordName,
    degree: chord.degree,
    midiNumbers: chord.notes.map((note) => note.midiNumber),
    noteNames: chord.notes.map((note) => `${note.name}${note.octave}`),
    quality: chord.quality,
    romanNumeral: chord.romanNumeral,
  }));
}

describe("supported chord progression keys", () => {
  it("defines the exact supported major and minor key IDs", () => {
    expect(
      SUPPORTED_CHORD_PROGRESSION_KEYS.filter((key) => key.mode === "major").map(
        (key) => key.id,
      ),
    ).toEqual([
      "c-major",
      "g-major",
      "d-major",
      "f-major",
      "b-flat-major",
      "e-flat-major",
    ]);

    expect(
      SUPPORTED_CHORD_PROGRESSION_KEYS.filter((key) => key.mode === "minor").map(
        (key) => key.id,
      ),
    ).toEqual([
      "a-minor",
      "e-minor",
      "b-minor",
      "d-minor",
      "g-minor",
      "c-minor",
    ]);
  });

  it("preserves tonic spellings and modes", () => {
    expect(
      SUPPORTED_CHORD_PROGRESSION_KEYS.map(({ id, mode, tonicName }) => ({
        id,
        mode,
        tonicName,
      })),
    ).toEqual([
      { id: "c-major", mode: "major", tonicName: "C" },
      { id: "g-major", mode: "major", tonicName: "G" },
      { id: "d-major", mode: "major", tonicName: "D" },
      { id: "f-major", mode: "major", tonicName: "F" },
      { id: "b-flat-major", mode: "major", tonicName: "B♭" },
      { id: "e-flat-major", mode: "major", tonicName: "E♭" },
      { id: "a-minor", mode: "minor", tonicName: "A" },
      { id: "e-minor", mode: "minor", tonicName: "E" },
      { id: "b-minor", mode: "minor", tonicName: "B" },
      { id: "d-minor", mode: "minor", tonicName: "D" },
      { id: "g-minor", mode: "minor", tonicName: "G" },
      { id: "c-minor", mode: "minor", tonicName: "C" },
    ]);
  });
});

describe("chord progression templates", () => {
  it("defines the exact nine templates with structured chord specifications", () => {
    expect(
      CHORD_PROGRESSION_TEMPLATES.map((template) => ({
        chords: template.chords.map(({ degree, quality, romanNumeral }) => [
          degree,
          quality,
          romanNumeral,
        ]),
        id: template.id,
        mode: template.mode,
        name: template.name,
      })),
    ).toEqual([
      { id: "major-1451", mode: "major", name: "I–IV–V–I", chords: [[1, "major", "I"], [4, "major", "IV"], [5, "major", "V"], [1, "major", "I"]] },
      { id: "major-251", mode: "major", name: "ii–V–I", chords: [[2, "minor", "ii"], [5, "major", "V"], [1, "major", "I"]] },
      { id: "major-1645", mode: "major", name: "I–vi–IV–V", chords: [[1, "major", "I"], [6, "minor", "vi"], [4, "major", "IV"], [5, "major", "V"]] },
      { id: "major-1564", mode: "major", name: "I–V–vi–IV", chords: [[1, "major", "I"], [5, "major", "V"], [6, "minor", "vi"], [4, "major", "IV"]] },
      { id: "major-6415", mode: "major", name: "vi–IV–I–V", chords: [[6, "minor", "vi"], [4, "major", "IV"], [1, "major", "I"], [5, "major", "V"]] },
      { id: "minor-1451", mode: "minor", name: "i–iv–V–i", chords: [[1, "minor", "i"], [4, "minor", "iv"], [5, "major", "V"], [1, "minor", "i"]] },
      { id: "minor-1637", mode: "minor", name: "i–VI–III–VII", chords: [[1, "minor", "i"], [6, "major", "VI"], [3, "major", "III"], [7, "major", "VII"]] },
      { id: "minor-1767", mode: "minor", name: "i–VII–VI–VII", chords: [[1, "minor", "i"], [7, "major", "VII"], [6, "major", "VI"], [7, "major", "VII"]] },
      { id: "minor-251", mode: "minor", name: "ii°–V–i", chords: [[2, "diminished", "ii°"], [5, "major", "V"], [1, "minor", "i"]] },
    ]);
  });

  it("filters templates by compatible key mode", () => {
    expect(getChordProgressionTemplatesForMode("major")).toHaveLength(5);
    expect(getChordProgressionTemplatesForMode("minor")).toHaveLength(4);
    expect(getChordProgressionTemplatesForMode("major").every((template) => template.mode === "major")).toBe(true);
    expect(getChordProgressionTemplatesForMode("minor").every((template) => template.mode === "minor")).toBe(true);
  });
});

describe("realizeChordProgression", () => {
  it("realizes C major I–IV–V–I in root position", () => {
    const progression = realize("c-major", "major-1451", 60);

    expect(progression).not.toBeNull();
    expect(summarizeChords(progression!)).toEqual([
      { chordName: "C major", degree: 1, midiNumbers: [60, 64, 67], noteNames: ["C4", "E4", "G4"], quality: "major", romanNumeral: "I" },
      { chordName: "F major", degree: 4, midiNumbers: [65, 69, 72], noteNames: ["F4", "A4", "C5"], quality: "major", romanNumeral: "IV" },
      { chordName: "G major", degree: 5, midiNumbers: [67, 71, 74], noteNames: ["G4", "B4", "D5"], quality: "major", romanNumeral: "V" },
      { chordName: "C major", degree: 1, midiNumbers: [60, 64, 67], noteNames: ["C4", "E4", "G4"], quality: "major", romanNumeral: "I" },
    ]);
  });

  it("realizes D major ii–V–I with sharp spellings", () => {
    const progression = realize("d-major", "major-251", 62);

    expect(progression).not.toBeNull();
    expect(summarizeChords(progression!)).toEqual([
      { chordName: "E minor", degree: 2, midiNumbers: [64, 67, 71], noteNames: ["E4", "G4", "B4"], quality: "minor", romanNumeral: "ii" },
      { chordName: "A major", degree: 5, midiNumbers: [69, 73, 76], noteNames: ["A4", "C♯5", "E5"], quality: "major", romanNumeral: "V" },
      { chordName: "D major", degree: 1, midiNumbers: [62, 66, 69], noteNames: ["D4", "F♯4", "A4"], quality: "major", romanNumeral: "I" },
    ]);
  });

  it("realizes B-flat major with flat spellings", () => {
    const progression = realize("b-flat-major", "major-1451", 58);

    expect(progression).not.toBeNull();
    expect(progression!.chords.map((chord) => ({
      chordName: chord.chordName,
      noteNames: chord.notes.map((note) => `${note.name}${note.octave}`),
    }))).toEqual([
      { chordName: "B♭ major", noteNames: ["B♭3", "D4", "F4"] },
      { chordName: "E♭ major", noteNames: ["E♭4", "G4", "B♭4"] },
      { chordName: "F major", noteNames: ["F4", "A4", "C5"] },
      { chordName: "B♭ major", noteNames: ["B♭3", "D4", "F4"] },
    ]);
  });

  it("raises only the leading tone needed by V in A minor", () => {
    const progression = realize("a-minor", "minor-1451", 57);

    expect(progression).not.toBeNull();
    expect(progression!.chords.map((chord) => ({
      chordName: chord.chordName,
      noteNames: chord.notes.map((note) => note.name),
    }))).toEqual([
      { chordName: "A minor", noteNames: ["A", "C", "E"] },
      { chordName: "D minor", noteNames: ["D", "F", "A"] },
      { chordName: "E major", noteNames: ["E", "G♯", "B"] },
      { chordName: "A minor", noteNames: ["A", "C", "E"] },
    ]);
  });

  it("realizes C minor ii°–V–i with the requested chromatic treatment", () => {
    const progression = realize("c-minor", "minor-251", 60);

    expect(progression).not.toBeNull();
    expect(progression!.chords.map((chord) => chord.notes.map((note) => note.name))).toEqual([
      ["D", "F", "A♭"],
      ["G", "B", "D"],
      ["C", "E♭", "G"],
    ]);
  });

  it("keeps III, VI, and VII in natural minor", () => {
    const progression = realize("a-minor", "minor-1637", 57);

    expect(progression).not.toBeNull();
    expect(progression!.chords.map((chord) => ({
      romanNumeral: chord.romanNumeral,
      notes: chord.notes.map((note) => note.name),
    }))).toEqual([
      { romanNumeral: "i", notes: ["A", "C", "E"] },
      { romanNumeral: "VI", notes: ["F", "A", "C"] },
      { romanNumeral: "III", notes: ["C", "E", "G"] },
      { romanNumeral: "VII", notes: ["G", "B", "D"] },
    ]);
  });

  it("returns null when realization requires a double accidental", () => {
    const unsupportedKey: ChordProgressionKey = {
      ...getSupportedChordProgressionKey("c-minor"),
      name: "G♯ minor",
      tonicLetter: "G",
      tonicName: "G♯",
      tonicPitchClass: 8,
    };

    expect(realizeChordProgression({
      key: unsupportedKey,
      template: getChordProgressionTemplate("minor-1451"),
      tonicMidiNumber: 56,
    })).toBeNull();
  });

  it("rejects incompatible key and template modes", () => {
    expect(() => realize("c-major", "minor-1451", 60)).toThrow(
      "The i–iv–V–i template is not compatible with C major.",
    );
  });

  it("rejects a tonic MIDI number that does not match the key", () => {
    expect(() => realize("c-major", "major-1451", 61)).toThrow(
      "MIDI 61 does not match the tonic of C major.",
    );
  });
});
