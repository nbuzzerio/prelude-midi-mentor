import { Formatter, Renderer, Stave, StaveConnector, StaveTie, type StemmableNote } from "vexflow";
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
  createStaffBuilderTemporalAnchors,
  createStaffBuilderVexFlowBeams,
  createStaffBuilderVexFlowVoices,
  drawStaffBuilderVexFlowBeams,
  type StaffBuilderEventAnchor,
  type StaffBuilderPositionAnchor,
  type StaffBuilderTemporalGeometry,
} from "./staff-builder-vexflow-rendering";

export type { StaffBuilderEventAnchor, StaffBuilderPositionAnchor, StaffBuilderTemporalGeometry } from "./staff-builder-vexflow-rendering";

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
  visibleStaff?: "grand" | StaffBuilderStaff;
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

export function renderStaffBuilderMeasure(container: HTMLDivElement, score: StaffBuilderScore, measureIndex: number, options?: StaffBuilderMeasureRenderOptions): StaffBuilderMeasureRenderResult {
  const projection = projectStaffBuilderMeasure(score, measureIndex, options);
  container.replaceChildren();
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(RENDER_WIDTH, RENDER_HEIGHT);
  const context = renderer.getContext();
  const staveWidth = RENDER_WIDTH - STAVE_X - STAVE_RIGHT_PADDING;
  const visibleStaff = options?.visibleStaff ?? "grand";
  const singleStaff = visibleStaff !== "grand";
  const trebleStave = new Stave(STAVE_X, singleStaff ? 95 : TREBLE_Y, staveWidth).addClef("treble");
  const bassStave = new Stave(STAVE_X, singleStaff ? 95 : BASS_Y, staveWidth).addClef("bass");
  const clefEndX = Math.max(trebleStave.getNoteStartX(), bassStave.getNoteStartX());
  trebleStave.addKeySignature(projection.vexflowKeySignature);
  bassStave.addKeySignature(projection.vexflowKeySignature);
  const keyEndX = Math.max(trebleStave.getNoteStartX(), bassStave.getNoteStartX());
  trebleStave.addTimeSignature(projection.timeSignature);
  bassStave.addTimeSignature(projection.timeSignature);
  const sharedNoteStartX = Math.max(trebleStave.getNoteStartX(), bassStave.getNoteStartX());
  trebleStave.setNoteStartX(sharedNoteStartX);
  bassStave.setNoteStartX(sharedNoteStartX);
  if (visibleStaff !== "bass") trebleStave.setContext(context).draw();
  if (visibleStaff !== "treble") bassStave.setContext(context).draw();
  if (!singleStaff) {
    new StaveConnector(trebleStave, bassStave).setType(StaveConnector.type.BRACE).setContext(context).draw();
    new StaveConnector(trebleStave, bassStave).setType(StaveConnector.type.SINGLE_LEFT).setContext(context).draw();
  }

  const trebleVoices = createStaffBuilderVexFlowVoices(projection.voices.treble, projection.timeSignature);
  const bassVoices = createStaffBuilderVexFlowVoices(projection.voices.bass, projection.timeSignature);
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
  formatter.format(allVoices.map(({ voice }) => voice), RENDER_WIDTH - FORMAT_PADDING);
  visibleTrebleVoices.forEach(({ voice }) => voice.draw(context, trebleStave));
  visibleBassVoices.forEach(({ voice }) => voice.draw(context, bassStave));
  drawStaffBuilderVexFlowBeams([...(visibleStaff === "bass" ? [] : trebleBeams), ...(visibleStaff === "treble" ? [] : bassBeams)], context);

  const trebleRendered = trebleVoices.flatMap(({ tickables }) => tickables);
  const bassRendered = bassVoices.flatMap(({ tickables }) => tickables);

  const noteByEventId = new Map<string, StemmableNote>();
  [...(visibleStaff === "bass" ? [] : trebleRendered), ...(visibleStaff === "treble" ? [] : bassRendered)].forEach(({ note, projection: item }) => {
    if (item.kind !== "spacer") noteByEventId.set(item.eventId, note);
  });
  projection.ties.forEach((tie) => {
    const firstNote = noteByEventId.get(tie.fromEventId);
    const lastNote = noteByEventId.get(tie.toEventId);
    if (!firstNote || !lastNote) return;
    new StaveTie({ firstNote, lastNote, firstIndexes: [tie.fromPitchIndex], lastIndexes: [tie.toPitchIndex] }).setContext(context).draw();
  });

  configureStaffBuilderSvg(container, RENDER_WIDTH, RENDER_HEIGHT);
  const eventAnchors = createStaffBuilderEventAnchors([...(visibleStaff === "bass" ? [] : trebleRendered), ...(visibleStaff === "treble" ? [] : bassRendered)]);
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
