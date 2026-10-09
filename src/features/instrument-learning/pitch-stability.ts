import { MONOPHONIC_CONFIG, type PitchObservation } from "@/lib/audio/monophonic/pitch-analysis-types";
import { centsBetween } from "@/lib/audio/monophonic/pitch-math";
import { CALIBRATION_POLICY, PRECISE_CALIBRATION_POLICY as P, type CalibrationPolicy, emptyCalibrationMeasurement, type CalibrationMeasurement, type CalibrationSample, type ViolinReference } from "./calibration-types";
import { calibrationAmbiguity } from "./instrument-interpretation";

/** Calibration-specific interruption bounds; tuning bands and statistics are unchanged. */
export const CALIBRATION_CONTINUITY = Object.freeze({ gapMs: 160, maximumWindowMs: 1000 });

/** Raw observation eligibility is independent of the smoothed tracker's acquisition state. */
export function reliableCalibrationFrequency(sample: CalibrationSample): number | null {
  const { observation: raw, observedAtMs: at, audioSeconds } = sample.envelope;
  return Number.isFinite(at) && Number.isFinite(audioSeconds) && at >= 0 && audioSeconds >= 0
    && raw.reason === "usable" && raw.frequencyHz !== null && Number.isFinite(raw.frequencyHz)
    && raw.frequencyHz >= MONOPHONIC_CONFIG.minHz && raw.frequencyHz <= MONOPHONIC_CONFIG.maxHz
    && Number.isFinite(raw.quality) && raw.quality >= MONOPHONIC_CONFIG.minQuality
    && Number.isFinite(raw.levelDbfs) && raw.levelDbfs >= MONOPHONIC_CONFIG.minDbfs ? raw.frequencyHz : null;
}

/** Linear interpolation between sorted ranks. These are spread statistics, not confidence intervals. */
export function quantile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (sorted.length - 1) * fraction, lower = Math.floor(rank);
  return sorted[lower] + (sorted[Math.ceil(rank)] - sorted[lower]) * (rank - lower);
}

