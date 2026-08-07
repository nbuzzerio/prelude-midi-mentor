import { getMusicKeyDefinition } from "@/lib/music/keys";
import { resolveStaffBuilderMeasureContext } from "../staff-builder-score";
import {
  STAFF_BUILDER_DURATIONS,
  STAFF_BUILDER_TICKS_PER_QUARTER,
  durationToTicks,
  type StaffBuilderDuration,
  type StaffBuilderTimeSignature,
} from "../staff-builder-time";
import type {
  StaffBuilderEvent,
  StaffBuilderPitch,
  StaffBuilderScoreV1,
  StaffBuilderStaff,
} from "../staff-builder-types";

export type StaffBuilderVisualDuration = Readonly<{
  duration: StaffBuilderDuration;
  vexflowDuration: "w" | "h" | "q" | "8" | "16";
  dots: 0 | 1;
  ticks: number;
}>;

export type StaffBuilderProjectedEvent = Readonly<{
  kind: StaffBuilderEvent["kind"];
  eventId: string;
  staff: StaffBuilderStaff;
  startTick: number;
  layoutDurationTicks: number;
  visualDuration: StaffBuilderVisualDuration;
  unresolved: boolean;
  pitches: readonly StaffBuilderPitch[];
}>;

export type StaffBuilderProjectedSpacer = Readonly<{
  kind: "spacer";
  staff: StaffBuilderStaff;
  startTick: number;
  durationTicks: number;
  visualDuration: StaffBuilderVisualDuration;
}>;

export type StaffBuilderProjectedTickable = StaffBuilderProjectedEvent | StaffBuilderProjectedSpacer;

export type StaffBuilderProjectedTie = Readonly<{
  tieId: string;
  fromEventId: string;
  fromPitchIndex: number;
  toEventId: string;
  toPitchIndex: number;
}>;

export type StaffBuilderUnavailableTie = Readonly<{
  tieId: string;
  reason: "endpoint-outside-measure" | "endpoint-missing";
}>;

export type StaffBuilderBeamProjection = Readonly<{
  beatGroups: readonly string[];
  eventIds: readonly string[];
}>;

export type StaffBuilderMeasureProjection = Readonly<{
  measureIndex: number;
  measureNumber: number;
  keySignatureId: StaffBuilderScoreV1["initialKeySignatureId"];
  keySignatureName: string;
  vexflowKeySignature: string;
  timeSignature: StaffBuilderTimeSignature;
  capacityTicks: number;
  introducesKeySignature: boolean;
  introducesTimeSignature: boolean;
  staves: Readonly<Record<StaffBuilderStaff, readonly StaffBuilderProjectedTickable[]>>;
  ties: readonly StaffBuilderProjectedTie[];
  unavailableTies: readonly StaffBuilderUnavailableTie[];
  beams: Readonly<Record<StaffBuilderStaff, StaffBuilderBeamProjection>>;
  positionTicks: readonly number[];
  summary: Readonly<Record<StaffBuilderStaff, string>>;
}>;

const VISUAL_DURATIONS: Readonly<Record<StaffBuilderDuration, StaffBuilderVisualDuration>> = {
  whole: { duration: "whole", vexflowDuration: "w", dots: 0, ticks: 1920 },
  "dotted-half": { duration: "dotted-half", vexflowDuration: "h", dots: 1, ticks: 1440 },
  half: { duration: "half", vexflowDuration: "h", dots: 0, ticks: 960 },
  "dotted-quarter": { duration: "dotted-quarter", vexflowDuration: "q", dots: 1, ticks: 720 },
  quarter: { duration: "quarter", vexflowDuration: "q", dots: 0, ticks: 480 },
  "dotted-eighth": { duration: "dotted-eighth", vexflowDuration: "8", dots: 1, ticks: 360 },
  eighth: { duration: "eighth", vexflowDuration: "8", dots: 0, ticks: 240 },
  sixteenth: { duration: "sixteenth", vexflowDuration: "16", dots: 0, ticks: 120 },
};

const GAP_DURATIONS = [...STAFF_BUILDER_DURATIONS]
  .sort((left, right) => durationToTicks(right) - durationToTicks(left));

