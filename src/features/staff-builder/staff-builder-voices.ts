import { durationToTicks } from "./staff-builder-time";
import type { StaffBuilderEvent, StaffBuilderStaff } from "./staff-builder-types";

export type StaffBuilderDerivedEvent = Readonly<{
  eventId: string;
  staff: StaffBuilderStaff;
  startTick: number;
  endTick: number;
}>;

export type StaffBuilderDerivedGap = Readonly<{ startTick: number; endTick: number }>;

export type StaffBuilderDerivedVoice = Readonly<{
  staff: StaffBuilderStaff;
  voiceIndex: number;
  events: readonly StaffBuilderDerivedEvent[];
  implicitGaps: readonly StaffBuilderDerivedGap[];
}>;

export type StaffBuilderSamePositionConflictReason =
  | "same-duration-notes"
  | "duplicate-midi-pitch"
  | "duplicate-rests";

export type StaffBuilderSamePositionConflict = Readonly<{
  staff: StaffBuilderStaff;
  startTick: number;
  eventIds: readonly string[];
  reasons: readonly StaffBuilderSamePositionConflictReason[];
}>;

function pitchCenter(event: StaffBuilderEvent): number {
  if (event.kind === "rest" || event.pitches.length === 0) return Number.NEGATIVE_INFINITY;
  return event.pitches.reduce((sum, pitch) => sum + pitch.midiNumber, 0) / event.pitches.length;
}

function endTick(event: StaffBuilderEvent): number {
  return event.rhythm.status === "final" ? event.startTick + durationToTicks(event.rhythm.duration) : event.startTick;
}

/** Musical ordering used only for deterministic derived allocation. */
export function compareStaffBuilderEventsForVoiceAllocation(left: StaffBuilderEvent, right: StaffBuilderEvent): number {
  return left.startTick - right.startTick
    || (left.kind === right.kind ? 0 : left.kind === "notes" ? -1 : 1)
    || pitchCenter(right) - pitchCenter(left)
    || endTick(right) - endTick(left)
    || left.id.localeCompare(right.id);
}

export function getStaffBuilderEventInterval(event: StaffBuilderEvent): StaffBuilderDerivedEvent | null {
  if (event.rhythm.status !== "final") return null;
  return { eventId: event.id, staff: event.staff, startTick: event.startTick, endTick: endTick(event) };
}

export function getStaffBuilderStaffCoverageGaps(intervals: readonly StaffBuilderDerivedEvent[], capacityTicks: number): readonly StaffBuilderDerivedGap[] {
  const ordered = [...intervals].sort((left, right) => left.startTick - right.startTick || left.endTick - right.endTick || left.eventId.localeCompare(right.eventId));
  const gaps: StaffBuilderDerivedGap[] = [];
  let coveredUntil = 0;
  for (const interval of ordered) {
    if (interval.startTick > coveredUntil) gaps.push({ startTick: coveredUntil, endTick: Math.min(interval.startTick, capacityTicks) });
    coveredUntil = Math.max(coveredUntil, interval.endTick);
    if (coveredUntil >= capacityTicks) break;
  }
  if (coveredUntil < capacityTicks) gaps.push({ startTick: coveredUntil, endTick: capacityTicks });
  return gaps.filter((gap) => gap.startTick < gap.endTick);
}

function implicitGaps(events: readonly StaffBuilderDerivedEvent[], capacityTicks: number): readonly StaffBuilderDerivedGap[] {
  return getStaffBuilderStaffCoverageGaps(events, capacityTicks);
}

export function deriveStaffBuilderVoices(events: readonly StaffBuilderEvent[], staff: StaffBuilderStaff, capacityTicks: number): readonly StaffBuilderDerivedVoice[] {
  const ordered = events.filter((event) => event.staff === staff && event.rhythm.status === "final").sort(compareStaffBuilderEventsForVoiceAllocation);
  const lanes: StaffBuilderDerivedEvent[][] = [];
  for (const event of ordered) {
    const interval = getStaffBuilderEventInterval(event);
    if (!interval) continue;
    const availableIndex = lanes.findIndex((lane) => (lane.at(-1)?.endTick ?? 0) <= interval.startTick);
    const voiceIndex = availableIndex < 0 ? lanes.length : availableIndex;
    (lanes[voiceIndex] ??= []).push(interval);
  }
  return lanes.map((voiceEvents, voiceIndex) => ({ staff, voiceIndex, events: voiceEvents, implicitGaps: implicitGaps(voiceEvents, capacityTicks) }));
}

function pairConflictReasons(left: StaffBuilderEvent, right: StaffBuilderEvent): readonly StaffBuilderSamePositionConflictReason[] {
  if (left.staff !== right.staff || left.startTick !== right.startTick || left.rhythm.status !== "final" || right.rhythm.status !== "final") return [];
  if (left.kind === "rest" && right.kind === "rest") return ["duplicate-rests"];
  if (left.kind === "rest" || right.kind === "rest") return [];
  const reasons: StaffBuilderSamePositionConflictReason[] = [];
  if (durationToTicks(left.rhythm.duration) === durationToTicks(right.rhythm.duration)) reasons.push("same-duration-notes");
  const rightMidi = new Set(right.pitches.map((pitch) => pitch.midiNumber));
  if (left.pitches.some((pitch) => rightMidi.has(pitch.midiNumber))) reasons.push("duplicate-midi-pitch");
  return reasons;
}

export function getStaffBuilderSamePositionConflicts(events: readonly StaffBuilderEvent[]): readonly StaffBuilderSamePositionConflict[] {
  const groups = new Map<string, StaffBuilderEvent[]>();
  for (const event of events) {
    if (event.rhythm.status !== "final") continue;
    const key = `${event.staff}:${event.startTick}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  const conflicts: StaffBuilderSamePositionConflict[] = [];
  for (const group of groups.values()) {
    const ids = new Set<string>();
    const reasons = new Set<StaffBuilderSamePositionConflictReason>();
    for (let leftIndex = 0; leftIndex < group.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < group.length; rightIndex += 1) {
        const pairReasons = pairConflictReasons(group[leftIndex]!, group[rightIndex]!);
        if (pairReasons.length === 0) continue;
        ids.add(group[leftIndex]!.id);
        ids.add(group[rightIndex]!.id);
        pairReasons.forEach((reason) => reasons.add(reason));
      }
    }
    if (reasons.size > 0) conflicts.push({
      staff: group[0]!.staff,
      startTick: group[0]!.startTick,
      eventIds: [...ids].sort(),
      reasons: [...reasons].sort(),
    });
  }
  return conflicts.sort((left, right) => left.startTick - right.startTick
    || (left.staff === right.staff ? 0 : left.staff === "treble" ? -1 : 1)
    || left.eventIds.join("|").localeCompare(right.eventIds.join("|")));
}
