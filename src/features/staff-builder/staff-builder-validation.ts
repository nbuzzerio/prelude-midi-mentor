import { durationToTicks, STAFF_BUILDER_TICKS_PER_QUARTER } from "./staff-builder-time";
import { resolveStaffBuilderMeasureContext } from "./staff-builder-score";
import { getExactStaffBuilderFittingDuration } from "./staff-builder-corrections";
import { deriveStaffBuilderVoices, getStaffBuilderSamePositionConflicts, getStaffBuilderStaffCoverageGaps } from "./staff-builder-voices";
import type { StaffBuilderEvent, StaffBuilderPitch, StaffBuilderScore, StaffBuilderStaff, StaffBuilderTie } from "./staff-builder-types";

export type StaffBuilderIssueCode =
  | "unresolved-rhythm"
  | "off-grid-start"
  | "start-outside-measure"
  | "event-overflow"
  | "invalid-arpeggiation"
  | "same-position-conflict"
  | "gap"
  | "tie-endpoint-missing"
  | "tie-not-cross-measure"
  | "tie-not-adjacent"
  | "tie-staff-mismatch"
  | "tie-pitch-mismatch"
  | "duplicate-tie"
  | "conflicting-incoming-tie"
  | "conflicting-outgoing-tie";

export type StaffBuilderIssueTarget = Readonly<{
  measureIndex: number;
  staff?: StaffBuilderStaff;
  positionTicks?: number;
  endTicks?: number;
  eventId?: string;
  pitchId?: string;
  tieId?: string;
}>;

export type StaffBuilderCorrection =
  | Readonly<{ kind: "assign-duration"; eventId: string }>
  | Readonly<{ kind: "shorten-duration"; eventId: string }>
  | Readonly<{ kind: "set-duration"; eventId: string; duration: Extract<StaffBuilderEvent["rhythm"], { status: "final" }>["duration"] }>
  | Readonly<{ kind: "delete-event"; eventId: string }>
  | Readonly<{ kind: "fill-gap-with-rests"; staff: StaffBuilderStaff; startTick: number; endTick: number }>
  | Readonly<{ kind: "remove-tie"; tieId: string }>;

export type StaffBuilderIssue = Readonly<{
  id: string;
  code: StaffBuilderIssueCode;
  severity: "error";
  target: StaffBuilderIssueTarget;
  message: string;
  corrections: readonly StaffBuilderCorrection[];
}>;

type LocatedEvent = Readonly<{ event: StaffBuilderEvent; measureIndex: number }>;
type LocatedPitch = Readonly<{ event: StaffBuilderEvent; pitch: StaffBuilderPitch; measureIndex: number }>;

const STAFF_RANK: Readonly<Record<StaffBuilderStaff, number>> = { treble: 0, bass: 1 };
const ISSUE_RANK: Readonly<Record<StaffBuilderIssueCode, number>> = {
  "unresolved-rhythm": 0,
  "off-grid-start": 1,
  "start-outside-measure": 2,
  "same-position-conflict": 3,
  "event-overflow": 4,
  "invalid-arpeggiation": 5,
  "tie-endpoint-missing": 6,
  "tie-not-cross-measure": 7,
  "tie-not-adjacent": 8,
  "tie-staff-mismatch": 9,
  "tie-pitch-mismatch": 10,
  "duplicate-tie": 11,
  "conflicting-incoming-tie": 12,
  "conflicting-outgoing-tie": 13,
  gap: 14,
};

function issue(code: StaffBuilderIssueCode, target: StaffBuilderIssueTarget, identity: string, message: string, corrections: readonly StaffBuilderCorrection[]): StaffBuilderIssue {
  const staff = target.staff ? `|s:${target.staff}` : "";
  const tick = target.positionTicks === undefined ? "" : `|t:${target.positionTicks}`;
  return { id: `${code}|m:${target.measureIndex}${staff}${tick}|${identity}`, code, severity: "error", target, message, corrections };
}

function compareIssues(left: StaffBuilderIssue, right: StaffBuilderIssue): number {
  return left.target.measureIndex - right.target.measureIndex
    || (left.target.positionTicks ?? 0) - (right.target.positionTicks ?? 0)
    || (left.target.staff ? STAFF_RANK[left.target.staff] : 2) - (right.target.staff ? STAFF_RANK[right.target.staff] : 2)
    || ISSUE_RANK[left.code] - ISSUE_RANK[right.code]
    || (left.target.eventId ?? left.target.tieId ?? left.id).localeCompare(right.target.eventId ?? right.target.tieId ?? right.id)
    || left.id.localeCompare(right.id);
}

function pitchIdentity(pitch: StaffBuilderPitch): string {
  return `${pitch.midiNumber}:${pitch.letter}:${pitch.accidental}:${pitch.octave}`;
}

function tieKey(tie: StaffBuilderTie): string {
  return `${tie.fromEventId}:${tie.fromPitchId}>${tie.toEventId}:${tie.toPitchId}`;
}

