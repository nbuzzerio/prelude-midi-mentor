import { Formatter, Renderer, Stave, StaveConnector, type StemmableNote } from "vexflow";
import type { StaffBuilderScore, StaffBuilderStaff } from "../staff-builder-types";
import {
  projectStaffBuilderMeasure,
  type StaffBuilderMeasureProjection,
  type StaffBuilderMeasureProjectionOptions,
} from "./staff-builder-notation";
import {
  applyStaffBuilderVexFlowAccidentals,
  configureStaffBuilderSvg,
  createStaffBuilderEventAnchors,
  createStaffBuilderPitchAnchors,
  createStaffBuilderTemporalAnchors,
  createStaffBuilderVexFlowBeams,
  createStaffBuilderVexFlowVoices,
  drawStaffBuilderVexFlowBeams,
  type StaffBuilderEventAnchor,
  type StaffBuilderPositionAnchor,
  type StaffBuilderPitchAnchor,
  type StaffBuilderTemporalGeometry,
} from "./staff-builder-vexflow-rendering";
import { getStaffBuilderVerticalGeometry } from "./staff-builder-vertical-geometry";
import { drawStaffBuilderTie } from "./draw-staff-builder-tie";
import { drawStaffBuilderLyricCues, getStaffBuilderLyricCues, STAFF_BUILDER_LYRIC_LANE_RESERVATION } from "./staff-builder-lyric-cues";

export type { StaffBuilderEventAnchor, StaffBuilderPitchAnchor, StaffBuilderPositionAnchor, StaffBuilderTemporalGeometry } from "./staff-builder-vexflow-rendering";

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
  pitches: ReadonlyMap<string, StaffBuilderPitchAnchor>;
  positions: ReadonlyMap<number, StaffBuilderPositionAnchor>;
  timeline: StaffBuilderTemporalGeometry;
  notationControls: StaffBuilderNotationControlAnchors;
}>;

export type StaffBuilderMeasureRenderOptions = StaffBuilderMeasureProjectionOptions & Readonly<{
  excludedEventIds?: ReadonlySet<string>;
  visibleStaff?: "grand" | StaffBuilderStaff;
  ghostedStaff?: StaffBuilderStaff;
  /** Reading Flow only: compact single-staff vertical layout and responsive formatting. */
  readingFlowWidth?: number;
  /** Melody's two-row reading view only; preserves full measures at their natural minimum width. */
  readingFlowCompact?: boolean;
}>;

export type StaffBuilderMeasureRenderResult = Readonly<{
  anchors: StaffBuilderRenderAnchors;
  projection: StaffBuilderMeasureProjection;
  width: number;
  height: number;
  coordinateSpace: Readonly<{ width: number; height: number }>;
}>;

const RENDER_WIDTH = 760;
const BASE_RENDER_HEIGHT = 300;
const STAVE_X = 20;
const TREBLE_Y = 55;
const BASS_Y = 155;
const STAVE_RIGHT_PADDING = 20;
const FORMAT_PADDING = 155;

