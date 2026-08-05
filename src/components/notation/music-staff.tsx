"use client";

import { useEffect, useRef } from "react";

import {
  renderGrandStaffHeldNotes,
  renderPracticeTarget,
  renderSequenceTarget,
  type StaffKeySignature,
} from "@/lib/music/vexflow";
import { createPracticeNote } from "@/lib/music/note-utils";
import type {
  PracticeNote,
  PracticeTarget,
  SequenceTarget,
} from "@/types/practice";

type PracticeMusicStaffProps = Readonly<{
  currentStepIndex?: never;
  heldMidiNumbers?: never;
  heldNotes?: never;
  keySignatureId?: never;
  mode?: never;
  practiceTarget: PracticeTarget;
  sequenceTarget?: never;
}>;

type SequenceMusicStaffProps = Readonly<{
  currentStepIndex: number;
  heldMidiNumbers?: never;
  heldNotes?: never;
  keySignatureId?: never;
  mode?: never;
  practiceTarget?: never;
  sequenceTarget: SequenceTarget;
}>;

type KeyAwareFreePlayMusicStaffProps = Readonly<{
  currentStepIndex?: never;
  heldMidiNumbers?: never;
  heldNotes: ReadonlyArray<PracticeNote>;
  keySignatureId?: StaffKeySignature;
  mode: "freeplay";
  practiceTarget?: never;
  sequenceTarget?: never;
}>;

// TODO(Phase 4): Remove after FreeplaySession supplies already-spelled notes.
type LegacyFreePlayMusicStaffProps = Readonly<{
  currentStepIndex?: never;
  heldMidiNumbers: ReadonlySet<number>;
  heldNotes?: never;
  keySignatureId?: never;
  mode?: never;
  practiceTarget?: never;
  sequenceTarget?: never;
}>;

type MusicStaffProps = (
  | PracticeMusicStaffProps
  | SequenceMusicStaffProps
  | KeyAwareFreePlayMusicStaffProps
  | LegacyFreePlayMusicStaffProps
) &
  Readonly<{
    isFocusMode?: boolean;
  }>;

function getPracticeTargetNoteNames(practiceTarget: PracticeTarget): string {
  return practiceTarget.notes
    .map((note) => `${note.name}${note.octave}`)
    .join(", ");
}

function getSequenceTargetNoteNames(sequenceTarget: SequenceTarget): string {
  return sequenceTarget.steps
    .map((step) =>
      step.notes.map((note) => `${note.name}${note.octave}`).join(" and "),
    )
    .join(", then ");
}

function getHeldMidiNumberLabel(heldMidiNumbers: ReadonlySet<number>): string {
  if (heldMidiNumbers.size === 0) {
    return "no currently held notes";
  }

  return [...heldMidiNumbers]
    .sort((left, right) => left - right)
    .map((midiNumber) => `MIDI note ${midiNumber}`)
    .join(", ");
}

function getHeldNoteLabel(heldNotes: ReadonlyArray<PracticeNote>): string {
  if (heldNotes.length === 0) {
    return "no currently held notes";
  }

  return [...heldNotes]
    .sort((left, right) => left.midiNumber - right.midiNumber)
    .map(
      (note) =>
        `${note.name}${note.octave} (MIDI note ${note.midiNumber})`,
    )
    .join(", ");
}

export default function MusicStaff(props: MusicStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const isSequenceStaff = props.sequenceTarget !== undefined;
  const isKeyAwareFreePlayStaff = props.mode === "freeplay";
  const isLegacyFreePlayStaff = props.heldMidiNumbers !== undefined;
  const isFreePlayStaff =
    isKeyAwareFreePlayStaff || isLegacyFreePlayStaff;

  let ariaLabel: string;

  if (isSequenceStaff) {
    const noteNames = getSequenceTargetNoteNames(props.sequenceTarget);

    ariaLabel = `Musical staff showing ${noteNames} in ${props.sequenceTarget.clef} clef`;
  } else if (isKeyAwareFreePlayStaff) {
    ariaLabel = `Grand staff showing ${getHeldNoteLabel(props.heldNotes)}`;
  } else if (isLegacyFreePlayStaff) {
    ariaLabel = `Grand staff showing ${getHeldMidiNumberLabel(
      props.heldMidiNumbers,
    )}`;
  } else {
    const noteNames = getPracticeTargetNoteNames(props.practiceTarget);

    ariaLabel = `Musical staff showing ${noteNames} in ${props.practiceTarget.clef} clef`;
  }

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    if (props.sequenceTarget !== undefined) {
      renderSequenceTarget(
        container,
        props.sequenceTarget,
        props.currentStepIndex,
      );

      return;
    }

    if (props.mode === "freeplay") {
      renderGrandStaffHeldNotes(
        container,
        props.heldNotes,
        props.keySignatureId,
      );

      return;
    }

    if (props.heldMidiNumbers !== undefined) {
      const heldNotes = [...props.heldMidiNumbers].map((midiNumber) =>
        createPracticeNote(midiNumber),
      );

      renderGrandStaffHeldNotes(container, heldNotes);

      return;
    }

    renderPracticeTarget(container, props.practiceTarget);
  }, [props]);

  const className = isFreePlayStaff
    ? "music-staff music-staff-freeplay mx-auto flex min-h-[440px] w-full items-center justify-center invert [&_svg]:h-auto! [&_svg]:max-h-[460px] [&_svg]:w-full! md:[&_svg]:scale-[125%] lg:[&_svg]:scale-[150%] md:[&_svg]:translate-y-[65px]"
    : "music-staff mx-auto flex min-h-0 w-full items-center justify-center invert [&_svg]:h-[200%]! [&_svg]:w-auto!";

  return (
    <div ref={containerRef} aria-label={ariaLabel} className={className} />
  );
}
