import { describe, expect, it } from "vitest";

import type { PracticeTarget } from "@/types/practice";

import { getTargetMidiNumbers, notesMatchTarget } from "./answer-validation";

function createPracticeTarget(midiNumbers: number[]): PracticeTarget {
  return {
    clef: "treble",
    name: {
      primary: "Test target",
    },
    notes: midiNumbers.map((midiNumber) => ({
      midiNumber,
      name: "C",
      octave: 4,
    })),
  };
}

describe("notesMatchTarget", () => {
  describe("single-note targets", () => {
    it("accepts the correct note", () => {
      const practiceTarget = createPracticeTarget([60]);
      const playedNotes = new Set([60]);

      expect(notesMatchTarget(playedNotes, practiceTarget)).toBe(true);
    });

    it("rejects an incorrect note", () => {
      const practiceTarget = createPracticeTarget([60]);
      const playedNotes = new Set([62]);

      expect(notesMatchTarget(playedNotes, practiceTarget)).toBe(false);
    });
  });

  describe("multi-note targets", () => {
    it("accepts the correct notes in any order", () => {
      const practiceTarget = createPracticeTarget([60, 64, 67]);
      const playedNotes = new Set([67, 60, 64]);

      expect(notesMatchTarget(playedNotes, practiceTarget)).toBe(true);
    });

    it("rejects an attempt with a missing note", () => {
      const practiceTarget = createPracticeTarget([60, 64, 67]);
      const playedNotes = new Set([60, 64]);

      expect(notesMatchTarget(playedNotes, practiceTarget)).toBe(false);
    });

    it("rejects an attempt with an extra note", () => {
      const practiceTarget = createPracticeTarget([60, 64, 67]);
      const playedNotes = new Set([60, 64, 67, 71]);

      expect(notesMatchTarget(playedNotes, practiceTarget)).toBe(false);
    });

    it("rejects an attempt containing the wrong note", () => {
      const practiceTarget = createPracticeTarget([60, 64, 67]);
      const playedNotes = new Set([60, 65, 67]);

      expect(notesMatchTarget(playedNotes, practiceTarget)).toBe(false);
    });
  });
});

describe("getTargetMidiNumbers", () => {
  it("returns the MIDI numbers contained in the target", () => {
    const practiceTarget = createPracticeTarget([60, 64, 67]);

    expect(getTargetMidiNumbers(practiceTarget)).toEqual(new Set([60, 64, 67]));
  });

  it("returns a new set each time", () => {
    const practiceTarget = createPracticeTarget([60, 64, 67]);

    const firstResult = getTargetMidiNumbers(practiceTarget);
    const secondResult = getTargetMidiNumbers(practiceTarget);

    expect(firstResult).not.toBe(secondResult);
    expect(firstResult).toEqual(secondResult);
  });
});
