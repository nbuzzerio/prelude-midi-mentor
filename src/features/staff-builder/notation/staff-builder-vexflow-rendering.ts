import {
  Accidental,
  Beam,
  Dot,
  Fraction,
  GhostNote,
  Stave,
  StaveNote,
  Stem,
  Voice,
  type RenderContext,
  type StemmableNote,
} from "vexflow";
import type { StaffBuilderStaff } from "../staff-builder-types";
import type {
  StaffBuilderMeasureProjection,
  StaffBuilderProjectedEvent,
  StaffBuilderProjectedTickable,
  StaffBuilderProjectedVoice,
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

export type StaffBuilderRenderedTickable = Readonly<{
  projection: StaffBuilderProjectedTickable;
  note: StemmableNote;
}>;

export type StaffBuilderRenderedVoice = Readonly<{
  projection: StaffBuilderProjectedVoice;
  tickables: readonly StaffBuilderRenderedTickable[];
  voice: Voice;
}>;

export function staffBuilderVexFlowPitchKey(event: StaffBuilderProjectedEvent, pitchIndex: number): string {
  const pitch = event.pitches[pitchIndex];
  if (!pitch) throw new Error(`Missing projected pitch ${pitchIndex} for ${event.eventId}.`);
  const accidental = pitch.accidental === "sharp" ? "#" : pitch.accidental === "flat" ? "b" : "";
  return `${pitch.letter.toLowerCase()}${accidental}/${pitch.octave}`;
}

export function createStaffBuilderVexFlowTickable(item: StaffBuilderProjectedTickable): StaffBuilderRenderedTickable {
  const duration = item.visualDuration.vexflowDuration;
  if (item.kind === "spacer") {
    const note = new GhostNote({ duration, dots: item.visualDuration.dots });
    note.setDuration(new Fraction(item.durationTicks * 128, 15));
    return { projection: item, note };
  }
  const keys = item.kind === "rest"
    ? [item.staff === "treble" ? "b/4" : "d/3"]
    : item.pitches.map((_pitch, index) => staffBuilderVexFlowPitchKey(item, index));
  const note = new StaveNote({ clef: item.staff, duration: `${duration}${item.kind === "rest" ? "r" : ""}`, keys });
  note.setDuration(new Fraction(item.layoutDurationTicks * 128, 15));
  if (item.visualDuration.dots > 0) Dot.buildAndAttach([note], { all: true });
  return { projection: item, note };
}

export function createStaffBuilderVexFlowVoices(
  projections: readonly StaffBuilderProjectedVoice[],
  timeSignature: StaffBuilderMeasureProjection["timeSignature"],
): readonly StaffBuilderRenderedVoice[] {
  const [numBeats, beatValue] = timeSignature.split("/").map(Number);
  const polyphonic = projections.length > 1;
  return projections.map((projection) => {
    const tickables = projection.tickables.map(createStaffBuilderVexFlowTickable);
    if (polyphonic) {
      const direction = projection.voiceIndex % 2 === 0 ? Stem.UP : Stem.DOWN;
      tickables.forEach(({ note, projection: item }) => {
        if (item.kind !== "spacer") note.setStemDirection(direction);
      });
    }
    const voice = new Voice({ numBeats: numBeats ?? 4, beatValue: beatValue ?? 4 })
      .setMode(Voice.Mode.SOFT)
      .addTickables(tickables.map(({ note }) => note));
    return { projection, tickables, voice };
  });
}

export function applyStaffBuilderVexFlowAccidentals(
  voices: readonly StaffBuilderRenderedVoice[],
  vexflowKeySignature: string,
): void {
  Accidental.applyAccidentals(voices.map(({ voice }) => voice), vexflowKeySignature);
}

export function createStaffBuilderVexFlowBeams(voices: readonly StaffBuilderRenderedVoice[]) {
  const polyphonic = voices.length > 1;
  return voices.flatMap((renderedVoice) => Beam.generateBeams(renderedVoice.tickables.map(({ note }) => note), {
    groups: renderedVoice.projection.beam.beatGroups.map((group) => {
      const [numerator, denominator] = group.split("/").map(Number);
      return new Fraction(numerator, denominator);
    }),
    beamRests: false,
    maintainStemDirections: polyphonic,
  }));
}

export function drawStaffBuilderVexFlowBeams(beams: ReturnType<typeof createStaffBuilderVexFlowBeams>, context: RenderContext): void {
  beams.forEach((beam) => beam.setContext(context).draw());
}

export function configureStaffBuilderSvg(container: HTMLDivElement, width: number, height: number): void {
  const svg = container.querySelector("svg");
  if (!svg) return;
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.style.display = "block";
}

export function createStaffBuilderEventAnchors(rendered: readonly StaffBuilderRenderedTickable[]): ReadonlyMap<string, StaffBuilderEventAnchor> {
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

export function createStaffBuilderTemporalAnchors(
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
    anchors.set(tick, { tick, x, y: top, width: Math.max(1, xAtTick(nextTick) - x), height: bottom - top });
  });
  return { positions: anchors, timeline: { rhythmicStartX, rhythmicEndX, y: top, height: bottom - top, capacityTicks: projection.capacityTicks } };
}
