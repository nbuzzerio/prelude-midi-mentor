import {
  Accidental,
  Beam,
  Dot,
  Formatter,
  Fraction,
  GhostNote,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  StaveTie,
  Stem,
  Voice,
  type StemmableNote,
} from "vexflow";
import type { StaffBuilderScoreV1, StaffBuilderStaff } from "../staff-builder-types";
import {
  projectStaffBuilderMeasure,
  type StaffBuilderMeasureProjection,
  type StaffBuilderMeasureProjectionOptions,
  type StaffBuilderProjectedEvent,
  type StaffBuilderProjectedTickable,
  type StaffBuilderProjectedVoice,
} from "./staff-builder-notation";

export type StaffBuilderEventAnchor = Readonly<{
  eventId: string;
  staff: StaffBuilderStaff;
  startTick: number;
  onsetX: number;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type StaffBuilderPositionAnchor = Readonly<{
  tick: number;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type StaffBuilderTemporalGeometry = Readonly<{
  rhythmicStartX: number;
  rhythmicEndX: number;
  y: number;
  height: number;
  capacityTicks: number;
}>;

export type StaffBuilderNotationControlAnchor = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type StaffBuilderNotationControlAnchors = Readonly<{
  trebleClef: StaffBuilderNotationControlAnchor;
  grandStaff: StaffBuilderNotationControlAnchor;
  bassClef: StaffBuilderNotationControlAnchor;
  keySignature: StaffBuilderNotationControlAnchor;
  timeSignature: StaffBuilderNotationControlAnchor;
}>;

export type StaffBuilderRenderAnchors = Readonly<{
  events: ReadonlyMap<string, StaffBuilderEventAnchor>;
  authoritativeEvents: ReadonlyMap<string, StaffBuilderEventAnchor>;
  positions: ReadonlyMap<number, StaffBuilderPositionAnchor>;
  timeline: StaffBuilderTemporalGeometry;
  notationControls: StaffBuilderNotationControlAnchors;
}>;

export type StaffBuilderMeasureRenderOptions = StaffBuilderMeasureProjectionOptions & Readonly<{
  excludedEventIds?: ReadonlySet<string>;
}>;

export type StaffBuilderMeasureRenderResult = Readonly<{
  anchors: StaffBuilderRenderAnchors;
  projection: StaffBuilderMeasureProjection;
  width: number;
  height: number;
  coordinateSpace: Readonly<{ width: number; height: number }>;
}>;

const RENDER_WIDTH = 760;
const RENDER_HEIGHT = 300;
const STAVE_X = 20;
const TREBLE_Y = 55;
const BASS_Y = 155;
const STAVE_RIGHT_PADDING = 20;
const FORMAT_PADDING = 155;

type RenderedTickable = Readonly<{
  projection: StaffBuilderProjectedTickable;
  note: StemmableNote;
}>;

type RenderedVoice = Readonly<{
  projection: StaffBuilderProjectedVoice;
  tickables: readonly RenderedTickable[];
  voice: Voice;
}>;

function pitchKey(event: StaffBuilderProjectedEvent, pitchIndex: number): string {
  const pitch = event.pitches[pitchIndex];
  if (!pitch) throw new Error(`Missing projected pitch ${pitchIndex} for ${event.eventId}.`);
  const accidental = pitch.accidental === "sharp" ? "#" : pitch.accidental === "flat" ? "b" : "";
  return `${pitch.letter.toLowerCase()}${accidental}/${pitch.octave}`;
}

function createTickable(item: StaffBuilderProjectedTickable): RenderedTickable {
  const duration = item.visualDuration.vexflowDuration;
  if (item.kind === "spacer") {
    const note = new GhostNote({ duration, dots: item.visualDuration.dots });
    note.setDuration(new Fraction(item.durationTicks * 128, 15));
    return { projection: item, note };
  }
  const keys = item.kind === "rest"
    ? [item.staff === "treble" ? "b/4" : "d/3"]
    : item.pitches.map((_pitch, index) => pitchKey(item, index));
  const note = new StaveNote({ clef: item.staff, duration: `${duration}${item.kind === "rest" ? "r" : ""}`, keys });
  note.setDuration(new Fraction(item.layoutDurationTicks * 128, 15));
  if (item.visualDuration.dots > 0) Dot.buildAndAttach([note], { all: true });
  return { projection: item, note };
}

function voiceFor(timeSignature: StaffBuilderMeasureProjection["timeSignature"], tickables: readonly RenderedTickable[]): Voice {
  const [numBeats, beatValue] = timeSignature.split("/").map(Number);
  return new Voice({ numBeats: numBeats ?? 4, beatValue: beatValue ?? 4 })
    .setMode(Voice.Mode.SOFT)
    .addTickables(tickables.map(({ note }) => note));
}

function beamGroups(groups: readonly string[]): Fraction[] {
  return groups.map((group) => {
    const [numerator, denominator] = group.split("/").map(Number);
    return new Fraction(numerator, denominator);
  });
}

function renderVoices(projections: readonly StaffBuilderProjectedVoice[], timeSignature: StaffBuilderMeasureProjection["timeSignature"]): readonly RenderedVoice[] {
  const polyphonic = projections.length > 1;
  return projections.map((projection) => {
    const tickables = projection.tickables.map(createTickable);
    if (polyphonic) {
      const direction = projection.voiceIndex % 2 === 0 ? Stem.UP : Stem.DOWN;
      tickables.forEach(({ note, projection: item }) => {
        if (item.kind !== "spacer") note.setStemDirection(direction);
      });
    }
    return { projection, tickables, voice: voiceFor(timeSignature, tickables) };
  });
}

function configureSvg(container: HTMLDivElement, width: number, height: number): void {
  const svg = container.querySelector("svg");
  if (!svg) return;
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.style.display = "block";
}

function createEventAnchors(rendered: readonly RenderedTickable[]): ReadonlyMap<string, StaffBuilderEventAnchor> {
  const anchors = new Map<string, StaffBuilderEventAnchor>();
  for (const { note, projection } of rendered) {
    if (projection.kind === "spacer") continue;
    const bounds = note.getBoundingBox();
    anchors.set(projection.eventId, {
      eventId: projection.eventId,
      staff: projection.staff,
      startTick: projection.startTick,
      onsetX: note.getAbsoluteX(),
      x: bounds.getX(),
      y: bounds.getY(),
      width: Math.max(1, bounds.getW()),
      height: Math.max(1, bounds.getH()),
    });
  }
  return anchors;
}

function createPositionAnchors(
  projection: StaffBuilderMeasureProjection,
  trebleStave: Stave,
  bassStave: Stave,
): Readonly<{ positions: ReadonlyMap<number, StaffBuilderPositionAnchor>; timeline: StaffBuilderTemporalGeometry }> {
  const anchors = new Map<number, StaffBuilderPositionAnchor>();
  const top = trebleStave.getBoundingBox().getY();
  const bottomBounds = bassStave.getBoundingBox();
  const bottom = bottomBounds.getY() + bottomBounds.getH();
  const rhythmicStartX = Math.max(trebleStave.getNoteStartX(), bassStave.getNoteStartX());
  const rhythmicEndX = Math.min(trebleStave.getNoteEndX(), bassStave.getNoteEndX());
  const width = Math.max(1, rhythmicEndX - rhythmicStartX);
  const xAtTick = (tick: number) => rhythmicStartX + Math.max(0, Math.min(projection.capacityTicks, tick)) / projection.capacityTicks * width;
  projection.positionTicks.forEach((tick, index) => {
    const nextTick = projection.positionTicks[index + 1] ?? projection.capacityTicks;
    const x = xAtTick(tick);
    anchors.set(tick, {
      tick,
      x,
      y: top,
      width: Math.max(1, xAtTick(nextTick) - x),
      height: bottom - top,
    });
  });
  return { positions: anchors, timeline: { rhythmicStartX, rhythmicEndX, y: top, height: bottom - top, capacityTicks: projection.capacityTicks } };
}

export function renderStaffBuilderMeasure(container: HTMLDivElement, score: StaffBuilderScoreV1, measureIndex: number, options?: StaffBuilderMeasureRenderOptions): StaffBuilderMeasureRenderResult {
  const projection = projectStaffBuilderMeasure(score, measureIndex, options);
  container.replaceChildren();
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(RENDER_WIDTH, RENDER_HEIGHT);
  const context = renderer.getContext();
  const staveWidth = RENDER_WIDTH - STAVE_X - STAVE_RIGHT_PADDING;
  const trebleStave = new Stave(STAVE_X, TREBLE_Y, staveWidth).addClef("treble");
  const bassStave = new Stave(STAVE_X, BASS_Y, staveWidth).addClef("bass");
  const clefEndX = Math.max(trebleStave.getNoteStartX(), bassStave.getNoteStartX());
  trebleStave.addKeySignature(projection.vexflowKeySignature);
  bassStave.addKeySignature(projection.vexflowKeySignature);
  const keyEndX = Math.max(trebleStave.getNoteStartX(), bassStave.getNoteStartX());
  trebleStave.addTimeSignature(projection.timeSignature);
  bassStave.addTimeSignature(projection.timeSignature);
  const sharedNoteStartX = Math.max(trebleStave.getNoteStartX(), bassStave.getNoteStartX());
  trebleStave.setNoteStartX(sharedNoteStartX);
  bassStave.setNoteStartX(sharedNoteStartX);
  trebleStave.setContext(context).draw();
  bassStave.setContext(context).draw();
  new StaveConnector(trebleStave, bassStave).setType(StaveConnector.type.BRACE).setContext(context).draw();
  new StaveConnector(trebleStave, bassStave).setType(StaveConnector.type.SINGLE_LEFT).setContext(context).draw();

  const trebleVoices = renderVoices(projection.voices.treble, projection.timeSignature);
  const bassVoices = renderVoices(projection.voices.bass, projection.timeSignature);
  Accidental.applyAccidentals(trebleVoices.map(({ voice }) => voice), projection.vexflowKeySignature);
  Accidental.applyAccidentals(bassVoices.map(({ voice }) => voice), projection.vexflowKeySignature);
  const beamsFor = (renderedVoice: RenderedVoice, polyphonic: boolean) => Beam.generateBeams(renderedVoice.tickables.map(({ note }) => note), {
    groups: beamGroups(renderedVoice.projection.beam.beatGroups),
    beamRests: false,
    maintainStemDirections: polyphonic,
  });
  const trebleBeams = trebleVoices.flatMap((renderedVoice) => beamsFor(renderedVoice, trebleVoices.length > 1));
  const bassBeams = bassVoices.flatMap((renderedVoice) => beamsFor(renderedVoice, bassVoices.length > 1));
  const formatter = new Formatter();
  formatter.joinVoices(trebleVoices.map(({ voice }) => voice));
  formatter.joinVoices(bassVoices.map(({ voice }) => voice));
  const allVoices = [...trebleVoices, ...bassVoices];
  formatter.format(allVoices.map(({ voice }) => voice), RENDER_WIDTH - FORMAT_PADDING);
  trebleVoices.forEach(({ voice }) => voice.draw(context, trebleStave));
  bassVoices.forEach(({ voice }) => voice.draw(context, bassStave));
  [...trebleBeams, ...bassBeams].forEach((beam) => beam.setContext(context).draw());

  const trebleRendered = trebleVoices.flatMap(({ tickables }) => tickables);
  const bassRendered = bassVoices.flatMap(({ tickables }) => tickables);

  const noteByEventId = new Map<string, StemmableNote>();
  [...trebleRendered, ...bassRendered].forEach(({ note, projection: item }) => {
    if (item.kind !== "spacer") noteByEventId.set(item.eventId, note);
  });
  projection.ties.forEach((tie) => {
    const firstNote = noteByEventId.get(tie.fromEventId);
    const lastNote = noteByEventId.get(tie.toEventId);
    if (!firstNote || !lastNote) return;
    new StaveTie({ firstNote, lastNote, firstIndexes: [tie.fromPitchIndex], lastIndexes: [tie.toPitchIndex] }).setContext(context).draw();
  });

  configureSvg(container, RENDER_WIDTH, RENDER_HEIGHT);
  const eventAnchors = createEventAnchors([...trebleRendered, ...bassRendered]);
  const trebleTop = trebleStave.getTopLineTopY() - 28;
  const trebleBottom = trebleStave.getBottomLineBottomY() + 28;
  const bassTop = bassStave.getTopLineTopY() - 28;
  const bassBottom = bassStave.getBottomLineBottomY() + 28;
  const signatureTop = trebleTop;
  const signatureBottom = bassBottom;
  const keyWidth = Math.max(12, keyEndX - clefEndX);
  const timeWidth = Math.max(12, sharedNoteStartX - keyEndX);
  const temporal = createPositionAnchors(projection, trebleStave, bassStave);
  return {
    anchors: {
      events: eventAnchors,
      authoritativeEvents: new Map([...eventAnchors].filter(([eventId]) => !options?.excludedEventIds?.has(eventId))),
      positions: temporal.positions,
      timeline: temporal.timeline,
      notationControls: {
        trebleClef: { x: STAVE_X, y: trebleTop, width: Math.max(12, clefEndX - STAVE_X), height: trebleBottom - trebleTop },
        grandStaff: { x: Math.max(0, STAVE_X - 18), y: trebleBottom - 8, width: 18, height: Math.max(44, bassTop - trebleBottom + 16) },
        bassClef: { x: STAVE_X, y: bassTop, width: Math.max(12, clefEndX - STAVE_X), height: bassBottom - bassTop },
        keySignature: { x: keyEndX - keyWidth, y: signatureTop, width: keyWidth, height: signatureBottom - signatureTop },
        timeSignature: { x: keyEndX, y: signatureTop, width: timeWidth, height: signatureBottom - signatureTop },
      },
    },
    projection,
    width: RENDER_WIDTH,
    height: RENDER_HEIGHT,
    coordinateSpace: { width: RENDER_WIDTH, height: RENDER_HEIGHT },
  };
}
