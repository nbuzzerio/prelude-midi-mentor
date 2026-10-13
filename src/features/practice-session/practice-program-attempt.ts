import { selectFlashcardPracticeReport } from "@/features/flashcards/flashcard-practice-result";
import { selectSequencePracticeReport } from "@/features/sequences/sequence-practice-result";
import { selectEarTrainingPracticeReport } from "@/features/ear-training/ear-training-practice-result";
import { selectMelodyPracticeReport } from "@/features/melody/melody-practice-result";
import type { PracticeSessionEngineResult } from "./practice-session-engine-result";
import type { PracticeExerciseEntry } from "./practice-session-types";
import type { PracticeProgramRevision } from "./practice-program-types";
import { validProgramId } from "./practice-program-types";
import { parsePracticeExerciseEntry } from "./practice-session-validation";
import { attributeProgramCalendarStart, programCalendarWeek, type ProgramCalendarAttribution } from "./practice-program-calendar";

export const PROGRAM_ATTEMPT_LIMITS = Object.freeze({ records: 10_000, queue: 100, durationMs: 24 * 60 * 60 * 1000, checkpointMs: 5_000, leaseMs: 30_000 });
export type ProgramOccurrence = Readonly<{ occurrenceId: string; exerciseId: string }>;
export type ProgramMetricSummary = Readonly<{
  schemaVersion: 1; engine: PracticeExerciseEntry["engine"];
  completedUnits: number; incorrectResponses: number | null; firstTryUnits: number | null;
  averageResponseDurationMs: number | null; completedRepertoire: number | null;
  sources: readonly ("midi" | "virtual" | "simulation")[] | null;
  pitchPercent: number | null; timingPercent: number | null; movementPercent: number | null;
}>;
type RecordBase = Readonly<{
  schemaVersion: 1; recordId: string; programId: string; programRevision: number; programTitle: string;
  exerciseId: string; occurrenceId: string; exercise: PracticeExerciseEntry;
  weeklyTarget: number | null; coverageTarget: number | null; calendar: ProgramCalendarAttribution;
  policyVersion: "native-hosted-v1"; metricsVersion: 1;
}>;
export type ProgramAttempt = RecordBase & Readonly<{
  kind: "attempt"; attemptId: string; ownerId: string; writeVersion: number; leaseUntilMs: number;
  outcome: "in-progress" | "completed" | "stopped-early" | "interrupted";
  closed: boolean; updatedAt: string; endedAt: string | null;
  activeDurationMs: number; prescribedDurationMs: number; bonusDurationMs: number;
  prescribedUnits: number; bonusUnits: number; metrics: ProgramMetricSummary | null; targetMetrics: ProgramMetricSummary | null;
}>;
export type ProgramSkip = RecordBase & Readonly<{ kind: "skip"; skippedAt: string }>;
export type ProgramHistoryRecord = ProgramAttempt | ProgramSkip;

export function programCalendarNow(atMs: number): ProgramCalendarAttribution {
  const date = new Date(atMs); let timeZone: string | null = null;
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { /* Offset/date remain available. */ }
  return attributeProgramCalendarStart({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), utcStartedAtMs: atMs, utcOffsetMinutes: -date.getTimezoneOffset(), timeZone });
}
export function createProgramRecordBase(program: PracticeProgramRevision, occurrence: ProgramOccurrence, recordId: string, calendar: ProgramCalendarAttribution): RecordBase {
  const index = program.program.exercises.findIndex(exercise => exercise.id === occurrence.exerciseId);
  if (index < 0 || !validProgramId(occurrence.occurrenceId) || !validProgramId(recordId)) throw Error("Invalid pool selection identity.");
  return structuredClone({ schemaVersion: 1, recordId, programId: program.programId, programRevision: program.revision, programTitle: program.program.title,
    exerciseId: occurrence.exerciseId, occurrenceId: occurrence.occurrenceId, exercise: program.nativeExercises[index]!,
    weeklyTarget: program.program.exercises[index]!.weeklyTarget?.completedAttempts ?? null,
    coverageTarget: program.program.weeklyGoal?.distinctExercisesPracticed ?? null, calendar, policyVersion: "native-hosted-v1", metricsVersion: 1 });
}
/** Aggregate existing engine evidence only; do not persist unbounded native journals. */
export function summarizeProgramMetrics(result: PracticeSessionEngineResult | null): ProgramMetricSummary | null {
  if (!result) return null;
  const sources = result.engine === "flashcards" ? [...new Set([...result.completedTargets, ...result.incorrectAttempts].map(value => value.source))]
    : result.engine === "sequences" ? [...new Set([...result.completedSequences, ...result.incorrectSequenceAttempts].map(value => value.source))] : null;
  const base = { schemaVersion: 1 as const, engine: result.engine, completedRepertoire: null, sources, pitchPercent: null, timingPercent: null, movementPercent: null };
  if (result.engine === "flashcards") { const report = selectFlashcardPracticeReport(result); return { ...base, completedUnits: report.completedTargetCount, incorrectResponses: report.incorrectAttemptCount, firstTryUnits: report.firstTryTargetCount, averageResponseDurationMs: report.averageResponseDurationMs }; }
  if (result.engine === "sequences") { const report = selectSequencePracticeReport(result); return { ...base, completedUnits: report.completedSequenceCount, incorrectResponses: report.incorrectSequenceAttemptCount, firstTryUnits: report.firstTrySequenceCount, averageResponseDurationMs: report.averageCompletionDurationMs, completedRepertoire: report.completedRepertoireCount }; }
  if (result.engine === "ear-training") { const report = selectEarTrainingPracticeReport(result); return { ...base, completedUnits: report.completedIdentificationCount, incorrectResponses: report.incorrectGuessCount, firstTryUnits: report.firstGuessIdentificationCount, averageResponseDurationMs: report.averageResponseDurationMs }; }
  // Diagnostic trials are measured, but they are not interchangeable with correct answers.
  const summary = selectMelodyPracticeReport(result).summary;
  return { ...base, completedUnits: result.diagnosticTrials.length, incorrectResponses: null, firstTryUnits: null, averageResponseDurationMs: null,
    pitchPercent: summary.averagePitch, timingPercent: summary.averageTiming, movementPercent: summary.averageMovement };
}

