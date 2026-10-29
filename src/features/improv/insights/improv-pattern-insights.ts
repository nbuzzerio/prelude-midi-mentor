import { INSIGHT_CAPS, monophonicInsightRuns, type ImprovInsightEvidence, type InsightSpan, type InsightNote } from "./improv-insight-evidence";

export type ImprovMotif = Readonly<{
  label: string; intervals: readonly number[]; rhythmRatios: readonly number[];
  occurrences: readonly (InsightSpan & Readonly<{ transpositionSemitones: number }>)[]; evidence: readonly string[];
}>;
type Candidate = { notes: readonly InsightNote[]; intervals: number[]; rhythmRatios: number[]; occurrences: { startMs: number; endMs: number; transpositionSemitones: number }[] };

/** Fixed five-note windows and hash indexing bound work; no all-pairs motif comparisons. */
export function analyzeImprovPatterns(evidence: ImprovInsightEvidence): { motifs: readonly ImprovMotif[]; truncated: boolean } {
  const candidates = new Map<string, Candidate>(); let truncated = false;
  for (const run of monophonicInsightRuns(evidence.notes)) for (let i = 0; i <= run.length - 5; i++) {
    const notes = run.slice(i, i + 5);
    const intervals = notes.slice(1).map((note, k) => note.pitch - notes[k].pitch);
    const gaps = notes.slice(1).map((note, k) => note.startMs - notes[k].startMs);
    if (new Set(notes.map(note => note.pitch)).size < 3 || gaps.some(gap => gap < 80 || gap > 2000)) continue;
    const minimum = Math.min(...gaps), rhythmRatios = gaps.map(gap => Math.round(gap / minimum * 4) / 4);
    // Suppress commonplace stepwise runs, not every directional contour. Uniform
    // repeated leaps need rhythmic contrast; varied leap intervals can stand alone.
    const sameDirection = intervals.every(interval => interval > 0) || intervals.every(interval => interval < 0);
    if (sameDirection && intervals.every(interval => Math.abs(interval) <= 2)
      || new Set(intervals).size < 2 && new Set(rhythmRatios).size < 2) continue;
    const key = `${intervals.join(",")}|${rhythmRatios.join(",")}`;
    const candidate = candidates.get(key);
    if (!candidate) {
      candidates.set(key, { notes, intervals, rhythmRatios, occurrences: [{ startMs: notes[0].startMs, endMs: notes.at(-1)!.endMs, transpositionSemitones: 0 }] });
      continue;
    }
    if (notes[0].startMs < candidate.occurrences.at(-1)!.endMs) continue;
    if (candidate.occurrences.length < INSIGHT_CAPS.occurrencesPerMotif) candidate.occurrences.push({ startMs: notes[0].startMs, endMs: notes.at(-1)!.endMs,
      transpositionSemitones: notes[0].pitch - candidate.notes[0].pitch });
    else truncated = true;
  }
  const motifs: ImprovMotif[] = [];
  const occupied: InsightSpan[] = [];
  // First recurring window owns overlapping evidence, suppressing shifted duplicate motifs.
  for (const candidate of candidates.values()) {
    if (candidate.occurrences.length < 2) continue;
    const occurrences = candidate.occurrences.filter(occurrence => !occupied.some(span => occurrence.startMs < span.endMs && occurrence.endMs > span.startMs));
    if (occurrences.length < 2) continue;
    if (motifs.length >= INSIGHT_CAPS.motifs) { truncated = true; break; }
    const base = occurrences[0].transpositionSemitones;
    const normalized = occurrences.map(occurrence => ({ ...occurrence, transpositionSemitones: occurrence.transpositionSemitones - base }));
    occupied.push(...occurrences);
    const label = `Figure ${motifs.length + 1}`;
    motifs.push({ label,
      intervals: candidate.intervals, rhythmRatios: candidate.rhythmRatios, occurrences: normalized,
      evidence: [`${label}: ${normalized.some(occurrence => occurrence.transpositionSemitones !== 0) ? "repeated or transposed" : "repeated"} five-note pattern.`,
        "Five-note patterns share signed semitone intervals and relative inter-attack rhythm (quarter-unit ratio bins).",
        "At least two non-overlapping occurrences in clean key-monophonic runs; same-direction semitone/whole-tone steps and repeated-single-pitch coincidences are excluded.",
        "Directional figures with leaps are eligible; uniform repeated intervals require contrasting relative rhythm.",
        "This suggests a recurring gesture, not a compositional intention, named motive, or performance grade."] });
  }
  return { motifs, truncated };
}
