import { parseEntry, playablePassage } from "../piece-practice/rolodex/rolodex-model";
import type { RolodexEntry } from "../piece-practice/rolodex/rolodex-types";
import type { ContinuousAttempt, ContinuousPassage } from "../piece-practice/continuous/continuous-types";
import type { RepertoirePreference } from "./practice-repertoire-preferences";

export type LessonRepertoire = Readonly<{ id: string; entry: RolodexEntry; passage: ContinuousPassage }>;
export type RepertoireEvidence = Readonly<{
  occurrence: LessonRepertoire; skipped: boolean; attempts: readonly ContinuousAttempt[];
  pending: boolean; datePending: number; dateFailed: number;
}>;
const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function recency(entry: RolodexEntry): number {
  const practice = entry.lastPractice;
  if (!practice || practice.prescriptionRevision !== entry.prescriptionRevision || practice.instrument !== "piano"
    || practice.inputSource !== "physical-midi" || !practice.attemptId) return -Infinity;
  const date = Date.parse(practice.endedAt);
  return Number.isFinite(date) ? date : -Infinity;
}

/** No adaptation and no device inference. Store reads must have completed before calling. */
export function selectLessonRepertoire(entries: readonly RolodexEntry[], preference: RepertoirePreference): RolodexEntry | null {
  if (!preference.enabled || !preference.instruments.includes("piano")) return null;
  const eligible = entries.filter(entry => {
    if (entry.status !== "needs-practice" && entry.status !== "improving") return false;
    if (entry.practiceInstrument !== "piano" || !entry.eligibleInstruments.includes("piano") || entry.mode !== "continuous") return false;
    try { playablePassage(parseEntry(entry)); return true; } catch { return false; }
  });
  eligible.sort((a, b) => Number(b.priority) - Number(a.priority)
    || (recency(a) === recency(b) ? 0 : recency(a) < recency(b) ? -1 : 1)
    || compareText(a.createdAt, b.createdAt) || compareText(a.id, b.id));
  return eligible[0] ?? null;
}

export function freezeLessonRepertoire(entry: RolodexEntry, id: string = crypto.randomUUID()): LessonRepertoire {
  const frozen = parseEntry(structuredClone(entry));
  return { id, entry: frozen, passage: playablePassage(frozen) };
}

/** Retry replaces evidence for the same native identity; Replay has a different identity. */
export function acknowledgeRepertoire(attempts: readonly ContinuousAttempt[], attempt: ContinuousAttempt): readonly ContinuousAttempt[] {
  if (attempt.status === "started" || !attempt.endedAt) return attempts;
  return [...attempts.filter(value => value.id !== attempt.id), structuredClone(attempt)];
}
