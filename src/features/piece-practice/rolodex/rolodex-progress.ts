import { attributeProgramCalendarStart } from "../../practice-session/practice-program-calendar";
import type { ContinuousPolicy } from "../continuous/continuous-types";
import type { RolodexEntry } from "./rolodex-types";
import { EMPTY_PROGRESS, type RolodexAcceptance, type RolodexProgress, type RolodexProgressState, type RolodexRunSummary } from "./rolodex-progress-types";

const date = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 256;
const localDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && date(`${v}T00:00:00.000Z`);
function validatePolicy(p: ContinuousPolicy) {
  if (!p || p.version !== 1 || [p.associationCapMs, p.associationPulse, p.associationGap, p.onTimeCapMs, p.onTimePulse, p.onTimeGap].some(n => !Number.isFinite(n) || n <= 0)
    || p.associationGap >= 0.5 || p.onTimeGap > p.associationGap || p.onTimeCapMs > p.associationCapMs || p.onTimePulse > p.associationPulse) throw Error("Invalid qualification policy.");
}
export function validateAcceptance(a: RolodexAcceptance | null): void {
  if (a === null) return;
  if (!a || a.version !== 1 || !text(a.generation) || typeof a.enabled !== "boolean" || !date(a.acceptedAt) || !text(a.inputId)) throw Error("Invalid physical acceptance settings. Qualification remains unavailable.");
  validatePolicy(a.policy);
}
export function validateSummary(s: RolodexRunSummary): void {
  if (!s || s.version !== 1 || !(s.cycle === null || date(s.cycle)) || !text(s.attemptId) || !text(s.passageId) || !Number.isSafeInteger(s.prescriptionRevision) || s.prescriptionRevision < 1
    || !/^[a-f0-9]{64}$/.test(s.target) || s.instrument !== "piano" || s.mode !== "continuous" || s.inputSource !== "physical-midi" || !text(s.inputId)
    || !Number.isInteger(s.bpm) || s.bpm < 40 || s.bpm > 120 || !date(s.startedAt) || !date(s.endedAt) || !date(s.acknowledgedAt)
    || s.endedAt < s.startedAt || !["completed", "stopped", "failed", "interrupted"].includes(s.outcome)
    || !["clean", "non-clean", "inconclusive"].includes(s.determination) || typeof s.restored !== "boolean"
    || !Array.isArray(s.reasons) || s.reasons.length > 8 || !s.reasons.every(text)) throw Error("Invalid retained qualification evidence.");
  validatePolicy(s.policy); validateAcceptance(s.acceptance);
  const counts = [s.expected, s.matched, s.onTime, s.early, s.late, s.wrong, s.missing, s.extras, s.uncertain, s.unobserved, s.unreliableAttacks];
  if (counts.some(n => !Number.isSafeInteger(n) || n < 0 || n > 100000)
    || s.expected !== s.matched + s.wrong + s.missing + s.unobserved
    || s.matched !== s.onTime + s.early + s.late + s.uncertain) throw Error("Inconsistent retained pitch counts.");
  const conclusive = s.outcome === "completed" && s.expected > 0 && !s.uncertain && !s.unobserved && !s.unreliableAttacks;
  const clean = conclusive && s.expected === s.matched && s.expected === s.onTime && !s.extras;
  if (s.determination !== (clean ? "clean" : conclusive ? "non-clean" : "inconclusive")) throw Error("Inconsistent clean-run determination.");
  if (s.acceptance && (!s.acceptance.enabled || s.acceptance.inputId !== s.inputId || s.startedAt <= s.acceptance.acceptedAt
    || JSON.stringify(s.acceptance.policy) !== JSON.stringify(s.policy))) throw Error("Incompatible physical acceptance provenance.");
  if (s.calendar !== null) {
    const c = s.calendar;
    if (!c || !localDate(c.localDate) || c.utcStartedAt !== s.startedAt) throw Error("Invalid attempt calendar.");
    const [year, month, day] = c.localDate.split("-").map(Number);
    const reconstructed = attributeProgramCalendarStart({ year: year!, month: month!, day: day!, utcStartedAtMs: Date.parse(s.startedAt), timeZone: c.timeZone, utcOffsetMinutes: c.utcOffsetMinutes });
    if (JSON.stringify(reconstructed) !== JSON.stringify(c)) throw Error("Inconsistent attempt calendar.");
  }
  if (s.endLocalDate !== null && !localDate(s.endLocalDate)) throw Error("Invalid completion calendar.");
}
export const runOrder = (s: RolodexRunSummary) => `${s.startedAt}|${s.attemptId}`;
export function validateProgress(p: RolodexProgress): void {
  if (!p || p.version !== 1 || !(p.cycle === null || date(p.cycle)) || !Array.isArray(p.recent) || p.recent.length > 32 || !Array.isArray(p.pinned) || p.pinned.length > 4
    || !(p.cutoff === null || typeof p.cutoff === "string" && p.cutoff.length <= 282)
    || !(p.resetAt === null || date(p.resetAt))) throw Error("Unsupported or invalid Rolodex progress. Original data preserved.");
  [...p.recent, ...p.pinned].forEach(validateSummary);
  if (new Set(p.recent.map(s => s.attemptId)).size !== p.recent.length || new Set(p.pinned.map(s => s.attemptId)).size !== p.pinned.length) throw Error("Duplicate qualification evidence.");
  for (const s of p.pinned) {
    const recent = p.recent.find(r => r.attemptId === s.attemptId);
    if (recent && JSON.stringify(recent) !== JSON.stringify(s)) throw Error("Conflicting retained evidence.");
  }
  if (new TextEncoder().encode(JSON.stringify(p)).length > 96 * 1024) throw Error("Progress exceeds its 96 KiB application ceiling. A1 evidence remains separate.");
}
export function progressRuns(p: RolodexProgress): RolodexRunSummary[] {
  return [...new Map([...p.pinned, ...p.recent].map(s => [s.attemptId, s])).values()].sort((a, b) => runOrder(a).localeCompare(runOrder(b)));
}
/** Consecutive conclusive performances; unavailable evidence neither passes nor resets credit. */
export function progressState(entry: RolodexEntry, accepted?: RolodexAcceptance | null): RolodexProgressState {
  const p = entry.progress ?? EMPTY_PROGRESS;
  const eligible = progressRuns(p).filter(s => s.passageId === entry.id && s.prescriptionRevision === entry.prescriptionRevision
    && s.instrument === entry.practiceInstrument && entry.eligibleInstruments.includes(s.instrument) && s.mode === entry.mode && s.bpm === entry.bpm
    && JSON.stringify(s.policy) === JSON.stringify(entry.policy) && s.acceptance && s.calendar && s.endLocalDate
    && s.cycle === p.cycle && (accepted === undefined || !accepted?.enabled || s.acceptance.generation === accepted.generation));
  let clean: RolodexRunSummary[] = [], retained: RolodexRunSummary | null = null, context = "";
  for (const s of eligible) {
    const nextContext = `${s.target}:${s.inputId}:${s.acceptance!.generation}:${s.restored ? "restored" : "native"}`;
    if (nextContext !== context) { clean = []; retained = null; context = nextContext; }
    if (s.determination === "inconclusive") continue;
    if (retained) continue; // Historical retirement is changed only by explicit reactivation/configuration.
    if (s.determination === "non-clean") { clean = []; continue; }
    if (clean.length < 3) { clean.push(s); continue; }
    const third = clean[2]!;
    if (s.startedAt > third.endedAt && s.calendar!.localDate > third.endLocalDate!
      && s.calendar!.timeZone === third.calendar!.timeZone
      && (s.calendar!.timeZone !== null || s.calendar!.utcOffsetMinutes === third.calendar!.utcOffsetMinutes) && s.calendar!.localDate >= third.calendar!.localDate) retained = s;
  }
  return { stage: retained ? "mastered" : clean.length === 3 ? "retention" : clean.length ? "improving" : "needs-practice",
    clean, retained, dueAfter: clean.length === 3 ? clean[2]!.endLocalDate : null, restored: [...clean, ...(retained ? [retained] : [])].some(s => s.restored) };
}
export function appendProgress(entry: RolodexEntry, summary: RolodexRunSummary): RolodexProgress {
  validateSummary(summary);
  const old = entry.progress ?? EMPTY_PROGRESS;
  const existing = progressRuns(old).find(s => s.attemptId === summary.attemptId);
  if (existing) return old; // ACK observation/Retry time is not another performance.
  const late = !!old.cutoff && runOrder(summary) <= old.cutoff;
  // Compacted old successes cannot earn credit again. A late, conclusive contradiction
  // inside the pinned qualifying sequence must still invalidate that sequence.
  if (late && !(summary.determination === "non-clean" && old.pinned.some(s => !s.restored && s.target === summary.target
    && s.acceptance?.generation === summary.acceptance?.generation && runOrder(s) < runOrder(summary))
    && old.pinned.some(s => runOrder(s) > runOrder(summary)))) return old;
  const recent = [...old.recent, summary].sort((a, b) => runOrder(a).localeCompare(runOrder(b)));
  const state = progressState({ ...entry, progress: { ...old, recent } });
  let cutoff = old.cutoff;
  while (recent.length > 32) { const removed = runOrder(recent.shift()!); if (!cutoff || removed > cutoff) cutoff = removed; }
  const result = { ...old, recent, cutoff, pinned: [...state.clean, ...(state.retained ? [state.retained] : [])] };
  validateProgress(result); return result;
}
export function retentionDue(entry: RolodexEntry, localToday: string, timeZone: string | null, acceptance?: RolodexAcceptance | null): boolean {
  if (acceptance !== undefined && !acceptance?.enabled) return false;
  const state = progressState(entry, acceptance);
  return state.stage === "retention" && !!state.dueAfter && localToday > state.dueAfter && state.clean[2]!.calendar!.timeZone === timeZone;
}