export function compareStaffBuilderIssues(left: StaffBuilderIssue, right: StaffBuilderIssue): number {
  return compareIssues(left, right);
}

export function validateStaffBuilderScore(score: StaffBuilderScore): readonly StaffBuilderIssue[] {
  const issues: StaffBuilderIssue[] = [];
  const events = new Map<string, LocatedEvent>();
  const pitches = new Map<string, LocatedPitch>();
  score.measures.forEach((measure, measureIndex) => measure.events.forEach((event) => {
    events.set(event.id, { event, measureIndex });
    if (event.kind === "notes") event.pitches.forEach((pitch) => pitches.set(`${event.id}:${pitch.id}`, { event, pitch, measureIndex }));
  }));

  score.measures.forEach((measure, measureIndex) => {
    const capacity = resolveStaffBuilderMeasureContext(score, measureIndex).capacityTicks;
    for (const event of measure.events) {
      const target = { measureIndex, staff: event.staff, positionTicks: event.startTick, eventId: event.id } as const;
      const deleteCorrection = { kind: "delete-event", eventId: event.id } as const;
      const arpeggiation = "arpeggiation" in event ? event.arpeggiation : undefined;
      if (arpeggiation !== undefined && (event.kind !== "notes" || event.pitches.length < 2 || arpeggiation !== "up")) {
        issues.push(issue("invalid-arpeggiation", target, `e:${event.id}`, `Measure ${measureIndex + 1} contains arpeggiation metadata on an event that is not a supported chord.`, [deleteCorrection]));
      }
      if (event.rhythm.status === "unresolved") {
        issues.push(issue("unresolved-rhythm", target, `e:${event.id}`, `Measure ${measureIndex + 1} ${event.staff} event at tick ${event.startTick} needs a final duration.`, [{ kind: "assign-duration", eventId: event.id }, deleteCorrection]));
      }
      if (event.startTick % (STAFF_BUILDER_TICKS_PER_QUARTER / 4) !== 0) {
        issues.push(issue("off-grid-start", target, `e:${event.id}`, `Measure ${measureIndex + 1} ${event.staff} event starts off the supported sixteenth-note grid at tick ${event.startTick}.`, [deleteCorrection]));
      }
      if (event.startTick < 0 || event.startTick >= capacity) {
        issues.push(issue("start-outside-measure", target, `e:${event.id}`, `Measure ${measureIndex + 1} ${event.staff} event starts at tick ${event.startTick}, outside the ${capacity}-tick measure.`, [deleteCorrection]));
      } else if (event.rhythm.status === "final" && event.startTick + durationToTicks(event.rhythm.duration) > capacity) {
        const fittingDuration = getExactStaffBuilderFittingDuration(capacity, event.startTick);
        const durationName = event.rhythm.duration.replace("-", " ");
        const eventName = event.kind === "rest" ? "rest" : event.pitches.length === 1 ? "note" : "chord";
        issues.push(issue(
          "event-overflow",
          target,
          `e:${event.id}`,
          `This ${durationName} ${eventName} extends past the end of measure ${measureIndex + 1}.`,
          [...(fittingDuration ? [{ kind: "set-duration" as const, eventId: event.id, duration: fittingDuration }] : []), { kind: "shorten-duration", eventId: event.id }, deleteCorrection],
        ));
      }
    }

    for (const staff of ["treble", "bass"] as const) {
      const staffEvents = measure.events.filter((event) => event.staff === staff);
      const conflicts = getStaffBuilderSamePositionConflicts(staffEvents);
      for (const conflict of conflicts) {
        issues.push(issue("same-position-conflict", { measureIndex, staff, positionTicks: conflict.startTick, eventId: conflict.eventIds[0] }, `events:${conflict.eventIds.join(",")}`, `Measure ${measureIndex + 1} ${staff} has incompatible separate events at tick ${conflict.startTick}. Equal-duration notes belong in one chord, and duplicate pitches or rests are not supported.`, conflict.eventIds.map((eventId) => ({ kind: "delete-event", eventId }))));
      }

      const timingReliable = staffEvents.every((event) => event.rhythm.status === "final" && event.startTick % 120 === 0 && event.startTick >= 0 && event.startTick < capacity
        && event.startTick + durationToTicks(event.rhythm.duration) <= capacity)
        && conflicts.length === 0;
      if (!timingReliable) continue;
      const voices = deriveStaffBuilderVoices(staffEvents, staff, capacity);
      const intervals = voices.flatMap((voice) => voice.events);
      for (const gap of getStaffBuilderStaffCoverageGaps(intervals, capacity)) {
        issues.push(issue("gap", { measureIndex, staff, positionTicks: gap.startTick, endTicks: gap.endTick }, `end:${gap.endTick}`, `This ${staff} staff has empty beats in measure ${measureIndex + 1}.`, [{ kind: "fill-gap-with-rests", staff, startTick: gap.startTick, endTick: gap.endTick }]));
      }
    }
  });

  const logicalTies = new Map<string, StaffBuilderTie[]>();
  const incoming = new Map<string, StaffBuilderTie[]>();
  const outgoing = new Map<string, StaffBuilderTie[]>();
  for (const tie of score.ties) {
    logicalTies.set(tieKey(tie), [...(logicalTies.get(tieKey(tie)) ?? []), tie]);
    const fromKey = `${tie.fromEventId}:${tie.fromPitchId}`;
    const toKey = `${tie.toEventId}:${tie.toPitchId}`;
    outgoing.set(fromKey, [...(outgoing.get(fromKey) ?? []), tie]);
    incoming.set(toKey, [...(incoming.get(toKey) ?? []), tie]);
    const fromEvent = events.get(tie.fromEventId);
    const toEvent = events.get(tie.toEventId);
    const fromPitch = pitches.get(fromKey);
    const toPitch = pitches.get(toKey);
    const located = fromEvent ?? toEvent;
    const target = { measureIndex: located?.measureIndex ?? 0, staff: located?.event.staff, positionTicks: located?.event.startTick ?? 0, eventId: located?.event.id, pitchId: fromPitch?.pitch.id ?? toPitch?.pitch.id, tieId: tie.id };
    const remove = [{ kind: "remove-tie", tieId: tie.id }] as const;
    if (!fromEvent || !toEvent || !fromPitch || !toPitch) {
      issues.push(issue("tie-endpoint-missing", target, `tie:${tie.id}`, `Tie ${tie.id} has a missing event or pitch endpoint.`, remove));
      continue;
    }
    if (fromEvent.measureIndex === toEvent.measureIndex) {
      issues.push(issue("tie-not-cross-measure", target, `tie:${tie.id}`, `Tie ${tie.id} does not cross a measure boundary.`, remove));
    } else if (toEvent.measureIndex !== fromEvent.measureIndex + 1) {
      issues.push(issue("tie-not-adjacent", target, `tie:${tie.id}`, `Tie ${tie.id} must connect immediately adjacent measures.`, remove));
    }
    if (fromEvent.event.staff !== toEvent.event.staff) {
      issues.push(issue("tie-staff-mismatch", target, `tie:${tie.id}`, `Tie ${tie.id} connects different staves.`, remove));
    }
    const sourceEndsAtBoundary = fromEvent.event.rhythm.status === "final"
      && fromEvent.event.startTick + durationToTicks(fromEvent.event.rhythm.duration) === resolveStaffBuilderMeasureContext(score, fromEvent.measureIndex).capacityTicks;
    if (!sourceEndsAtBoundary || toEvent.event.startTick !== 0) {
      issues.push(issue("tie-not-adjacent", target, `timing:${tie.id}`, `Tie ${tie.id} must connect a source ending at the barline to tick 0 of the next measure.`, remove));
    }
    if (pitchIdentity(fromPitch.pitch) !== pitchIdentity(toPitch.pitch)) {
      issues.push(issue("tie-pitch-mismatch", target, `tie:${tie.id}`, `Tie ${tie.id} connects pitches with different sounding or written identities.`, remove));
    }
  }
  for (const ties of logicalTies.values()) {
    if (ties.length < 2) continue;
    for (const tie of ties.slice(1).sort((a, b) => a.id.localeCompare(b.id))) {
      const from = events.get(tie.fromEventId);
      issues.push(issue("duplicate-tie", { measureIndex: from?.measureIndex ?? 0, staff: from?.event.staff, positionTicks: from?.event.startTick ?? 0, eventId: tie.fromEventId, pitchId: tie.fromPitchId, tieId: tie.id }, `tie:${tie.id}`, `Tie ${tie.id} duplicates another tie between the same pitches.`, [{ kind: "remove-tie", tieId: tie.id }]));
    }
  }
  const addConflicts = (groups: Map<string, StaffBuilderTie[]>, code: "conflicting-incoming-tie" | "conflicting-outgoing-tie") => {
    for (const ties of groups.values()) {
      if (ties.length < 2) continue;
      for (const tie of [...ties].sort((a, b) => a.id.localeCompare(b.id)).slice(1)) {
        const located = events.get(code === "conflicting-incoming-tie" ? tie.toEventId : tie.fromEventId);
        issues.push(issue(code, { measureIndex: located?.measureIndex ?? 0, staff: located?.event.staff, positionTicks: located?.event.startTick ?? 0, eventId: located?.event.id, tieId: tie.id }, `tie:${tie.id}`, `Tie ${tie.id} conflicts with another ${code === "conflicting-incoming-tie" ? "incoming" : "outgoing"} tie.`, [{ kind: "remove-tie", tieId: tie.id }]));
      }
    }
  };
  addConflicts(incoming, "conflicting-incoming-tie");
  addConflicts(outgoing, "conflicting-outgoing-tie");
  return issues.sort(compareIssues);
}
