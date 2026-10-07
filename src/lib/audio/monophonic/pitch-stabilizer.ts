import { centsBetween, describeFrequency, equalTemperedFrequency } from "./pitch-math";
import { MONOPHONIC_CONFIG, type PitchObservation, type PitchSnapshot, type TrackedPitch } from "./pitch-analysis-types";

export function createPitchStabilizer() {
  let lastRead: number | null = null, lastAudio: number | null = null, credibleAt: number | null = null;
  let tracked: TrackedPitch | null = null, reliable = false;
  let candidate: { semitone: number; frequencyHz: number; since: number; count: number; peakDbfs: number } | null = null;
  let levels: { at: number; dbfs: number }[] = [];
  const reset = () => { lastRead = lastAudio = credibleAt = tracked = candidate = null; reliable = false; levels = []; };
  function snapshot(nowMs: number): PitchSnapshot {
    const ageMs = credibleAt === null ? null : Math.max(0, nowMs - credibleAt);
    const pitch = tracked && ageMs !== null && ageMs <= MONOPHONIC_CONFIG.clearMs ? { ...tracked } : null;
    const fresh = Boolean(pitch && reliable && candidate === null && ageMs !== null && ageMs <= MONOPHONIC_CONFIG.staleMs);
    return { state: fresh ? "stable" : candidate ? "acquiring" : pitch ? "uncertain" : "listening", pitch, fresh, ageMs };
  }
  function update(observation: PitchObservation, nowMs: number, audioSeconds: number): PitchSnapshot {
    if (!Number.isFinite(nowMs) || !Number.isFinite(audioSeconds)) throw new Error("Finite tuner clocks required.");
    if (lastRead !== null && nowMs < lastRead) reset();
    if (lastAudio !== null && audioSeconds <= lastAudio) { candidate = null; reliable = false; return snapshot(nowMs); }
    if (lastRead !== null && nowMs - lastRead > MONOPHONIC_CONFIG.maxGapMs) reset();
    lastRead = nowMs; lastAudio = audioSeconds;
    if (credibleAt !== null && nowMs - credibleAt > MONOPHONIC_CONFIG.clearMs) { tracked = null; reliable = false; }
    const recentLevels = levels.filter(({ at }) => nowMs - at <= MONOPHONIC_CONFIG.acquisitionMs);
    const decaying = recentLevels.some(({ dbfs }) => dbfs - observation.levelDbfs >= 3);
    levels = [...recentLevels, { at: nowMs, dbfs: observation.levelDbfs }].slice(-8);
    const pitch = observation.frequencyHz === null ? null : describeFrequency(observation.frequencyHz);
    if (observation.reason !== "usable" || !pitch || observation.quality < MONOPHONIC_CONFIG.minQuality || observation.levelDbfs < MONOPHONIC_CONFIG.minDbfs || decaying) {
      candidate = null; reliable = false;
      return snapshot(nowMs);
    }
    const hz = pitch.frequencyHz;
    if (tracked && reliable && credibleAt !== null && nowMs - credibleAt <= MONOPHONIC_CONFIG.staleMs && Math.abs(centsBetween(hz, equalTemperedFrequency(tracked.semitone))) <= 60) {
      candidate = null; credibleAt = nowMs;
      tracked = { ...tracked, frequencyHz: 2 ** (0.5 * Math.log2(hz) + 0.5 * Math.log2(tracked.frequencyHz)) };
    } else {
      if (!candidate || candidate.semitone !== pitch.semitone || Math.abs(centsBetween(hz, candidate.frequencyHz)) > 25) {
        candidate = { semitone: pitch.semitone, frequencyHz: hz, since: nowMs, count: 1, peakDbfs: observation.levelDbfs };
      } else { candidate.count++; candidate.peakDbfs = Math.max(candidate.peakDbfs, observation.levelDbfs); }
      if (candidate.peakDbfs - observation.levelDbfs >= 3) { candidate = null; reliable = false; return snapshot(nowMs); }
      const octave = tracked && Math.abs(pitch.semitone - tracked.semitone) === 12;
      if (candidate.count >= 3 && nowMs - candidate.since >= (octave ? MONOPHONIC_CONFIG.octaveDwellMs : MONOPHONIC_CONFIG.acquisitionMs)) {
        tracked = { semitone: pitch.semitone, frequencyHz: hz }; credibleAt = nowMs; candidate = null; reliable = true;
      }
    }
    return snapshot(nowMs);
  }
  return { update, snapshot, reset };
}