export function renderStaffBuilderMeasure(container: HTMLDivElement, score: StaffBuilderScore, measureIndex: number, options?: StaffBuilderMeasureRenderOptions): StaffBuilderMeasureRenderResult {
  const projection = projectStaffBuilderMeasure(score, measureIndex, options);
  const measureEventIds = new Set(score.measures[measureIndex]?.events.map(({ id }) => id) ?? []);
  const lyricCues = getStaffBuilderLyricCues(score, measureEventIds);
  const visibleStaff = options?.visibleStaff ?? "grand";
  const singleStaff = visibleStaff !== "grand";
  const readingFlow = singleStaff && options?.readingFlowWidth !== undefined;
  const compactReading = readingFlow && options?.readingFlowCompact === true;
  let renderWidth = readingFlow && Number.isFinite(options?.readingFlowWidth) ? Math.max(compactReading ? 160 : 440, options!.readingFlowWidth!) : RENDER_WIDTH;
  const staveX = compactReading ? 8 : STAVE_X;
  const staveRightPadding = compactReading ? 8 : STAVE_RIGHT_PADDING;
  const baseTrebleY = compactReading ? 0 : singleStaff ? readingFlow ? 35 : 95 : TREBLE_Y;
  const baseBassY = compactReading ? 0 : singleStaff ? readingFlow ? 35 : 95 : BASS_Y;
  const pitchSources = [...projection.staves.treble, ...projection.staves.bass].flatMap((item) => item.kind === "notes" ? [{ staff: item.staff, clef: projection.clefs[item.staff], pitches: item.pitches }] : []);
  const vertical = getStaffBuilderVerticalGeometry({
    // Reserve the whole Melody range, not just this measure, so the two rows stay
    // fixed while their active state changes. Actual pitches still expand safely.
    pitchSources: compactReading ? [...pitchSources, {
      staff: visibleStaff,
      clef: projection.clefs[visibleStaff],
      pitches: [
        { letter: "C", octave: visibleStaff === "treble" ? 4 : 3 },
        { letter: "C", octave: visibleStaff === "treble" ? 5 : 4 },
      ],
    }] : pitchSources,
    baseHeight: compactReading ? 110 : readingFlow ? 180 : BASE_RENDER_HEIGHT,
    trebleStaveY: baseTrebleY,
    bassStaveY: baseBassY,
    visibleStaff,
    topLaneReservation: visibleStaff !== "bass" && lyricCues.length > 0 ? STAFF_BUILDER_LYRIC_LANE_RESERVATION : 0,
  });
  container.replaceChildren();
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(renderWidth, vertical.height);
  const context = renderer.getContext();
  const drawStaff = (staff: StaffBuilderStaff, draw: () => void) => {
    if (!options?.ghostedStaff) { draw(); return; }
    const group = context.openGroup("semantic-staff") as SVGGElement;
    group.setAttribute("data-semantic-staff", staff);
    if (options.ghostedStaff === staff) group.setAttribute("opacity", "0.55");
    draw();
    context.closeGroup();
  };
  const staveWidth = renderWidth - staveX - staveRightPadding;
  const trebleStave = new Stave(staveX, vertical.trebleStaveY, staveWidth).addClef(projection.clefs.treble);
  const bassStave = new Stave(staveX, vertical.bassStaveY, staveWidth).addClef(projection.clefs.bass);
  const signatureEndX = () => compactReading
    ? (visibleStaff === "bass" ? bassStave : trebleStave).getNoteStartX()
    : Math.max(trebleStave.getNoteStartX(), bassStave.getNoteStartX());
  const clefEndX = signatureEndX();
  trebleStave.addKeySignature(projection.vexflowKeySignature);
  bassStave.addKeySignature(projection.vexflowKeySignature);
  const keyEndX = signatureEndX();
  trebleStave.addTimeSignature(projection.timeSignature);
  bassStave.addTimeSignature(projection.timeSignature);
  const sharedNoteStartX = signatureEndX();
  trebleStave.setNoteStartX(sharedNoteStartX);
  bassStave.setNoteStartX(sharedNoteStartX);

  const trebleVoices = createStaffBuilderVexFlowVoices(projection.voices.treble, projection.timeSignature, projection.clefs.treble);
  const bassVoices = createStaffBuilderVexFlowVoices(projection.voices.bass, projection.timeSignature, projection.clefs.bass);
  applyStaffBuilderVexFlowAccidentals(trebleVoices, projection.vexflowKeySignature);
  applyStaffBuilderVexFlowAccidentals(bassVoices, projection.vexflowKeySignature);
  const trebleBeams = createStaffBuilderVexFlowBeams(trebleVoices);
  const bassBeams = createStaffBuilderVexFlowBeams(bassVoices);
  const formatter = new Formatter();
  formatter.joinVoices(trebleVoices.map(({ voice }) => voice));
  formatter.joinVoices(bassVoices.map(({ voice }) => voice));
  const visibleTrebleVoices = visibleStaff === "bass" ? [] : trebleVoices;
  const visibleBassVoices = visibleStaff === "treble" ? [] : bassVoices;
  const allVoices = [...visibleTrebleVoices, ...visibleBassVoices];
  const voices = allVoices.map(({ voice }) => voice);
  if (compactReading) {
    const visibleStave = visibleStaff === "bass" ? bassStave : trebleStave;
    // Measure glyph demand before drawing: narrow screens may scroll a dense
    // full measure, but sparse measures need not inherit the 440-unit floor.
    const rhythmicMinimum = formatter.preCalculateMinTotalWidth(voices);
    const endInset = renderWidth - staveRightPadding - visibleStave.getNoteEndX();
    renderWidth = Math.max(renderWidth, Math.ceil(sharedNoteStartX + rhythmicMinimum + Stave.defaultPadding + endInset + staveRightPadding));
    trebleStave.setWidth(renderWidth - staveX - staveRightPadding).setNoteStartX(sharedNoteStartX);
    bassStave.setWidth(renderWidth - staveX - staveRightPadding).setNoteStartX(sharedNoteStartX);
    renderer.resize(renderWidth, vertical.height);
    formatter.format(voices, visibleStave.getNoteEndX() - sharedNoteStartX - Stave.defaultPadding);
  } else {
    formatter.format(voices, renderWidth - FORMAT_PADDING);
  }
  if (visibleStaff !== "bass") drawStaff("treble", () => trebleStave.setContext(context).draw());
  if (visibleStaff !== "treble") drawStaff("bass", () => bassStave.setContext(context).draw());
  if (!singleStaff) {
    new StaveConnector(trebleStave, bassStave).setType(StaveConnector.type.BRACE).setContext(context).draw();
    new StaveConnector(trebleStave, bassStave).setType(StaveConnector.type.SINGLE_LEFT).setContext(context).draw();
  }
  if (!options?.ghostedStaff) {
    visibleTrebleVoices.forEach(({ voice }) => voice.draw(context, trebleStave));
    visibleBassVoices.forEach(({ voice }) => voice.draw(context, bassStave));
    drawStaffBuilderVexFlowBeams([...(visibleStaff === "bass" ? [] : trebleBeams), ...(visibleStaff === "treble" ? [] : bassBeams)], context);
  } else {
    if (visibleStaff !== "bass") drawStaff("treble", () => {
      visibleTrebleVoices.forEach(({ voice }) => voice.draw(context, trebleStave));
      drawStaffBuilderVexFlowBeams(trebleBeams, context);
    });
    if (visibleStaff !== "treble") drawStaff("bass", () => {
      visibleBassVoices.forEach(({ voice }) => voice.draw(context, bassStave));
      drawStaffBuilderVexFlowBeams(bassBeams, context);
    });
  }

  const trebleRendered = trebleVoices.flatMap(({ tickables }) => tickables);
  const bassRendered = bassVoices.flatMap(({ tickables }) => tickables);

  const noteByEventId = new Map<string, StemmableNote>();
  [...(visibleStaff === "bass" ? [] : trebleRendered), ...(visibleStaff === "treble" ? [] : bassRendered)].forEach(({ note, projection: item }) => {
    if (item.kind !== "spacer") noteByEventId.set(item.eventId, note);
  });
  const staffByEventId = new Map(score.measures[measureIndex]?.events.map(({ id, staff }) => [id, staff] as const) ?? []);
  projection.ties.forEach((tie) => {
    const firstNote = noteByEventId.get(tie.fromEventId);
    const lastNote = noteByEventId.get(tie.toEventId);
    if (!firstNote || !lastNote) return;
    const staff = staffByEventId.get(tie.fromEventId);
    if (staff) drawStaff(staff, () => drawStaffBuilderTie(context, firstNote, lastNote, tie.fromPitchIndex, tie.toPitchIndex));
    else drawStaffBuilderTie(context, firstNote, lastNote, tie.fromPitchIndex, tie.toPitchIndex);
  });
  projection.boundaryTies.forEach((tie) => {
    const note = noteByEventId.get(tie.eventId);
    if (!note) return;
    const draw = () => tie.direction === "incoming"
      ? drawStaffBuilderTie(context, null, note, tie.pitchIndex, tie.pitchIndex)
      : drawStaffBuilderTie(context, note, null, tie.pitchIndex, tie.pitchIndex);
    const staff = staffByEventId.get(tie.eventId);
    if (staff) drawStaff(staff, draw);
    else draw();
  });
  if (visibleStaff !== "bass") drawStaff("treble", () => drawStaffBuilderLyricCues(context, lyricCues, noteByEventId, 16, staveX, renderWidth - staveRightPadding));

  configureStaffBuilderSvg(container, renderWidth, vertical.height);
  const eventAnchors = createStaffBuilderEventAnchors([...(visibleStaff === "bass" ? [] : trebleRendered), ...(visibleStaff === "treble" ? [] : bassRendered)]);
  const pitchAnchors = createStaffBuilderPitchAnchors([...(visibleStaff === "bass" ? [] : trebleRendered), ...(visibleStaff === "treble" ? [] : bassRendered)]);
  const trebleTop = trebleStave.getTopLineTopY() - 28;
  const trebleBottom = trebleStave.getBottomLineBottomY() + 28;
  const bassTop = bassStave.getTopLineTopY() - 28;
  const bassBottom = bassStave.getBottomLineBottomY() + 28;
  const signatureTop = trebleTop;
  const signatureBottom = bassBottom;
  const keyWidth = Math.max(12, keyEndX - clefEndX);
  const timeWidth = Math.max(12, sharedNoteStartX - keyEndX);
  const temporal = createStaffBuilderTemporalAnchors(projection, trebleStave, bassStave);
  return {
    anchors: {
      events: eventAnchors,
      authoritativeEvents: new Map([...eventAnchors].filter(([eventId]) => !options?.excludedEventIds?.has(eventId))),
      pitches: pitchAnchors,
      positions: temporal.positions,
      timeline: temporal.timeline,
      notationControls: {
        trebleClef: { x: staveX, y: trebleTop, width: Math.max(12, clefEndX - staveX), height: trebleBottom - trebleTop },
        grandStaff: { x: Math.max(0, staveX - 18), y: trebleBottom - 8, width: 18, height: Math.max(44, bassTop - trebleBottom + 16) },
        bassClef: { x: staveX, y: bassTop, width: Math.max(12, clefEndX - staveX), height: bassBottom - bassTop },
        keySignature: { x: keyEndX - keyWidth, y: signatureTop, width: keyWidth, height: signatureBottom - signatureTop },
        timeSignature: { x: keyEndX, y: signatureTop, width: timeWidth, height: signatureBottom - signatureTop },
      },
    },
    projection,
    width: renderWidth,
    height: vertical.height,
    coordinateSpace: { width: renderWidth, height: vertical.height },
  };
}
