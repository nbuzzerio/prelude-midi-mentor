import { hydratePiecePracticeRun, parsePiecePracticeRun } from "../persistence/piece-practice-runs";
import { PIECE_PRACTICE_TARGETED_PRACTICE_PRIORITY, selectPiecePracticeTargetedPractice } from "../piece-practice-targeted-practice";
import { createEntry, parseEntry, stable } from "./rolodex-model";
import type { RolodexEntry } from "./rolodex-types";

/** Only acknowledged, validated completed runs; ranking and evidence definitions remain native. */
export function rolodexSuggestions(records: readonly unknown[]): readonly RolodexEntry[] {
  const runs = records.map(parsePiecePracticeRun).filter(r => r.ok && r.record.status === "completed");
  const suggestions: RolodexEntry[] = [];
  const candidates = runs.flatMap(parsed => {
    if (!parsed.ok) return [];
    const { record } = parsed;
    const sourceKey = stable(record.sourceScore);
    return selectPiecePracticeTargetedPractice(hydratePiecePracticeRun(record, 0))
      .map(measure => ({ record, measure, sourceKey }));
  }).sort((left, right) => {
    for (const signal of PIECE_PRACTICE_TARGETED_PRACTICE_PRIORITY) {
      const difference = right.measure[signal] - left.measure[signal];
      if (difference) return difference;
    }
    const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
    return compare(left.sourceKey, right.sourceKey)
      || left.measure.measureIndex - right.measure.measureIndex
      || compare(left.record.runId, right.record.runId)
      || right.record.revision - left.record.revision;
  });
  const seen = new Set<string>();
  for (const { record, measure, sourceKey } of candidates) {
      if (suggestions.length === 3) return suggestions;
      const key = stable([sourceKey, measure.sourceMeasureId]);
      if (seen.has(key)) continue;
      const config = record.configuration.inputConfiguration;
      try {
        const entry = createEntry(record.sourceScore, config.mode === "microphone" ? config.instrument : "unknown", measure.measureIndex, measure.measureIndex);
        const reasons = `${measure.mistakeCount} mistakes, ${measure.skippedTargetCount} skipped targets, ${measure.restartCount} restarts, ${measure.hesitationCount} recorded slow responses`;
        suggestions.push(parseEntry({ ...entry, origin: "evidence-suggested", evidence: { runId: record.runId, measureIndex: measure.measureIndex, reasons } }));
        seen.add(key);
      } catch { /* Oversized/unsupported snapshots stay in their original history. */ }
  }
  return suggestions;
}
