import { getMusicKeyDefinition, type MusicKeyId } from "@/lib/music/keys";
import { resolveStaffBuilderMeasureContext, type StaffBuilderFactories } from "./staff-builder-score";
import { durationToTicks, getMeasureCapacityTicks, STAFF_BUILDER_DURATIONS, STAFF_BUILDER_TICKS_PER_QUARTER, type StaffBuilderDuration, type StaffBuilderTimeSignature } from "./staff-builder-time";
import type { StaffBuilderEvent, StaffBuilderPitch, StaffBuilderScoreV1, StaffBuilderStaff, StaffBuilderTie } from "./staff-builder-types";
import { getStaffBuilderEventInterval, getStaffBuilderSamePositionConflicts, getStaffBuilderStaffCoverageGaps } from "./staff-builder-voices";

export type StaffBuilderCorrectionError = "event-missing" | "pitch-missing" | "invalid-timing" | "conflict" | "tie-conflict" | "incompatible-pitch" | "unsupported-span" | "stale-correction";
export type StaffBuilderCorrectionResult = Readonly<{ ok: true; score: StaffBuilderScoreV1 }> | Readonly<{ ok: false; error: StaffBuilderCorrectionError; score: StaffBuilderScoreV1 }>;
export type StaffBuilderGapCorrectionTarget = Readonly<{ measureIndex: number; staff: StaffBuilderStaff; startTick: number; endTick: number }>;

const defaultFactories: StaffBuilderFactories = { createId: () => crypto.randomUUID(), now: () => new Date().toISOString() };
const ORDERED_DURATIONS = [...STAFF_BUILDER_DURATIONS].sort((a, b) => durationToTicks(b) - durationToTicks(a) || a.localeCompare(b));

function durationForTicks(ticks: number): StaffBuilderDuration | null {
  return STAFF_BUILDER_DURATIONS.find((duration) => durationToTicks(duration) === ticks) ?? null;
}

export function getExactStaffBuilderFittingDuration(capacityTicks: number, startTick: number): StaffBuilderDuration | null {
  if (!Number.isInteger(capacityTicks) || !Number.isInteger(startTick) || capacityTicks <= 0 || startTick < 0 || startTick >= capacityTicks) return null;
  return durationForTicks(capacityTicks - startTick);
}

function update(score: StaffBuilderScoreV1, factories: Pick<StaffBuilderFactories, "now">, changes: Partial<StaffBuilderScoreV1>): StaffBuilderScoreV1 {
  return { ...score, ...changes, updatedAt: factories.now() };
}

function findEvent(score: StaffBuilderScoreV1, eventId: string): Readonly<{ event: StaffBuilderEvent; measureIndex: number }> | null {
  for (let measureIndex = 0; measureIndex < score.measures.length; measureIndex += 1) {
    const event = score.measures[measureIndex]?.events.find(({ id }) => id === eventId);
    if (event) return { event, measureIndex };
  }
  return null;
}

function sameWrittenPitch(left: StaffBuilderPitch, right: StaffBuilderPitch): boolean {
  return left.midiNumber === right.midiNumber && left.letter === right.letter && left.accidental === right.accidental && left.octave === right.octave;
}

export function decomposeStaffBuilderGap(timeSignature: StaffBuilderTimeSignature, capacityTicks: number, startTick: number, endTick: number): readonly Readonly<{ startTick: number; duration: StaffBuilderDuration }>[] | null {
  if (!Number.isInteger(startTick) || !Number.isInteger(endTick) || startTick < 0 || endTick > capacityTicks || startTick >= endTick) return null;
  if (startTick === 0 && endTick === capacityTicks) {
    const full = durationForTicks(capacityTicks);
    return full ? [{ startTick: 0, duration: full }] : null;
  }
  const beatTicks = timeSignature === "6/8" ? 720 : 480;
  const result: Array<{ startTick: number; duration: StaffBuilderDuration }> = [];
  let cursor = startTick;
  while (cursor < endTick) {
    const nextBeat = Math.min(endTick, (Math.floor(cursor / beatTicks) + 1) * beatTicks);
    let remaining = nextBeat - cursor;
    while (remaining > 0) {
      const duration = ORDERED_DURATIONS.find((candidate) => durationToTicks(candidate) <= remaining);
      if (!duration) return null;
      result.push({ startTick: cursor, duration });
      const ticks = durationToTicks(duration);
      cursor += ticks;
      remaining -= ticks;
    }
  }
  return result;
}

