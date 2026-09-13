import { getMusicKeyDefinition } from "@/lib/music/keys";
import { resolveStaffBuilderMeasureContext } from "../staff-builder-score";
import { STAFF_BUILDER_TICKS_PER_QUARTER, durationToTicks } from "../staff-builder-time";
import type { StaffBuilderAccidental, StaffBuilderEvent, StaffBuilderMeasure, StaffBuilderScore } from "../staff-builder-types";
import { getStaffBuilderVerticalGeometry } from "./staff-builder-vertical-geometry";
import { getStaffBuilderLyricCues, STAFF_BUILDER_LYRIC_LANE_RESERVATION } from "./staff-builder-lyric-cues";

export type StaffBuilderVerticalLayoutReservations = Readonly<{
  aboveStaff: number;
  betweenStaves: number;
  belowStaff: number;
}>;

export type StaffBuilderSystemLayoutConstraints = Readonly<{
  contentWidth: number;
  minimumMeasureWidth: number;
  maximumMeasureWidth: number;
  baseMusicHeight: number;
  systemGap: number;
  maximumMeasuresPerSystem?: 2 | 3 | 4 | 5;
  fittedSystemComposition?: Readonly<{
    targetMeasureCount: 2 | 3 | 4 | 5;
    minimumRhythmicWidth: number;
    minimumCompressionRatio: number;
    partialMaximumMeasureWidth: number;
  }>;
  verticalReservations?: StaffBuilderVerticalLayoutReservations;
}>;

