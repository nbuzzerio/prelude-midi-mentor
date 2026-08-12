"use client";

import { useEffect, useRef } from "react";

import {
  renderGrandStaffHeldNotes,
  renderPracticeTarget,
  renderSequenceTarget,
  type StaffKeySignature,
} from "@/lib/music/vexflow";
import { deriveSequenceTimeline } from "@/lib/music/sequence-timing";
import type {
  PracticeNote,
  PracticeTarget,
  SequenceTarget,
} from "@/types/practice";

type PracticeMusicStaffProps = Readonly<{
  currentStepIndex?: never;
  heldNotes?: never;
  keySignatureId?: never;
  mode?: never;
  practiceTarget: PracticeTarget;
  sequenceTarget?: never;
}>;

type SequenceMusicStaffProps = Readonly<{
  currentStepIndex: number;
  firstVisibleStepIndex: number;
  heldNotes?: never;
  keySignatureId?: never;
  mode?: never;
  practiceTarget?: never;
  sequenceTarget: SequenceTarget;
  showWholeSequence: boolean;
  lastVisibleStepIndex: number;
}>;

type KeyAwareFreePlayMusicStaffProps = Readonly<{
  currentStepIndex?: never;
  heldNotes: ReadonlyArray<PracticeNote>;
  keySignatureId?: StaffKeySignature;
  mode: "freeplay";
  practiceTarget?: never;
  sequenceTarget?: never;
}>;

type MusicStaffProps = (
  | PracticeMusicStaffProps
  | SequenceMusicStaffProps
  | KeyAwareFreePlayMusicStaffProps
) &
  Readonly<{
    isFocusMode?: boolean;
    isMobilePlayMode?: boolean;
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

function getHeldNoteLabel(heldNotes: ReadonlyArray<PracticeNote>): string {
  if (heldNotes.length === 0) {
    return "no currently held notes";
  }

  return [...heldNotes]
    .sort((left, right) => left.midiNumber - right.midiNumber)
    .map((note) => `${note.name}${note.octave} (MIDI note ${note.midiNumber})`)
    .join(", ");
}

export default function MusicStaff(props: MusicStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const isSequenceStaff = props.sequenceTarget !== undefined;
  const isKeyAwareFreePlayStaff = props.mode === "freeplay";

  let ariaLabel: string;

  if (isSequenceStaff) {
    const visibleTarget: SequenceTarget = {
      ...props.sequenceTarget,
      steps: props.sequenceTarget.steps.slice(
        props.firstVisibleStepIndex,
        props.lastVisibleStepIndex + 1,
      ),
    };
    const noteNames = getSequenceTargetNoteNames(visibleTarget);
    const timeline = deriveSequenceTimeline(props.sequenceTarget);
    const currentMeasureIndex =
      timeline.steps[props.currentStepIndex]?.measureIndex ?? 0;
    const presentationLabel = props.showWholeSequence
      ? `whole sequence, current measure ${currentMeasureIndex + 1} of ${timeline.measureCount}`
      : `measure ${currentMeasureIndex + 1} of ${timeline.measureCount}`;

    ariaLabel = `Musical staff showing ${presentationLabel}: ${noteNames} in ${props.sequenceTarget.clef} clef`;
  } else if (isKeyAwareFreePlayStaff) {
    ariaLabel = `Grand staff showing ${getHeldNoteLabel(props.heldNotes)}`;
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
        props.currentStepIndex - props.firstVisibleStepIndex,
        {
          firstVisibleStepIndex: props.firstVisibleStepIndex,
          lastVisibleStepIndex: props.lastVisibleStepIndex,
          showWholeSequence: props.showWholeSequence,
        },
      );

      if (props.showWholeSequence) {
        container
          .querySelector('[data-sequence-active="true"]')
          ?.scrollIntoView?.({ block: "nearest", inline: "center" });
      }

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

    renderPracticeTarget(container, props.practiceTarget);
  }, [props]);

  const className = isKeyAwareFreePlayStaff
    ? [
        "music-staff music-staff-freeplay mx-auto flex min-h-[440px] w-full items-center justify-center invert",
        "[&_svg]:h-auto! [&_svg]:max-h-[460px] [&_svg]:w-full!",
        props.isMobilePlayMode
          ? "[&_svg]:scale-[300%] [&_svg]:translate-y-[55px]"
          : "md:[&_svg]:scale-[125%] lg:[&_svg]:scale-[150%] md:[&_svg]:translate-y-[65px]",
      ].join(" ")
    : [
        "music-staff mx-auto flex min-h-0 w-full items-center justify-center invert [&_svg]:h-[200%]! [&_svg]:w-auto!",
        props.isMobilePlayMode
          ? props.sequenceTarget !== undefined
            ? "[&_svg]:scale-[115%] [&_svg]:translate-y-[8px]"
            : "[&_svg]:scale-[175%] [&_svg]:translate-y-[15px]"
          : "",
      ].join(" ");

  return (
    <div
      ref={containerRef}
      aria-label={ariaLabel}
      className={`${className}${isSequenceStaff ? " sequence-notation" : ""}`}
      data-sequence-presentation={
        isSequenceStaff
          ? props.showWholeSequence
            ? "whole"
            : "measure"
          : undefined
      }
      tabIndex={isSequenceStaff && props.showWholeSequence ? 0 : undefined}
    />
  );
}
