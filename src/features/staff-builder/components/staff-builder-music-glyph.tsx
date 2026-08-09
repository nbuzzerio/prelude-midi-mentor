import { useLayoutEffect, useRef } from "react";
import { Dot, Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow";
import type { StaffBuilderDuration } from "../staff-builder-time";

type MusicGlyphKind = StaffBuilderDuration | "treble-clef" | "grand-staff" | "bass-clef";

const DURATION_CODES: Readonly<Record<StaffBuilderDuration, string>> = {
  whole: "w", "dotted-half": "h", half: "h", "dotted-quarter": "q", quarter: "q",
  "dotted-eighth": "8", eighth: "8", sixteenth: "16",
};

export function StaffBuilderMusicGlyph({ kind, family = "note" }: Readonly<{
  kind: MusicGlyphKind;
  family?: "note" | "rest";
}>) {
  const targetRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const target = targetRef.current;
    if (!target) return;
    target.replaceChildren();
    const renderer = new Renderer(target, Renderer.Backends.SVG);
    renderer.resize(36, 42);
    const context = renderer.getContext();
    const stave = new Stave(0, -31, 36);
    stave.setContext(context);
    if (kind === "treble-clef" || kind === "bass-clef") {
      stave.addClef(kind === "treble-clef" ? "treble" : "bass").draw();
      return;
    }
    if (kind === "grand-staff") {
      new Stave(0, -37, 36).addClef("treble").setContext(context).draw();
      new Stave(0, -9, 36).addClef("bass").setContext(context).draw();
      return;
    }
    const dotted = kind.startsWith("dotted-");
    const note = new StaveNote({
      keys: [family === "rest" ? "b/4" : "c/5"],
      duration: `${DURATION_CODES[kind]}${family === "rest" ? "r" : ""}`,
    });
    if (dotted) Dot.buildAndAttach([note], { all: true });
    const voice = new Voice({ numBeats: 1, beatValue: 4 }).setMode(Voice.Mode.SOFT).addTickable(note);
    note.setStave(stave).setContext(context);
    new Formatter().joinVoices([voice]).format([voice], 28);
    voice.draw(context, stave);
  }, [family, kind]);

  return <div aria-hidden="true" className="staff-builder-music-glyph" data-glyph-family={family} data-glyph-kind={kind} ref={targetRef} />;
}
