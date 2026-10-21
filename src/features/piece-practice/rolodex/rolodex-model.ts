import { EMPTY_PROGRESS } from "./rolodex-progress-types";
import { validateProgress } from "./rolodex-progress";
import { parseStaffBuilderScore } from "@/features/staff-builder/persistence/staff-builder-schema";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import { projectStaffBuilderPieceForPractice } from "../piece-practice-projection";
import { CONTINUOUS_MAX_SCORE_BYTES, CONTINUOUS_POLICY, projectContinuousPassage } from "../continuous/continuous-projection";
import type { RolodexEntry, RolodexInstrument, RolodexPractice, RolodexSourceInstrument } from "./rolodex-types";

export const ROLODEX_LIMITS = Object.freeze({ entries: 256, scoreBytes: CONTINUOUS_MAX_SCORE_BYTES,
  recordBytes: 384 * 1024, totalBytes: 64 * 1024 * 1024, backupBytes: 64 * 1024 * 1024 });
export const instruments: readonly RolodexInstrument[] = ["piano", "violin", "ocarina"];
export const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
const date = (v: unknown): v is string => typeof v === "string" && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const text = (v: unknown, max = 256): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const instrument = (v: unknown): v is RolodexInstrument => instruments.includes(v as RolodexInstrument);
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export function validatePractice(p: RolodexPractice): void {
  if (!p || !text(p.attemptId) || !integer(p.prescriptionRevision) || p.prescriptionRevision < 1 || !date(p.endedAt)
    || !["completed", "stopped", "failed", "interrupted"].includes(p.outcome) || p.instrument !== "piano"
    || p.inputSource !== "physical-midi" || !(p.inputId === null || text(p.inputId))) throw Error("Invalid practice acknowledgement.");
}
export function parseEntry(value: unknown): RolodexEntry {
  if (!value || typeof value !== "object") throw Error("Invalid Rolodex entry.");
  const e = value as RolodexEntry;
  if (e.schemaVersion !== 1 && e.schemaVersion !== 2) throw Error("Unsupported Rolodex record version. Original data preserved.");
  if (!text(e.id) || !integer(e.revision) || e.revision < 1 || !integer(e.prescriptionRevision) || e.prescriptionRevision < 1
    || !text(e.sourceId) || !text(e.sourceTitle, 4096) || !date(e.sourceUpdatedAt) || !date(e.createdAt) || !date(e.updatedAt)
    || typeof e.nickname !== "string" || e.nickname.length > 120 || !["manual", "evidence-suggested"].includes(e.origin)
    || !["needs-practice", "improving", "paused", "archived"].includes(e.status) || typeof e.priority !== "boolean"
    || !(instrument(e.sourceInstrument) || e.sourceInstrument === "unknown")
    || !Array.isArray(e.eligibleInstruments) || !e.eligibleInstruments.length || e.eligibleInstruments.length > 3
    || !e.eligibleInstruments.every(instrument) || new Set(e.eligibleInstruments).size !== e.eligibleInstruments.length
    || !instrument(e.practiceInstrument) || !e.eligibleInstruments.includes(e.practiceInstrument)
    || e.mode !== "continuous" || !integer(e.bpm) || e.bpm < 40 || e.bpm > 120
    || !integer(e.start) || !integer(e.end) || e.end < e.start || e.end - e.start > 3) throw Error("Invalid Rolodex settings or range.");
  const p = e.policy;
  if (!p || p.version !== 1 || [p.associationCapMs, p.associationPulse, p.associationGap, p.onTimeCapMs, p.onTimePulse, p.onTimeGap].some(v => !Number.isFinite(v) || v <= 0)
    || p.associationGap >= 0.5 || p.onTimeGap > p.associationGap || p.onTimeCapMs > p.associationCapMs || p.onTimePulse > p.associationPulse) throw Error("Unsupported assessment policy.");
  const parsed = parseStaffBuilderScore(e.score);
  if (!parsed.ok || e.score.schemaVersion !== 4 || !projectStaffBuilderPieceForPractice(parsed.value).ok) throw Error("Resolve the source score's notation and rhythm validation before saving.");
  const score = parsed.value;
  const progress = e.schemaVersion === 1 ? EMPTY_PROGRESS : e.progress;
  validateProgress(progress!);
  if (e.sourceId !== score.id || e.sourceTitle !== score.title || e.sourceUpdatedAt !== score.updatedAt || e.end >= score.measures.length
    || stable(e.measureIds) !== stable(score.measures.slice(e.start, e.end + 1).map(m => m.id))
    || stable(e.measureNumbers) !== stable(Array.from({ length: e.end - e.start + 1 }, (_, i) => e.start + i + 1))) throw Error("The frozen source and range identities do not agree.");
  if (e.evidence !== null && (!e.evidence || !text(e.evidence.runId) || !integer(e.evidence.measureIndex) || e.evidence.measureIndex >= score.measures.length || !text(e.evidence.reasons, 2048))) throw Error("Invalid suggestion provenance.");
  if (e.origin === "evidence-suggested" && !e.evidence) throw Error("Missing suggestion evidence.");
  if (e.lastPractice !== null) { validatePractice(e.lastPractice); if (e.lastPractice.prescriptionRevision > e.prescriptionRevision) throw Error("Invalid practice revision."); }
  if (bytes(score) > ROLODEX_LIMITS.scoreBytes || bytes(e) > ROLODEX_LIMITS.recordBytes) throw Error("This passage exceeds the local application size ceiling.");
  return freeze(JSON.parse(JSON.stringify({ ...e, schemaVersion: 2, progress, score })) as RolodexEntry);
}
export function createEntry(score: StaffBuilderScore, sourceInstrument: RolodexSourceInstrument = "unknown",
  start = 0, end = Math.min(1, score.measures.length - 1), bpm = Math.max(40, Math.min(120, score.tempoBpm))): RolodexEntry {
  const now = new Date().toISOString();
  const chosen = sourceInstrument === "unknown" ? "piano" : sourceInstrument;
  return parseEntry({ schemaVersion: 2, progress: EMPTY_PROGRESS, id: crypto.randomUUID(), revision: 1, prescriptionRevision: 1,
    sourceId: score.id, sourceTitle: score.title, sourceUpdatedAt: score.updatedAt, score, start, end,
    measureIds: score.measures.slice(start, end + 1).map(m => m.id), measureNumbers: Array.from({ length: end - start + 1 }, (_, i) => start + i + 1),
    sourceInstrument, eligibleInstruments: [chosen], practiceInstrument: chosen, mode: "continuous", bpm,
    policy: CONTINUOUS_POLICY, nickname: "", origin: "manual", evidence: null, status: "needs-practice", priority: false,
    createdAt: now, updatedAt: now, lastPractice: null });
}
/** Music identity ignores library names/dates and generated IDs, retaining tie relationships and spelling. */
export function musicKey(score: StaffBuilderScore): string {
  const ids = new Map<string, string>();
  score.measures.forEach((m, i) => { ids.set(m.id, `m${i}`); m.events.forEach((e, j) => {
    ids.set(e.id, `m${i}e${j}`); if (e.kind === "notes") e.pitches.forEach((p, k) => ids.set(p.id, `m${i}e${j}p${k}`));
  }); });
  const normalize = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(normalize);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([k]) => k !== "id").map(([k, x]) => [k, normalize(x)]));
    return typeof v === "string" && ids.has(v) ? ids.get(v) : v;
  };
  return stable(normalize({ initialKeySignatureId: score.initialKeySignatureId, initialTimeSignature: score.initialTimeSignature,
    measures: score.measures, ties: score.ties, annotations: score.annotations }));
}
export const prescriptionKey = (e: RolodexEntry) => stable({ music: musicKey(e.score), start: e.start, end: e.end,
  eligible: [...e.eligibleInstruments].sort(), instrument: e.practiceInstrument, mode: e.mode, bpm: e.bpm, policy: e.policy });