export function fillStaffBuilderGapWithRests(score: StaffBuilderScoreV1, options: Readonly<{ measureIndex: number; staff: StaffBuilderStaff; startTick: number; endTick: number; factories?: StaffBuilderFactories }>): StaffBuilderCorrectionResult {
  const measure = score.measures[options.measureIndex];
  if (!measure) return { ok: false, error: "invalid-timing", score };
  const context = resolveStaffBuilderMeasureContext(score, options.measureIndex);
  const pieces = decomposeStaffBuilderGap(context.timeSignature, context.capacityTicks, options.startTick, options.endTick);
  if (!pieces) return { ok: false, error: "unsupported-span", score };
  const overlaps = measure.events.some((event) => event.staff === options.staff && event.rhythm.status === "final"
    && event.startTick < options.endTick && event.startTick + durationToTicks(event.rhythm.duration) > options.startTick);
  if (overlaps) return { ok: false, error: "conflict", score };
  const factories = options.factories ?? defaultFactories;
  const rests: StaffBuilderEvent[] = pieces.map(({ startTick, duration }) => ({ id: factories.createId(), kind: "rest", staff: options.staff, startTick, rhythm: { status: "final", duration } }));
  return { ok: true, score: update(score, factories, { measures: score.measures.map((item, index) => index === options.measureIndex ? { ...item, events: [...item.events, ...rests] } : item) }) };
}

function getSafeStaffGaps(score: StaffBuilderScoreV1, measureIndex: number, staff: StaffBuilderStaff): readonly Readonly<{ startTick: number; endTick: number }>[] | null {
  const measure = score.measures[measureIndex];
  if (!measure) return null;
  const capacity = resolveStaffBuilderMeasureContext(score, measureIndex).capacityTicks;
  const events = measure.events.filter((event) => event.staff === staff);
  if (events.some((event) => event.rhythm.status !== "final"
    || event.startTick % (STAFF_BUILDER_TICKS_PER_QUARTER / 4) !== 0
    || event.startTick < 0
    || event.startTick >= capacity
    || event.startTick + durationToTicks(event.rhythm.duration) > capacity)
    || getStaffBuilderSamePositionConflicts(events).length > 0) return null;
  return getStaffBuilderStaffCoverageGaps(events.flatMap((event) => {
    const interval = getStaffBuilderEventInterval(event);
    return interval ? [interval] : [];
  }), capacity);
}

export function fillAllStaffBuilderGapsWithRests(score: StaffBuilderScoreV1, gaps: readonly StaffBuilderGapCorrectionTarget[], factories: StaffBuilderFactories = defaultFactories): StaffBuilderCorrectionResult {
  if (gaps.length === 0) return { ok: false, error: "unsupported-span", score };
  const seen = new Set<string>();
  const planned: Array<Readonly<{ measureIndex: number; staff: StaffBuilderStaff; startTick: number; duration: StaffBuilderDuration }>> = [];
  for (const gap of gaps) {
    const key = `${gap.measureIndex}:${gap.staff}:${gap.startTick}:${gap.endTick}`;
    if (seen.has(key)) return { ok: false, error: "stale-correction", score };
    seen.add(key);
    const context = score.measures[gap.measureIndex] ? resolveStaffBuilderMeasureContext(score, gap.measureIndex) : null;
    const safeGaps = getSafeStaffGaps(score, gap.measureIndex, gap.staff);
    if (!context || !safeGaps?.some((candidate) => candidate.startTick === gap.startTick && candidate.endTick === gap.endTick)) {
      return { ok: false, error: "stale-correction", score };
    }
    const pieces = decomposeStaffBuilderGap(context.timeSignature, context.capacityTicks, gap.startTick, gap.endTick);
    if (!pieces) return { ok: false, error: "unsupported-span", score };
    planned.push(...pieces.map((piece) => ({ measureIndex: gap.measureIndex, staff: gap.staff, ...piece })));
  }
  const restsByMeasure = new Map<number, StaffBuilderEvent[]>();
  for (const piece of planned) {
    const rests = restsByMeasure.get(piece.measureIndex) ?? [];
    rests.push({ id: factories.createId(), kind: "rest", staff: piece.staff, startTick: piece.startTick, rhythm: { status: "final", duration: piece.duration } });
    restsByMeasure.set(piece.measureIndex, rests);
  }
  return {
    ok: true,
    score: update(score, factories, { measures: score.measures.map((measure, measureIndex) => {
      const rests = restsByMeasure.get(measureIndex);
      return rests ? { ...measure, events: [...measure.events, ...rests] } : measure;
    }) }),
  };
}

