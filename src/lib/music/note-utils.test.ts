import { describe, expect, it } from "vitest";

import {
  createPracticeNote,
  createTheoryPracticeNote,
  getTheoryRootLetterCandidates,
} from "./note-utils";

describe("getTheoryRootLetterCandidates", () => {
  it("returns the natural letter for a natural pitch", () => {
    expect(getTheoryRootLetterCandidates(60)).toEqual(["C"]);
    expect(getTheoryRootLetterCandidates(69)).toEqual(["A"]);
    expect(getTheoryRootLetterCandidates(71)).toEqual(["B"]);
  });

  it("returns both possible letters for an accidental pitch", () => {
    expect(getTheoryRootLetterCandidates(61)).toEqual(["C", "D"]);
    expect(getTheoryRootLetterCandidates(63)).toEqual(["D", "E"]);
    expect(getTheoryRootLetterCandidates(66)).toEqual(["F", "G"]);
    expect(getTheoryRootLetterCandidates(68)).toEqual(["G", "A"]);
    expect(getTheoryRootLetterCandidates(70)).toEqual(["A", "B"]);
  });

  it("returns the same candidates across octaves", () => {
    expect(getTheoryRootLetterCandidates(58)).toEqual(["A", "B"]);
    expect(getTheoryRootLetterCandidates(70)).toEqual(["A", "B"]);
    expect(getTheoryRootLetterCandidates(82)).toEqual(["A", "B"]);
  });
});

describe("createTheoryPracticeNote", () => {
  it("creates a natural note using the requested letter", () => {
    expect(createTheoryPracticeNote(60, "C")).toEqual({
      midiNumber: 60,
      name: "C",
      octave: 4,
    });
  });

  it("creates a sharp when the requested letter is below the pitch", () => {
    expect(createTheoryPracticeNote(70, "A")).toEqual({
      midiNumber: 70,
      name: "A♯",
      octave: 4,
    });
  });

  it("creates a flat when the requested letter is above the pitch", () => {
    expect(createTheoryPracticeNote(70, "B")).toEqual({
      midiNumber: 70,
      name: "B♭",
      octave: 4,
    });
  });

  it("handles B sharp across a written octave boundary", () => {
    expect(createTheoryPracticeNote(60, "B")).toEqual({
      midiNumber: 60,
      name: "B♯",
      octave: 3,
    });
  });

  it("handles C flat across a written octave boundary", () => {
    expect(createTheoryPracticeNote(59, "C")).toEqual({
      midiNumber: 59,
      name: "C♭",
      octave: 4,
    });
  });

  it("rejects spellings that require a double accidental", () => {
    expect(() => createTheoryPracticeNote(61, "B")).toThrow(
      /double accidental/i,
    );

    expect(() => createTheoryPracticeNote(63, "C")).toThrow(
      /double accidental/i,
    );
  });
});

describe("createPracticeNote", () => {
  it("preserves the existing default sharp spelling behavior", () => {
    expect(createPracticeNote(61)).toEqual({
      midiNumber: 61,
      name: "C♯",
      octave: 4,
    });
  });

  it("preserves explicit flat spelling behavior", () => {
    expect(createPracticeNote(61, "flat")).toEqual({
      midiNumber: 61,
      name: "D♭",
      octave: 4,
    });
  });
});
