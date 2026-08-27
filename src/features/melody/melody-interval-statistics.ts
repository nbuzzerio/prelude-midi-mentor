import type { MelodyContinuousDiagnosticTrial } from "./melody-continuous-practice";
import type { MelodyAttemptResult } from "./melody-scoring";
import type { MelodyExpectedAttack, MelodyWrittenPitch } from "./melody-types";

export type MelodyIntervalDirection = "ascending" | "descending" | "repeated";
export type MelodyIntervalQuality = "perfect" | "major" | "minor" | "augmented" | "diminished";

export type MelodyWrittenInterval = Readonly<{
  direction: MelodyIntervalDirection;
  quality: MelodyIntervalQuality;
  number: number;
}>;

export type MelodyIntervalOpportunity = Readonly<{
  interval: MelodyWrittenInterval;
  sourceExpectedAttackId: string;
  destinationExpectedAttackId: string;
  outcome: "correct" | "error";
}>;

export type MelodyIntervalStatistic = Readonly<{
  interval: MelodyWrittenInterval;
  opportunities: number;
  correct: number;
  errors: number;
  errorRate: number;
  sampleStatus: "recurring" | "limited-sample" | "strong";
}>;

export type MelodyIntervalReport = Readonly<{
  needsAttention: readonly MelodyIntervalStatistic[];
  strong: readonly MelodyIntervalStatistic[];
  totalOpportunities: number;
  totalErrors: number;
}>;

type IntervalPitch = MelodyWrittenPitch & Readonly<{ midiNumber: number }>;

const LETTER_INDEX = Object.freeze({ C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 });
const NATURAL_PITCH_CLASS = Object.freeze({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });
const ACCIDENTAL_OFFSET = Object.freeze({ flat: -1, natural: 0, sharp: 1 });
const SIMPLE_BASELINE_SEMITONES = Object.freeze([0, 0, 2, 4, 5, 7, 9, 11, 12]);
const PERFECT_INTERVAL_NUMBERS = new Set([1, 4, 5, 8]);
const QUALITY_ABBREVIATION: Readonly<Record<MelodyIntervalQuality, string>> = Object.freeze({
  perfect: "P", major: "M", minor: "m", augmented: "A", diminished: "d",
});
const ORDINAL: Readonly<Record<number, string>> = Object.freeze({
  1: "unison", 2: "second", 3: "third", 4: "fourth",
  5: "fifth", 6: "sixth", 7: "seventh", 8: "octave",
});

function assertPitchSpelling(pitch: IntervalPitch): void {
  const expectedMidi = (pitch.octave + 1) * 12
    + NATURAL_PITCH_CLASS[pitch.letter]
    + ACCIDENTAL_OFFSET[pitch.accidental];
  if (expectedMidi !== pitch.midiNumber) {
    throw new Error(`Melody interval pitch spelling does not match MIDI ${pitch.midiNumber}.`);
  }
}

function qualityFor(number: number, semitones: number): MelodyIntervalQuality {
  const baseline = SIMPLE_BASELINE_SEMITONES[number];
  if (baseline === undefined) {
    throw new Error(`Melody interval ${number} is compound or outside the supported P1-P8 contract.`);
  }
  const difference = semitones - baseline;
  if (PERFECT_INTERVAL_NUMBERS.has(number)) {
    if (difference === 0) return "perfect";
    if (difference === 1) return "augmented";
    if (difference === -1) return "diminished";
  } else {
    if (difference === 0) return "major";
    if (difference === -1) return "minor";
    if (difference === 1) return "augmented";
    if (difference === -2) return "diminished";
  }
  throw new Error(`Unsupported written Melody interval: ${number} spanning ${semitones} semitones.`);
}

export function classifyMelodyWrittenInterval(
  source: IntervalPitch,
  destination: IntervalPitch,
): MelodyWrittenInterval {
  assertPitchSpelling(source);
  assertPitchSpelling(destination);
  const sourceCoordinate = source.octave * 7 + LETTER_INDEX[source.letter];
  const destinationCoordinate = destination.octave * 7 + LETTER_INDEX[destination.letter];
  const number = Math.abs(destinationCoordinate - sourceCoordinate) + 1;
  if (number > 8) {
    throw new Error(`Melody interval ${number} is compound or outside the supported P1-P8 contract.`);
  }
  const direction: MelodyIntervalDirection = destination.midiNumber === source.midiNumber
    ? "repeated"
    : destination.midiNumber > source.midiNumber ? "ascending" : "descending";
  if (direction === "repeated" && number !== 1) {
    throw new Error("A repeated Melody pitch must be written as a unison.");
  }
  return Object.freeze({
    direction,
    quality: qualityFor(number, Math.abs(destination.midiNumber - source.midiNumber)),
    number,
  });
}

