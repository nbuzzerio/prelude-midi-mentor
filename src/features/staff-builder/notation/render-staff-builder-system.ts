import { Barline, Formatter, Renderer, Stave, StaveConnector, type StemmableNote } from "vexflow";
import type { StaffBuilderNoteEvent, StaffBuilderScore } from "../staff-builder-types";
import { projectStaffBuilderMeasure, type StaffBuilderMeasureProjection, type StaffBuilderProjectedEvent } from "./staff-builder-notation";
import type { StaffBuilderLayoutBounds, StaffBuilderSystemLayout } from "./staff-builder-system-layout";
import { drawStaffBuilderTie } from "./draw-staff-builder-tie";
import { drawStaffBuilderLyricCues, getStaffBuilderLyricCues } from "./staff-builder-lyric-cues";
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

export type StaffBuilderSystemMeasureGeometry = Readonly<{
  measureId: string;
  measureIndex: number;
  bounds: StaffBuilderLayoutBounds;
  events: ReadonlyMap<string, StaffBuilderEventAnchor>;
  pitches: ReadonlyMap<string, StaffBuilderPitchAnchor>;
  positions: ReadonlyMap<number, StaffBuilderPositionAnchor>;
  timeline: StaffBuilderTemporalGeometry;
}>;

export type StaffBuilderSystemRenderResult = Readonly<{
  coordinateSpace: Readonly<{ width: number; height: number }>;
  system: Readonly<{ systemIndex: number; bounds: StaffBuilderLayoutBounds }>;
  measures: readonly StaffBuilderSystemMeasureGeometry[];
  events: ReadonlyMap<string, StaffBuilderEventAnchor>;
  pitches: ReadonlyMap<string, StaffBuilderPitchAnchor>;
}>;

type RenderedEvent = Readonly<{
  note: StemmableNote;
  projection: StaffBuilderProjectedEvent;
  measureIndex: number;
  pitchIndexById: ReadonlyMap<string, number>;
}>;

const STAVE_TOP_INSET = 15;
const BASS_STAVE_BOTTOM_INSET = 105;
const MINIMUM_RHYTHMIC_WIDTH = 1;

function requireSystemLayout(score: StaffBuilderScore, systemLayout: StaffBuilderSystemLayout): void {
  for (const placement of systemLayout.measures) {
    const measure = score.measures[placement.measureIndex];
    if (!measure || measure.id !== placement.measureId) {
      throw new Error(`System ${systemLayout.systemIndex} placement ${placement.measureId} does not match score measure index ${placement.measureIndex}.`);
    }
    if (placement.width <= 0 || placement.height <= 0) {
      throw new Error(`Cannot render measure ${placement.measureId} at index ${placement.measureIndex} with allocated width ${placement.width}.`);
    }
  }
}

function authoredEvents(score: StaffBuilderScore): ReadonlyMap<string, StaffBuilderNoteEvent> {
  const events = new Map<string, StaffBuilderNoteEvent>();
  for (const measure of score.measures) {
    for (const event of measure.events) if (event.kind === "notes") events.set(event.id, event);
  }
  return events;
}

function drawSystemTies(
  score: StaffBuilderScore,
  renderedEvents: ReadonlyMap<string, RenderedEvent>,
  context: ReturnType<Renderer["getContext"]>,
): void {
  const allEvents = authoredEvents(score);
  for (const tie of score.ties) {
    const source = allEvents.get(tie.fromEventId);
    const destination = allEvents.get(tie.toEventId);
    const sourcePitch = source?.pitches.find(({ id }) => id === tie.fromPitchId);
    const destinationPitch = destination?.pitches.find(({ id }) => id === tie.toPitchId);
    if (!source || !destination || !sourcePitch || !destinationPitch) continue;

    const renderedSource = renderedEvents.get(source.id);
    const renderedDestination = renderedEvents.get(destination.id);
    if (!renderedSource && !renderedDestination) continue;
    const sourceIndex = renderedSource?.pitchIndexById.get(tie.fromPitchId);
    const destinationIndex = renderedDestination?.pitchIndexById.get(tie.toPitchId);
    if ((renderedSource && sourceIndex === undefined) || (renderedDestination && destinationIndex === undefined)) continue;

    if (renderedSource && renderedDestination) {
      drawStaffBuilderTie(context, renderedSource.note, renderedDestination.note, sourceIndex!, destinationIndex!);
    } else if (renderedSource) {
      drawStaffBuilderTie(context, renderedSource.note, null, sourceIndex!, sourceIndex!);
    } else if (renderedDestination) {
      drawStaffBuilderTie(context, null, renderedDestination.note, destinationIndex!, destinationIndex!);
    }
  }
}

