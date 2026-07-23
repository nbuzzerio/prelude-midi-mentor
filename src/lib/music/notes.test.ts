import { afterEach, describe, expect, it, vi } from "vitest";

import { generateTriadTarget } from "./generators/triads";
import {
  generatePracticeTarget,
  getFullNoteName,
  getNoteName,
  getNoteOctave,
} from "./notes";

vi.mock("./generators/triads", () => ({
  generateTriadTarget: vi.fn(),
}));

const mockedGenerateTriadTarget = vi.mocked(generateTriadTarget);

afterEach(() => {
  vi.restoreAllMocks();
  mockedGenerateTriadTarget.mockReset();
});

describe("getNoteName", () => {
  it("returns natural note names from MIDI numbers", () => {
    expect(getNoteName(60)).toBe("C");
    expect(getNoteName(62)).toBe("D");
    expect(getNoteName(64)).toBe("E");
    expect(getNoteName(65)).toBe("F");
    expect(getNoteName(67)).toBe("G");
    expect(getNoteName(69)).toBe("A");
    expect(getNoteName(71)).toBe("B");
  });

  it("uses sharp spelling by default for accidental notes", () => {
    expect(getNoteName(61)).toBe("C♯");
    expect(getNoteName(63)).toBe("D♯");
    expect(getNoteName(66)).toBe("F♯");
    expect(getNoteName(68)).toBe("G♯");
    expect(getNoteName(70)).toBe("A♯");
  });

  it("uses flat spelling when requested", () => {
    expect(getNoteName(61, "flat")).toBe("D♭");
    expect(getNoteName(63, "flat")).toBe("E♭");
    expect(getNoteName(66, "flat")).toBe("G♭");
    expect(getNoteName(68, "flat")).toBe("A♭");
    expect(getNoteName(70, "flat")).toBe("B♭");
  });

  it("returns the same pitch-class name across octaves", () => {
    expect(getNoteName(48)).toBe("C");
    expect(getNoteName(60)).toBe("C");
    expect(getNoteName(72)).toBe("C");
  });

  it("handles negative MIDI numbers consistently", () => {
    expect(getNoteName(-1)).toBe("B");
    expect(getNoteName(-12)).toBe("C");
  });
});

describe("getNoteOctave", () => {
  it("uses scientific pitch notation for common MIDI notes", () => {
    expect(getNoteOctave(21)).toBe(0);
    expect(getNoteOctave(60)).toBe(4);
    expect(getNoteOctave(69)).toBe(4);
    expect(getNoteOctave(108)).toBe(8);
  });

  it("changes octave at each C boundary", () => {
    expect(getNoteOctave(59)).toBe(3);
    expect(getNoteOctave(60)).toBe(4);

    expect(getNoteOctave(71)).toBe(4);
    expect(getNoteOctave(72)).toBe(5);
  });

  it("identifies MIDI note zero as C negative one", () => {
    expect(getNoteOctave(0)).toBe(-1);
  });
});

describe("getFullNoteName", () => {
  it("combines the note name and octave", () => {
    expect(getFullNoteName(60)).toBe("C4");
    expect(getFullNoteName(69)).toBe("A4");
    expect(getFullNoteName(71)).toBe("B4");
  });

  it("uses sharp spelling by default", () => {
    expect(getFullNoteName(61)).toBe("C♯4");
  });

  it("uses flat spelling when requested", () => {
    expect(getFullNoteName(61, "flat")).toBe("D♭4");
  });

  it("uses the correct octave around a C boundary", () => {
    expect(getFullNoteName(59)).toBe("B3");
    expect(getFullNoteName(60)).toBe("C4");
  });
});

