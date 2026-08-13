import {
  Accidental,
  Formatter,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  Voice,
} from "vexflow";

import { getMusicKeyDefinition, type MusicKeyId } from "@/lib/music/keys";
import { deriveSequenceTimeline } from "@/lib/music/sequence-timing";
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

export type StaffKeySignature = MusicKeyId;

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

function getSequenceVexFlowDuration(
  durationTicks: number,
  ticksPerQuarter: number,
): "16" | "8" | "q" | "h" {
  const durationByTicks = new Map<number, "16" | "8" | "q" | "h">([
    [ticksPerQuarter / 4, "16"],
    [ticksPerQuarter / 2, "8"],
    [ticksPerQuarter, "q"],
    [ticksPerQuarter * 2, "h"],
  ]);
  const duration = durationByTicks.get(durationTicks);

  if (!duration) {
    throw new Error(
      `Sequence duration ${durationTicks} ticks is not supported by notation.`,
    );
  }

  return duration;
}

function createSequenceStaveNote(
  clef: Clef,
  notes: StaffNoteGroup,
  duration: "16" | "8" | "q" | "h",
  isActive: boolean,
): StaveNote {
  const pitches = notes.map(toVexFlowPitch);
  const staveNote = new StaveNote({
    clef,
    duration,
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

  if (isActive) {
    staveNote.setAttribute("data-sequence-active", "true");
  }

  return staveNote;
}

function drawHeldNoteGroup(
  context: ReturnType<Renderer["getContext"]>,
  stave: Stave,
  clef: Clef,
  notes: StaffNoteGroup,
  accidentalContext: string,
): void {
  if (notes.length === 0) {
    return;
  }

  const pitches = notes.map(toVexFlowPitch);
  const staveNote = new StaveNote({
    clef,
    duration: "q",
    keys: pitches.map((pitch) => pitch.key),
  });

  staveNote.setStyle({
    fillStyle: "#000000",
    strokeStyle: "#000000",
  });

  const voice = new Voice({
    beatValue: 4,
    numBeats: 1,
  });

  voice.addTickable(staveNote);

  Accidental.applyAccidentals([voice], accidentalContext);

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
  currentVisibleStepIndex: number,
  options: Readonly<{
    firstVisibleStepIndex: number;
    lastVisibleStepIndex: number;
    showWholeSequence: boolean;
  }>,
): void {
  container.replaceChildren();
  const timeline = deriveSequenceTimeline(sequenceTarget);
  const visibleTemporalSteps = timeline.steps.filter(
    ({ globalStepIndex }) =>
      globalStepIndex >= options.firstVisibleStepIndex &&
      globalStepIndex <= options.lastVisibleStepIndex,
  );

  if (visibleTemporalSteps.length === 0) {
    throw new Error("Sequence notation window contains no steps.");
  }
  const activeGlobalStepIndex =
    options.firstVisibleStepIndex + currentVisibleStepIndex;

  if (
    currentVisibleStepIndex < 0 ||
    activeGlobalStepIndex > options.lastVisibleStepIndex
  ) {
    throw new Error("Sequence notation highlight is outside the visible window.");
  }

  const visibleMeasureIndexes = [
    ...new Set(visibleTemporalSteps.map(({ measureIndex }) => measureIndex)),
  ];
  const measureWidth = 360;
  const rendererWidth = Math.max(
    MIN_RENDERER_WIDTH,
    STAVE_X + visibleMeasureIndexes.length * measureWidth,
  );
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(rendererWidth, RENDERER_HEIGHT);
  const context = renderer.getContext();

  visibleMeasureIndexes.forEach((measureIndex, visibleMeasureIndex) => {
    const x = visibleMeasureIndex * measureWidth + STAVE_X;
    const stave = new Stave(x, STAVE_Y, measureWidth);
    const measureSteps = visibleTemporalSteps.filter(
      (step) => step.measureIndex === measureIndex,
    );

    if (visibleMeasureIndex === 0) {
      stave.addClef(sequenceTarget.clef);
      stave.addTimeSignature(
        `${sequenceTarget.timing.meter.numerator}/${sequenceTarget.timing.meter.denominator}`,
      );
    }

    stave.setContext(context).draw();

    const staveNotes = measureSteps.map((temporalStep) => {
      const step = sequenceTarget.steps[temporalStep.globalStepIndex];

      if (!step) {
        throw new Error("Sequence notation step is missing from its target.");
      }

      return createSequenceStaveNote(
        sequenceTarget.clef,
        step.notes,
        getSequenceVexFlowDuration(
          step.durationTicks,
          sequenceTarget.timing.ticksPerQuarter,
        ),
        temporalStep.globalStepIndex === activeGlobalStepIndex,
      );
    });
    const voice = new Voice({
      beatValue: sequenceTarget.timing.meter.denominator,
      numBeats: sequenceTarget.timing.meter.numerator,
    });

    voice.setMode(Voice.Mode.SOFT);
    voice.addTickables(staveNotes);
    new Formatter()
      .joinVoices([voice])
      .format([voice], measureWidth - CLEF_AND_NOTE_PADDING);
    voice.draw(context, stave);
  });

  configureResponsiveSvg(container, rendererWidth, RENDERER_HEIGHT);

  const svg = container.querySelector("svg");

  if (svg) {
    svg.style.setProperty("--sequence-renderer-width", `${rendererWidth}px`);
  }
}

export function renderGrandStaffHeldNotes(
  container: HTMLDivElement,
  heldNotes: ReadonlyArray<PracticeNote>,
  keySignatureId?: StaffKeySignature,
): void {
  container.replaceChildren();

  const rendererWidth = 560;
  const staveWidth = rendererWidth - HORIZONTAL_PADDING;

  const renderer = new Renderer(container, Renderer.Backends.SVG);

  renderer.resize(rendererWidth, GRAND_STAFF_RENDERER_HEIGHT);

  const context = renderer.getContext();

  const trebleStave = new Stave(
    STAVE_X,
    GRAND_STAFF_TOP_Y,
    staveWidth,
  ).addClef("treble");

  const bassStave = new Stave(
    STAVE_X,
    GRAND_STAFF_BOTTOM_Y,
    staveWidth,
  ).addClef("bass");

  const vexflowKeySignature =
    keySignatureId === undefined
      ? undefined
      : getMusicKeyDefinition(keySignatureId).vexflowKeySignature;

  if (vexflowKeySignature !== undefined) {
    trebleStave.addKeySignature(vexflowKeySignature);
    bassStave.addKeySignature(vexflowKeySignature);
  }

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

  const sortedNotes = [...heldNotes].sort(
    (left, right) => left.midiNumber - right.midiNumber,
  );

  const bassNotes = sortedNotes.filter(
    (note) => note.midiNumber < MIDDLE_C_MIDI_NUMBER,
  );

  const trebleNotes = sortedNotes.filter(
    (note) => note.midiNumber >= MIDDLE_C_MIDI_NUMBER,
  );

  const accidentalContext = vexflowKeySignature ?? "C";

  drawHeldNoteGroup(
    context,
    trebleStave,
    "treble",
    trebleNotes,
    accidentalContext,
  );
  drawHeldNoteGroup(
    context,
    bassStave,
    "bass",
    bassNotes,
    accidentalContext,
  );

  configureResponsiveSvg(container, rendererWidth, GRAND_STAFF_RENDERER_HEIGHT);
}
