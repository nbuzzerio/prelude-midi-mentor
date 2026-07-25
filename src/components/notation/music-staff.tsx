"use client";

import { useEffect, useRef } from "react";

import {
  renderPracticeTarget,
  renderSequenceTarget,
} from "@/lib/music/vexflow";
import type { PracticeTarget, SequenceTarget } from "@/types/practice";

type PracticeMusicStaffProps = Readonly<{
  currentStepIndex?: never;
  practiceTarget: PracticeTarget;
  sequenceTarget?: never;
}>;

type SequenceMusicStaffProps = Readonly<{
  currentStepIndex: number;
  practiceTarget?: never;
  sequenceTarget: SequenceTarget;
}>;

type MusicStaffProps = PracticeMusicStaffProps | SequenceMusicStaffProps;

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

export default function MusicStaff(props: MusicStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const isSequenceStaff = props.sequenceTarget !== undefined;

  const clef = isSequenceStaff
    ? props.sequenceTarget.clef
    : props.practiceTarget.clef;

  const noteNames = isSequenceStaff
    ? getSequenceTargetNoteNames(props.sequenceTarget)
    : getPracticeTargetNoteNames(props.practiceTarget);

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

    renderPracticeTarget(container, props.practiceTarget);
  }, [props]);

  return (
    <div
      ref={containerRef}
      aria-label={`Musical staff showing ${noteNames} in ${clef} clef`}
      className="mx-auto flex min-h-0 w-full items-center justify-center invert [&_svg]:h-[200%]! [&_svg]:w-auto!"
    />
  );
}
