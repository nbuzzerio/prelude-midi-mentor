import {
  Accidental,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  Voice,
} from "vexflow";
import type { PracticeNote, PracticeTarget } from "@/types/practice";

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

function toVexFlowPitch(practiceNote: PracticeNote): VexFlowPitch {
  const accidental = practiceNote.name.includes("♯")
    ? "#"
    : practiceNote.name.includes("♭")
      ? "b"
      : null;

  const normalizedName = practiceNote.name
    .replace("♯", "#")
    .replace("♭", "b")
    .toLowerCase();

  return {
    accidental,
    key: `${normalizedName}/${practiceNote.octave}`,
  };
}

export function renderPracticeTarget(
  container: HTMLDivElement,
  practiceTarget: PracticeTarget,
): void {
  container.replaceChildren();

  const renderer = new Renderer(container, Renderer.Backends.SVG);

  renderer.resize(RENDERER_WIDTH, RENDERER_HEIGHT);

  const context = renderer.getContext();
  const stave = new Stave(STAVE_X, STAVE_Y, STAVE_WIDTH);

  stave.addClef(practiceTarget.clef);
  stave.setContext(context).draw();

  const pitches = practiceTarget.notes.map(toVexFlowPitch);

  const note = new StaveNote({
    clef: practiceTarget.clef,
    keys: pitches.map((pitch) => pitch.key),
    duration: "q",
  });

  pitches.forEach((pitch, index) => {
    if (pitch.accidental) {
      note.addModifier(new Accidental(pitch.accidental), index);
    }
  });

  const voice = new Voice({
    numBeats: 1,
    beatValue: 4,
  });

  voice.addTickables([note]);

  new Formatter().joinVoices([voice]).format([voice], NOTE_FORMAT_WIDTH);

  voice.draw(context, stave);

  const svg = container.querySelector("svg");

  if (!svg) {
    return;
  }

  svg.setAttribute("viewBox", `0 0 ${RENDERER_WIDTH} ${RENDERER_HEIGHT}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.style.display = "block";
}
