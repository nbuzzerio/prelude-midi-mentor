import { getMusicKeyDefinition } from "@/lib/music/keys";
import { createStaffBuilderPitch, resolveStaffBuilderMeasureContext } from "../staff-builder-score";
import type { StaffBuilderPendingCapture } from "../staff-builder-capture";
import {
  STAFF_BUILDER_TICKS_PER_QUARTER,
  STAFF_BUILDER_DURATIONS,
  durationToTicks,
  type StaffBuilderDuration,
  type StaffBuilderStepDuration,
  type StaffBuilderTimeSignature,
} from "../staff-builder-time";
import { stepDurationToTicks } from "../staff-builder-time";
import type {
  StaffBuilderEvent,
  StaffBuilderPitch,
  StaffBuilderScore,
  StaffBuilderStaff,
} from "../staff-builder-types";
import { deriveStaffBuilderVoices } from "../staff-builder-voices";

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

export type StaffBuilderBoundaryTie = Readonly<{ tieId: string; eventId: string; pitchIndex: number; direction: "incoming" | "outgoing"; description: string }>;

export type StaffBuilderBeamProjection = Readonly<{
  beatGroups: readonly string[];
  eventIds: readonly string[];
}>;

export type StaffBuilderProjectedVoice = Readonly<{
  staff: StaffBuilderStaff;
  voiceIndex: number;
  tickables: readonly StaffBuilderProjectedTickable[];
  beam: StaffBuilderBeamProjection;
}>;

export type StaffBuilderMeasureProjection = Readonly<{
  measureIndex: number;
  measureNumber: number;
  keySignatureId: StaffBuilderScore["initialKeySignatureId"];
  keySignatureName: string;
  vexflowKeySignature: string;
  timeSignature: StaffBuilderTimeSignature;
  capacityTicks: number;
  introducesKeySignature: boolean;
  introducesTimeSignature: boolean;
  staves: Readonly<Record<StaffBuilderStaff, readonly StaffBuilderProjectedTickable[]>>;
  voices: Readonly<Record<StaffBuilderStaff, readonly StaffBuilderProjectedVoice[]>>;
  ties: readonly StaffBuilderProjectedTie[];
  unavailableTies: readonly StaffBuilderUnavailableTie[];
  boundaryTies: readonly StaffBuilderBoundaryTie[];
  invalidEventIds: readonly string[];
  beams: Readonly<Record<StaffBuilderStaff, StaffBuilderBeamProjection>>;
  positionTicks: readonly number[];
  summary: Readonly<Record<StaffBuilderStaff, string>>;
}>;

export type StaffBuilderPendingPreviewProjection = Readonly<{
  renderScore: StaffBuilderScore;
  events: Readonly<Record<StaffBuilderStaff, StaffBuilderEvent | null>>;
  layoutDurationTicksByEventId: ReadonlyMap<string, number>;
  previewEventIds: ReadonlySet<string>;
  summary: Readonly<Record<StaffBuilderStaff, string>>;
}>;