const BEAT_GROUPS: Readonly<Record<StaffBuilderTimeSignature, readonly string[]>> = {
  "2/4": ["1/4"],
  "3/4": ["1/4"],
  "4/4": ["1/4"],
  "6/8": ["3/8"],
};

export function getStaffBuilderVisualDuration(duration: StaffBuilderDuration): StaffBuilderVisualDuration {
  return VISUAL_DURATIONS[duration];
}

function projectEvent(event: StaffBuilderEvent, nextStartTick: number | undefined, capacityTicks: number): StaffBuilderProjectedEvent {
  const unresolved = event.rhythm.status === "unresolved";
  const duration = unresolved ? "quarter" : event.rhythm.duration;
  const visualDuration = getStaffBuilderVisualDuration(duration);
  const ticksUntilNextOnset = nextStartTick === undefined ? visualDuration.ticks : Math.max(0, nextStartTick - event.startTick);
  const ticksUntilMeasureEnd = Math.max(0, capacityTicks - event.startTick);
  return {
    kind: event.kind,
    eventId: event.id,
    staff: event.staff,
    startTick: event.startTick,
    layoutDurationTicks: unresolved ? Math.min(visualDuration.ticks, ticksUntilNextOnset, ticksUntilMeasureEnd) : visualDuration.ticks,
    visualDuration,
    unresolved,
    pitches: event.kind === "notes" ? event.pitches : [],
  };
}

function gapSpacers(staff: StaffBuilderStaff, startTick: number, gapTicks: number): StaffBuilderProjectedSpacer[] {
  const spacers: StaffBuilderProjectedSpacer[] = [];
  let remaining = gapTicks;
  let tick = startTick;
  for (const duration of GAP_DURATIONS) {
    const visualDuration = getStaffBuilderVisualDuration(duration);
    while (remaining >= visualDuration.ticks) {
      spacers.push({ kind: "spacer", staff, startTick: tick, durationTicks: visualDuration.ticks, visualDuration });
      tick += visualDuration.ticks;
      remaining -= visualDuration.ticks;
    }
  }
  if (remaining !== 0) spacers.push({
    kind: "spacer",
    staff,
    startTick: tick,
    durationTicks: remaining,
    visualDuration: getStaffBuilderVisualDuration("sixteenth"),
  });
  return spacers;
}

function projectStaff(events: readonly StaffBuilderEvent[], staff: StaffBuilderStaff, capacityTicks: number): readonly StaffBuilderProjectedTickable[] {
  const projected: StaffBuilderProjectedTickable[] = [];
  let occupiedUntil = 0;
  const ordered = events.filter((event) => event.staff === staff)
    .sort((left, right) => left.startTick - right.startTick || left.id.localeCompare(right.id));
  ordered.forEach((event, index) => {
    if (event.startTick > occupiedUntil) projected.push(...gapSpacers(staff, occupiedUntil, event.startTick - occupiedUntil));
    const projection = projectEvent(event, ordered[index + 1]?.startTick, capacityTicks);
    projected.push(projection);
    occupiedUntil = Math.max(occupiedUntil, event.startTick + projection.layoutDurationTicks);
  });
  if (occupiedUntil < capacityTicks) projected.push(...gapSpacers(staff, occupiedUntil, capacityTicks - occupiedUntil));
  return projected;
}

function pitchName(pitch: StaffBuilderPitch): string {
  const accidental = pitch.accidental === "sharp" ? "♯" : pitch.accidental === "flat" ? "♭" : "";
  return `${pitch.letter}${accidental}${pitch.octave}`;
}

function summarize(events: readonly StaffBuilderEvent[], staff: StaffBuilderStaff): string {
  const descriptions = events.filter((event) => event.staff === staff)
    .sort((left, right) => left.startTick - right.startTick || left.id.localeCompare(right.id))
    .map((event) => {
      const rhythm = event.rhythm.status === "unresolved" ? "unresolved rhythm" : event.rhythm.duration;
      if (event.kind === "rest") return `${rhythm} rest at tick ${event.startTick}`;
      const label = event.pitches.length === 1 ? "note" : "chord";
      return `${rhythm} ${label} ${event.pitches.map(pitchName).join(", ")} at tick ${event.startTick}`;
    });
  return descriptions.length === 0 ? "No events." : descriptions.join("; ");
}