export function removeStaffBuilderTie(score: StaffBuilderScoreV1, tieId: string, factories: Pick<StaffBuilderFactories, "now"> = defaultFactories): StaffBuilderCorrectionResult {
  if (!score.ties.some(({ id }) => id === tieId)) return { ok: false, error: "event-missing", score };
  return { ok: true, score: update(score, factories, { ties: score.ties.filter(({ id }) => id !== tieId) }) };
}

export function createStaffBuilderTies(score: StaffBuilderScoreV1, options: Readonly<{ fromEventId: string; toEventId: string; fromPitchIds: readonly string[]; factories?: StaffBuilderFactories }>): StaffBuilderCorrectionResult {
  const from = findEvent(score, options.fromEventId);
  const to = findEvent(score, options.toEventId);
  if (!from || !to || from.event.kind !== "notes" || to.event.kind !== "notes") return { ok: false, error: "event-missing", score };
  if (from.event.rhythm.status !== "final" || from.measureIndex + 1 !== to.measureIndex || to.event.startTick !== 0 || from.event.staff !== to.event.staff
    || from.event.startTick + durationToTicks(from.event.rhythm.duration) !== resolveStaffBuilderMeasureContext(score, from.measureIndex).capacityTicks) {
    return { ok: false, error: "invalid-timing", score };
  }
  const selected = [...new Set(options.fromPitchIds)];
  if (selected.length === 0) return { ok: false, error: "pitch-missing", score };
  const pairs: Array<Readonly<{ from: StaffBuilderPitch; to: StaffBuilderPitch }>> = [];
  for (const pitchId of selected) {
    const fromPitch = from.event.pitches.find(({ id }) => id === pitchId);
    if (!fromPitch) return { ok: false, error: "pitch-missing", score };
    const toPitch = to.event.pitches.find((candidate) => sameWrittenPitch(fromPitch, candidate));
    if (!toPitch) return { ok: false, error: "incompatible-pitch", score };
    if (score.ties.some((tie) => (tie.fromEventId === from.event.id && tie.fromPitchId === fromPitch.id) || (tie.toEventId === to.event.id && tie.toPitchId === toPitch.id))) {
      return { ok: false, error: "tie-conflict", score };
    }
    pairs.push({ from: fromPitch, to: toPitch });
  }
  const factories = options.factories ?? defaultFactories;
  const ties: StaffBuilderTie[] = pairs.map((pair) => ({ id: factories.createId(), fromEventId: from.event.id, fromPitchId: pair.from.id, toEventId: to.event.id, toPitchId: pair.to.id }));
  return { ok: true, score: update(score, factories, { ties: [...score.ties, ...ties] }) };
}