export type StaffBuilderMeasureProjectionOptions = Readonly<{
  layoutDurationTicksByEventId?: ReadonlyMap<string, number>;
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

function projectEvent(event: StaffBuilderEvent, capacityTicks: number, layoutDurationOverride?: number): StaffBuilderProjectedEvent {
  const unresolved = event.rhythm.status === "unresolved";
  const duration = unresolved ? "quarter" : event.rhythm.duration;
  const visualDuration = getStaffBuilderVisualDuration(duration);
  const ticksUntilMeasureEnd = Math.max(0, capacityTicks - event.startTick);
  return {
    kind: event.kind,
    eventId: event.id,
    staff: event.staff,
    startTick: event.startTick,
    layoutDurationTicks: Math.max(1, Math.min(layoutDurationOverride ?? visualDuration.ticks, ticksUntilMeasureEnd || visualDuration.ticks)),
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

function projectStaff(events: readonly StaffBuilderEvent[], staff: StaffBuilderStaff, capacityTicks: number, timeSignature: StaffBuilderTimeSignature, options?: StaffBuilderMeasureProjectionOptions): readonly StaffBuilderProjectedVoice[] {
  const renderable = events.filter((event) => event.staff === staff && event.startTick < capacityTicks);
  const allocationEvents = renderable.map((event): StaffBuilderEvent => event.rhythm.status === "final" ? event : {
    ...event,
    rhythm: { status: "final", duration: "quarter" },
  });
  const eventById = new Map(renderable.map((event) => [event.id, event]));
  const derived = deriveStaffBuilderVoices(allocationEvents, staff, capacityTicks);
  const lanes = derived.length > 0 ? derived : [{ staff, voiceIndex: 0, events: [], implicitGaps: [] }];
  return lanes.map((voice): StaffBuilderProjectedVoice => {
    const tickables: StaffBuilderProjectedTickable[] = [];
    let occupiedUntil = 0;
    for (const derivedEvent of voice.events) {
      const event = eventById.get(derivedEvent.eventId);
      if (!event) continue;
      if (event.startTick > occupiedUntil) tickables.push(...gapSpacers(staff, occupiedUntil, event.startTick - occupiedUntil));
      const projection = projectEvent(event, capacityTicks, options?.layoutDurationTicksByEventId?.get(event.id));
      tickables.push(projection);
      occupiedUntil = event.startTick + projection.layoutDurationTicks;
    }
    if (occupiedUntil < capacityTicks) tickables.push(...gapSpacers(staff, occupiedUntil, capacityTicks - occupiedUntil));
    return {
      staff,
      voiceIndex: voice.voiceIndex,
      tickables,
      beam: {
        beatGroups: BEAT_GROUPS[timeSignature],
        eventIds: tickables.filter((item): item is StaffBuilderProjectedEvent => item.kind === "notes" && item.visualDuration.ticks <= durationToTicks("eighth")).map(({ eventId }) => eventId),
      },
    };
  });
}

function pitchName(pitch: StaffBuilderPitch): string {
  const accidental = pitch.accidental === "sharp" ? "♯" : pitch.accidental === "flat" ? "♭" : "";
  return `${pitch.letter}${accidental}${pitch.octave}`;
}

export function projectStaffBuilderPendingPreview(
  score: StaffBuilderScore,
  measureIndex: number,
  startTick: number,
  pending: StaffBuilderPendingCapture,
  stepDuration: StaffBuilderStepDuration = "quarter",
): StaffBuilderPendingPreviewProjection {
  const measure = score.measures[measureIndex];
  if (!measure) throw new Error(`Unknown measure index ${measureIndex}.`);
  const context = resolveStaffBuilderMeasureContext(score, measureIndex);
  if (!Number.isInteger(startTick) || startTick < 0 || startTick >= context.capacityTicks) {
    throw new Error(`Unknown preview position ${startTick}.`);
  }
  const events: Record<StaffBuilderStaff, StaffBuilderEvent | null> = { treble: null, bass: null };
  for (const staff of ["treble", "bass"] as const) {
    const midiNumbers = [...new Set(pending[staff])].sort((left, right) => left - right);
    if (midiNumbers.length === 0) continue;
    const idBase = `__staff-builder-preview:${score.id}:${measureIndex}:${staff}:${startTick}`;
    events[staff] = {
      id: `${idBase}:event`,
      kind: "notes",
      staff,
      startTick,
      rhythm: { status: "final", duration: "quarter" },
      pitches: midiNumbers.map((midiNumber) => createStaffBuilderPitch({
        midiNumber,
        keySignatureId: context.keySignatureId,
        id: `${idBase}:pitch:${midiNumber}`,
      })),
    };
  }
  const previewEvents = Object.values(events).filter((event): event is StaffBuilderEvent => event !== null);
  const previewEventIds = new Set(previewEvents.map(({ id }) => id));
  const layoutDurationTicks = stepDurationToTicks(stepDuration);
  const layoutDurationTicksByEventId = new Map(previewEvents.map(({ id }) => [id, layoutDurationTicks]));
  const renderScore = previewEvents.length === 0 ? score : {
    ...score,
    measures: score.measures.map((item, index) => index !== measureIndex ? item : {
      ...item,
      events: [
        ...item.events.filter((event) => events[event.staff] === null || event.startTick !== startTick),
        ...previewEvents,
      ],
    }),
  };
  const previewSummary = (staff: StaffBuilderStaff) => {
    const event = events[staff];
    if (!event || event.kind !== "notes") return `Pending ${staff} preview: none.`;
    const label = event.pitches.length === 1 ? "note" : "chord";
    return `Pending ${staff} preview: ${label} ${event.pitches.map(pitchName).join(", ")} at tick ${startTick}.`;
  };
  return {
    renderScore,
    events,
    layoutDurationTicksByEventId,
    previewEventIds,
    summary: { treble: previewSummary("treble"), bass: previewSummary("bass") },
  };
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

function projectTies(score: StaffBuilderScore, eventById: ReadonlyMap<string, StaffBuilderProjectedEvent>): Readonly<{
  ties: readonly StaffBuilderProjectedTie[];
  unavailableTies: readonly StaffBuilderUnavailableTie[];
  boundaryTies: readonly StaffBuilderBoundaryTie[];
}> {
  const ties: StaffBuilderProjectedTie[] = [];
  const unavailableTies: StaffBuilderUnavailableTie[] = [];
  const boundaryTies: StaffBuilderBoundaryTie[] = [];
  const scoreEventIds = new Set(score.measures.flatMap((measure) => measure.events.map(({ id }) => id)));
  for (const tie of score.ties) {
    const fromEvent = eventById.get(tie.fromEventId);
    const toEvent = eventById.get(tie.toEventId);
    if (!fromEvent || !toEvent) {
      const visible = fromEvent ?? toEvent;
      const visiblePitchId = fromEvent ? tie.fromPitchId : tie.toPitchId;
      const pitchIndex = visible?.pitches.findIndex(({ id }) => id === visiblePitchId) ?? -1;
      if (visible && pitchIndex >= 0 && scoreEventIds.has(tie.fromEventId) && scoreEventIds.has(tie.toEventId)) {
        const direction = fromEvent ? "outgoing" : "incoming";
        boundaryTies.push({ tieId: tie.id, eventId: visible.eventId, pitchIndex, direction, description: `${direction === "outgoing" ? "Tie continues to" : "Tie continues from"} the adjacent measure.` });
      } else unavailableTies.push({ tieId: tie.id, reason: scoreEventIds.has(tie.fromEventId) && scoreEventIds.has(tie.toEventId) ? "endpoint-outside-measure" : "endpoint-missing" });
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
  return { ties, unavailableTies, boundaryTies };
}

export function projectStaffBuilderMeasure(score: StaffBuilderScore, measureIndex: number, options?: StaffBuilderMeasureProjectionOptions): StaffBuilderMeasureProjection {
  const measure = score.measures[measureIndex];
  if (!measure) throw new Error(`Unknown measure index ${measureIndex}.`);
  const context = resolveStaffBuilderMeasureContext(score, measureIndex);
  const key = getMusicKeyDefinition(context.keySignatureId);
  const trebleVoices = projectStaff(measure.events, "treble", context.capacityTicks, context.timeSignature, options);
  const bassVoices = projectStaff(measure.events, "bass", context.capacityTicks, context.timeSignature, options);
  const treble = trebleVoices.flatMap((voice) => voice.tickables);
  const bass = bassVoices.flatMap((voice) => voice.tickables);
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
    voices: { treble: trebleVoices, bass: bassVoices },
    ties: tieProjection.ties,
    unavailableTies: tieProjection.unavailableTies,
    boundaryTies: tieProjection.boundaryTies,
    invalidEventIds: measure.events.filter(({ startTick }) => startTick >= context.capacityTicks).map(({ id }) => id).sort(),
    beams: { treble: beams("treble"), bass: beams("bass") },
    positionTicks,
    summary: { treble: summarize(measure.events, "treble"), bass: summarize(measure.events, "bass") },
  };
}
