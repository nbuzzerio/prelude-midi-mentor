import { durationToTicks, getMeasureStartTick } from "./staff-builder-time";
import { resolveStaffBuilderMeasureContext } from "./staff-builder-score";
import type { StaffBuilderNoteEvent, StaffBuilderPitch, StaffBuilderScore, StaffBuilderTie } from "./staff-builder-types";

export type StaffBuilderLocatedPitch = Readonly<{
  event: StaffBuilderNoteEvent;
  pitch: StaffBuilderPitch;
  measureIndex: number;
  absoluteStartTick: number;
  absoluteEndTick: number;
}>;

export type StaffBuilderSoundingSpan = Readonly<{
  originEventId: string;
  originPitchId: string;
  staff: StaffBuilderNoteEvent["staff"];
  midiNumber: number;
  attackTick: number;
  endTick: number;
  endpointKeys: readonly string[];
}>;

export function staffBuilderPitchEndpointKey(eventId: string, pitchId: string): string {
  return `${eventId}:${pitchId}`;
}

export function locateStaffBuilderPitches(score: StaffBuilderScore): ReadonlyMap<string, StaffBuilderLocatedPitch> {
  const capacities = score.measures.map((_measure, index) => resolveStaffBuilderMeasureContext(score, index).capacityTicks);
  const result = new Map<string, StaffBuilderLocatedPitch>();
  score.measures.forEach((measure, measureIndex) => {
    const measureStart = getMeasureStartTick(capacities, measureIndex);
    measure.events.forEach((event) => {
      if (event.kind !== "notes" || event.rhythm.status !== "final") return;
      const absoluteStartTick = measureStart + event.startTick;
      const absoluteEndTick = absoluteStartTick + durationToTicks(event.rhythm.duration);
      event.pitches.forEach((pitch) => result.set(staffBuilderPitchEndpointKey(event.id, pitch.id), {
        event, pitch, measureIndex, absoluteStartTick, absoluteEndTick,
      }));
    });
  });
  return result;
}

export function getStaffBuilderTieCycleIds(ties: readonly StaffBuilderTie[]): ReadonlySet<string> {
  const outgoing = new Map<string, StaffBuilderTie[]>();
  ties.forEach((tie) => {
    const key = staffBuilderPitchEndpointKey(tie.fromEventId, tie.fromPitchId);
    outgoing.set(key, [...(outgoing.get(key) ?? []), tie]);
  });
  const cycleIds = new Set<string>();
  const canReach = (start: string, destination: string): boolean => {
    const pending = [start];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const key = pending.pop()!;
      if (key === destination) return true;
      if (visited.has(key)) continue;
      visited.add(key);
      for (const tie of outgoing.get(key) ?? []) pending.push(staffBuilderPitchEndpointKey(tie.toEventId, tie.toPitchId));
    }
    return false;
  };
  for (const tie of ties) {
    const source = staffBuilderPitchEndpointKey(tie.fromEventId, tie.fromPitchId);
    const destination = staffBuilderPitchEndpointKey(tie.toEventId, tie.toPitchId);
    if (canReach(destination, source)) cycleIds.add(tie.id);
  }
  return cycleIds;
}

export function deriveStaffBuilderSoundingSpans(score: StaffBuilderScore): readonly StaffBuilderSoundingSpan[] {
  const pitches = locateStaffBuilderPitches(score);
  const incoming = new Set(score.ties.map((tie) => staffBuilderPitchEndpointKey(tie.toEventId, tie.toPitchId)));
  const outgoing = new Map(score.ties.map((tie) => [staffBuilderPitchEndpointKey(tie.fromEventId, tie.fromPitchId), tie]));
  const spans: StaffBuilderSoundingSpan[] = [];
  for (const [originKey, origin] of pitches) {
    if (incoming.has(originKey)) continue;
    const endpointKeys = [originKey];
    let endTick = origin.absoluteEndTick;
    let currentKey = originKey;
    const visited = new Set<string>();
    while (!visited.has(currentKey)) {
      visited.add(currentKey);
      const tie = outgoing.get(currentKey);
      if (!tie) break;
      const destinationKey = staffBuilderPitchEndpointKey(tie.toEventId, tie.toPitchId);
      const destination = pitches.get(destinationKey);
      if (!destination) break;
      endpointKeys.push(destinationKey);
      endTick = destination.absoluteEndTick;
      currentKey = destinationKey;
    }
    spans.push({ originEventId: origin.event.id, originPitchId: origin.pitch.id, staff: origin.event.staff,
      midiNumber: origin.pitch.midiNumber, attackTick: origin.absoluteStartTick, endTick, endpointKeys });
  }
  return spans.sort((left, right) => left.attackTick - right.attackTick || left.endTick - right.endTick || left.midiNumber - right.midiNumber);
}
