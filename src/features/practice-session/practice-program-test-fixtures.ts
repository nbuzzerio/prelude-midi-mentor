// Test-only fixtures; production owners do not import this module.
import { REALISTIC_WEEKLY_PRACTICE_EXAMPLE } from "./import/weekly-practice-examples";
import { WEEKLY_PROGRAM_EXAMPLE } from "./import/practice-program-specification";
import { validatePracticeProgram } from "./practice-program-validation";
import { createProgramRecordBase, programCalendarNow, type ProgramAttempt, type ProgramSkip } from "./practice-program-attempt";
import { PracticeAttemptOwnership } from "./persistence/practice-attempt-ownership";
export const testConcepts = REALISTIC_WEEKLY_PRACTICE_EXAMPLE.days.flatMap(day => "exercises" in day ? [...day.exercises] : []);
export function testProgram() {
  const parsed = validatePracticeProgram({ ...WEEKLY_PROGRAM_EXAMPLE, exercises: testConcepts.map((exercise, index) => ({ ...exercise, id: `exercise-${index}`, ...("target" in exercise ? { target: { [Object.keys(exercise.target)[0]!]: 1 } } : {}) })), suggestedRotation: [], weeklyGoal: { distinctExercisesPracticed: 2 } });
  if (!parsed.ok) throw Error(JSON.stringify(parsed.issues)); return parsed.value;
}
export const testWallTime = Date.UTC(2026, 9, 13, 12);
export function testAttempt(index = 0, id = "attempt-1"): ProgramAttempt {
  const program = testProgram(), calendar = programCalendarNow(testWallTime);
  return { ...createProgramRecordBase(program, { occurrenceId: `occurrence-${id}`, exerciseId: program.program.exercises[index]!.id }, id, calendar), kind: "attempt", attemptId: id, ownerId: "owner-1", writeVersion: 0, leaseUntilMs: testWallTime + 30000,
    outcome: "in-progress", closed: false, updatedAt: calendar.utcStartedAt, endedAt: null, activeDurationMs: 0, prescribedDurationMs: 0, bonusDurationMs: 0, prescribedUnits: 0, bonusUnits: 0, metrics: null, targetMetrics: null };
}
export function testSkip(): ProgramSkip {
  const record = testAttempt(); return { ...createProgramRecordBase(testProgram(), record, "skip-1", record.calendar), kind: "skip", skippedAt: record.calendar.utcStartedAt };
}
export function testOwnership() {
  const held = new Set<string>();
  const manager = { request: async (name: string, _: unknown, callback: (lock: object | null) => Promise<void> | void) => {
    if (held.has(name)) return callback(null); held.add(name); try { return await callback({}); } finally { held.delete(name); }
  } } as unknown as LockManager;
  return new PracticeAttemptOwnership(manager);
}
