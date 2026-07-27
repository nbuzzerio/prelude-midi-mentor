import {
  Accidental,
  Formatter,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  Voice,
} from "vexflow";

import { createPracticeNote } from "@/lib/music/note-utils";
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

const GRAND_STAFF_RENDERER_HEIGHT = 460;
const GRAND_STAFF_TOP_Y = 55;
const GRAND_STAFF_BOTTOM_Y = 125;
const GRAND_STAFF_NOTE_FORMAT_WIDTH = 190;
const MIDDLE_C_MIDI_NUMBER = 60;

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

function drawHeldNoteGroup(
  context: ReturnType<Renderer["getContext"]>,
  stave: Stave,
  clef: Clef,
  notes: StaffNoteGroup,
): void {
  if (notes.length === 0) {
    return;
  }

  const staveNote = createStaveNote(clef, notes, true);

  const voice = new Voice({
    beatValue: 4,
    numBeats: 1,
  });

  voice.addTickable(staveNote);

  new Formatter()
    .joinVoices([voice])
    .format([voice], GRAND_STAFF_NOTE_FORMAT_WIDTH);

  voice.draw(context, stave);
}

function configureResponsiveSvg(
  container: HTMLDivElement,
  rendererWidth: number,
  rendererHeight: number,
): void {
  const svg = container.querySelector("svg");

  if (!svg) {
    return;
  }

  svg.setAttribute("viewBox", `0 0 ${rendererWidth} ${rendererHeight}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.style.display = "block";
}

export function renderStaffNotation(
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

  configureResponsiveSvg(container, rendererWidth, RENDERER_HEIGHT);
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

export function renderGrandStaffHeldNotes(
  container: HTMLDivElement,
  heldMidiNumbers: ReadonlySet<number>,
): void {
  container.replaceChildren();

  const rendererWidth = 560;
  const staveWidth = rendererWidth - HORIZONTAL_PADDING;

  const renderer = new Renderer(container, Renderer.Backends.SVG);

  renderer.resize(rendererWidth, GRAND_STAFF_RENDERER_HEIGHT);

  const context = renderer.getContext();

  const trebleStave = new Stave(STAVE_X, GRAND_STAFF_TOP_Y, staveWidth).addClef(
    "treble",
  );

  const bassStave = new Stave(
    STAVE_X,
    GRAND_STAFF_BOTTOM_Y,
    staveWidth,
  ).addClef("bass");

  trebleStave.setContext(context).draw();
  bassStave.setContext(context).draw();

  new StaveConnector(trebleStave, bassStave)
    .setType(StaveConnector.type.BRACE)
    .setContext(context)
    .draw();

  new StaveConnector(trebleStave, bassStave)
    .setType(StaveConnector.type.SINGLE_LEFT)
    .setContext(context)
    .draw();

  const sortedMidiNumbers = [...heldMidiNumbers].sort(
    (left, right) => left - right,
  );

  const bassNotes = sortedMidiNumbers
    .filter((midiNumber) => midiNumber < MIDDLE_C_MIDI_NUMBER)
    .map((midiNumber) => createPracticeNote(midiNumber));

  const trebleNotes = sortedMidiNumbers
    .filter((midiNumber) => midiNumber >= MIDDLE_C_MIDI_NUMBER)
    .map((midiNumber) => createPracticeNote(midiNumber));

  drawHeldNoteGroup(context, trebleStave, "treble", trebleNotes);
  drawHeldNoteGroup(context, bassStave, "bass", bassNotes);

  configureResponsiveSvg(container, rendererWidth, GRAND_STAFF_RENDERER_HEIGHT);
}