export function getMelodyIntervalSemanticKey(interval: MelodyWrittenInterval): string {
  return `${interval.direction}|${interval.quality}|${interval.number}`;
}

export function getMelodyIntervalShortLabel(interval: MelodyWrittenInterval): string {
  const arrow = interval.direction === "ascending" ? "↑ " : interval.direction === "descending" ? "↓ " : "";
  return `${arrow}${QUALITY_ABBREVIATION[interval.quality]}${interval.number}`;
}

export function getMelodyIntervalAccessibleLabel(interval: MelodyWrittenInterval): string {
  if (interval.direction === "repeated") return "Repeated pitch, perfect unison";
  const ordinal = ORDINAL[interval.number];
  if (!ordinal) throw new Error(`No accessible label exists for Melody interval ${interval.number}.`);
  return `${interval.direction === "ascending" ? "Ascending" : "Descending"} ${interval.quality} ${ordinal}`;
}

function pitchFromExpectedAttack(attack: MelodyExpectedAttack): IntervalPitch {
  return { ...attack.writtenPitch, midiNumber: attack.midiNumber };
}

export function deriveMelodyIntervalOpportunities(
  result: MelodyAttemptResult,
): readonly MelodyIntervalOpportunity[] {
  return Object.freeze(result.attacks.slice(1).map((destination, index) => {
    const source = result.attacks[index]!;
    return Object.freeze({
      interval: classifyMelodyWrittenInterval(
        pitchFromExpectedAttack(source.expectedAttack),
        pitchFromExpectedAttack(destination.expectedAttack),
      ),
      sourceExpectedAttackId: source.expectedAttack.id,
      destinationExpectedAttackId: destination.expectedAttack.id,
      outcome: destination.status === "correct" ? "correct" as const : "error" as const,
    });
  }));
}

export function aggregateMelodyIntervalResults(
  results: readonly MelodyAttemptResult[],
): MelodyIntervalReport {
  const aggregated = new Map<string, { interval: MelodyWrittenInterval; opportunities: number; errors: number }>();
  for (const result of results) {
    for (const opportunity of deriveMelodyIntervalOpportunities(result)) {
      const key = getMelodyIntervalSemanticKey(opportunity.interval);
      const current = aggregated.get(key) ?? { interval: opportunity.interval, opportunities: 0, errors: 0 };
      aggregated.set(key, {
        interval: current.interval,
        opportunities: current.opportunities + 1,
        errors: current.errors + (opportunity.outcome === "error" ? 1 : 0),
      });
    }
  }
  const statistics = [...aggregated.entries()].map(([semanticKey, value]) => Object.freeze({
    semanticKey,
    statistic: Object.freeze({
      interval: value.interval,
      opportunities: value.opportunities,
      correct: value.opportunities - value.errors,
      errors: value.errors,
      errorRate: value.errors / value.opportunities,
      sampleStatus: value.errors === 0
        ? "strong" as const
        : value.errors >= 2 && value.opportunities >= 2
          ? "recurring" as const
          : "limited-sample" as const,
    }),
  }));
  const attentionStatusRank = { recurring: 0, "limited-sample": 1, strong: 2 } as const;
  const needsAttention = statistics
    .filter(({ statistic }) => statistic.errors > 0)
    .sort((left, right) =>
      attentionStatusRank[left.statistic.sampleStatus] - attentionStatusRank[right.statistic.sampleStatus]
      || right.statistic.errorRate - left.statistic.errorRate
      || right.statistic.errors - left.statistic.errors
      || right.statistic.opportunities - left.statistic.opportunities
      || left.semanticKey.localeCompare(right.semanticKey))
    .map(({ statistic }) => statistic);
  const strong = statistics
    .filter(({ statistic }) => statistic.errors === 0)
    .sort((left, right) => right.statistic.opportunities - left.statistic.opportunities
      || left.semanticKey.localeCompare(right.semanticKey))
    .map(({ statistic }) => statistic);
  return Object.freeze({
    needsAttention: Object.freeze(needsAttention),
    strong: Object.freeze(strong),
    totalOpportunities: statistics.reduce((sum, { statistic }) => sum + statistic.opportunities, 0),
    totalErrors: statistics.reduce((sum, { statistic }) => sum + statistic.errors, 0),
  });
}

export function summarizeMelodySightReadIntervals(
  trials: readonly MelodyContinuousDiagnosticTrial[],
): MelodyIntervalReport {
  return aggregateMelodyIntervalResults(trials.map(({ originalResult }) => originalResult));
}

export function summarizeMelodyRepairIntervals(
  trials: readonly MelodyContinuousDiagnosticTrial[],
): MelodyIntervalReport {
  return aggregateMelodyIntervalResults(trials.flatMap(({ retryResults }) => retryResults));
}
