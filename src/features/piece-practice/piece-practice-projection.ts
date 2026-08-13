import { resolveStaffBuilderMeasureContext } from "@/features/staff-builder/staff-builder-score";
import { durationToTicks } from "@/features/staff-builder/staff-builder-time";
import type { StaffBuilderEvent, StaffBuilderPitch, StaffBuilderScore, StaffBuilderStaff } from "@/features/staff-builder/staff-builder-types";
import { validateStaffBuilderScore } from "@/features/staff-builder/staff-builder-validation";
import type {
  PiecePracticeAttackedPitch,
  PiecePracticeMeasure,
  PiecePracticeProjectionResult,
  PiecePracticeSourceEvent,
  PiecePracticeSourcePitch,
  PiecePracticeTarget,
} from "./piece-practice-types";

const STAFF_ORDER: Readonly<Record<StaffBuilderStaff, number>> = { treble: 0, bass: 1 };

function pitchEndpointKey(eventId: string, pitchId: string): string {
  return `${eventId}:${pitchId}`;
}

function compareEvents(left: StaffBuilderEvent, right: StaffBuilderEvent): number {
  return left.startTick - right.startTick
    || STAFF_ORDER[left.staff] - STAFF_ORDER[right.staff]
    || left.id.localeCompare(right.id);
}

function compareSourcePitches(left: StaffBuilderPitch, right: StaffBuilderPitch): number {
  return left.midiNumber - right.midiNumber || left.id.localeCompare(right.id);
}

function compareAttackedPitches(left: PiecePracticeAttackedPitch, right: PiecePracticeAttackedPitch): number {
  return left.midiNumber - right.midiNumber
    || STAFF_ORDER[left.staff] - STAFF_ORDER[right.staff]
    || left.sourceEventId.localeCompare(right.sourceEventId)
    || left.sourcePitchId.localeCompare(right.sourcePitchId);
}

export function projectStaffBuilderPieceForPractice(score: StaffBuilderScore): PiecePracticeProjectionResult {
  const issues = validateStaffBuilderScore(score);
  if (issues.length > 0) return { ok: false, issues };

  const incomingTies = new Map<string, string[]>();
  const outgoingTies = new Map<string, string[]>();
  for (const tie of [...score.ties].sort((left, right) => left.id.localeCompare(right.id))) {
    const incomingKey = pitchEndpointKey(tie.toEventId, tie.toPitchId);
    const outgoingKey = pitchEndpointKey(tie.fromEventId, tie.fromPitchId);
    incomingTies.set(incomingKey, [...(incomingTies.get(incomingKey) ?? []), tie.id]);
    outgoingTies.set(outgoingKey, [...(outgoingTies.get(outgoingKey) ?? []), tie.id]);
  }

  let pieceTick = 0;
  const measures: PiecePracticeMeasure[] = score.measures.map((measure, measureIndex) => {
    const context = resolveStaffBuilderMeasureContext(score, measureIndex);
    const measureAbsoluteStartTick = pieceTick;
    pieceTick += context.capacityTicks;
    const attackedByTick = new Map<number, PiecePracticeAttackedPitch[]>();
    const sourceEvents: PiecePracticeSourceEvent[] = [...measure.events].sort(compareEvents).map((event) => {
      if (event.rhythm.status !== "final") throw new Error("Validated Staff Builder events must have final rhythm.");
      const duration = event.rhythm.duration;
      const durationTicks = durationToTicks(duration);
      const base = {
        sourceEventId: event.id,
        staff: event.staff,
        startTick: event.startTick,
        absoluteStartTick: measureAbsoluteStartTick + event.startTick,
        duration,
        durationTicks,
      } as const;
      if (event.kind === "rest") return { ...base, kind: "rest" };

      const pitches: PiecePracticeSourcePitch[] = [...event.pitches].sort(compareSourcePitches).map((pitch) => {
        const endpoint = pitchEndpointKey(event.id, pitch.id);
        const incomingTieIds = [...(incomingTies.get(endpoint) ?? [])].sort();
        const outgoingTieIds = [...(outgoingTies.get(endpoint) ?? [])].sort();
        const requiresAttack = incomingTieIds.length === 0;
        if (requiresAttack) {
          const attackedPitch: PiecePracticeAttackedPitch = {
            sourceEventId: event.id,
            sourcePitchId: pitch.id,
            staff: event.staff,
            midiNumber: pitch.midiNumber,
            letter: pitch.letter,
            accidental: pitch.accidental,
            octave: pitch.octave,
            duration,
            durationTicks,
            incomingTieIds,
            outgoingTieIds,
          };
          attackedByTick.set(event.startTick, [...(attackedByTick.get(event.startTick) ?? []), attackedPitch]);
        }
        return {
          sourcePitchId: pitch.id,
          midiNumber: pitch.midiNumber,
          letter: pitch.letter,
          accidental: pitch.accidental,
          octave: pitch.octave,
          incomingTieIds,
          outgoingTieIds,
          requiresAttack,
        };
      });
      return { ...base, kind: "notes", pitches };
    });

    const targets: PiecePracticeTarget[] = [...attackedByTick.entries()]
      .sort(([leftTick], [rightTick]) => leftTick - rightTick)
      .map(([startTick, collectedPitches]) => {
        const attackedPitches = [...collectedPitches].sort(compareAttackedPitches);
        return {
          id: `${measure.id}:attack:${startTick}`,
          measureIndex,
          sourceMeasureId: measure.id,
          startTick,
          absoluteStartTick: measureAbsoluteStartTick + startTick,
          sourceEventIds: [...new Set(attackedPitches.map(({ sourceEventId }) => sourceEventId))].sort(),
          expectedMidiNumbers: [...new Set(attackedPitches.map(({ midiNumber }) => midiNumber))].sort((left, right) => left - right),
          attackedPitches,
        };
      });

    return {
      measureIndex,
      sourceMeasureId: measure.id,
      absoluteStartTick: measureAbsoluteStartTick,
      capacityTicks: context.capacityTicks,
      keySignatureId: context.keySignatureId,
      timeSignature: context.timeSignature,
      sourceEvents,
      restEventIds: sourceEvents.filter(({ kind }) => kind === "rest").map(({ sourceEventId }) => sourceEventId).sort(),
      targets,
    };
  });

  return {
    ok: true,
    piece: {
      sourceScoreId: score.id,
      sourceScoreUpdatedAt: score.updatedAt,
      title: score.title,
      tempoBpm: score.tempoBpm,
      measures,
    },
  };
}
