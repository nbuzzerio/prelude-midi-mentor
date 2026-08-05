import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PracticeNote, PracticeTarget, SequenceTarget } from "@/types/practice";

import MusicStaff from "./music-staff";

const mocks = vi.hoisted(() => ({
  renderGrandStaffHeldNotes: vi.fn(),
  renderPracticeTarget: vi.fn(),
  renderSequenceTarget: vi.fn(),
}));

vi.mock("@/lib/music/vexflow", () => ({
  renderGrandStaffHeldNotes: mocks.renderGrandStaffHeldNotes,
  renderPracticeTarget: mocks.renderPracticeTarget,
  renderSequenceTarget: mocks.renderSequenceTarget,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const B_FLAT: PracticeNote = { midiNumber: 70, name: "B♭", octave: 4 };
const C: PracticeNote = { midiNumber: 60, name: "C", octave: 4 };
const F_SHARP: PracticeNote = { midiNumber: 66, name: "F♯", octave: 4 };

const PRACTICE_TARGET: PracticeTarget = {
  clef: "treble",
  name: { primary: "C" },
  notes: [C],
};

const SEQUENCE_TARGET: SequenceTarget = {
  clef: "treble",
  name: { primary: "Ascending fifth" },
  steps: [{ notes: [C] }, { notes: [{ midiNumber: 67, name: "G", octave: 4 }] }],
};

describe("MusicStaff Free Play rendering", () => {
  it("forwards authoritative notes and a selected signature exactly", () => {
    render(
      <MusicStaff
        heldNotes={[B_FLAT]}
        keySignatureId="f-major"
        mode="freeplay"
      />,
    );

    expect(mocks.renderGrandStaffHeldNotes).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      [B_FLAT],
      "f-major",
    );
    expect(
      screen.getByLabelText("Grand staff showing B♭4 (MIDI note 70)"),
    ).toBeTruthy();
  });

  it("forwards undefined for No Key", () => {
    render(<MusicStaff heldNotes={[C]} mode="freeplay" />);

    expect(mocks.renderGrandStaffHeldNotes).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      [C],
      undefined,
    );
  });

  it("uses written sharp names and deterministic MIDI ordering in its label", () => {
    render(
      <MusicStaff heldNotes={[F_SHARP, C]} mode="freeplay" />,
    );

    expect(
      screen.getByLabelText(
        "Grand staff showing C4 (MIDI note 60), F♯4 (MIDI note 66)",
      ),
    ).toBeTruthy();
  });

  it("uses the empty Free Play wording", () => {
    render(<MusicStaff heldNotes={[]} mode="freeplay" />);

    expect(
      screen.getByLabelText("Grand staff showing no currently held notes"),
    ).toBeTruthy();
  });

  it("redraws when written notes or the signature changes", () => {
    const view = render(
      <MusicStaff heldNotes={[F_SHARP]} keySignatureId="g-major" mode="freeplay" />,
    );

    view.rerender(
      <MusicStaff heldNotes={[B_FLAT]} keySignatureId="f-major" mode="freeplay" />,
    );

    expect(mocks.renderGrandStaffHeldNotes).toHaveBeenCalledTimes(2);
    expect(mocks.renderGrandStaffHeldNotes).toHaveBeenLastCalledWith(
      expect.any(HTMLDivElement),
      [B_FLAT],
      "f-major",
    );
  });

  it("preserves the Free Play Focus Staff classes", () => {
    render(<MusicStaff heldNotes={[]} isFocusMode mode="freeplay" />);

    expect(
      screen.getByLabelText("Grand staff showing no currently held notes").className,
    ).toContain("music-staff-freeplay");
  });
});

describe("MusicStaff graded rendering", () => {
  it("keeps Practice rendering unchanged", () => {
    render(<MusicStaff practiceTarget={PRACTICE_TARGET} />);

    expect(mocks.renderPracticeTarget).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      PRACTICE_TARGET,
    );
    expect(mocks.renderGrandStaffHeldNotes).not.toHaveBeenCalled();
  });

  it("keeps Sequence rendering unchanged", () => {
    render(
      <MusicStaff currentStepIndex={1} sequenceTarget={SEQUENCE_TARGET} />,
    );

    expect(mocks.renderSequenceTarget).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      SEQUENCE_TARGET,
      1,
    );
    expect(mocks.renderGrandStaffHeldNotes).not.toHaveBeenCalled();
  });
});
