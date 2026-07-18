"use client";

import { useEffect, useRef } from "react";
import { renderPracticeTarget } from "@/lib/music/vexflow";
import type { PracticeTarget } from "@/types/practice";

type MusicStaffProps = Readonly<{
  practiceTarget: PracticeTarget;
}>;

export default function MusicStaff({ practiceTarget }: MusicStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const noteNames = practiceTarget.notes
    .map((note) => `${note.name}${note.octave}`)
    .join(", ");

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    renderPracticeTarget(container, practiceTarget);
  }, [practiceTarget]);

  return (
    <div
      ref={containerRef}
      aria-label={`Musical staff showing ${noteNames} in ${practiceTarget.clef} clef`}
      className="mx-auto flex min-h-0 w-full items-center justify-center invert [&_svg]:h-[200%]! [&_svg]:w-auto!"
    />
  );
}
