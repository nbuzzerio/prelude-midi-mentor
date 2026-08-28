import type { StaffBuilderScore, StaffBuilderTie } from "@/features/staff-builder/staff-builder-types";
import type { PiecePracticePiece } from "./piece-practice-types";

export function createPiecePracticeDisplayScore(piece: PiecePracticePiece): StaffBuilderScore {
  const tieEndpoints = new Map<string, Partial<StaffBuilderTie>>();
  const measures = piece.measures.map((measure, measureIndex) => {
    const previous = piece.measures[measureIndex - 1];
    const events = measure.sourceEvents.map((event) => {
      if (event.kind === "rest") {
        return { id: event.sourceEventId, kind: "rest" as const, staff: event.staff, startTick: event.startTick, rhythm: { status: "final" as const, duration: event.duration } };
      }
      const pitches = event.pitches.map((pitch) => {
        pitch.outgoingTieIds.forEach((id) => tieEndpoints.set(id, { ...tieEndpoints.get(id), id, fromEventId: event.sourceEventId, fromPitchId: pitch.sourcePitchId }));
        pitch.incomingTieIds.forEach((id) => tieEndpoints.set(id, { ...tieEndpoints.get(id), id, toEventId: event.sourceEventId, toPitchId: pitch.sourcePitchId }));
        return { id: pitch.sourcePitchId, midiNumber: pitch.midiNumber, letter: pitch.letter, accidental: pitch.accidental, octave: pitch.octave };
      });
      return { id: event.sourceEventId, kind: "notes" as const, staff: event.staff, startTick: event.startTick, rhythm: { status: "final" as const, duration: event.duration }, pitches, ...(event.arpeggiation ? { arpeggiation: event.arpeggiation } : {}) };
    });
    return {
      id: measure.sourceMeasureId,
      ...(measureIndex > 0 && measure.keySignatureId !== previous?.keySignatureId ? { keySignatureChange: measure.keySignatureId } : {}),
      ...(measureIndex > 0 && measure.timeSignature !== previous?.timeSignature ? { timeSignatureChange: measure.timeSignature } : {}),
      events,
    };
  });
  const ties = [...tieEndpoints.values()].filter((tie): tie is StaffBuilderTie => Boolean(
    tie.id && tie.fromEventId && tie.fromPitchId && tie.toEventId && tie.toPitchId,
  )).sort((left, right) => left.id.localeCompare(right.id));
  const timestamp = piece.sourceScoreUpdatedAt;
  return {
    schemaVersion: 3,
    id: piece.sourceScoreId,
    title: piece.title,
    createdAt: timestamp,
    updatedAt: timestamp,
    tempoBpm: piece.tempoBpm,
    initialKeySignatureId: piece.measures[0]?.keySignatureId ?? "c-major",
    initialTimeSignature: piece.measures[0]?.timeSignature ?? "4/4",
    measures,
    ties,
    annotations: [],
  };
}
