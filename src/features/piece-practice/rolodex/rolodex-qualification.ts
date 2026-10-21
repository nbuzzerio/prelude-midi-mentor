import { validateContinuousAttempt } from "../continuous/continuous-store";
import type { ContinuousAttempt } from "../continuous/continuous-types";
import type { ProgramCalendarAttribution } from "../../practice-session/practice-program-calendar";
import { parseEntry, playablePassage, stable } from "./rolodex-model";
import type { RolodexEntry } from "./rolodex-types";
import type { RolodexAcceptance, RolodexRunSummary } from "./rolodex-progress-types";

export async function targetFingerprint(entry: RolodexEntry): Promise<string> {
  const e = parseEntry(entry);
  const bytes = new TextEncoder().encode(stable({ score: e.score, range: [e.start, e.end], measures: e.measureIds,
    id: e.id, revision: e.prescriptionRevision, eligible: [...e.eligibleInstruments].sort(), instrument: e.practiceInstrument,
    mode: e.mode, bpm: e.bpm, policy: e.policy }));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
}
export function acceptanceMatches(a: RolodexAcceptance | null, inputId: string, policy: unknown, startedAt: string): boolean {
  return !!a?.enabled && a.inputId === inputId && stable(a.policy) === stable(policy) && startedAt > a.acceptedAt;
}
/** Called only after native terminal acknowledgement. No new musical scoring occurs here. */
export async function summarizeAcknowledged(entry: RolodexEntry, attempt: ContinuousAttempt,
  calendar: ProgramCalendarAttribution | null, endLocalDate: string | null,
  acceptance: RolodexAcceptance | null, acknowledgedAt: string): Promise<RolodexRunSummary> {
  validateContinuousAttempt(attempt);
  if (attempt.status === "started" || !attempt.endedAt || !attempt.assessment) throw Error("Native terminal acknowledgement is required.");
  if (stable(playablePassage(entry)) !== stable(attempt.passage)) throw Error("The native performance has a different frozen prescription.");
  const a = attempt.assessment;
  const reasons: string[] = [];
  const unreliableAttacks = attempt.attacks.filter(a => a.uncertaintyMs === null).length;
  const complete = attempt.status === "completed" && !!attempt.performanceStartedAt
    && attempt.observedThroughMs >= attempt.passage.durationMs + attempt.passage.tailMs;
  if (!complete) reasons.push("The entire performance was not completed.");
  if (!a.expected) reasons.push("No expected pitch attacks were assessed.");
  if (a.uncertain || a.unobserved || unreliableAttacks) reasons.push("Required timing or observation evidence is unavailable.");
  const conclusive = complete && a.expected > 0 && !a.uncertain && !a.unobserved && !unreliableAttacks;
  const clean = conclusive && a.matched === a.expected && a.onTime === a.expected
    && !a.wrong && !a.missing && !a.extras.length && !a.early && !a.late;
  if (conclusive && !clean) reasons.push("The completed pitch-and-onset target was not clean.");
  const accepted = acceptanceMatches(acceptance, attempt.input.id!, entry.policy, attempt.startedAt) ? acceptance : null;
  if (!accepted) reasons.push("Provisional: physical timing acceptance was not active for this attempt.");
  if (!calendar || !endLocalDate) reasons.push("Local calendar provenance is unavailable; no automatic progression.");
  return { version: 1, cycle: entry.progress?.cycle ?? null, attemptId: attempt.id, passageId: entry.id, prescriptionRevision: entry.prescriptionRevision,
    target: await targetFingerprint(entry), instrument: "piano", mode: "continuous", inputSource: "physical-midi",
    inputId: attempt.input.id!, bpm: entry.bpm, policy: entry.policy, startedAt: attempt.startedAt, endedAt: attempt.endedAt,
    acknowledgedAt, calendar, endLocalDate, outcome: attempt.status,
    expected: a.expected, matched: a.matched, onTime: a.onTime, early: a.early, late: a.late,
    unreliableAttacks, wrong: a.wrong, missing: a.missing, extras: a.extras.length, uncertain: a.uncertain, unobserved: a.unobserved,
    determination: clean ? "clean" : conclusive ? "non-clean" : "inconclusive", reasons, acceptance: accepted, restored: false };
}
