import { MONOPHONIC_CONFIG } from "@/lib/audio/monophonic/pitch-analysis-types";
import { equalTemperedFrequency } from "@/lib/audio/monophonic/pitch-math";
import { isPiecePracticeStaffAssessed } from "./piece-practice-assessment";
import { getPiecePracticeBoundaryReattackPitches } from "./piece-practice-input";
import type { PiecePracticePiece, PiecePracticeTarget } from "./piece-practice-types";

export type AcousticEligibility = Readonly<{ eligible: true }> | Readonly<{ eligible: false; message: string; measureIndex: number }>;
export const acousticTargetEligible = (target: PiecePracticeTarget): boolean => target.expectedMidiNumbers.length === 1
  && target.checks.filter((check) => check.expectedMidiNumbers.length > 0).length === 1
  && target.checks.every((check) => check.kind === "normal" || check.expectedMidiNumbers.length === 0)
  && target.expectedMidiNumbers.every((pitch) => {
    const hz = equalTemperedFrequency(pitch);
    return hz >= MONOPHONIC_CONFIG.minHz && hz <= MONOPHONIC_CONFIG.maxHz;
  });

/** Input is already focused. Full-score spans must still be filtered by assessed staff. */
export function getAcousticEligibility(piece: PiecePracticePiece, startMeasureIndex: number, endMeasureIndex: number | null = null): AcousticEligibility {
  const end = endMeasureIndex ?? piece.measures.length - 1;
  const fail = (measureIndex: number, reason: string): AcousticEligibility => ({ eligible: false, measureIndex,
    message: `Microphone practice needs one pitch at a time. Measure ${measureIndex + 1} ${reason}. Choose another Staff Focus or practice range.` });
  if (!Number.isInteger(startMeasureIndex) || !Number.isInteger(end) || startMeasureIndex < 0 || end < startMeasureIndex
    || !piece.measures[startMeasureIndex] || !piece.measures[end]) return fail(Math.max(0, startMeasureIndex), "is outside the practice range");
  const rangeStart = piece.measures[startMeasureIndex].absoluteStartTick;
  const rangeEnd = piece.measures[end].absoluteStartTick + piece.measures[end].capacityTicks;
  const assessed = piece.assessmentFocus ?? "both";
  for (const measure of piece.measures.slice(startMeasureIndex, end + 1)) {
    for (const target of measure.targets) {
      if (target.checks.some((check) => check.kind === "rolled-chord" && check.expectedMidiNumbers.length > 0)) return fail(measure.measureIndex, "contains a rolled-chord requirement");
      if (target.expectedMidiNumbers.length > 1) return fail(measure.measureIndex, "contains an assessed chord");
      if (target.expectedMidiNumbers.some((pitch) => equalTemperedFrequency(pitch) < MONOPHONIC_CONFIG.minHz || equalTemperedFrequency(pitch) > MONOPHONIC_CONFIG.maxHz)) {
        return fail(measure.measureIndex, "contains a pitch outside the 120–2300 Hz analysis range");
      }
    }
    const boundary = getPiecePracticeBoundaryReattackPitches(piece, measure.measureIndex);
    const boundaryPitches = new Set([...boundary.map((pitch) => pitch.midiNumber), ...measure.targets.filter((target) => target.startTick === 0).flatMap((target) => target.expectedMidiNumbers)]);
    if (boundaryPitches.size > 1) return fail(measure.measureIndex, "requires multiple pitches on a boundary restart");
    const pitches = measure.sourceEvents.flatMap((event) => event.kind === "notes" && isPiecePracticeStaffAssessed(assessed, event.staff) ? event.pitches : []);
    if (pitches.some(({ midiNumber }) => equalTemperedFrequency(midiNumber) < MONOPHONIC_CONFIG.minHz || equalTemperedFrequency(midiNumber) > MONOPHONIC_CONFIG.maxHz)) {
      return fail(measure.measureIndex, "contains a pitch outside the 120–2300 Hz analysis range");
    }
  }
  // Production projections have tie-merged spans. Event spans also support legacy projections without them.
  const spans = (piece.soundingSpans ?? piece.measures.flatMap((measure) => measure.sourceEvents.flatMap((event) =>
    event.kind === "notes" ? event.pitches.map((pitch) => ({ staff: event.staff, midiNumber: pitch.midiNumber,
      attackTick: event.absoluteStartTick, endTick: event.absoluteStartTick + event.durationTicks })) : [])))
    .filter((span) => isPiecePracticeStaffAssessed(assessed, span.staff) && span.attackTick < rangeEnd && span.endTick > rangeStart)
    .sort((a, b) => a.attackTick - b.attackTick);
  for (let i = 0; i < spans.length; i++) {
    const left = spans[i];
    for (let j = i + 1; j < spans.length && spans[j].attackTick < left.endTick; j++) {
      const right = spans[j];
      if (left.midiNumber === right.midiNumber) continue;
      const tick = Math.max(rangeStart, left.attackTick, right.attackTick);
      const measureIndex = piece.measures.findIndex((measure) => measure.absoluteStartTick <= tick && tick < measure.absoluteStartTick + measure.capacityTicks);
      return fail(measureIndex, "contains overlapping assessed pitches");
    }
  }
  return { eligible: true };
}
