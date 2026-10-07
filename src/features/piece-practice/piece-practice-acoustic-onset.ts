import { MONOPHONIC_CONFIG, type PitchObservationEnvelope } from "@/lib/audio/monophonic/pitch-analysis-types";
import { centsBetween, describeFrequency } from "@/lib/audio/monophonic/pitch-math";
import type { AcousticAttack } from "./piece-practice-acoustic-types";
import { reliableAcousticObservation } from "./piece-practice-acoustic-validation";

/** Provisional physical-QA parameters; not an instrument-specific confidence model. */
export const ACOUSTIC_ARTICULATION = Object.freeze({ quietMs: 50, dipDb: 6, recoveryMs: 250, recoveryDb: 3 });

/** Never receives a target. A consumed sound remains consumed across score advancement. */
export function createAcousticOnsetDetector() {
  let generation: number | null = null, sequence = 0;
  let lastAt: number | null = null, lastAudio: number | null = null;
  let needsQuiet = true, quietArmed = false, consumedSemitone: number | null = null;
  let quiet: { since: number; count: number } | null = null;
  let candidate: { semitone: number; hz: number; since: number; count: number; peakDbfs: number } | null = null;
  let level: { at: number; dbfs: number } | null = null;
  let dip: { at: number; baselineDbfs: number; recovered: boolean } | null = null;

  const discardCandidate = () => { candidate = null; dip = null; };
  const reset = () => {
    lastAt = lastAudio = null; needsQuiet = true; quietArmed = false;
    consumedSemitone = null; quiet = null; candidate = null; level = null; dip = null;
  };

  function update(envelope: PitchObservationEnvelope): AcousticAttack | null {
    const { observation: raw, observedAtMs: at, audioSeconds, captureGeneration } = envelope;
    if (!Number.isFinite(at) || at < 0 || !Number.isFinite(audioSeconds) || audioSeconds < 0
      || !Number.isInteger(captureGeneration) || captureGeneration < 0) return null;
    if (generation !== null && captureGeneration < generation) return null;
    if (generation !== captureGeneration) { reset(); generation = captureGeneration; }
    if (lastAt !== null && (at <= lastAt || at - lastAt > MONOPHONIC_CONFIG.maxGapMs)
      || lastAudio !== null && audioSeconds <= lastAudio) {
      reset(); lastAt = at; lastAudio = audioSeconds; return null;
    }
    lastAt = at; lastAudio = audioSeconds;
    if (dip && at - dip.at > ACOUSTIC_ARTICULATION.recoveryMs) dip = null;

    if (raw.reason === "quiet" && Number.isFinite(raw.levelDbfs) && raw.levelDbfs < MONOPHONIC_CONFIG.minDbfs) {
      candidate = null; dip = null;
      quiet = quiet ? { since: quiet.since, count: quiet.count + 1 } : { since: at, count: 1 };
      if (quiet.count >= 2 && at - quiet.since >= ACOUSTIC_ARTICULATION.quietMs) {
        needsQuiet = false; quietArmed = true;
      }
      return null;
    }
    quiet = null;
    if (["invalid", "clipped", "clock-stalled", "out-of-range"].includes(raw.reason)
      || !Number.isFinite(raw.levelDbfs) || !Number.isFinite(raw.quality)) {
      candidate = null; dip = null; quietArmed = false; return null;
    }
    const periodicityLost = raw.reason === "aperiodic" || raw.reason === "low-periodicity";
    if (periodicityLost) {
      candidate = null;
      if (!needsQuiet && !quietArmed && !dip && level && at - level.at <= MONOPHONIC_CONFIG.maxGapMs
        && level.dbfs - raw.levelDbfs >= ACOUSTIC_ARTICULATION.dipDb) {
        dip = { at, baselineDbfs: level.dbfs, recovered: false };
      }
      return null;
    }
    const pitch = raw.frequencyHz === null ? null : describeFrequency(raw.frequencyHz);
    if (needsQuiet || raw.reason !== "usable" || !pitch || raw.quality < MONOPHONIC_CONFIG.minQuality
      || raw.levelDbfs < MONOPHONIC_CONFIG.minDbfs) { candidate = null; return null; }
    if (dip && raw.levelDbfs >= dip.baselineDbfs - ACOUSTIC_ARTICULATION.recoveryDb) dip.recovered = true;
    if (reliableAcousticObservation(envelope)) level = { at, dbfs: raw.levelDbfs };

    if (!candidate || candidate.semitone !== pitch.semitone || Math.abs(centsBetween(pitch.frequencyHz, candidate.hz)) > 25) {
      candidate = { semitone: pitch.semitone, hz: pitch.frequencyHz, since: at, count: 1, peakDbfs: raw.levelDbfs };
    } else { candidate.count++; candidate.peakDbfs = Math.max(candidate.peakDbfs, raw.levelDbfs); }
    if (candidate.peakDbfs - raw.levelDbfs >= 3) { candidate = null; return null; }
    const dwell = consumedSemitone !== null && Math.abs(consumedSemitone - pitch.semitone) === 12
      ? MONOPHONIC_CONFIG.octaveDwellMs : MONOPHONIC_CONFIG.acquisitionMs;
    if (candidate.count < 3 || at - candidate.since < dwell || !reliableAcousticObservation(envelope)) return null;

    const articulation: AcousticAttack["articulation"] | null = quietArmed
      ? consumedSemitone === null ? "initial-acquisition" : "after-quiet"
      : consumedSemitone !== null && pitch.semitone !== consumedSemitone ? "pitch-change"
        : dip?.recovered ? "reattack" : null;
    if (!articulation) return null;
    const attack = Object.freeze({ source: "microphone" as const, captureGeneration, sequence: sequence++,
      onsetObservedAtMs: articulation === "reattack" && dip ? dip.at : candidate.since,
      confirmedAtMs: at, frequencyHz: pitch.frequencyHz, nearestSemitone: pitch.semitone, articulation });
    consumedSemitone = pitch.semitone; quietArmed = false; candidate = null; dip = null;
    return attack;
  }
  return { update, reset, discardCandidate, needsQuiet: () => needsQuiet };
}
