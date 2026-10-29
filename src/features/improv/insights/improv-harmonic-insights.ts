import { INSIGHT_CAPS, INSIGHT_PITCH_NAMES, monophonicInsightRuns, type ImprovInsightEvidence, type InsightSpan } from "./improv-insight-evidence";

export type ImprovHarmonicRegion = InsightSpan & Readonly<{ label: string; kind: "held" | "arpeggiated"; evidence: readonly string[] }>;
const CHORDS = [
  { name: "major", intervals: [0, 4, 7] }, { name: "minor", intervals: [0, 3, 7] },
  { name: "diminished", intervals: [0, 3, 6] }, { name: "augmented", intervals: [0, 4, 8] },
  { name: "dominant seventh", intervals: [0, 4, 7, 10] }, { name: "major seventh", intervals: [0, 4, 7, 11] },
  { name: "minor seventh", intervals: [0, 3, 7, 10] }, { name: "half-diminished seventh", intervals: [0, 3, 6, 10] },
  { name: "minor-major seventh", intervals: [0, 3, 7, 11] },
  { name: "diminished seventh", intervals: [0, 3, 6, 9] },
] as const;
const labelsByMask = new Map<number, string[]>();
for (const chord of CHORDS) for (let root = 0; root < 12; root++) {
  const mask = chord.intervals.reduce<number>((value, interval) => value | (1 << ((root + interval) % 12)), 0);
  labelsByMask.set(mask, [...(labelsByMask.get(mask) ?? []), `${INSIGHT_PITCH_NAMES[root]} ${chord.name}`]);
}
const labelFor = (mask: number) => {
  const labels = labelsByMask.get(mask);
  // Preserve all root alternatives for symmetric or enharmonically ambiguous pitch sets.
  return labels ? labels.join(" / ") : null;
};

export function analyzeImprovHarmony(evidence: ImprovInsightEvidence): { regions: readonly ImprovHarmonicRegion[]; truncated: boolean } {
  const regions: ImprovHarmonicRegion[] = []; let truncated = false;
  const push = (region: ImprovHarmonicRegion) => {
    if (regions.length < INSIGHT_CAPS.harmony) regions.push(region); else truncated = true;
  };
  // Sweep physical key lifetimes; exact pitch-class sets only, never chord subsets of a dense cluster.
  const edges = evidence.notes.flatMap(note => [{ atMs: note.startMs, delta: 1, note }, { atMs: note.endMs, delta: -1, note }])
    .sort((a, b) => a.atMs - b.atMs || a.delta - b.delta);
  const counts = Array<number>(12).fill(0), segments = new Map<number, number>(); let invalid = 0;
  let pending: { startMs: number; endMs: number; label: string; segment: number; mask: number } | null = null;
  const flush = () => {
    if (pending && pending.endMs - pending.startMs >= 80) {
      const { startMs, endMs, label, mask } = pending;
      push({ startMs, endMs, label, kind: "held", evidence: [
        `Complete pitch-class set ${INSIGHT_PITCH_NAMES.filter((_, pitch) => mask & (1 << pitch)).join(", ")} held on physical keys for ${Math.round(endMs - startMs)} ms; no extra pitch classes.`,
        "Root spelling is provisional; pedal-retained tones and harmonic function are not inferred.",
        ...(label.includes(" / ") ? ["This symmetric or enharmonically ambiguous pitch set has multiple possible roots; no root is selected."] : []),
      ] });
    }
    pending = null;
  };
  let index = 0;
  while (index < edges.length) {
    const atMs = edges[index].atMs;
    while (index < edges.length && edges[index].atMs === atMs) {
      const { delta, note } = edges[index++];
      if (note.endMs <= note.startMs) continue;
      counts[note.pitch % 12] += delta;
      const count = (segments.get(note.segment) ?? 0) + delta;
      if (count) segments.set(note.segment, count); else segments.delete(note.segment);
      if (!note.inferenceEligible || note.channel === 9) invalid += delta;
    }
    const endMs = edges[index]?.atMs ?? atMs;
    if (invalid || segments.size !== 1 || endMs <= atMs) { flush(); continue; }
    const mask = counts.reduce((value, count, pitch) => count > 0 ? value | (1 << pitch) : value, 0);
    const label = labelFor(mask);
    if (!label) { flush(); continue; }
    const segment = segments.keys().next().value!;
    if (pending && pending.label === label && pending.segment === segment && pending.endMs === atMs) pending.endMs = endMs;
    else { flush(); pending = { startMs: atMs, endMs, label, segment, mask }; }
  }
  flush();
  for (const run of monophonicInsightRuns(evidence.notes)) {
    for (let i = 0; i < run.length - 2; i++) {
      for (const size of [4, 3]) {
        if (i + size > run.length) continue;
        const window = run.slice(i, i + size);
        if (window.at(-1)!.endMs - window[0].startMs > 4000 || window.some((note, k) => k > 0 && note.startMs - window[k - 1].startMs > 800)) continue;
        if (new Set(window.map(note => note.pitch % 12)).size !== size) continue;
        const label = labelFor(window.reduce((mask, note) => mask | (1 << (note.pitch % 12)), 0));
        if (!label) continue;
        push({ startMs: window[0].startMs, endMs: window.at(-1)!.endMs, label, kind: "arpeggiated", evidence: [
          `${size} consecutive, individually released MIDI notes (${window.map(note => note.pitch).join(", ")}) outline a complete chord in a clean key-monophonic run.`,
          "This is an arpeggio-like pitch-set hypothesis, not a simultaneous chord or confirmed harmonic function.",
          ...(label.includes(" / ") ? ["This symmetric or enharmonically ambiguous pitch set has multiple possible roots; no root is selected."] : []),
        ] });
        i += size - 1; break;
      }
    }
  }
  regions.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  return { regions, truncated };
}
