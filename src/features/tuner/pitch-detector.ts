import { TUNER_CONFIG, type PitchObservation } from "./tuner-pitch";

/** Direct MPM/NSDF. Reuses frame workspaces; receives samples, never owns capture. */
export function createPitchDetector() {
  const size = TUNER_CONFIG.frameSize;
  const signal = new Float64Array(size), curve = new Float64Array(size);
  return (frame: Float32Array, sampleRate: number): PitchObservation => {
    if (frame.length !== size || !Number.isFinite(sampleRate) || sampleRate < 8000) {
      throw new Error("Invalid pitch frame or sample rate.");
    }
    let sum = 0, clipped = 0;
    for (const value of frame) {
      if (!Number.isFinite(value)) return { frequencyHz: null, quality: 0, levelDbfs: -180, reason: "invalid" };
      sum += value;
      if (Math.abs(value) >= 0.99) clipped++;
    }
    const mean = sum / size;
    let energy = 0;
    for (let i = 0; i < size; i++) { signal[i] = frame[i] - mean; energy += signal[i] ** 2; }
    const levelDbfs = 20 * Math.log10(Math.max(Math.sqrt(energy / size), 1e-9));
    const reject = (reason: PitchObservation["reason"], quality = 0): PitchObservation =>
      ({ frequencyHz: null, quality, levelDbfs, reason });
    if (clipped / size >= 0.01) return reject("clipped");
    if (levelDbfs < TUNER_CONFIG.minDbfs) return reject("quiet");
    const maximum = Math.min(size >> 1, Math.ceil(sampleRate / TUNER_CONFIG.minHz) + 2);
    let denominator = 2 * energy;
    curve[0] = 1;
    for (let lag = 1; lag <= maximum; lag++) {
      denominator -= signal[lag - 1] ** 2 + signal[size - lag] ** 2;
      let correlation = 0;
      for (let i = 0; i < size - lag; i++) correlation += signal[i] * signal[i + lag];
      curve[lag] = denominator > 1e-12 ? 2 * correlation / denominator : 0;
    }
    // Include short periods, then reject high estimates; never force a subharmonic into range.
    const peaks: number[] = [];
    let pastZeroLobe = false, best = -1;
    for (let lag = 1; lag <= maximum; lag++) {
      if (curve[lag] <= 0) {
        pastZeroLobe = true;
        if (best >= 2) peaks.push(best);
        best = -1;
      } else if (pastZeroLobe && (best < 0 || curve[lag] > curve[best])) best = lag;
    }
    if (best >= 2 && best < maximum) peaks.push(best);
    const highest = peaks.reduce((value, lag) => Math.max(value, curve[lag]), 0);
    const index = peaks.find((lag) => curve[lag] >= TUNER_CONFIG.peakRatio * highest);
    if (index === undefined) return reject("aperiodic");
    const quality = Math.max(0, Math.min(1, curve[index]));
    const a = curve[index - 1], b = curve[index], c = curve[index + 1];
    const curvature = a - 2 * b + c;
    const period = index + (Math.abs(curvature) > 1e-12 ? Math.max(-1, Math.min(1, (a - c) / (2 * curvature))) : 0);
    const frequencyHz = sampleRate / period;
    if (!Number.isFinite(frequencyHz) || frequencyHz < TUNER_CONFIG.minHz || frequencyHz > TUNER_CONFIG.maxHz) return reject("out-of-range", quality);
    if (quality < TUNER_CONFIG.minQuality) return reject("low-periodicity", quality);
    return { frequencyHz, quality, levelDbfs, reason: "usable" };
  };
}