export function createPreciseCalibrationStability(reference: ViolinReference) {
  let samples: CalibrationSample[] = [], settlingAt: number | null = null;
  let lastAt: number | null = null, lastAudio: number | null = null, generation: number | null = null, lastUsableAt: number | null = null;
  let latestSample: CalibrationSample | null = null, latestMeasurement = emptyCalibrationMeasurement();
  let resetAt: number | null = null, resetCause: "gap" | "interruption" | "capacity" | null = null;
  const reset = () => {
    samples = []; settlingAt = lastAt = lastAudio = generation = lastUsableAt = null;
    latestSample = null; latestMeasurement = emptyCalibrationMeasurement(); resetAt = null; resetCause = null;
  };
  function collect(sample: CalibrationSample): CalibrationMeasurement {
    const { observation: raw, observedAtMs: at, audioSeconds, captureGeneration } = sample.envelope;
    const discontinuity = lastAt !== null && (at <= lastAt || at - lastAt > CALIBRATION_CONTINUITY.gapMs)
      || lastAudio !== null && audioSeconds <= lastAudio || generation !== null && captureGeneration !== generation;
    if (discontinuity) {
      const gap = lastAt !== null && at - lastAt > CALIBRATION_CONTINUITY.gapMs;
      reset(); resetAt = at; resetCause = gap ? "gap" : "interruption";
    }
    lastAt = at; lastAudio = audioSeconds; generation = captureGeneration;
    const hz = discontinuity ? null : reliableCalibrationFrequency(sample);
    if (lastUsableAt !== null && at - lastUsableAt > CALIBRATION_CONTINUITY.gapMs) {
      samples = []; settlingAt = null; lastUsableAt = null; resetAt = at; resetCause = "gap";
    }
    if (hz === null) return emptyCalibrationMeasurement();
    const cents = centsBetween(raw.frequencyHz!, reference.frequencyHz);
    const ambiguity = calibrationAmbiguity(raw.frequencyHz!, reference, P);
    if (ambiguity) {
      return { ...emptyCalibrationMeasurement(), status: "ambiguous", ambiguity, medianHz: raw.frequencyHz, cents };
    }
    lastUsableAt = at;
    settlingAt ??= at;
    if (at - settlingAt < P.settlingMs) return emptyCalibrationMeasurement();
    samples.push(sample);
    if (samples.length > 128) { samples = []; settlingAt = null; resetAt = at; resetCause = "capacity"; return emptyCalibrationMeasurement(); }
    // Retain one boundary sample so irregular cadence can actually span 800 ms.
    while (samples.length > P.minimumSamples && samples[1].envelope.observedAtMs <= at - P.windowMs) samples.shift();
    while (samples.length > 1 && samples[0].envelope.observedAtMs < at - CALIBRATION_CONTINUITY.maximumWindowMs) samples.shift();
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
  function update(sample: CalibrationSample) {
    latestMeasurement = collect(sample); latestSample = sample;
    return latestMeasurement;
  }
  /** Read-only view of participating evidence, never elapsed bowing time or acceptance. */
  function progress(now: number) {
    const at = latestSample?.envelope.observedAtMs ?? null;
    const observation = latestSample?.envelope.observation;
    const gapExpired = lastUsableAt !== null && now - lastUsableAt > CALIBRATION_CONTINUITY.gapMs;
    const freshAnalysis = at !== null && now >= at && now - at <= MONOPHONIC_CONFIG.clearMs;
    const participating = freshAnalysis && !gapExpired ? samples : [];
    const sampleCount = participating.length;
    const coverageMs = sampleCount > 1 ? participating[sampleCount - 1].envelope.observedAtMs - participating[0].envelope.observedAtMs : 0;
    const ambiguity = observation?.frequencyHz != null && reliableCalibrationFrequency(latestSample!) !== null
      ? calibrationAmbiguity(observation.frequencyHz, reference, P) : null;
    let blocker: PitchObservation["reason"] | "no-observations" | "gap" | "interruption" | "capacity"
      | "harmonic" | "outside-fundamental" | "settling" | "samples" | "span" | "spread" | "drift" | "out-of-band" | null = null;
    if (!freshAnalysis) blocker = "no-observations";
    else if (observation?.reason !== "usable") blocker = observation?.reason ?? "invalid";
    else if (ambiguity) blocker = ambiguity === "possible-harmonic-or-different-pitch" ? "harmonic" : "outside-fundamental";
    else if (gapExpired || resetCause === "gap" && resetAt !== null && now - resetAt < 600 && latestMeasurement.status !== "valid") blocker = "gap";
    else if (resetCause === "interruption" && resetAt === at) blocker = "interruption";
    else if (resetCause === "capacity" && resetAt === at) blocker = "capacity";
    else if (reliableCalibrationFrequency(latestSample!) === null) blocker = "invalid";
    else if (settlingAt !== null && at! - settlingAt < P.settlingMs) blocker = "settling";
    else if (sampleCount < P.minimumSamples) blocker = "samples";
    else if (coverageMs < P.windowMs) blocker = "span";
    else if (latestMeasurement.p90Cents !== null && latestMeasurement.p10Cents !== null
      && latestMeasurement.p90Cents - latestMeasurement.p10Cents > P.spreadCents + 1e-9) blocker = "spread";
    else if (latestMeasurement.driftCents !== null && latestMeasurement.driftCents > P.driftCents + 1e-9) blocker = "drift";
    else if (latestMeasurement.status === "valid" && latestMeasurement.tuning !== "within-band") blocker = "out-of-band";
    return { sampleCount, coverageMs, requiredSamples: P.minimumSamples, requiredSpanMs: P.windowMs, blocker,
      resetCause: gapExpired ? "gap" as const : resetCause, freshAnalysis };
  }
  return { update, reset, progress };
}

/** Default preparation collector. Evidence may span compatible short acoustic candidates. */
export function createCalibrationStability(reference: ViolinReference, policy: CalibrationPolicy = CALIBRATION_POLICY) {
  return policy.version === 1 ? createPreciseCalibrationStability(reference) : createBeginnerCalibrationStability(reference);
}
function createBeginnerCalibrationStability(reference: ViolinReference) {
  const p = CALIBRATION_POLICY;
  type Entry = { sample: CalibrationSample; ring: number; cents: number };
  let entries: Entry[] = [], displaced: Entry[] = [], agreement: Entry[] = [];
  let ring = 0, ringStart: number | null = null, lastAt: number | null = null, lastAudio: number | null = null;
  let generation: number | null = null, lastLevel: number | null = null, ambiguityCount = 0;
  let latest: CalibrationSample | null = null, measured = emptyCalibrationMeasurement();
  const reset = () => { entries = []; displaced = []; agreement = []; ring = 0; ringStart = lastAt = lastAudio = generation = lastLevel = null; latest = null; measured = emptyCalibrationMeasurement(); ambiguityCount = 0; };
  const center = (values: Entry[]) => quantile(values.map((e) => e.cents), 0.5);
  const coverage = (values: Entry[]) => values.reduce((sum, e, i) => {
    const before = values[i - 1];
    const gap = before ? e.sample.envelope.observedAtMs - before.sample.envelope.observedAtMs : 0;
    return sum + (before && before.ring === e.ring && gap <= p.maxGapMs ? gap : 0);
  }, 0);
  function update(sample: CalibrationSample): CalibrationMeasurement {
    const { observedAtMs: at, audioSeconds, captureGeneration, observation: raw } = sample.envelope;
    const interrupted = lastAt !== null && at <= lastAt || lastAudio !== null && audioSeconds <= lastAudio
      || generation !== null && captureGeneration !== generation;
    if (interrupted) reset();
    const gap = lastAt !== null && at - lastAt > p.maxGapMs;
    const rise = lastLevel !== null && raw.levelDbfs - lastLevel >= p.attackRiseDb;
    lastAt = at; lastAudio = audioSeconds; generation = captureGeneration; latest = sample;
    entries = entries.filter((e) => at - e.sample.envelope.observedAtMs <= p.maximumAgeMs).slice(-p.maximumSamples);
    displaced = displaced.filter((e) => at - e.sample.envelope.observedAtMs <= p.maxGapMs);
    agreement = agreement.filter((e) => at - e.sample.envelope.observedAtMs <= p.maximumAgeMs);
    const sounding = Number.isFinite(raw.levelDbfs) && raw.levelDbfs >= MONOPHONIC_CONFIG.minDbfs
      && raw.reason !== "clock-stalled" && raw.reason !== "invalid";
    if (!sounding) ringStart = null;
    else if (ringStart === null || gap || rise) { ring++; ringStart = at; }
    lastLevel = Number.isFinite(raw.levelDbfs) ? raw.levelDbfs : null;
    measured = emptyCalibrationMeasurement();
    const hz = interrupted ? null : reliableCalibrationFrequency(sample);
    if (hz === null) return measured;
    const cents = centsBetween(hz, reference.frequencyHz), ambiguity = calibrationAmbiguity(hz, reference);
    if (ambiguity) {
      if (++ambiguityCount >= 2) { entries = []; displaced = []; agreement = []; }
      measured = { ...measured, status: "ambiguous", ambiguity, medianHz: hz, cents };
      return measured;
    }
    ambiguityCount = 0;
    if (ringStart === null || at - ringStart < p.settlingMs) return measured;
    const entry = { sample, ring, cents };
    agreement = [...agreement, entry].slice(-p.agreementWindowSamples);
    if (entries.length && Math.abs(cents - center(entries)) > p.compatibilityCents) {
      if (displaced.length && Math.abs(cents - center(displaced)) > p.compatibilityCents) displaced = [];
      if (displaced.length && at - displaced[displaced.length - 1].sample.envelope.observedAtMs < p.minimumSampleSpacingMs) return measured;
      displaced.push(entry);
      if (displaced.length < 2) return measured;
      entries = displaced; agreement = [...displaced]; displaced = [];
    } else {
      displaced = [];
      if (entries.length && at - entries[entries.length - 1].sample.envelope.observedAtMs < p.minimumSampleSpacingMs) return measured;
      entries.push(entry);
    }
    entries = entries.slice(-p.maximumSamples);
    const median = center(entries);
    const inliers = entries.filter((e) => Math.abs(e.cents - median) <= p.compatibilityCents);
    if (!inliers.length) return measured;
    const values = inliers.map((e) => e.cents), representative = quantile(values, 0.5);
    const span = coverage(inliers), p10 = quantile(values, 0.1), p90 = quantile(values, 0.9);
    const mad = quantile(values.map((v) => Math.abs(v - representative)), 0.5);
    const stable = inliers.length >= p.minimumSamples && span >= p.windowMs
      && p90 - p10 <= p.spreadCents + 1e-9 && mad <= p.madCents + 1e-9
      && agreement.filter((e) => Math.abs(e.cents - representative) <= p.compatibilityCents).length / agreement.length >= p.agreementFraction;
    measured = { status: stable ? "valid" : "insufficient", ambiguity: null, stable,
      tuning: !stable ? "unknown" : Math.abs(representative) <= p.greenCents + 1e-9 ? "within-band"
        : Math.abs(representative) <= p.yellowCents + 1e-9 ? "near-target" : "needs-adjustment",
      sampleCount: inliers.length, startMs: inliers[0].sample.envelope.observedAtMs, endMs: at,
      medianHz: reference.frequencyHz * 2 ** (representative / 1200), cents: representative,
      p10Cents: p10, p90Cents: p90, madCents: mad, driftCents: null, coverageMs: span,
      samples: stable ? inliers.map((e) => e.sample) : [] };
    return measured;
  }
  function progress(now: number) {
    const at = latest?.envelope.observedAtMs ?? null, observation = latest?.envelope.observation;
    const current = entries.filter((e) => now - e.sample.envelope.observedAtMs <= p.maximumAgeMs);
    const freshAnalysis = at !== null && now >= at && now - at <= MONOPHONIC_CONFIG.clearMs;
    const hz = latest ? reliableCalibrationFrequency(latest) : null;
    const ambiguity = hz === null ? null : calibrationAmbiguity(hz, reference);
    let blocker: ReturnType<ReturnType<typeof createPreciseCalibrationStability>["progress"]>["blocker"] = null;
    if (!freshAnalysis) blocker = "no-observations";
    else if (observation?.reason !== "usable") blocker = observation?.reason ?? "invalid";
    else if (ambiguity) blocker = ambiguity === "possible-harmonic-or-different-pitch" ? "harmonic" : "outside-fundamental";
    else if (hz === null) blocker = "invalid";
    else if (ringStart !== null && at! - ringStart < p.settlingMs) blocker = "settling";
    else if (current.length >= p.minimumSamples && agreement.length && agreement.filter((e) => Math.abs(e.cents - center(current)) <= p.compatibilityCents).length / agreement.length < p.agreementFraction) blocker = "spread";
    else if (displaced.length) blocker = "samples";
    else if (current.length < p.minimumSamples) blocker = "samples";
    else if (coverage(current) < p.windowMs) blocker = "span";
    else if (measured.p90Cents !== null && measured.p10Cents !== null && measured.p90Cents - measured.p10Cents > p.spreadCents) blocker = "spread";
    else if (measured.madCents !== null && measured.madCents > p.madCents) blocker = "spread";
    else if (measured.status === "insufficient") blocker = "spread";
    else if (measured.status === "valid" && measured.tuning !== "within-band") blocker = "out-of-band";
    return { sampleCount: current.length, coverageMs: coverage(current), requiredSamples: p.minimumSamples,
      requiredSpanMs: p.windowMs, blocker, resetCause: null, freshAnalysis };
  }
  return { update, reset, progress };
}
