import { immutableCopy, type ImprovLoadedTake } from "../improv-library";
import { collectImprovInsightEvidence, INSIGHT_CAPS, type ImprovInsightEvidence } from "./improv-insight-evidence";
import { analyzeImprovTonality, type ImprovTonalInsights } from "./improv-tonal-insights";
import { analyzeImprovHarmony, type ImprovHarmonicRegion } from "./improv-harmonic-insights";
import { analyzeImprovPatterns, type ImprovMotif } from "./improv-pattern-insights";

export type ImprovMusicalInsights = Readonly<{
  version: 1; overview: ImprovInsightEvidence["overview"]; tonal: ImprovTonalInsights;
  harmony: readonly ImprovHarmonicRegion[]; phrases: ImprovInsightEvidence["phrases"]; rests: ImprovInsightEvidence["rests"];
  motifs: readonly ImprovMotif[]; limitations: readonly string[];
  caps: Readonly<typeof INSIGHT_CAPS & { truncated: readonly string[] }>;
}>;

/** Ephemeral versioned interpretation; never persisted into or used to rewrite raw evidence. */
export function analyzeImprovTake(take: ImprovLoadedTake): ImprovMusicalInsights {
  const evidence = collectImprovInsightEvidence(take), harmony = analyzeImprovHarmony(evidence), patterns = analyzeImprovPatterns(evidence);
  const truncated = [...evidence.truncated, ...(harmony.truncated ? ["harmony"] : []), ...(patterns.truncated ? ["motifs or motif occurrences"] : [])];
  return immutableCopy({ version: 1, overview: evidence.overview, tonal: analyzeImprovTonality(evidence), harmony: harmony.regions,
    phrases: evidence.phrases, rests: evidence.rests, motifs: patterns.motifs,
    limitations: [...evidence.limitations,
      "Phrase boundaries mark observed activity separated by at least 1.2 seconds of released-key space or a capture boundary; they are not a formal phrase analysis.",
      "Chord labels require complete exact triad/seventh sets; incomplete voicings, dense textures, and uncertain note lifetimes are omitted. Symmetric pitch sets retain root alternatives.",
      "Motif search uses five-note interval/rhythm windows only and omits polyphonic, pedal-down, uncertain, and cross-boundary patterns.",
      "Motif search suppresses same-direction semitone/whole-tone steps; directional figures with leaps remain eligible. Uniform repeated intervals require contrasting relative rhythm.",
      ...(truncated.length ? [`Output limits reached: ${truncated.join(", ")}. Full-journal evidence is still analyzed; tonal statistics use eligible pitched attacks.`] : [])],
    caps: { ...INSIGHT_CAPS, truncated } });
}
