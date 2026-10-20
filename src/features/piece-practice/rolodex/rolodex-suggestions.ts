import { hydratePiecePracticeRun, parsePiecePracticeRun } from "../persistence/piece-practice-runs";
import { selectPiecePracticeTargetedPractice } from "../piece-practice-targeted-practice";
import { createEntry, parseEntry } from "./rolodex-model";
import type { RolodexEntry } from "./rolodex-types";

/** Only acknowledged, validated completed runs; ranking and evidence definitions remain native. */
export function rolodexSuggestions(records: readonly unknown[]): readonly RolodexEntry[] {
  const runs = records.map(parsePiecePracticeRun).filter(r => r.ok && r.record.status === "completed");
  const suggestions: RolodexEntry[] = [];
  for (const parsed of runs) {
    if (!parsed.ok) continue;
    const { record } = parsed;
    const state = hydratePiecePracticeRun(record, 0);
    for (const measure of selectPiecePracticeTargetedPractice(state)) {
      if (suggestions.length === 3) return suggestions;
      const config = record.configuration.inputConfiguration;
      try {
        const entry = createEntry(record.sourceScore, config.mode === "microphone" ? config.instrument : "unknown", measure.measureIndex, measure.measureIndex);
        const reasons = `${measure.mistakeCount} mistakes, ${measure.skippedTargetCount} skipped targets, ${measure.restartCount} restarts, ${measure.hesitationCount} recorded slow responses`;
        suggestions.push(parseEntry({ ...entry, origin: "evidence-suggested", evidence: { runId: record.runId, measureIndex: measure.measureIndex, reasons } }));
      } catch { /* Oversized/unsupported snapshots stay in their original history. */ }
    }
  }
  return suggestions;
}