export function editEntry(previous: RolodexEntry, changes: Partial<Pick<RolodexEntry, "nickname" | "start" | "end" | "sourceInstrument" | "eligibleInstruments" | "practiceInstrument" | "bpm" | "status" | "priority">>): RolodexEntry {
  const e = { ...previous, ...changes, revision: previous.revision + 1, updatedAt: new Date().toISOString() };
  e.measureIds = e.score.measures.slice(e.start, e.end + 1).map(m => m.id);
  e.measureNumbers = Array.from({ length: e.end - e.start + 1 }, (_, i) => e.start + i + 1);
  e.prescriptionRevision = previous.prescriptionRevision + (prescriptionKey(e) !== prescriptionKey(previous) ? 1 : 0);
  return parseEntry(e);
}
export function playablePassage(entry: RolodexEntry) {
  const e = parseEntry(entry);
  if (e.practiceInstrument !== "piano" || !e.eligibleInstruments.includes("piano")) throw Error("Continuous Tempo currently supports Piano with physical MIDI only. Edit eligibility and select Piano explicitly to opt in.");
  return projectContinuousPassage(e.score, e.start, e.end, e.bpm, e.policy);
}
export function playability(entry: RolodexEntry): string | null {
  try { playablePassage(entry); return null; } catch (error) { return error instanceof Error ? error.message : "This passage cannot currently be played."; }
}
export function sourceStatus(entry: RolodexEntry, sources: readonly StaffBuilderScore[]): string {
  const current = sources.find(s => s.id === entry.sourceId);
  if (!current) return "Original piece unavailable. Saved music is preserved.";
  return stable(current) === stable(entry.score) ? "" : "Original piece has changed. Saved music is preserved.";
}