describe("generatePracticeTarget", () => {
  it("throws when no practice exercise types are enabled", () => {
    expect(() =>
      generatePracticeTarget(
        "bass",
        new Set(),
        new Set(["naturals"]),
        new Set(["major"]),
        new Set(["root"]),
      ),
    ).toThrow("At least one practice exercise type must be enabled.");
  });

  it("throws when notes are enabled without a note category", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    expect(() =>
      generatePracticeTarget(
        "bass",
        new Set(["notes"]),
        new Set(),
        new Set(["major"]),
        new Set(["root"]),
      ),
    ).toThrow("At least one individual note category must be enabled.");
  });

  it("generates a natural note inside the bass-clef range", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const target = generatePracticeTarget(
      "bass",
      new Set(["notes"]),
      new Set(["naturals"]),
      new Set(["major"]),
      new Set(["root"]),
    );

    expect(target).toEqual({
      clef: "bass",
      name: {
        primary: "C2",
        secondary: "Individual note",
      },
      notes: [
        {
          midiNumber: 36,
          name: "C",
          octave: 2,
        },
      ],
    });
  });

  it("generates a natural note inside the treble-clef range", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const target = generatePracticeTarget(
      "treble",
      new Set(["notes"]),
      new Set(["naturals"]),
      new Set(["major"]),
      new Set(["root"]),
    );

    expect(target).toEqual({
      clef: "treble",
      name: {
        primary: "C4",
        secondary: "Individual note",
      },
      notes: [
        {
          midiNumber: 60,
          name: "C",
          octave: 4,
        },
      ],
    });
  });

  it("can choose bass clef in mixed mode", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.25)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0);

    const target = generatePracticeTarget(
      "mixed",
      new Set(["notes"]),
      new Set(["naturals"]),
      new Set(["major"]),
      new Set(["root"]),
    );

    expect(target.clef).toBe("bass");
    expect(target.notes[0]?.midiNumber).toBe(36);
  });

  it("can choose treble clef in mixed mode", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0);

    const target = generatePracticeTarget(
      "mixed",
      new Set(["notes"]),
      new Set(["naturals"]),
      new Set(["major"]),
      new Set(["root"]),
    );

    expect(target.clef).toBe("treble");
    expect(target.notes[0]?.midiNumber).toBe(60);
  });

  it("generates only an accidental when only accidentals are enabled", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.75);

    const target = generatePracticeTarget(
      "bass",
      new Set(["notes"]),
      new Set(["accidentals"]),
      new Set(["major"]),
      new Set(["root"]),
    );

    expect(target).toEqual({
      clef: "bass",
      name: {
        primary: "D♭2",
        secondary: "Individual note",
      },
      notes: [
        {
          midiNumber: 37,
          name: "D♭",
          octave: 2,
        },
      ],
    });
  });

  it("delegates triad generation with the selected clef and settings", () => {
    const triadTarget = {
      clef: "treble",
      name: {
        primary: "C minor",
        secondary: "First inversion",
      },
      notes: [
        {
          midiNumber: 63,
          name: "E♭",
          octave: 4,
        },
        {
          midiNumber: 67,
          name: "G",
          octave: 4,
        },
        {
          midiNumber: 72,
          name: "C",
          octave: 5,
        },
      ],
    } as const;

    mockedGenerateTriadTarget.mockReturnValue(triadTarget);

    const result = generatePracticeTarget(
      "treble",
      new Set(["triads"]),
      new Set(["naturals"]),
      new Set(["minor"]),
      new Set(["first"]),
    );

    expect(mockedGenerateTriadTarget).toHaveBeenCalledOnce();
    expect(mockedGenerateTriadTarget).toHaveBeenCalledWith(
      "treble",
      new Set(["minor"]),
      new Set(["first"]),
    );
    expect(result).toBe(triadTarget);
  });

  it("does not call the triad generator when notes are selected", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    generatePracticeTarget(
      "bass",
      new Set(["notes"]),
      new Set(["naturals"]),
      new Set(["major"]),
      new Set(["root"]),
    );

    expect(mockedGenerateTriadTarget).not.toHaveBeenCalled();
  });

  it("can randomly select triads when both exercise types are enabled", () => {
    const triadTarget = {
      clef: "bass",
      name: {
        primary: "C major",
        secondary: "Root position",
      },
      notes: [
        {
          midiNumber: 48,
          name: "C",
          octave: 3,
        },
        {
          midiNumber: 52,
          name: "E",
          octave: 3,
        },
        {
          midiNumber: 55,
          name: "G",
          octave: 3,
        },
      ],
    } as const;

    mockedGenerateTriadTarget.mockReturnValue(triadTarget);

    vi.spyOn(Math, "random").mockReturnValue(0.75);

    const result = generatePracticeTarget(
      "bass",
      new Set(["notes", "triads"]),
      new Set(["naturals"]),
      new Set(["major"]),
      new Set(["root"]),
    );

    expect(mockedGenerateTriadTarget).toHaveBeenCalledOnce();
    expect(result).toBe(triadTarget);
  });
});
