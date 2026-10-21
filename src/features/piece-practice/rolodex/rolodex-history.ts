import type { RolodexEntry } from "./rolodex-types";
import { EMPTY_PROGRESS } from "./rolodex-progress-types";
import { progressRuns } from "./rolodex-progress";

export function comparableHistory(entry: RolodexEntry): string[] {
  const runs = progressRuns(entry.progress ?? EMPTY_PROGRESS).filter(s => s.prescriptionRevision === entry.prescriptionRevision && s.passageId === entry.id && s.outcome === "completed");
  const latest = runs.at(-1);
  if (!latest) return ["Not enough comparable practice history yet."];
  const earlier = runs.slice(0, -1).filter(s => s.target === latest.target && s.instrument === latest.instrument && s.mode === latest.mode && s.bpm === latest.bpm && s.expected === latest.expected);
  const previous = earlier.at(-1);
  if (!previous) return ["Not enough comparable practice history yet."];
  const lines = [`Last two comparable completed runs: correct pitches ${previous.matched} → ${latest.matched} of ${latest.expected}; missing ${previous.missing} → ${latest.missing}; wrong ${previous.wrong} → ${latest.wrong}; extra ${previous.extras} → ${latest.extras}.`];
  if (previous.inputId === latest.inputId && !previous.uncertain && !latest.uncertain && !previous.unreliableAttacks && !latest.unreliableAttacks && !previous.unobserved && !latest.unobserved) {
    lines.push(`Same physical MIDI device: confidently on-time pitches ${previous.onTime} → ${latest.onTime}. Timing thresholds remain subject to physical acceptance.`);
  } else lines.push("Timing comparison unavailable: device or timing reliability differs.");
  lines.push(`Performed ${previous.endedAt} and ${latest.endedAt}${previous.restored || latest.restored ? " · includes restored historical evidence" : ""}.`);
  return lines;
}