export function createStaffBuilderContinuationAndTies(score: StaffBuilderScoreV1, options: Readonly<{ fromEventId: string; fromPitchIds: readonly string[]; remainderDuration: StaffBuilderDuration; factories?: StaffBuilderFactories }>): StaffBuilderCorrectionResult {
  const from = findEvent(score, options.fromEventId);
  if (!from || from.event.kind !== "notes" || from.event.rhythm.status !== "final") return { ok: false, error: "event-missing", score };
  const nextMeasure = score.measures[from.measureIndex + 1];
  if (!nextMeasure || nextMeasure.events.some((event) => event.staff === from.event.staff && event.startTick === 0)) return { ok: false, error: "conflict", score };
  if (durationToTicks(options.remainderDuration) > resolveStaffBuilderMeasureContext(score, from.measureIndex + 1).capacityTicks) return { ok: false, error: "invalid-timing", score };
  const selected = [...new Set(options.fromPitchIds)].map((id) => from.event.kind === "notes" ? from.event.pitches.find((pitch) => pitch.id === id) : undefined);
  if (selected.length === 0 || selected.some((pitch) => !pitch)) return { ok: false, error: "pitch-missing", score };
  if ((selected as StaffBuilderPitch[]).some((pitch) => score.ties.some((tie) => tie.fromEventId === from.event.id && tie.fromPitchId === pitch.id))) return { ok: false, error: "tie-conflict", score };
  const factories = options.factories ?? defaultFactories;
  const eventId = factories.createId();
  const pitches = (selected as StaffBuilderPitch[]).map((pitch) => ({ ...pitch, id: factories.createId() }));
  const continuation: StaffBuilderEvent = { id: eventId, kind: "notes", staff: from.event.staff, startTick: 0, rhythm: { status: "final", duration: options.remainderDuration }, pitches };
  const ties = (selected as StaffBuilderPitch[]).map((pitch, index): StaffBuilderTie => ({ id: factories.createId(), fromEventId: from.event.id, fromPitchId: pitch.id, toEventId: eventId, toPitchId: pitches[index]?.id ?? "" }));
  return { ok: true, score: update(score, factories, { measures: score.measures.map((measure, index) => index === from.measureIndex + 1 ? { ...measure, events: [...measure.events, continuation] } : measure), ties: [...score.ties, ...ties] }) };
}

export function splitStaffBuilderEventAcrossBarline(score: StaffBuilderScoreV1, options: Readonly<{ eventId: string; targetDuration: StaffBuilderDuration; fromPitchIds: readonly string[]; useEventId?: string; factories?: StaffBuilderFactories }>): StaffBuilderCorrectionResult {
  const located = findEvent(score, options.eventId);
  if (!located || located.event.kind !== "notes") return { ok: false, error: "event-missing", score };
  const capacity = resolveStaffBuilderMeasureContext(score, located.measureIndex).capacityTicks;
  const sourceTicks = capacity - located.event.startTick;
  const remainderTicks = durationToTicks(options.targetDuration) - sourceTicks;
  const sourceDuration = durationForTicks(sourceTicks);
  const remainderDuration = durationForTicks(remainderTicks);
  const nextCapacity = located.measureIndex + 1 < score.measures.length ? resolveStaffBuilderMeasureContext(score, located.measureIndex + 1).capacityTicks : 0;
  if (!sourceDuration || !remainderDuration || remainderTicks > nextCapacity) return { ok: false, error: "unsupported-span", score };
  const factories = options.factories ?? defaultFactories;
  const shortened = update(score, factories, { measures: score.measures.map((measure, index) => index === located.measureIndex ? { ...measure, events: measure.events.map((event) => event.id === located.event.id ? { ...event, rhythm: { status: "final", duration: sourceDuration } } : event) } : measure) });
  if (options.useEventId) {
    const destination = findEvent(shortened, options.useEventId);
    if (!destination || destination.event.rhythm.status !== "final" || durationToTicks(destination.event.rhythm.duration) !== remainderTicks) return { ok: false, error: "invalid-timing", score };
    return createStaffBuilderTies(shortened, { fromEventId: located.event.id, toEventId: options.useEventId, fromPitchIds: options.fromPitchIds, factories });
  }
  return createStaffBuilderContinuationAndTies(shortened, { fromEventId: located.event.id, fromPitchIds: options.fromPitchIds, remainderDuration, factories });
}

export function setStaffBuilderInitialKey(score: StaffBuilderScoreV1, keyId: MusicKeyId, factories: Pick<StaffBuilderFactories, "now"> = defaultFactories): StaffBuilderScoreV1 {
  getMusicKeyDefinition(keyId);
  return score.initialKeySignatureId === keyId ? score : update(score, factories, { initialKeySignatureId: keyId });
}

export function setStaffBuilderInitialTime(score: StaffBuilderScoreV1, timeSignature: StaffBuilderTimeSignature, factories: Pick<StaffBuilderFactories, "now"> = defaultFactories): StaffBuilderScoreV1 {
  getMeasureCapacityTicks(timeSignature);
  return score.initialTimeSignature === timeSignature ? score : update(score, factories, { initialTimeSignature: timeSignature });
}
