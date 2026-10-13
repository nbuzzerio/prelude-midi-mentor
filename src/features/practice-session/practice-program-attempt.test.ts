import { describe, expect, it } from "vitest";
import { createFlashcardPracticeResult, appendFlashcardCompletedTarget } from "@/features/flashcards/flashcard-practice-result";
import { createMelodyPracticeResult } from "@/features/melody/melody-practice-result";
import { parseProgramHistoryRecord, weeklyProgramProgress, summarizeProgramMetrics, createProgramRecordBase } from "./practice-program-attempt";
import { testAttempt, testSkip, testConcepts, testProgram } from "./practice-program-test-fixtures";

describe("versioned weekly attempt snapshots and progress", () => {
  it.each(testConcepts.map((concept, index) => [concept.type, index] as const))("preserves %s native settings and goals", (_, index) => {
    const value = testAttempt(index); expect(parseProgramHistoryRecord(value)).toEqual(value);
    expect(value.exercise.id).toBe(value.exerciseId); expect(value.programRevision).toBe(1);
    const parsed = parseProgramHistoryRecord(value); expect(parsed).not.toBe(value); expect(parsed.exercise).not.toBe(value.exercise);
  });
  it("keeps skip evidence separate from actual attempts and keeps missing exercises neutral", () => {
    const started = testAttempt(), skip = testSkip(); const completed = { ...started, outcome: "completed" as const, prescribedUnits: 1, closed: true, endedAt: started.updatedAt };
    const stopped = { ...testAttempt(1, "attempt-2"), outcome: "stopped-early" as const, closed: true, endedAt: started.updatedAt };
    const progress = weeklyProgramProgress([completed, stopped, skip], started.programId, started.calendar.weekStartLocalDate);
    expect(progress.exercises.get(started.exerciseId)).toMatchObject({ attempts: 1, completed: 1, skips: 1 }); expect(progress.exercises.get(stopped.exerciseId)).toMatchObject({ attempts: 1, incomplete: 1 });
    expect(progress.exercises.has("exercise-8")).toBe(false); expect(progress.distinctAttempted).toBe(2);
  });
  it("derives bounded native summaries with actual source provenance and unknown absent metrics", () => {
    const result = appendFlashcardCompletedTarget(createFlashcardPracticeResult(), { target: { id: "n", kind: "note", clef: "treble", name: { primary: "C" }, expectedPitches: [{ midiNumber: 60, name: "C", octave: 4 }] }, submittedMidiNumbers: [60], responseDurationMs: 127, source: "simulation" });
    expect(summarizeProgramMetrics(result)).toMatchObject({ completedUnits: 1, incorrectResponses: 0, firstTryUnits: 1, averageResponseDurationMs: 127, sources: ["simulation"] });
    expect(summarizeProgramMetrics(null)).toBeNull(); expect(summarizeProgramMetrics(createMelodyPracticeResult())).toMatchObject({ completedUnits: 0, incorrectResponses: null, firstTryUnits: null, sources: null });
  });
  it.each(["schemaVersion", "programRevision", "exerciseId", "occurrenceId", "policyVersion", "metricsVersion"])("rejects corrupt/future %s without repairing", key => {
    expect(() => parseProgramHistoryRecord({ ...testAttempt(), [key]: key.includes("Version") || key === "programRevision" ? 2.5 : "bad value" })).toThrow();
  });
  it("rejects unknown fields, forged completion, malformed goals and native configurations", () => {
    expect(() => parseProgramHistoryRecord({ ...testAttempt(), importedGrade: 100 })).toThrow();
    expect(() => parseProgramHistoryRecord({ ...testAttempt(), outcome: "completed" })).toThrow();
    expect(() => parseProgramHistoryRecord({ ...testAttempt(), weeklyTarget: 0 })).toThrow();
    expect(() => parseProgramHistoryRecord({ ...testAttempt(), exercise: { junk: 1 } })).toThrow();
  });
  it("uses captured timezone/offset and start-day attribution across midnight and travel", () => {
    const value = testAttempt(); const calendar = { localDate: "2026-10-17", weekStartLocalDate: "2026-10-11", weekday: "saturday" as const, utcStartedAt: "2026-10-18T03:59:00.000Z", timeZone: "America/New_York", utcOffsetMinutes: -240 };
    const record = { ...value, calendar, updatedAt: "2026-10-18T05:00:00.000Z", closed: true, endedAt: "2026-10-18T05:00:00.000Z", outcome: "interrupted" as const };
    expect(parseProgramHistoryRecord(record).calendar).toEqual(calendar); expect(weeklyProgramProgress([record], value.programId, "2026-10-18").recent).toEqual([]);
    expect(() => parseProgramHistoryRecord({ ...record, calendar: { ...calendar, localDate: "2026-10-18" } })).toThrow();
  });
  it("retains historical revision snapshots and bounds recent rows", () => {
    const attempt = testAttempt(); const program = testProgram(); const original = JSON.stringify(attempt.exercise);
    (program.nativeExercises[0]!.target as { count: number }).count = 9; expect(JSON.stringify(attempt.exercise)).toBe(original);
    const rows = Array.from({ length: 80 }, (_, i) => ({ ...attempt, recordId: `record-${i}`, attemptId: `record-${i}` }));
    expect(weeklyProgramProgress(rows, attempt.programId, attempt.calendar.weekStartLocalDate).recent).toHaveLength(50);
    expect(() => createProgramRecordBase(program, { exerciseId: "missing", occurrenceId: "occ-1" }, "new", attempt.calendar)).toThrow();
  });
  it.each([
    ["2026-03-08T06:30:00.000Z", -300, "2026-03-08", "sunday", "2026-03-08"],
    ["2026-03-08T07:30:00.000Z", -240, "2026-03-08", "sunday", "2026-03-08"],
    ["2026-11-01T05:30:00.000Z", -240, "2026-11-01", "sunday", "2026-11-01"],
    ["2026-11-01T06:30:00.000Z", -300, "2026-11-01", "sunday", "2026-11-01"],
    ["2026-01-01T01:00:00.000Z", 60, "2026-01-01", "thursday", "2025-12-28"],
  ] as const)("preserves captured local calendar at %s", (utcStartedAt, utcOffsetMinutes, localDate, weekday, weekStartLocalDate) => {
    const value = testAttempt(), calendar = { utcStartedAt, utcOffsetMinutes, localDate, weekday, weekStartLocalDate, timeZone: "America/New_York" };
    const saved = { ...value, calendar, updatedAt: utcStartedAt }; expect(parseProgramHistoryRecord(saved).calendar).toEqual(calendar);
  });
});
