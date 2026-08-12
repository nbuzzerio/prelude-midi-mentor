import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PracticeNote, PracticeTarget, SequenceTarget } from "@/types/practice";
import { SEQUENCE_DEFAULT_TIMING } from "@/lib/music/sequence-timing";

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
  steps: [
    { durationTicks: 480, notes: [C] },
    { durationTicks: 480, notes: [{ midiNumber: 67, name: "G", octave: 4 }] },
  ],
  timing: SEQUENCE_DEFAULT_TIMING,
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

  it("applies Free Play Mobile Play scaling only while active", () => {
    const view = render(<MusicStaff heldNotes={[]} mode="freeplay" />);
    const staff = screen.getByLabelText("Grand staff showing no currently held notes");
    expect(staff.className).not.toContain("scale-[300%]");

    view.rerender(<MusicStaff heldNotes={[]} isMobilePlayMode mode="freeplay" />);
    expect(staff.className).toContain("scale-[300%]");
    expect(staff.className).not.toContain("scale-[175%]");
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
      <MusicStaff
        currentStepIndex={1}
        firstVisibleStepIndex={0}
        lastVisibleStepIndex={1}
        sequenceTarget={SEQUENCE_TARGET}
        showWholeSequence={false}
      />,
    );

    expect(mocks.renderSequenceTarget).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      SEQUENCE_TARGET,
      1,
      {
        firstVisibleStepIndex: 0,
        lastVisibleStepIndex: 1,
        showWholeSequence: false,
      },
    );
    expect(mocks.renderGrandStaffHeldNotes).not.toHaveBeenCalled();
  });

  it("uses distinct Flashcard and Sequence Mobile Play scaling", () => {
    const practice = render(
      <MusicStaff isMobilePlayMode practiceTarget={PRACTICE_TARGET} />,
    );
    expect(screen.getByLabelText(/Musical staff showing/).className).toContain(
      "scale-[175%]",
    );
    practice.unmount();

    render(
      <MusicStaff
        currentStepIndex={0}
        firstVisibleStepIndex={0}
        isMobilePlayMode
        lastVisibleStepIndex={1}
        sequenceTarget={SEQUENCE_TARGET}
        showWholeSequence={false}
      />,
    );
    expect(screen.getByLabelText(/Musical staff showing/).className).toContain(
      "scale-[115%]",
    );
  });

  it("does not leak Mobile Play scaling into normal graded staffs", () => {
    render(<MusicStaff practiceTarget={PRACTICE_TARGET} />);
    const staff = screen.getByLabelText(/Musical staff showing/);
    expect(staff.className).not.toContain("scale-[175%]");
    expect(staff.className).not.toContain("scale-[115%]");
  });
});
