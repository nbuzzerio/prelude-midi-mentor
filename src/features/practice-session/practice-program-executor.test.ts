import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeImprovIndexedDb } from "../improv/persistence/improv-indexeddb-fake";
import { IndexedDbPracticeAttempts } from "./persistence/practice-attempt-indexeddb";
import { PracticeProgramExecutor } from "./practice-program-executor";
import { testProgram, testWallTime, testOwnership, testConcepts } from "./practice-program-test-fixtures";
import type { PracticeSessionRunEvent } from "./practice-session-runtime";
const cleanups: (() => void)[] = [];
afterEach(async () => { for (const dispose of cleanups.splice(0)) dispose(); await Promise.resolve(); vi.useRealTimers(); });
async function settle() { for (let i = 0; i < 100; i++) await Promise.resolve(); }
function fixture() {
  const fake = new FakeImprovIndexedDb(), store = new IndexedDbPracticeAttempts(fake.factory); let id = 0, clock = 100, wall = testWallTime;
  const executor = new PracticeProgramExecutor(testProgram(), { store, ownership: testOwnership(), createId: () => `id-${id++}`, clockNow: () => clock, wallNow: () => wall });
  cleanups.push(executor.attach());
  const event = (type: "UNIT_COMPLETED" | "TARGET_REACHED" | "END" | "KEEP_PLAYING"): PracticeSessionRunEvent => {
    const run = executor.getSnapshot().run!; if (run.status !== "active") throw Error("not active");
    const scope = { runId: run.runId, exerciseId: run.snapshot.exercises[0]!.id, exerciseToken: run.activeExerciseToken };
    return type === "END" ? { type, ...scope, endedAt: clock } : { type, ...scope, at: clock };
  };
  return { fake, store, executor, event, time: (ms: number) => { clock += ms; wall += ms; } };
}
describe("weekly execution adapter", () => {
  it("does not start an empty queue and preserves order/independent occurrence IDs", async () => {
    const { executor } = fixture(); await executor.start(); expect(executor.getSnapshot().run).toBeNull();
    executor.select(["exercise-2", "exercise-0", "exercise-2"]); const queue = executor.getSnapshot().queue;
    expect(queue.map(row => row.exerciseId)).toEqual(["exercise-2", "exercise-0", "exercise-2"]); expect(new Set(queue.map(row => row.occurrenceId)).size).toBe(3);
    expect(() => executor.select(["unknown"])).toThrow(); expect(executor.returnToPool()).toBe(true);
  });
  it("starts the native engine only after the durable initial transaction", async () => {
    const { executor, fake } = fixture(); executor.select(["exercise-0"]); const hold = fake.holdNextCommit(), pending = executor.start(); await settle();
    expect(hold.ready()).toBe(true); expect(executor.getSnapshot().run).toBeNull(); expect(executor.getSnapshot().durable).toBeNull();
    hold.release(); await pending; expect(executor.getSnapshot().run?.status).toBe("active"); expect(executor.getSnapshot().durable?.writeVersion).toBe(0);
  });
  it.each(testConcepts.map((concept, index) => [concept.type, index] as const))("hosts %s using the existing native completion contract", async (_, index) => {
    const { executor, event, store } = fixture(); executor.select([`exercise-${index}`]); await executor.start();
    const exercise = executor.getSnapshot().record!.exercise;
    if (exercise.target.kind === "complete-scale-repertoire" && exercise.engine === "sequences") { for (let i = 0; i < exercise.config.scaleRepertoire.length; i++) executor.handle(event("UNIT_COMPLETED")); executor.handle(event("TARGET_REACHED")); }
    else executor.handle(event(exercise.engine === "melody" ? "TARGET_REACHED" : "UNIT_COMPLETED"));
    await settle(); expect(executor.getSnapshot().durable?.outcome).toBe("completed"); executor.handle(event("END")); await settle();
    const rows = await store.list(testProgram().programId); expect(rows[0]).toMatchObject({ closed: true, outcome: "completed", exercise: testProgram().nativeExercises[index] });
  });
  it("separates Keep Playing/Bonus from a fresh Repeat attempt and rejects stale callbacks", async () => {
    const { executor, event, time, store } = fixture(); executor.select(["exercise-0"]); await executor.start(); const first = executor.getSnapshot().record!;
    const stale = event("UNIT_COMPLETED"), staleVisibility = { ...stale, type: "VISIBILITY_CHANGED", foreground: false } as PracticeSessionRunEvent;
    time(100); executor.handle(event("UNIT_COMPLETED")); executor.handle(event("KEEP_PLAYING")); time(100); executor.handle(event("UNIT_COMPLETED")); executor.handle(event("END")); await settle();
    expect(executor.getSnapshot().durable).toMatchObject({ attemptId: first.attemptId, prescribedUnits: 1, bonusUnits: 1, activeDurationMs: 200 });
    executor.repeat(); await settle(); const next = executor.getSnapshot().record!;
    expect(next.attemptId).not.toBe(first.attemptId); expect(next.occurrenceId).not.toBe(first.occurrenceId); expect(next.exerciseId).toBe(first.exerciseId);
    executor.handle(stale); executor.handle(staleVisibility); expect(executor.getSnapshot().run?.status).toBe("active"); expect(executor.getSnapshot().run?.records[0]?.prescribedUnitsCompleted).toBe(0);
    executor.handle(event("END")); await settle(); expect(await store.list(first.programId)).toHaveLength(2);
  });
  it("does not duplicate completion callbacks or count skips as attempts", async () => {
    const { executor, event, store } = fixture(); executor.select(["exercise-0", "exercise-1"]); await executor.start();
    const unit = event("UNIT_COMPLETED"); executor.handle(unit); executor.handle(unit); executor.handle(event("END")); await settle(); executor.next(); await executor.skip();
    const rows = await store.list(testProgram().programId); expect(rows.filter(row => row.kind === "attempt")).toHaveLength(1); expect(rows.filter(row => row.kind === "skip")).toHaveLength(1);
    expect(executor.getSnapshot().index).toBe(2); expect(executor.returnToPool()).toBe(true);
  });
  it("retains a failed start for retry without creating another identity or engine", async () => {
    const { executor, fake } = fixture(); executor.select(["exercise-0"]); fake.commitError = "QuotaExceededError"; await executor.start();
    const id = executor.getSnapshot().record!.attemptId; expect(executor.getSnapshot().run).toBeNull(); expect(executor.returnToPool()).toBe(false);
    await executor.retry(); expect(executor.getSnapshot().record!.attemptId).toBe(id); expect(executor.getSnapshot().run?.status).toBe("active");
  });
  it("retains early-stop results and their stop instant after failed terminal save", async () => {
    const { executor, fake, event, time } = fixture(); executor.select(["exercise-0"]); await executor.start(); time(300); fake.commitError = "QuotaExceededError";
    executor.handle(event("END")); await settle(); const pending = executor.getSnapshot().record!;
    expect(pending.outcome).toBe("stopped-early"); expect(executor.getSnapshot().durable?.closed).toBe(false); expect(executor.returnToPool()).toBe(false);
    time(60000); await executor.retry(); expect(executor.getSnapshot().durable).toMatchObject({ outcome: "stopped-early", activeDurationMs: 300, endedAt: pending.endedAt });
  });
  it("freezes at progress failure and permits explicit retry of the interrupted snapshot", async () => {
    vi.useFakeTimers(); const { executor, fake, time } = fixture(); executor.select(["exercise-0"]); await executor.start(); time(5000); fake.commitError = "QuotaExceededError";
    await vi.advanceTimersByTimeAsync(5000); expect(executor.getSnapshot().run?.status).toBe("summary"); expect(executor.getSnapshot().record?.outcome).toBe("interrupted");
    await executor.retry(); expect(executor.getSnapshot().durable).toMatchObject({ closed: true, outcome: "interrupted", activeDurationMs: 5000 });
  });
  it("stops on navigation/background and never automatically resumes", async () => {
    const { executor, time } = fixture(); executor.select(["exercise-0"]); await executor.start(); time(400); executor.setForeground(false); await settle();
    expect(executor.getSnapshot().durable).toMatchObject({ closed: true, outcome: "interrupted", activeDurationMs: 400 }); executor.setForeground(true); expect(executor.getSnapshot().run?.status).toBe("summary");
  });
  it("preserves completed outcome through background interruption", async () => {
    const { executor, event } = fixture(); executor.select(["exercise-0"]); await executor.start(); executor.handle(event("UNIT_COMPLETED")); executor.interrupt(); await settle();
    expect(executor.getSnapshot().durable).toMatchObject({ closed: true, outcome: "completed" });
  });
  it("coalesces changes during a pending checkpoint without losing terminal results", async () => {
    const { executor, event, fake, time } = fixture(); executor.select(["exercise-0"]); await executor.start(); const hold = fake.holdNextCommit(); executor.handle(event("UNIT_COMPLETED")); await settle();
    expect(hold.ready()).toBe(true); time(100); executor.handle(event("END")); hold.release(); await settle(); expect(executor.getSnapshot().durable).toMatchObject({ closed: true, outcome: "completed" });
  });
  it("fences Strict Mode attachment replay and closes real unmount during start safely", async () => {
    const { executor, fake, store } = fixture(); const detach = cleanups.pop()!; detach(); cleanups.push(executor.attach()); await settle();
    executor.select(["exercise-0"]); const hold = fake.holdNextCommit(), pending = executor.start(); await settle(); cleanups.pop()!(); await settle(); hold.release(); await pending; await settle();
    const rows = await new IndexedDbPracticeAttempts(fake.factory).list(testProgram().programId); expect(rows[0]).toMatchObject({ closed: true, outcome: "interrupted" }); expect(executor.getSnapshot().run).toBeNull();
    await expect(store.list(testProgram().programId)).rejects.toMatchObject({ reason: "closed" });
  });
});
