import { describe, expect, it } from "vitest";

import type { PracticeNote, SequenceTarget } from "@/types/practice";

import {
  getCurrentSequenceStepMidiNumbers,
  getSequenceStepMidiNumbers,
  getSequenceTargetMidiNumbers,
  sequenceStepMatchesInput,
} from "./sequence-validation";

const C4: PracticeNote = {
  midiNumber: 60,
  name: "C",
  octave: 4,
};

const E4: PracticeNote = {
  midiNumber: 64,
  name: "E",
  octave: 4,
};

const G4: PracticeNote = {
  midiNumber: 67,
  name: "G",
  octave: 4,
};

const SEQUENCE_TARGET: SequenceTarget = {
  clef: "treble",
  name: {
    primary: "Major third",
    secondary: "Ascending melodic interval",
  },
  steps: [
    {
      notes: [C4],
    },
    {
      notes: [E4],
    },
  ],
};

describe("getSequenceStepMidiNumbers", () => {
  it("returns the MIDI numbers belonging to a sequence step", () => {
    expect(getSequenceStepMidiNumbers([C4, E4])).toEqual(new Set([60, 64]));
  });

  it("removes duplicate MIDI numbers", () => {
    expect(getSequenceStepMidiNumbers([C4, C4])).toEqual(new Set([60]));
  });

  it("returns an empty set when the step contains no notes", () => {
    expect(getSequenceStepMidiNumbers([])).toEqual(new Set());
  });
});

describe("getCurrentSequenceStepMidiNumbers", () => {
  it("returns the MIDI numbers for the requested sequence step", () => {
    expect(getCurrentSequenceStepMidiNumbers(SEQUENCE_TARGET, 1)).toEqual(
      new Set([64]),
    );
  });

  it("returns an empty set when the requested step does not exist", () => {
    expect(getCurrentSequenceStepMidiNumbers(SEQUENCE_TARGET, 10)).toEqual(
      new Set(),
    );
  });
});

describe("getSequenceTargetMidiNumbers", () => {
  it("returns all MIDI numbers used throughout the sequence", () => {
    expect(getSequenceTargetMidiNumbers(SEQUENCE_TARGET)).toEqual(
      new Set([60, 64]),
    );
  });

  it("removes MIDI numbers repeated across sequence steps", () => {
    const repeatedTarget: SequenceTarget = {
      ...SEQUENCE_TARGET,
      steps: [
        {
          notes: [C4],
        },
        {
          notes: [E4],
        },
        {
          notes: [C4],
        },
      ],
    };

    expect(getSequenceTargetMidiNumbers(repeatedTarget)).toEqual(
      new Set([60, 64]),
    );
  });
});

describe("sequenceStepMatchesInput", () => {
  it("returns true when the input exactly matches the current step", () => {
    expect(
      sequenceStepMatchesInput({
        inputMidiNumbers: new Set([60]),
        sequenceTarget: SEQUENCE_TARGET,
        stepIndex: 0,
      }),
    ).toBe(true);
  });

  it("matches multi-note steps regardless of input order", () => {
    const chordStepTarget: SequenceTarget = {
      ...SEQUENCE_TARGET,
      steps: [
        {
          notes: [C4, E4, G4],
        },
      ],
    };

    expect(
      sequenceStepMatchesInput({
        inputMidiNumbers: new Set([67, 60, 64]),
        sequenceTarget: chordStepTarget,
        stepIndex: 0,
      }),
    ).toBe(true);
  });

  it("returns false when the input is missing a required note", () => {
    const chordStepTarget: SequenceTarget = {
      ...SEQUENCE_TARGET,
      steps: [
        {
          notes: [C4, E4],
        },
      ],
    };

    expect(
      sequenceStepMatchesInput({
        inputMidiNumbers: new Set([60]),
        sequenceTarget: chordStepTarget,
        stepIndex: 0,
      }),
    ).toBe(false);
  });

  it("returns false when the input contains an extra note", () => {
    expect(
      sequenceStepMatchesInput({
        inputMidiNumbers: new Set([60, 64]),
        sequenceTarget: SEQUENCE_TARGET,
        stepIndex: 0,
      }),
    ).toBe(false);
  });

  it("returns false when the input contains the wrong note", () => {
    expect(
      sequenceStepMatchesInput({
        inputMidiNumbers: new Set([61]),
        sequenceTarget: SEQUENCE_TARGET,
        stepIndex: 0,
      }),
    ).toBe(false);
  });
});
