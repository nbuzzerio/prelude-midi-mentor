import {
  Accidental,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  Voice,
} from "vexflow";

import type {
  Clef,
  PracticeNote,
  PracticeTarget,
  SequenceTarget,
} from "@/types/practice";

type VexFlowAccidental = "#" | "b";

type VexFlowPitch = Readonly<{
  accidental: VexFlowAccidental | null;
  key: string;
}>;

type StaffNoteGroup = ReadonlyArray<PracticeNote>;

type StaffNotation = Readonly<{
  activeGroupIndex?: number;
  clef: Clef;
  noteGroups: ReadonlyArray<StaffNoteGroup>;
}>;

const MIN_RENDERER_WIDTH = 320;
const RENDERER_HEIGHT = 180;
const STAVE_X = 10;
const STAVE_Y = 30;
const HORIZONTAL_PADDING = 20;
const CLEF_AND_NOTE_PADDING = 100;
const NOTE_GROUP_WIDTH = 90;

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

function createStaveNote(
  clef: Clef,
  notes: StaffNoteGroup,
  isActive: boolean,
): StaveNote {
  const pitches = notes.map(toVexFlowPitch);

  const staveNote = new StaveNote({
    clef,
    duration: "q",
    keys: pitches.map((pitch) => pitch.key),
  });

  pitches.forEach((pitch, index) => {
    if (pitch.accidental) {
      staveNote.addModifier(new Accidental(pitch.accidental), index);
    }
  });

  staveNote.setStyle({
    fillStyle: isActive ? "#000000" : "#a1a1aa",
    strokeStyle: isActive ? "#000000" : "#a1a1aa",
  });

  return staveNote;
}

function renderStaffNotation(
  container: HTMLDivElement,
  notation: StaffNotation,
): void {
  container.replaceChildren();

  if (notation.noteGroups.length === 0) {
    return;
  }

  const rendererWidth = Math.max(
    MIN_RENDERER_WIDTH,
    CLEF_AND_NOTE_PADDING + notation.noteGroups.length * NOTE_GROUP_WIDTH,
  );

  const staveWidth = rendererWidth - HORIZONTAL_PADDING;
  const noteFormatWidth = rendererWidth - CLEF_AND_NOTE_PADDING;

  const renderer = new Renderer(container, Renderer.Backends.SVG);

  renderer.resize(rendererWidth, RENDERER_HEIGHT);

  const context = renderer.getContext();
  const stave = new Stave(STAVE_X, STAVE_Y, staveWidth);

  stave.addClef(notation.clef);
  stave.setContext(context).draw();

  const staveNotes = notation.noteGroups.map((notes, index) =>
    createStaveNote(
      notation.clef,
      notes,
      notation.activeGroupIndex === undefined ||
        notation.activeGroupIndex === index,
    ),
  );

  const voice = new Voice({
    beatValue: 4,
    numBeats: staveNotes.length,
  });

  voice.addTickables(staveNotes);

  new Formatter().joinVoices([voice]).format([voice], noteFormatWidth);

  voice.draw(context, stave);

  const svg = container.querySelector("svg");

  if (!svg) {
    return;
  }

  svg.setAttribute("viewBox", `0 0 ${rendererWidth} ${RENDERER_HEIGHT}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.style.display = "block";
}

export function renderPracticeTarget(
  container: HTMLDivElement,
  practiceTarget: PracticeTarget,
): void {
  renderStaffNotation(container, {
    clef: practiceTarget.clef,
    noteGroups: [practiceTarget.notes],
  });
}

export function renderSequenceTarget(
  container: HTMLDivElement,
  sequenceTarget: SequenceTarget,
  currentStepIndex: number,
): void {
  renderStaffNotation(container, {
    activeGroupIndex: currentStepIndex,
    clef: sequenceTarget.clef,
    noteGroups: sequenceTarget.steps.map((step) => step.notes),
  });
}
