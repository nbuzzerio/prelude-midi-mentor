import { hydratePiecePracticeRun, parsePiecePracticeRun } from "../persistence/piece-practice-runs";
import { PIECE_PRACTICE_TARGETED_PRACTICE_PRIORITY, selectPiecePracticeTargetedPractice } from "../piece-practice-targeted-practice";
import { createEntry, parseEntry, prescriptionKey, stable } from "./rolodex-model";
import type { RolodexEntry } from "./rolodex-types";

/** Only acknowledged, validated completed runs; ranking and evidence definitions remain native. */
export function rolodexSuggestions(records: readonly unknown[], saved: readonly RolodexEntry[] = [], dismissed: ReadonlySet<string> = new Set()): readonly RolodexEntry[] {
  return collectSuggestions(records, saved, dismissed, 3);
}

function collectSuggestions(records: readonly unknown[], saved: readonly RolodexEntry[], dismissed: ReadonlySet<string>, limit: number): readonly RolodexEntry[] {
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
      if (suggestions.length === limit) return suggestions;
      const key = stable([sourceKey, measure.sourceMeasureId]);
      if (seen.has(key)) continue;
      const config = record.configuration.inputConfiguration;
      try {
        const entry = createEntry(record.sourceScore, config.mode === "microphone" ? config.instrument : "unknown", measure.measureIndex, measure.measureIndex);
        const reasons = `${measure.mistakeCount} mistakes, ${measure.skippedTargetCount} skipped targets, ${measure.restartCount} restarts, ${measure.hesitationCount} recorded slow responses`;
        const suggestion = parseEntry({ ...entry, origin: "evidence-suggested", evidence: { runId: record.runId, measureIndex: measure.measureIndex, reasons } });
        seen.add(key);
        if (dismissed.has(prescriptionKey(suggestion)) || saved.some(e => prescriptionKey(e) === prescriptionKey(suggestion))) continue;
        suggestions.push(suggestion);
      } catch { /* Oversized/unsupported snapshots stay in their original history. */ }
  }
  return suggestions;
}

/** Recheck the selected run, not today's ranking or the mutable source library. */
export function validateSuggestion(entry: RolodexEntry, records: readonly unknown[]): void {
  const checked = parseEntry(entry);
  const evidence = checked.evidence;
  if (checked.origin !== "evidence-suggested" || !evidence
    || evidence.measureIndex < checked.start || evidence.measureIndex > checked.end) {
    throw Error("Keep the evidence measure in the suggested passage range.");
  }
  const attributed = records.filter(raw => {
    const parsed = parsePiecePracticeRun(raw);
    return parsed.ok && parsed.record.runId === evidence.runId;
  });
  const matches = collectSuggestions(attributed, [], new Set(), Infinity).some(candidate =>
    stable(candidate.score) === stable(checked.score) && stable(candidate.evidence) === stable(evidence));
  if (!matches) throw Error("Suggestion evidence changed or is unavailable. Cancel and reload saved suggestions before saving.");
}