export function renderStaffBuilderSystem(
  container: HTMLDivElement,
  score: StaffBuilderScore,
  systemLayout: StaffBuilderSystemLayout,
): StaffBuilderSystemRenderResult {
  requireSystemLayout(score, systemLayout);
  container.replaceChildren();
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(systemLayout.width, systemLayout.height);
  const context = renderer.getContext();
  const renderedEvents = new Map<string, RenderedEvent>();
  const aggregateEvents = new Map<string, StaffBuilderEventAnchor>();
  const aggregatePitches = new Map<string, StaffBuilderPitchAnchor>();
  const measureGeometry: StaffBuilderSystemMeasureGeometry[] = [];
  let previousProjection: StaffBuilderMeasureProjection | undefined;

  systemLayout.measures.forEach((placement, placementIndex) => {
    const projection = projectStaffBuilderMeasure(score, placement.measureIndex);
    const trebleStave = new Stave(placement.x, placement.y + STAVE_TOP_INSET, placement.width)
      .setBegBarType(Barline.type.NONE).setEndBarType(Barline.type.NONE);
    const bassY = placement.y + Math.max(STAVE_TOP_INSET + 80, placement.height - BASS_STAVE_BOTTOM_INSET);
    const bassStave = new Stave(placement.x, bassY, placement.width)
      .setBegBarType(Barline.type.NONE).setEndBarType(Barline.type.NONE);

    if (placementIndex === 0) {
      trebleStave.addClef("treble").addKeySignature(projection.vexflowKeySignature).addTimeSignature(projection.timeSignature);
      bassStave.addClef("bass").addKeySignature(projection.vexflowKeySignature).addTimeSignature(projection.timeSignature);
    } else {
      if (projection.keySignatureId !== previousProjection?.keySignatureId) {
        trebleStave.addKeySignature(projection.vexflowKeySignature, previousProjection?.vexflowKeySignature);
        bassStave.addKeySignature(projection.vexflowKeySignature, previousProjection?.vexflowKeySignature);
      }
      if (projection.timeSignature !== previousProjection?.timeSignature) {
        trebleStave.addTimeSignature(projection.timeSignature);
        bassStave.addTimeSignature(projection.timeSignature);
      }
    }
    previousProjection = projection;

    const sharedNoteStartX = Math.max(trebleStave.getNoteStartX(), bassStave.getNoteStartX());
    trebleStave.setNoteStartX(sharedNoteStartX);
    bassStave.setNoteStartX(sharedNoteStartX);
    const rhythmicEndX = Math.min(trebleStave.getNoteEndX(), bassStave.getNoteEndX());
    const rhythmicWidth = rhythmicEndX - sharedNoteStartX;
    if (rhythmicWidth < MINIMUM_RHYTHMIC_WIDTH) {
      throw new Error(`Cannot render measure ${placement.measureId} at index ${placement.measureIndex}: allocated width ${placement.width} leaves no positive rhythmic formatting width.`);
    }

    trebleStave.setContext(context).draw();
    bassStave.setContext(context).draw();
    if (placementIndex === 0) {
      new StaveConnector(trebleStave, bassStave).setType(StaveConnector.type.BRACE).setContext(context).draw();
      new StaveConnector(trebleStave, bassStave).setType(StaveConnector.type.SINGLE_LEFT).setContext(context).draw();
    }
    new StaveConnector(trebleStave, bassStave).setType(StaveConnector.type.SINGLE_RIGHT).setContext(context).draw();

    const trebleVoices = createStaffBuilderVexFlowVoices(projection.voices.treble, projection.timeSignature);
    const bassVoices = createStaffBuilderVexFlowVoices(projection.voices.bass, projection.timeSignature);
    applyStaffBuilderVexFlowAccidentals(trebleVoices, projection.vexflowKeySignature);
    applyStaffBuilderVexFlowAccidentals(bassVoices, projection.vexflowKeySignature);
    const trebleBeams = createStaffBuilderVexFlowBeams(trebleVoices);
    const bassBeams = createStaffBuilderVexFlowBeams(bassVoices);
    const formatter = new Formatter();
    formatter.joinVoices(trebleVoices.map(({ voice }) => voice));
    formatter.joinVoices(bassVoices.map(({ voice }) => voice));
    formatter.format([...trebleVoices, ...bassVoices].map(({ voice }) => voice), rhythmicWidth);
    trebleVoices.forEach(({ voice }) => voice.draw(context, trebleStave));
    bassVoices.forEach(({ voice }) => voice.draw(context, bassStave));
    drawStaffBuilderVexFlowBeams([...trebleBeams, ...bassBeams], context);

    const renderedTickables = [...trebleVoices, ...bassVoices].flatMap(({ tickables }) => tickables);
    for (const rendered of renderedTickables) {
      if (rendered.projection.kind === "spacer") continue;
      const pitchIndexById = new Map(rendered.projection.kind === "notes"
        ? rendered.projection.pitches.map(({ id }, index) => [id, index] as const)
        : []);
      renderedEvents.set(rendered.projection.eventId, {
        note: rendered.note,
        projection: rendered.projection,
        measureIndex: placement.measureIndex,
        pitchIndexById,
      });
    }
    const events = createStaffBuilderEventAnchors(renderedTickables);
    const pitches = createStaffBuilderPitchAnchors(renderedTickables);
    const measureEventIds = new Set(score.measures[placement.measureIndex]?.events.map(({ id }) => id) ?? []);
    const measureNotes = new Map([...renderedEvents].filter(([, rendered]) => rendered.measureIndex === placement.measureIndex).map(([eventId, rendered]) => [eventId, rendered.note] as const));
    drawStaffBuilderLyricCues(context, getStaffBuilderLyricCues(score, measureEventIds), measureNotes, 16, placement.x, placement.x + placement.width);
    events.forEach((anchor, eventId) => aggregateEvents.set(eventId, anchor));
    pitches.forEach((anchor, pitchId) => aggregatePitches.set(pitchId, anchor));
    const temporal = createStaffBuilderTemporalAnchors(projection, trebleStave, bassStave);
    measureGeometry.push({
      measureId: placement.measureId,
      measureIndex: placement.measureIndex,
      bounds: { x: placement.x, y: placement.y, width: placement.width, height: placement.height },
      events,
      pitches,
      positions: temporal.positions,
      timeline: temporal.timeline,
    });
  });

  drawSystemTies(score, renderedEvents, context);
  configureStaffBuilderSvg(container, systemLayout.width, systemLayout.height);
  return {
    coordinateSpace: { width: systemLayout.width, height: systemLayout.height },
    system: { systemIndex: systemLayout.systemIndex, bounds: { x: 0, y: 0, width: systemLayout.width, height: systemLayout.height } },
    measures: measureGeometry,
    events: aggregateEvents,
    pitches: aggregatePitches,
  };
}
