import { INSIGHT_PITCH_NAMES, type ImprovInsightEvidence } from "./improv-insight-evidence";
export type ImprovTonalHypothesis = Readonly<{ label: string; tonicPitchClass: number; mode: "major" | "minor"; score: number; coverage: number }>;
export type ImprovTonalInsights = Readonly<{ status: "supported" | "ambiguous" | "insufficient"; hypotheses: readonly ImprovTonalHypothesis[]; reasons: readonly string[] }>;
const PROFILES = { major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
  minor: [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17] };
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const MINOR_TONICS = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "G♯", "A", "B♭", "B"] as const;

/** Profile similarity is a descriptive ranking, not calibrated key probability. */
export function analyzeImprovTonality(evidence: ImprovInsightEvidence): ImprovTonalInsights {
  const notes = evidence.notes.filter(note => note.channel !== 9 && note.pitchEligible), histogram = Array<number>(12).fill(0);
  for (const note of notes) histogram[note.pitch % 12] += 1 + (note.reliable ? Math.min(2000, note.endMs - note.startMs) / 2000 : 0);
  const total = histogram.reduce((a, b) => a + b, 0), mean = total / 12;
  const variance = histogram.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const hypotheses: ImprovTonalHypothesis[] = [];
  for (const mode of ["major", "minor"] as const) for (let tonic = 0; tonic < 12; tonic++) {
    const profile = PROFILES[mode], profileMean = profile.reduce((a, b) => a + b, 0) / 12;
    let covariance = 0, profileVariance = 0;
    for (let pitch = 0; pitch < 12; pitch++) {
      const centered = profile[(pitch - tonic + 12) % 12] - profileMean;
      covariance += (histogram[pitch] - mean) * centered; profileVariance += centered ** 2;
    }
    const correlation = variance > 0 ? covariance / Math.sqrt(variance * profileVariance) : 0;
    hypotheses.push({ label: `${mode === "minor" ? MINOR_TONICS[tonic] : INSIGHT_PITCH_NAMES[tonic]} ${mode}`, tonicPitchClass: tonic, mode,
      score: variance > 0 ? Math.max(0, Math.min(1, (1 + correlation) / 2)) : 0,
      coverage: total ? SCALES[mode].reduce((sum, pitch) => sum + histogram[(pitch + tonic) % 12], 0) / total : 0 });
  }
  hypotheses.sort((a, b) => b.score - a.score || a.tonicPitchClass - b.tonicPitchClass || a.mode.localeCompare(b.mode));
  const distinct = histogram.filter(Boolean).length, gap = hypotheses[0].score - hypotheses[1].score;
  const observedEnd = notes.reduce((end, note) => Math.max(end, note.reliable ? note.endMs : note.startMs), 0);
  const span = notes.length ? observedEnd - notes[0].startMs : 0;
  const insufficient = notes.length < 12 || distinct < 5 || span < 3000;
  const supported = !insufficient && variance > 0 && hypotheses[0].score >= 0.78 && gap >= 0.06 && hypotheses[0].coverage >= 0.85;
  const reasons = [
    `${notes.length} pitched attacks across ${distinct} pitch classes inform all 24 major/minor hypotheses.`,
    "Fit uses attack counts plus capped, unambiguous key-down duration; fit scores are not probabilities or a confirmed key.",
    "Coverage is duration-weighted attack support in major or natural-minor pitch classes. Harmonic and classical melodic-minor variants are not classified; raised sixth/seventh degrees may reduce coverage.",
    "MIDI pitch-class labels use display spellings; enharmonic spelling, key signatures, and harmonic function are not inferred.",
    "Pitch candidates use nominal MIDI notes with no observed pitch uncertainty; unknown initial instrument, tuning and controller state mean these are hypotheses, not verified sounding pitches.",
  ];
  const excludedPitchAttacks = evidence.notes.filter(note => note.channel !== 9 && !note.pitchEligible).length;
  if (excludedPitchAttacks) reasons.push(`${excludedPitchAttacks} attacks affected by pitch bend or unmodeled pitch/tuning behavior are excluded; their physical MIDI-pitch statistics remain available.`);
  if (insufficient) reasons.push("Too few attacks, too few distinct pitch classes, or less than three seconds of observed activity for a stable tonal hypothesis.");
  else if (!supported) reasons.push("The leading fits are too close, weak, or chromatic to distinguish a tonal center reliably; relative major/minor and modal alternatives remain possible.");
  else reasons.push(`${hypotheses[0].label} has the strongest separated profile fit; it remains a hypothesis and does not establish a key or modulation.`);
  return { status: insufficient ? "insufficient" : supported ? "supported" : "ambiguous", hypotheses, reasons };
}
