"use client";

import { useEffect, useRef } from "react";

import {
  renderGrandStaffHeldNotes,
  renderPracticeTarget,
  renderSequenceTarget,
} from "@/lib/music/vexflow";
import type { PracticeTarget, SequenceTarget } from "@/types/practice";

type PracticeMusicStaffProps = Readonly<{
  currentStepIndex?: never;
  heldMidiNumbers?: never;
  practiceTarget: PracticeTarget;
  sequenceTarget?: never;
}>;

type SequenceMusicStaffProps = Readonly<{
  currentStepIndex: number;
  heldMidiNumbers?: never;
  practiceTarget?: never;
  sequenceTarget: SequenceTarget;
}>;

type FreePlayMusicStaffProps = Readonly<{
  currentStepIndex?: never;
  heldMidiNumbers: ReadonlySet<number>;
  practiceTarget?: never;
  sequenceTarget?: never;
}>;

type MusicStaffProps =
  | PracticeMusicStaffProps
  | SequenceMusicStaffProps
  | FreePlayMusicStaffProps;

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

export default function MusicStaff(props: MusicStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const isSequenceStaff = props.sequenceTarget !== undefined;
  const isFreePlayStaff = props.heldMidiNumbers !== undefined;

  let ariaLabel: string;

  if (isSequenceStaff) {
    const noteNames = getSequenceTargetNoteNames(props.sequenceTarget);

    ariaLabel = `Musical staff showing ${noteNames} in ${props.sequenceTarget.clef} clef`;
  } else if (isFreePlayStaff) {
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

    if (props.heldMidiNumbers !== undefined) {
      renderGrandStaffHeldNotes(container, props.heldMidiNumbers);

      return;
    }

    renderPracticeTarget(container, props.practiceTarget);
  }, [props]);

  const className = isFreePlayStaff
    ? "mx-auto flex min-h-[440px] w-full items-center justify-center invert [&_svg]:h-auto! [&_svg]:max-h-[460px] [&_svg]:w-full! md:[&_svg]:scale-[125%] lg:[&_svg]:scale-[150%] md:[&_svg]:translate-y-[65px]"
    : "mx-auto flex min-h-0 w-full items-center justify-center invert [&_svg]:h-[200%]! [&_svg]:w-auto!";

  return (
    <div ref={containerRef} aria-label={ariaLabel} className={className} />
  );
}