const baseKeys = ["schemaVersion", "recordId", "programId", "programRevision", "programTitle", "exerciseId", "occurrenceId", "exercise", "weeklyTarget", "coverageTarget", "calendar", "policyVersion", "metricsVersion"];
const attemptKeys = ["kind", "attemptId", "ownerId", "writeVersion", "leaseUntilMs", "outcome", "closed", "updatedAt", "endedAt", "activeDurationMs", "prescribedDurationMs", "bonusDurationMs", "prescribedUnits", "bonusUnits", "metrics", "targetMetrics"];
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: object, keys: readonly string[]) => Object.keys(value).sort().join() === [...keys].sort().join();
const integer = (value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
const instant = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
/** Strict additive persistence contract. Never repair malformed/future rows by replacing them. */
export function parseProgramHistoryRecord(value: unknown): ProgramHistoryRecord {
  const bad = (): never => { throw Error("Saved weekly history is corrupt or unsupported. It has not been changed."); };
  if (!object(value) || value.schemaVersion !== 1 || !exact(value, [...baseKeys, ...(value.kind === "attempt" ? attemptKeys : ["kind", "skippedAt"])])) return bad();
  if (![value.recordId, value.programId, value.exerciseId, value.occurrenceId].every(validProgramId) || !integer(value.programRevision, 1)
    || typeof value.programTitle !== "string" || !value.programTitle.trim() || [...value.programTitle].length > 120
    || value.policyVersion !== "native-hosted-v1" || value.metricsVersion !== 1 || !(value.weeklyTarget === null || integer(value.weeklyTarget, 1, 1000)) || !(value.coverageTarget === null || integer(value.coverageTarget, 1, 100))) return bad();
  const exercise = parsePracticeExerciseEntry(value.exercise);
  if (!exercise.ok || exercise.value.id !== value.exerciseId || [...exercise.value.label].length > 100 || "count" in exercise.value.target && !integer(exercise.value.target.count, 1, 1000) || !object(value.calendar)
    || !exact(value.calendar, ["localDate", "weekStartLocalDate", "weekday", "utcStartedAt", "timeZone", "utcOffsetMinutes"])) return bad();
  const calendar = value.calendar;
  if (typeof calendar.localDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(calendar.localDate) || !instant(calendar.utcStartedAt)
    || !integer(calendar.utcOffsetMinutes, -840, 840) || calendar.timeZone !== null && (typeof calendar.timeZone !== "string" || !calendar.timeZone.trim() || calendar.timeZone.length > 100)) return bad();
  const [year, month, day] = calendar.localDate.split("-").map(Number);
  const week = programCalendarWeek({ year: year!, month: month!, day: day! });
  if (week.weekStartLocalDate !== calendar.weekStartLocalDate || week.weekday !== calendar.weekday) return bad();
  // Validate captured date against captured offset, never today's timezone rules.
  const local = new Date(Date.parse(calendar.utcStartedAt) + (calendar.utcOffsetMinutes as number) * 60_000);
  if (`${String(local.getUTCFullYear()).padStart(4, "0")}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}` !== calendar.localDate) return bad();
  if (value.kind === "skip") { if (!instant(value.skippedAt) || value.skippedAt !== calendar.utcStartedAt) return bad(); }
  else if (value.kind === "attempt") {
    if (value.attemptId !== value.recordId || !validProgramId(value.ownerId) || !integer(value.writeVersion) || !integer(value.leaseUntilMs)
      || !["in-progress", "completed", "stopped-early", "interrupted"].includes(value.outcome as string) || typeof value.closed !== "boolean"
      || !instant(value.updatedAt) || Date.parse(value.updatedAt) < Date.parse(calendar.utcStartedAt)
      || value.closed !== (value.endedAt !== null) || value.closed && (!instant(value.endedAt) || Date.parse(value.endedAt) < Date.parse(calendar.utcStartedAt))
      || value.outcome === "in-progress" && value.closed || ["stopped-early", "interrupted"].includes(value.outcome as string) && !value.closed
      || ![value.activeDurationMs, value.prescribedDurationMs, value.bonusDurationMs].every(duration => typeof duration === "number" && Number.isFinite(duration) && duration >= 0 && duration <= Number.MAX_SAFE_INTEGER)
      || value.activeDurationMs !== (value.prescribedDurationMs as number) + (value.bonusDurationMs as number)
      || ![value.prescribedUnits, value.bonusUnits].every(count => integer(count))) return bad();
    if (value.outcome === "completed" && ("count" in exercise.value.target && (value.prescribedUnits as number) < exercise.value.target.count!
      || exercise.value.target.kind === "complete-scale-repertoire" && exercise.value.engine === "sequences" && (value.prescribedUnits as number) < exercise.value.config.scaleRepertoire.length)) return bad();
    if (value.targetMetrics !== null && value.outcome !== "completed") return bad();
    for (const metrics of [value.metrics, value.targetMetrics]) if (metrics !== null) {
      if (!object(metrics) || !exact(metrics, ["schemaVersion", "engine", "completedUnits", "incorrectResponses", "firstTryUnits", "averageResponseDurationMs", "completedRepertoire", "sources", "pitchPercent", "timingPercent", "movementPercent"])
        || metrics.schemaVersion !== 1 || metrics.engine !== exercise.value.engine || !integer(metrics.completedUnits)
        || ![metrics.incorrectResponses, metrics.firstTryUnits, metrics.completedRepertoire].every(count => count === null || integer(count))
        || metrics.firstTryUnits !== null && (metrics.firstTryUnits as number) > (metrics.completedUnits as number)
        || metrics.averageResponseDurationMs !== null && (typeof metrics.averageResponseDurationMs !== "number" || !Number.isFinite(metrics.averageResponseDurationMs) || metrics.averageResponseDurationMs < 0)
        || metrics.sources !== null && (!Array.isArray(metrics.sources) || metrics.sources.length > 3 || new Set(metrics.sources).size !== metrics.sources.length || metrics.sources.some(source => !["midi", "virtual", "simulation"].includes(source)))
        || ![metrics.pitchPercent, metrics.timingPercent, metrics.movementPercent].every(percent => percent === null || metrics.engine === "melody" && typeof percent === "number" && Number.isFinite(percent) && percent >= 0 && percent <= 100)) return bad();
    }
  } else return bad();
  return structuredClone(value) as ProgramHistoryRecord;
}

export function weeklyProgramProgress(records: readonly ProgramHistoryRecord[], programId: string, weekStart: string) {
  const week = records.filter(row => row.programId === programId && row.calendar.weekStartLocalDate === weekStart);
  const exercises = new Map<string, { attempts: number; completed: number; incomplete: number; skips: number; activeMs: number }>();
  for (const row of week) {
    const total = exercises.get(row.exerciseId) ?? { attempts: 0, completed: 0, incomplete: 0, skips: 0, activeMs: 0 };
    if (row.kind === "skip") total.skips++;
    else { total.attempts++; total.completed += row.outcome === "completed" ? 1 : 0; total.incomplete += row.closed && row.outcome !== "completed" ? 1 : 0; total.activeMs += row.activeDurationMs; }
    exercises.set(row.exerciseId, total);
  }
  return { exercises, distinctAttempted: [...exercises.values()].filter(value => value.attempts > 0).length, recent: [...week].sort((a, b) => b.calendar.utcStartedAt.localeCompare(a.calendar.utcStartedAt)).slice(0, 50) };
}
