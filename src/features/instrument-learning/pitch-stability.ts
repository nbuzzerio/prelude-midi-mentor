import { MONOPHONIC_CONFIG } from "@/lib/audio/monophonic/pitch-analysis-types";
import { centsBetween } from "@/lib/audio/monophonic/pitch-math";
import { CALIBRATION_POLICY as P, emptyCalibrationMeasurement, type CalibrationMeasurement, type CalibrationSample, type ViolinReference } from "./calibration-types";
import { calibrationAmbiguity } from "./instrument-interpretation";

/** Linear interpolation between sorted ranks. These are spread statistics, not confidence intervals. */
export function quantile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (sorted.length - 1) * fraction, lower = Math.floor(rank);
  return sorted[lower] + (sorted[Math.ceil(rank)] - sorted[lower]) * (rank - lower);
}

export function createCalibrationStability(reference: ViolinReference) {
  let samples: CalibrationSample[] = [], settlingAt: number | null = null;
  let lastAt: number | null = null, lastAudio: number | null = null, generation: number | null = null;
  const reset = () => { samples = []; settlingAt = lastAt = lastAudio = generation = null; };
  function update(sample: CalibrationSample): CalibrationMeasurement {
    const { observation: raw, snapshot, observedAtMs: at, audioSeconds, captureGeneration } = sample.envelope;
    const discontinuity = lastAt !== null && (at <= lastAt || at - lastAt > P.maxGapMs)
      || lastAudio !== null && audioSeconds <= lastAudio || generation !== null && captureGeneration !== generation;
    if (discontinuity) reset();
    lastAt = at; lastAudio = audioSeconds; generation = captureGeneration;
    const valid = !discontinuity && Number.isFinite(at) && Number.isFinite(audioSeconds)
      && at >= 0 && audioSeconds >= 0 && raw.reason === "usable" && raw.frequencyHz !== null
      && Number.isFinite(raw.frequencyHz) && raw.frequencyHz >= MONOPHONIC_CONFIG.minHz && raw.frequencyHz <= MONOPHONIC_CONFIG.maxHz
      && Number.isFinite(raw.quality) && raw.quality >= MONOPHONIC_CONFIG.minQuality
      && Number.isFinite(raw.levelDbfs) && raw.levelDbfs >= MONOPHONIC_CONFIG.minDbfs
      && snapshot.state === "stable" && snapshot.fresh && snapshot.ageMs !== null
      && snapshot.ageMs >= 0 && snapshot.ageMs <= MONOPHONIC_CONFIG.staleMs;
    if (!valid) { samples = []; settlingAt = null; return emptyCalibrationMeasurement(); }
    const cents = centsBetween(raw.frequencyHz!, reference.frequencyHz);
    const ambiguity = calibrationAmbiguity(raw.frequencyHz!, reference);
    if (ambiguity) {
      samples = []; settlingAt = null;
      return { ...emptyCalibrationMeasurement(), status: "ambiguous", ambiguity, medianHz: raw.frequencyHz, cents };
    }
    settlingAt ??= at;
    if (at - settlingAt < P.settlingMs) return emptyCalibrationMeasurement();
    samples.push(sample);
    if (samples.length > 128) { samples = []; settlingAt = null; return emptyCalibrationMeasurement(); }
    // Retain one boundary sample so irregular cadence can actually span 800 ms.
    while (samples.length > 1 && samples[1].envelope.observedAtMs <= at - P.windowMs) samples.shift();
    const start = samples[0].envelope.observedAtMs, duration = at - start;
    if (samples.length < P.minimumSamples || duration < P.windowMs) return { ...emptyCalibrationMeasurement(), sampleCount: samples.length, coverageMs: duration };
    const values = samples.map(({ envelope }) => centsBetween(envelope.observation.frequencyHz!, reference.frequencyHz));
    const median = quantile(values, 0.5), p10 = quantile(values, 0.1), p90 = quantile(values, 0.9);
    const half = start + duration / 2;
    const first = values.filter((_, index) => samples[index].envelope.observedAtMs < half);
    const second = values.filter((_, index) => samples[index].envelope.observedAtMs >= half);
    const drift = Math.abs(quantile(first, 0.5) - quantile(second, 0.5));
    const stable = p90 - p10 <= P.spreadCents + 1e-9 && drift <= P.driftCents + 1e-9;
    return { status: stable ? "valid" : "insufficient", ambiguity: null, stable,
      tuning: !stable ? "unknown" : Math.abs(median) <= P.greenCents + 1e-9 ? "within-band"
        : Math.abs(median) <= P.yellowCents + 1e-9 ? "near-target" : "needs-adjustment",
      sampleCount: samples.length, startMs: start, endMs: at, medianHz: reference.frequencyHz * 2 ** (median / 1200),
      cents: median, p10Cents: p10, p90Cents: p90, madCents: quantile(values.map((value) => Math.abs(value - median)), 0.5),
      driftCents: drift, coverageMs: duration, samples: stable ? [...samples] : [] };
  }
  return { update, reset };
}
