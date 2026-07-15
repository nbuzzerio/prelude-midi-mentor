"use client";

import { useEffect, useRef } from "react";
import {
  Accidental,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  Voice,
} from "vexflow";
import { toVexFlowPitch } from "@/lib/music/vexflow";
import type { TargetNote } from "@/types/practice";

type MusicStaffProps = Readonly<{
  targetNote: TargetNote;
}>;

const RENDERER_WIDTH = 320;
const RENDERER_HEIGHT = 180;
const STAVE_X = 10;
const STAVE_Y = 30;
const STAVE_WIDTH = 300;
const NOTE_FORMAT_WIDTH = 200;

export default function MusicStaff({ targetNote }: MusicStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    container.replaceChildren();

    const renderer = new Renderer(container, Renderer.Backends.SVG);

    renderer.resize(RENDERER_WIDTH, RENDERER_HEIGHT);

    const context = renderer.getContext();
    const stave = new Stave(STAVE_X, STAVE_Y, STAVE_WIDTH);

    stave.addClef(targetNote.clef);
    stave.setContext(context).draw();

    const { accidental, key } = toVexFlowPitch(targetNote);

    const note = new StaveNote({
      clef: targetNote.clef,
      keys: [key],
      duration: "q",
    });

    if (accidental) {
      note.addModifier(new Accidental(accidental), 0);
    }

    const voice = new Voice({
      numBeats: 1,
      beatValue: 4,
    });

    voice.addTickables([note]);

    new Formatter()
      .joinVoices([voice])
      .format([voice], NOTE_FORMAT_WIDTH);

    voice.draw(context, stave);
  }, [targetNote]);

  return (
    <div
      ref={containerRef}
      aria-label={`Musical staff showing ${targetNote.name}${targetNote.octave} in ${targetNote.clef} clef`}
      className="mx-auto w-full max-w-80 invert"
    />
  );
}