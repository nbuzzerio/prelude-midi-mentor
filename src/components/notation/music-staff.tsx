"use client";

import { useEffect, useRef } from "react";
import { renderTargetNote } from "@/lib/music/vexflow";
import type { TargetNote } from "@/types/practice";

type MusicStaffProps = Readonly<{
  targetNote: TargetNote;
}>;

export default function MusicStaff({ targetNote }: MusicStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    renderTargetNote(container, targetNote);
  }, [targetNote]);

  return (
    <div
      ref={containerRef}
      aria-label={`Musical staff showing ${targetNote.name}${targetNote.octave} in ${targetNote.clef} clef`}
      className="mx-auto min-h-0 w-full flex justify-center items-center invert [&_svg]:h-[200%]! [&_svg]:w-auto!"
    />
  );
}
