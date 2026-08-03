import { describe, expect, it } from "vitest";

import type { PracticeNote, PracticeTriadQuality } from "@/types/practice";

import { createRootPositionTriad } from "./chords";

function note(
  midiNumber: number,
  name: string,
  octave: number,
): PracticeNote {
  return { midiNumber, name, octave };
}

type TriadCase = Readonly<{
  expected: ReadonlyArray<PracticeNote>;
  quality: PracticeTriadQuality;
  root: PracticeNote;
}>;

const TRIAD_CASES: ReadonlyArray<TriadCase> = [
  {
    root: note(60, "C", 4),
    quality: "major",
    expected: [note(60, "C", 4), note(64, "E", 4), note(67, "G", 4)],
  },
  {
    root: note(57, "A", 3),
    quality: "minor",
    expected: [note(57, "A", 3), note(60, "C", 4), note(64, "E", 4)],
  },
  {
    root: note(59, "B", 3),
    quality: "diminished",
    expected: [note(59, "B", 3), note(62, "D", 4), note(65, "F", 4)],
  },
  {
    root: note(60, "C", 4),
    quality: "augmented",
    expected: [note(60, "C", 4), note(64, "E", 4), note(68, "G♯", 4)],
  },
  {
    root: note(63, "E♭", 4),
    quality: "major",
    expected: [note(63, "E♭", 4), note(67, "G", 4), note(70, "B♭", 4)],
  },
  {
    root: note(66, "F♯", 4),
    quality: "minor",
    expected: [note(66, "F♯", 4), note(69, "A", 4), note(73, "C♯", 5)],
  },
];

describe("createRootPositionTriad", () => {
  it.each(TRIAD_CASES)(
    "constructs a correctly spelled $root.name $quality triad",
    ({ expected, quality, root }) => {
      expect(createRootPositionTriad(root, quality)).toEqual(expected);
    },
  );

  it("preserves written octaves when chord tones cross B/C boundaries", () => {
    expect(createRootPositionTriad(note(59, "B", 3), "minor")).toEqual([
      note(59, "B", 3),
      note(62, "D", 4),
      note(66, "F♯", 4),
    ]);
  });

  it("rejects a spelling that requires a double accidental", () => {
    expect(createRootPositionTriad(note(61, "C♯", 4), "augmented")).toBeNull();
  });
});
