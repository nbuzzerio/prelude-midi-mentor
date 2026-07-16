import {
  Accidental,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  Voice,
} from "vexflow";
import type { TargetNote } from "@/types/practice";

type VexFlowAccidental = "#" | "b";

type VexFlowPitch = Readonly<{
  accidental: VexFlowAccidental | null;
  key: string;
}>;

const RENDERER_WIDTH = 320;
const RENDERER_HEIGHT = 180;
const STAVE_X = 10;
const STAVE_Y = 30;
const STAVE_WIDTH = 300;
const NOTE_FORMAT_WIDTH = 200;

function toVexFlowPitch(targetNote: TargetNote): VexFlowPitch {
  const normalizedName = targetNote.name
    .replace("♯", "#")
    .replace("♭", "b")
    .toLowerCase();

  const accidental = normalizedName.includes("#")
    ? "#"
    : normalizedName.includes("b")
      ? "b"
      : null;

  return {
    accidental,
    key: `${normalizedName}/${targetNote.octave}`,
  };
}

export function renderTargetNote(
  container: HTMLDivElement,
  targetNote: TargetNote,
): void {
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

  new Formatter().joinVoices([voice]).format([voice], NOTE_FORMAT_WIDTH);

  voice.draw(context, stave);
}