export type StaffBuilderMeasurePlacement = Readonly<{
  measureId: string;
  measureIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type StaffBuilderSystemLayout = Readonly<{
  systemIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  measures: readonly StaffBuilderMeasurePlacement[];
}>;

export type StaffBuilderScoreDocumentLayout = Readonly<{
  width: number;
  height: number;
  systems: readonly StaffBuilderSystemLayout[];
}>;

export type StaffBuilderMeasureLayoutEstimate = Readonly<{
  measureId: string;
  measureIndex: number;
  startsSystem: boolean;
  rhythmicOnsetCount: number;
  subdivisionComplexity: number;
  simultaneousEventBurden: number;
  chordBurden: number;
  polyphonyBurden: number;
  accidentalBurden: number;
  signatureChangeOverhead: number;
  systemStartOverhead: number;
  complexityWeight: number;
  requestedWidth: number;
}>;

export type StaffBuilderLayoutPoint = Readonly<{ x: number; y: number }>;
export type StaffBuilderLayoutBounds = StaffBuilderLayoutPoint & Readonly<{ width: number; height: number }>;

export const DEFAULT_STAFF_BUILDER_VERTICAL_LAYOUT_RESERVATIONS: StaffBuilderVerticalLayoutReservations = {
  aboveStaff: 0,
  betweenStaves: 0,
  belowStaff: 0,
};

const SYSTEM_START_OVERHEAD = 72;
const KEY_CHANGE_OVERHEAD = 24;
const TIME_CHANGE_OVERHEAD = 20;
const COMPLEXITY_WIDTH_UNIT = 12;

function requireNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative finite number.`);
}

function validateConstraints(constraints: StaffBuilderSystemLayoutConstraints): StaffBuilderVerticalLayoutReservations {
  for (const [name, value] of Object.entries({
    contentWidth: constraints.contentWidth,
    minimumMeasureWidth: constraints.minimumMeasureWidth,
    maximumMeasureWidth: constraints.maximumMeasureWidth,
    baseMusicHeight: constraints.baseMusicHeight,
    systemGap: constraints.systemGap,
  })) requireNonNegative(value, name);
  if (constraints.contentWidth === 0 || constraints.minimumMeasureWidth === 0 || constraints.maximumMeasureWidth === 0 || constraints.baseMusicHeight === 0) {
    throw new Error("Layout width and base music height constraints must be positive.");
  }
  if (constraints.maximumMeasureWidth < constraints.minimumMeasureWidth) throw new Error("Maximum measure width must be at least the minimum measure width.");
  if (constraints.maximumMeasuresPerSystem !== undefined && ![2, 3, 4, 5].includes(constraints.maximumMeasuresPerSystem)) throw new Error("Maximum measures per system must be 2, 3, 4, or 5.");
  if (constraints.fittedSystemComposition) {
    const fitted = constraints.fittedSystemComposition;
    if (![2, 3, 4, 5].includes(fitted.targetMeasureCount)) throw new Error("Fitted target measure count must be 2, 3, 4, or 5.");
    requireNonNegative(fitted.minimumRhythmicWidth, "minimum rhythmic width");
    requireNonNegative(fitted.minimumCompressionRatio, "minimum compression ratio");
    requireNonNegative(fitted.partialMaximumMeasureWidth, "partial maximum measure width");
    if (fitted.minimumRhythmicWidth === 0 || fitted.minimumCompressionRatio === 0 || fitted.minimumCompressionRatio > 1 || fitted.partialMaximumMeasureWidth === 0) throw new Error("Fitted composition constraints are outside their supported range.");
  }
  const reservations = constraints.verticalReservations ?? DEFAULT_STAFF_BUILDER_VERTICAL_LAYOUT_RESERVATIONS;
  for (const [name, value] of Object.entries(reservations)) requireNonNegative(value, name);
  return reservations;
}

function eventDurationTicks(event: StaffBuilderEvent): number {
  return event.rhythm.status === "final" ? durationToTicks(event.rhythm.duration) : STAFF_BUILDER_TICKS_PER_QUARTER;
}

function maximumOverlap(events: readonly StaffBuilderEvent[]): number {
  let maximum = 0;
  for (const event of events) {
    const active = events.filter((candidate) => candidate.startTick <= event.startTick
      && candidate.startTick + eventDurationTicks(candidate) > event.startTick).length;
    maximum = Math.max(maximum, active);
  }
  return maximum;
}

const NATURAL_PITCH_CLASSES = { A: 9, B: 11, C: 0, D: 2, E: 4, F: 5, G: 7 } as const;

function keySignatureAccidentals(keySignatureId: StaffBuilderScore["initialKeySignatureId"]): ReadonlyMap<string, StaffBuilderAccidental> {
  const accidentals = new Map<string, StaffBuilderAccidental>();
  for (const degree of getMusicKeyDefinition(keySignatureId).diatonicScale) {
    const natural = NATURAL_PITCH_CLASSES[degree.letter];
    const difference = ((degree.pitchClass - natural + 6) % 12) - 6;
    accidentals.set(degree.letter, difference === 1 ? "sharp" : difference === -1 ? "flat" : "natural");
  }
  return accidentals;
}

function writtenAccidentalBurden(measure: StaffBuilderMeasure, keySignatureId: StaffBuilderScore["initialKeySignatureId"]): number {
  const signature = keySignatureAccidentals(keySignatureId);
  let burden = 0;
  for (const staff of ["treble", "bass"] as const) {
    const state = new Map<string, StaffBuilderAccidental>();
    const events = measure.events.filter((event) => event.staff === staff).sort((left, right) => left.startTick - right.startTick || left.id.localeCompare(right.id));
    for (const event of events) {
      if (event.kind !== "notes") continue;
      for (const pitch of event.pitches) {
        const stateKey = `${pitch.letter}:${pitch.octave}`;
        const current = state.get(stateKey) ?? signature.get(pitch.letter) ?? "natural";
        if (pitch.accidental !== current) {
          burden += 1;
          state.set(stateKey, pitch.accidental);
        }
      }
    }
  }
  return burden;
}

function measureSignals(measure: StaffBuilderMeasure, capacityTicks: number, keySignatureId: StaffBuilderScore["initialKeySignatureId"]) {
  const onsetGroups = new Map<number, StaffBuilderEvent[]>();
  for (const event of measure.events) onsetGroups.set(event.startTick, [...(onsetGroups.get(event.startTick) ?? []), event]);
  const onsets = [...onsetGroups.keys()].sort((left, right) => left - right);
  const durations = measure.events.map(eventDurationTicks);
  const onsetIntervals = onsets.slice(1).map((tick, index) => tick - (onsets[index] ?? 0)).filter((ticks) => ticks > 0);
  const smallestUnit = Math.min(capacityTicks, ...durations, ...onsetIntervals);
  const subdivisionComplexity = Math.max(0, Math.log2(STAFF_BUILDER_TICKS_PER_QUARTER / Math.max(1, smallestUnit)));
  const simultaneousEventBurden = [...onsetGroups.values()].reduce((sum, group) => sum + Math.max(0, group.length - 1), 0);
  const chordBurden = measure.events.reduce((sum, event) => sum + (event.kind === "notes" ? Math.max(0, event.pitches.length - 1) : 0), 0);
  const polyphonyBurden = (["treble", "bass"] as const).reduce((sum, staff) => sum + Math.max(0, maximumOverlap(measure.events.filter((event) => event.staff === staff)) - 1), 0);
  const accidentalBurden = writtenAccidentalBurden(measure, keySignatureId);
  return { onsets, subdivisionComplexity, simultaneousEventBurden, chordBurden, polyphonyBurden, accidentalBurden };
}

export function estimateStaffBuilderMeasureLayout(
  score: StaffBuilderScore,
  measureIndex: number,
  constraints: Pick<StaffBuilderSystemLayoutConstraints, "minimumMeasureWidth" | "maximumMeasureWidth">,
  startsSystem = false,
): StaffBuilderMeasureLayoutEstimate {
  if (constraints.minimumMeasureWidth <= 0 || constraints.maximumMeasureWidth < constraints.minimumMeasureWidth) throw new Error("Invalid measure width constraints.");
  const measure = score.measures[measureIndex];
  if (!measure) throw new Error(`Unknown measure index ${measureIndex}.`);
  const { capacityTicks, keySignatureId } = resolveStaffBuilderMeasureContext(score, measureIndex);
  const signals = measureSignals(measure, capacityTicks, keySignatureId);
  const capacityInQuarters = capacityTicks / STAFF_BUILDER_TICKS_PER_QUARTER;
  const rhythmicDensity = signals.onsets.length / Math.max(1, capacityInQuarters);
  const complexityWeight = 1
    + rhythmicDensity * 1.8
    + signals.subdivisionComplexity * 0.9
    + signals.simultaneousEventBurden * 0.7
    + signals.chordBurden * 0.35
    + signals.polyphonyBurden * 0.8
    + signals.accidentalBurden * 0.25;
  const systemStartOverhead = startsSystem ? SYSTEM_START_OVERHEAD : 0;
  const signatureChangeOverhead = startsSystem ? 0
    : (measure.keySignatureChange === undefined ? 0 : KEY_CHANGE_OVERHEAD)
      + (measure.timeSignatureChange === undefined ? 0 : TIME_CHANGE_OVERHEAD);
  const requestedWidth = Math.min(constraints.maximumMeasureWidth, Math.max(constraints.minimumMeasureWidth,
    constraints.minimumMeasureWidth + complexityWeight * COMPLEXITY_WIDTH_UNIT + systemStartOverhead + signatureChangeOverhead));
  return {
    measureId: measure.id,
    measureIndex,
    startsSystem,
    rhythmicOnsetCount: signals.onsets.length,
    subdivisionComplexity: signals.subdivisionComplexity,
    simultaneousEventBurden: signals.simultaneousEventBurden,
    chordBurden: signals.chordBurden,
    polyphonyBurden: signals.polyphonyBurden,
    accidentalBurden: signals.accidentalBurden,
    signatureChangeOverhead,
    systemStartOverhead,
    complexityWeight,
    requestedWidth,
  };
}

function distributeWidths(estimates: readonly StaffBuilderMeasureLayoutEstimate[], targetWidth: number, maximumWidth: number): readonly number[] {
  const widths = estimates.map(({ requestedWidth }) => requestedWidth);
  let remaining = Math.max(0, targetWidth - widths.reduce((sum, width) => sum + width, 0));
  let eligible = widths.map((_width, index) => index).filter((index) => (widths[index] ?? maximumWidth) < maximumWidth);
  while (remaining > 1e-7 && eligible.length > 0) {
    const totalWeight = eligible.reduce((sum, index) => sum + (estimates[index]?.complexityWeight ?? 0), 0);
    let distributed = 0;
    for (const index of eligible) {
      const room = maximumWidth - (widths[index] ?? maximumWidth);
      const share = remaining * (estimates[index]?.complexityWeight ?? 0) / totalWeight;
      const addition = Math.min(room, share);
      widths[index] = (widths[index] ?? 0) + addition;
      distributed += addition;
    }
    if (distributed <= 1e-7) break;
    remaining -= distributed;
    eligible = eligible.filter((index) => maximumWidth - (widths[index] ?? maximumWidth) > 1e-7);
  }
  return widths;
}

function fitWidths(estimates: readonly StaffBuilderMeasureLayoutEstimate[], targetWidth: number): readonly number[] {
  const overheads = estimates.map(({ signatureChangeOverhead, systemStartOverhead }) => signatureChangeOverhead + systemStartOverhead);
  const demands = estimates.map((estimate, index) => Math.max(1, estimate.requestedWidth - (overheads[index] ?? 0)));
  const availableRhythmicWidth = targetWidth - overheads.reduce((sum, width) => sum + width, 0);
  const totalDemand = demands.reduce((sum, width) => sum + width, 0);
  const widths = demands.map((demand, index) => (overheads[index] ?? 0) + availableRhythmicWidth * demand / totalDemand);
  if (widths.length > 0) widths[widths.length - 1] = (widths.at(-1) ?? 0) + targetWidth - widths.reduce((sum, width) => sum + width, 0);
  return widths;
}

function fittedWidthsAreReadable(estimates: readonly StaffBuilderMeasureLayoutEstimate[], widths: readonly number[], minimumRhythmicWidth: number, minimumCompressionRatio: number): boolean {
  return estimates.every((estimate, index) => {
    const overhead = estimate.signatureChangeOverhead + estimate.systemStartOverhead;
    const demand = Math.max(1, estimate.requestedWidth - overhead);
    const allocated = (widths[index] ?? 0) - overhead;
    return allocated >= minimumRhythmicWidth && allocated / demand >= minimumCompressionRatio;
  });
}

function packFittedSystems(score: StaffBuilderScore, constraints: StaffBuilderSystemLayoutConstraints, measureIndexes: readonly number[]): readonly StaffBuilderMeasureLayoutEstimate[][] {
  const fitted = constraints.fittedSystemComposition!;
  const packed: StaffBuilderMeasureLayoutEstimate[][] = [];
  let cursor = 0;
  while (cursor < measureIndexes.length) {
    const runStart = cursor;
    while (cursor + 1 < measureIndexes.length && measureIndexes[cursor + 1] === (measureIndexes[cursor] ?? 0) + 1) cursor += 1;
    const runEnd = cursor + 1;
    let runCursor = runStart;
    while (runCursor < runEnd) {
      let count = Math.min(fitted.targetMeasureCount, runEnd - runCursor);
      while (count > 1) {
        const estimates = measureIndexes.slice(runCursor, runCursor + count).map((measureIndex, index) => estimateStaffBuilderMeasureLayout(score, measureIndex, constraints, index === 0));
        const isPartial = count < fitted.targetMeasureCount;
        const targetWidth = isPartial ? Math.min(constraints.contentWidth, count * fitted.partialMaximumMeasureWidth) : constraints.contentWidth;
        if (fittedWidthsAreReadable(estimates, fitWidths(estimates, targetWidth), fitted.minimumRhythmicWidth, fitted.minimumCompressionRatio)) break;
        count -= 1;
      }
      packed.push(measureIndexes.slice(runCursor, runCursor + count).map((measureIndex, index) => estimateStaffBuilderMeasureLayout(score, measureIndex, constraints, index === 0)));
      runCursor += count;
    }
    cursor = runEnd;
  }
  return packed;
}

export function layoutStaffBuilderScoreSystems(score: StaffBuilderScore, constraints: StaffBuilderSystemLayoutConstraints, measureIndexes: readonly number[] = score.measures.map((_measure, index) => index)): StaffBuilderScoreDocumentLayout {
  const reservations = validateConstraints(constraints);
  if (measureIndexes.length === 0) return { width: constraints.contentWidth, height: 0, systems: [] };
  for (let index = 0; index < measureIndexes.length; index += 1) {
    const measureIndex = measureIndexes[index]!;
    if (!Number.isInteger(measureIndex) || measureIndex < 0 || measureIndex >= score.measures.length) throw new Error(`Unknown measure index ${measureIndex}.`);
    if (index > 0 && measureIndex <= measureIndexes[index - 1]!) throw new Error("Selected measure indexes must be strictly increasing.");
  }
  const packed: StaffBuilderMeasureLayoutEstimate[][] = constraints.fittedSystemComposition ? [...packFittedSystems(score, constraints, measureIndexes)] : [];
  let current: StaffBuilderMeasureLayoutEstimate[] = [];
  let previousMeasureIndex: number | null = null;
  for (const measureIndex of constraints.fittedSystemComposition ? [] : measureIndexes) {
    if (current.length > 0 && previousMeasureIndex !== null && measureIndex !== previousMeasureIndex + 1) { packed.push(current); current = []; }
    const estimate = estimateStaffBuilderMeasureLayout(score, measureIndex, constraints, current.length === 0);
    const used = current.reduce((sum, item) => sum + item.requestedWidth, 0);
    if (current.length > 0 && (current.length >= (constraints.maximumMeasuresPerSystem ?? Number.POSITIVE_INFINITY) || used + estimate.requestedWidth > constraints.contentWidth)) {
      packed.push(current);
      current = [estimateStaffBuilderMeasureLayout(score, measureIndex, constraints, true)];
    } else current.push(estimate);
    previousMeasureIndex = measureIndex;
  }
  if (current.length > 0) packed.push(current);

  let documentY = 0;
  const systems = packed.map((estimates, systemIndex): StaffBuilderSystemLayout => {
    const pitchSources = estimates.flatMap(({ measureIndex }) => score.measures[measureIndex]?.events.flatMap((event) => event.kind === "notes" ? [{ staff: event.staff, pitches: event.pitches }] : []) ?? []);
    const systemEventIds = new Set(estimates.flatMap(({ measureIndex }) => score.measures[measureIndex]?.events.map(({ id }) => id) ?? []));
    const hasLyricCues = getStaffBuilderLyricCues(score, systemEventIds).length > 0;
    const range = getStaffBuilderVerticalGeometry({ pitchSources, baseHeight: constraints.baseMusicHeight, trebleStaveY: 15, bassStaveY: constraints.baseMusicHeight - 105, topLaneReservation: hasLyricCues ? STAFF_BUILDER_LYRIC_LANE_RESERVATION : 0 });
    const aboveStaff = reservations.aboveStaff + range.topReservation;
    const belowStaff = reservations.belowStaff + range.bottomReservation;
    const systemHeight = aboveStaff + constraints.baseMusicHeight + reservations.betweenStaves + belowStaff;
    const requestedTotal = estimates.reduce((sum, estimate) => sum + estimate.requestedWidth, 0);
    const fitted = constraints.fittedSystemComposition;
    const isPartial = fitted !== undefined && estimates.length < fitted.targetMeasureCount;
    const allocationTarget = fitted
      ? isPartial ? Math.min(constraints.contentWidth, estimates.length * fitted.partialMaximumMeasureWidth) : constraints.contentWidth
      : Math.max(constraints.contentWidth, requestedTotal);
    const widths = fitted ? fitWidths(estimates, allocationTarget) : distributeWidths(estimates, allocationTarget, constraints.maximumMeasureWidth);
    let measureX = 0;
    const measures = estimates.map((estimate, index): StaffBuilderMeasurePlacement => {
      const width = widths[index] ?? estimate.requestedWidth;
      const placement = { measureId: estimate.measureId, measureIndex: estimate.measureIndex, x: measureX, y: aboveStaff, width, height: constraints.baseMusicHeight + reservations.betweenStaves };
      measureX += width;
      return placement;
    });
    const system = { systemIndex, x: 0, y: documentY, width: measureX, height: systemHeight, measures };
    documentY += systemHeight + (systemIndex < packed.length - 1 ? constraints.systemGap : 0);
    return system;
  });
  return {
    width: Math.max(constraints.contentWidth, ...systems.map(({ width }) => width)),
    height: systems.length === 0 ? 0 : documentY,
    systems,
  };
}

export function translateStaffBuilderMeasurePointToSystem(point: StaffBuilderLayoutPoint, placement: StaffBuilderMeasurePlacement): StaffBuilderLayoutPoint {
  return { x: point.x + placement.x, y: point.y + placement.y };
}

export function translateStaffBuilderMeasureBoundsToSystem(bounds: StaffBuilderLayoutBounds, placement: StaffBuilderMeasurePlacement): StaffBuilderLayoutBounds {
  return { ...translateStaffBuilderMeasurePointToSystem(bounds, placement), width: bounds.width, height: bounds.height };
}

export function translateStaffBuilderSystemPointToDocument(point: StaffBuilderLayoutPoint, system: StaffBuilderSystemLayout): StaffBuilderLayoutPoint {
  return { x: point.x + system.x, y: point.y + system.y };
}

export function translateStaffBuilderSystemBoundsToDocument(bounds: StaffBuilderLayoutBounds, system: StaffBuilderSystemLayout): StaffBuilderLayoutBounds {
  return { ...translateStaffBuilderSystemPointToDocument(bounds, system), width: bounds.width, height: bounds.height };
}
