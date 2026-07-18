"use client";

import { useEffect, useRef } from "react";
import { renderTargetNote } from "@/lib/music/vexflow";
import type { PracticeTarget } from "@/types/practice";

type MusicStaffProps = Readonly<{
  practiceTarget: PracticeTarget;
}>;

export default function MusicStaff({ practiceTarget }: MusicStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    renderTargetNote(container, practiceTarget);
  }, [practiceTarget]);

  return (
    <div
      ref={containerRef}
      aria-label={`Musical staff showing ${practiceTarget.name}${practiceTarget.octave} in ${practiceTarget.clef} clef`}
      className="mx-auto min-h-0 w-full flex justify-center items-center invert [&_svg]:h-[200%]! [&_svg]:w-auto!"
    />
  );
}
