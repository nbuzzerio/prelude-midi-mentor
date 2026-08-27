import type { StaffBuilderFactories } from "./staff-builder-score";
import type {
  StaffBuilderAnnotation,
  StaffBuilderEvent,
  StaffBuilderMeasure,
  StaffBuilderScore,
  StaffBuilderTie,
} from "./staff-builder-types";

export type StaffBuilderDuplicationMode = "full" | "treble" | "bass";

const defaultFactories: StaffBuilderFactories = {
  createId: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
};

const titleSuffix: Readonly<Record<StaffBuilderDuplicationMode, string>> = {
  full: "Copy",
  treble: "Treble Copy",
  bass: "Bass Copy",
};

function retainPitch(mode: StaffBuilderDuplicationMode, midiNumber: number): boolean {
  if (mode === "full") return true;
  return mode === "treble" ? midiNumber >= 60 : midiNumber < 60;
}

export function duplicateStaffBuilderScore(
  source: StaffBuilderScore,
  mode: StaffBuilderDuplicationMode,
  factories: StaffBuilderFactories = defaultFactories,
): StaffBuilderScore {
  const measureIds = new Map<string, string>();
  const eventIds = new Map<string, string>();
  const pitchIds = new Map<string, string>();
  const destinationStaff = mode === "full" ? null : mode;

  const measures: StaffBuilderMeasure[] = source.measures.map((measure) => {
    const measureId = factories.createId();
    measureIds.set(measure.id, measureId);
    const events: StaffBuilderEvent[] = [];
    for (const event of measure.events) {
      if (event.kind === "rest") {
        if (destinationStaff !== null && event.staff !== destinationStaff) continue;
        const eventId = factories.createId();
        eventIds.set(event.id, eventId);
        events.push({ ...event, id: eventId });
        continue;
      }
      const retainedPitches = event.pitches.filter(({ midiNumber }) => retainPitch(mode, midiNumber));
      if (retainedPitches.length === 0) continue;
      const eventId = factories.createId();
      eventIds.set(event.id, eventId);
      const pitches = retainedPitches.map((pitch) => {
        const pitchId = factories.createId();
        pitchIds.set(pitch.id, pitchId);
        return { ...pitch, id: pitchId };
      });
      events.push({ ...event, id: eventId, staff: destinationStaff ?? event.staff, pitches });
    }
    return { ...measure, id: measureId, events };
  });

  const ties: StaffBuilderTie[] = source.ties.flatMap((tie) => {
    const fromEventId = eventIds.get(tie.fromEventId);
    const fromPitchId = pitchIds.get(tie.fromPitchId);
    const toEventId = eventIds.get(tie.toEventId);
    const toPitchId = pitchIds.get(tie.toPitchId);
    return fromEventId && fromPitchId && toEventId && toPitchId
      ? [{ ...tie, id: factories.createId(), fromEventId, fromPitchId, toEventId, toPitchId }]
      : [];
  });

  const annotations: StaffBuilderAnnotation[] = source.annotations.flatMap((annotation) => {
    const anchor = annotation.anchor.kind === "measure"
      ? measureIds.get(annotation.anchor.measureId) && { kind: "measure" as const, measureId: measureIds.get(annotation.anchor.measureId)! }
      : eventIds.get(annotation.anchor.eventId) && { kind: "event" as const, eventId: eventIds.get(annotation.anchor.eventId)! };
    return anchor ? [{ ...annotation, id: factories.createId(), anchor }] : [];
  });

  const timestamp = factories.now();
  return {
    ...source,
    id: factories.createId(),
    title: `${source.title} — ${titleSuffix[mode]}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    measures,
    ties,
    annotations,
  };
}
