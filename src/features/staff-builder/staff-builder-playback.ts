import type { PlayableMusicalEvent } from "@/lib/audio/musical-event-player";
import { resolveStaffBuilderMeasureContext } from "./staff-builder-score";
import { durationToTicks, getMeasureStartTick, tickBoundaryDurationMilliseconds, ticksToMilliseconds } from "./staff-builder-time";
import type { StaffBuilderEvent, StaffBuilderPitch, StaffBuilderScoreV1 } from "./staff-builder-types";
import { validateStaffBuilderScore } from "./staff-builder-validation";

export const STAFF_BUILDER_AUDITION_DURATION_MS = 600;

export type StaffBuilderPlaybackPosition = Readonly<{ measureIndex: number; offsetTicks: number }>;
export type StaffBuilderPlaybackScope =
  | Readonly<{ kind: "measure"; measureIndex: number }>
  | Readonly<{ kind: "from-position"; position: StaffBuilderPlaybackPosition }>
  | Readonly<{ kind: "entire-piece" }>;

export type StaffBuilderPlaybackProjection = Readonly<{
  events: readonly PlayableMusicalEvent[];
  scopeStartTick: number;
  scopeEndTick: number;
  durationMs: number;
}>;

type LocatedPitch = Readonly<{
  event: Extract<StaffBuilderEvent, { kind: "notes" }>;
  pitch: StaffBuilderPitch;
  measureIndex: number;
  startTick: number;
  endTick: number;
}>;

type SoundingPitch = Readonly<{ midiNumber: number; attackTick: number; endTick: number }>;

function pitchKey(eventId: string, pitchId: string): string {
  return `${eventId}:${pitchId}`;
}

function measureTiming(score: StaffBuilderScoreV1) {
  const capacities = score.measures.map((_measure, measureIndex) => resolveStaffBuilderMeasureContext(score, measureIndex).capacityTicks);
  const starts = capacities.map((_capacity, measureIndex) => getMeasureStartTick(capacities, measureIndex));
  return { capacities, starts, totalTicks: capacities.reduce((sum, capacity) => sum + capacity, 0) };
}

function flattenSoundingPitches(score: StaffBuilderScoreV1, measureStarts: readonly number[]): readonly SoundingPitch[] {
  const pitches = new Map<string, LocatedPitch>();
  score.measures.forEach((measure, measureIndex) => measure.events.forEach((event) => {
    if (event.kind !== "notes" || event.rhythm.status !== "final") return;
    const startTick = (measureStarts[measureIndex] ?? 0) + event.startTick;
    const endTick = startTick + durationToTicks(event.rhythm.duration);
    event.pitches.forEach((pitch) => pitches.set(pitchKey(event.id, pitch.id), { event, pitch, measureIndex, startTick, endTick }));
  }));
  const incoming = new Set(score.ties.map((tie) => pitchKey(tie.toEventId, tie.toPitchId)));
  const outgoing = new Map(score.ties.map((tie) => [pitchKey(tie.fromEventId, tie.fromPitchId), tie]));
  const sounding: SoundingPitch[] = [];
  for (const [rootKey, root] of pitches) {
    if (incoming.has(rootKey)) continue;
    let currentKey = rootKey;
    let endTick = root.endTick;
    const visited = new Set<string>();
    while (!visited.has(currentKey)) {
      visited.add(currentKey);
      const tie = outgoing.get(currentKey);
      if (!tie) break;
      const destinationKey = pitchKey(tie.toEventId, tie.toPitchId);
      const destination = pitches.get(destinationKey);
      if (!destination) break;
      endTick = Math.max(endTick, destination.endTick);
      currentKey = destinationKey;
    }
    sounding.push({ midiNumber: root.pitch.midiNumber, attackTick: root.startTick, endTick });
  }
  return sounding.sort((left, right) => left.attackTick - right.attackTick || left.endTick - right.endTick || left.midiNumber - right.midiNumber);
}

function resolveScope(score: StaffBuilderScoreV1, scope: StaffBuilderPlaybackScope, capacities: readonly number[], starts: readonly number[], totalTicks: number): Readonly<{ startTick: number; endTick: number }> {
  if (scope.kind === "entire-piece") return { startTick: 0, endTick: totalTicks };
  if (scope.kind === "measure") {
    const startTick = starts[scope.measureIndex];
    const capacity = capacities[scope.measureIndex];
    if (startTick === undefined || capacity === undefined) throw new Error(`Unknown Staff Builder playback measure ${scope.measureIndex}.`);
    return { startTick, endTick: startTick + capacity };
  }
  const measureStart = starts[scope.position.measureIndex];
  const capacity = capacities[scope.position.measureIndex];
  if (measureStart === undefined || capacity === undefined || !Number.isInteger(scope.position.offsetTicks)
    || scope.position.offsetTicks < 0 || scope.position.offsetTicks >= capacity) {
    throw new Error("Staff Builder playback position is outside the score.");
  }
  return { startTick: measureStart + scope.position.offsetTicks, endTick: totalTicks };
}

export function projectStaffBuilderPlayback(score: StaffBuilderScoreV1, scope: StaffBuilderPlaybackScope): StaffBuilderPlaybackProjection {
  if (validateStaffBuilderScore(score).length > 0) throw new Error("Staff Builder playback requires a structurally valid score.");
  const timing = measureTiming(score);
  const resolvedScope = resolveScope(score, scope, timing.capacities, timing.starts, timing.totalTicks);
  const grouped = new Map<string, Set<number>>();
  for (const interval of flattenSoundingPitches(score, timing.starts)) {
    const effectiveStart = Math.max(interval.attackTick, resolvedScope.startTick);
    const effectiveEnd = Math.min(interval.endTick, resolvedScope.endTick);
    if (effectiveStart >= effectiveEnd) continue;
    const key = `${effectiveStart}:${effectiveEnd}`;
    const notes = grouped.get(key) ?? new Set<number>();
    notes.add(interval.midiNumber);
    grouped.set(key, notes);
  }
  const events = [...grouped.entries()].map(([key, notes]): PlayableMusicalEvent => {
    const [startTick = 0, endTick = 0] = key.split(":").map(Number);
    return {
      notes: [...notes].sort((left, right) => left - right),
      startTimeMs: ticksToMilliseconds(startTick, score.tempoBpm) - ticksToMilliseconds(resolvedScope.startTick, score.tempoBpm),
      durationMs: tickBoundaryDurationMilliseconds(startTick, endTick, score.tempoBpm),
    };
  }).sort((left, right) => left.startTimeMs - right.startTimeMs || left.durationMs - right.durationMs || (left.notes[0] ?? 0) - (right.notes[0] ?? 0));
  return {
    events,
    scopeStartTick: resolvedScope.startTick,
    scopeEndTick: resolvedScope.endTick,
    durationMs: tickBoundaryDurationMilliseconds(resolvedScope.startTick, resolvedScope.endTick, score.tempoBpm),
  };
}

export function projectStaffBuilderEventAudition(event: StaffBuilderEvent | null): PlayableMusicalEvent | null {
  if (!event || event.kind !== "notes" || event.rhythm.status !== "final") return null;
  return { notes: [...new Set(event.pitches.map(({ midiNumber }) => midiNumber))].sort((left, right) => left - right), startTimeMs: 0, durationMs: STAFF_BUILDER_AUDITION_DURATION_MS };
}