function projectTies(score: StaffBuilderScoreV1, eventById: ReadonlyMap<string, StaffBuilderProjectedEvent>): Readonly<{
  ties: readonly StaffBuilderProjectedTie[];
  unavailableTies: readonly StaffBuilderUnavailableTie[];
}> {
  const ties: StaffBuilderProjectedTie[] = [];
  const unavailableTies: StaffBuilderUnavailableTie[] = [];
  const scoreEventIds = new Set(score.measures.flatMap((measure) => measure.events.map(({ id }) => id)));
  for (const tie of score.ties) {
    const fromEvent = eventById.get(tie.fromEventId);
    const toEvent = eventById.get(tie.toEventId);
    if (!fromEvent || !toEvent) {
      unavailableTies.push({ tieId: tie.id, reason: scoreEventIds.has(tie.fromEventId) && scoreEventIds.has(tie.toEventId) ? "endpoint-outside-measure" : "endpoint-missing" });
      continue;
    }
    const fromPitchIndex = fromEvent.pitches.findIndex(({ id }) => id === tie.fromPitchId);
    const toPitchIndex = toEvent.pitches.findIndex(({ id }) => id === tie.toPitchId);
    if (fromPitchIndex < 0 || toPitchIndex < 0) {
      unavailableTies.push({ tieId: tie.id, reason: "endpoint-missing" });
      continue;
    }
    ties.push({ tieId: tie.id, fromEventId: tie.fromEventId, fromPitchIndex, toEventId: tie.toEventId, toPitchIndex });
  }
  return { ties, unavailableTies };
}

export function projectStaffBuilderMeasure(score: StaffBuilderScoreV1, measureIndex: number): StaffBuilderMeasureProjection {
  const measure = score.measures[measureIndex];
  if (!measure) throw new Error(`Unknown measure index ${measureIndex}.`);
  const context = resolveStaffBuilderMeasureContext(score, measureIndex);
  const key = getMusicKeyDefinition(context.keySignatureId);
  const treble = projectStaff(measure.events, "treble", context.capacityTicks);
  const bass = projectStaff(measure.events, "bass", context.capacityTicks);
  const projectedEvents = [...treble, ...bass].filter((item): item is StaffBuilderProjectedEvent => item.kind !== "spacer");
  const eventById = new Map(projectedEvents.map((event) => [event.eventId, event]));
  const tieProjection = projectTies(score, eventById);
  const positionTicks = Array.from(
    { length: Math.ceil(context.capacityTicks / (STAFF_BUILDER_TICKS_PER_QUARTER / 4)) },
    (_value, index) => index * (STAFF_BUILDER_TICKS_PER_QUARTER / 4),
  );
  const beams = (staff: StaffBuilderStaff): StaffBuilderBeamProjection => ({
    beatGroups: BEAT_GROUPS[context.timeSignature],
    eventIds: projectedEvents.filter((event) => event.staff === staff && event.kind === "notes" && event.visualDuration.ticks <= durationToTicks("eighth")).map(({ eventId }) => eventId),
  });
  return {
    measureIndex,
    measureNumber: measureIndex + 1,
    keySignatureId: context.keySignatureId,
    keySignatureName: key.name,
    vexflowKeySignature: key.vexflowKeySignature,
    timeSignature: context.timeSignature,
    capacityTicks: context.capacityTicks,
    introducesKeySignature: measure.keySignatureChange !== undefined,
    introducesTimeSignature: measure.timeSignatureChange !== undefined,
    staves: { treble, bass },
    ties: tieProjection.ties,
    unavailableTies: tieProjection.unavailableTies,
    beams: { treble: beams("treble"), bass: beams("bass") },
    positionTicks,
    summary: { treble: summarize(measure.events, "treble"), bass: summarize(measure.events, "bass") },
  };
}
