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
  it("retains only this selection's acknowledgements across Next/Repeat/Skip and resets for a second lesson", async () => {
    const { executor, event, store } = fixture();
    // A prior manual session on this same program/date must not enter a lesson.
    executor.select(["exercise-0"]); await executor.start(); executor.stop(); await settle();
    const manual = executor.getSnapshot().record!; expect(executor.returnToPool()).toBe(true);
    executor.select(["exercise-0", "exercise-1", "exercise-2"]); await executor.start();
    const first = executor.getSnapshot().record!; executor.handle(event("UNIT_COMPLETED")); await settle();
    await executor.advanceLesson("repeat"); await settle();
    const repeated = executor.getSnapshot().record!; expect(repeated.attemptId).not.toBe(first.attemptId);
    executor.stop(); await settle(); await executor.advanceLesson("skip");
    const saved = executor.getSnapshot().acknowledged;
    expect(saved).toHaveLength(3); expect(saved.some(entry => entry.record.recordId === manual.recordId)).toBe(false);
    expect(saved.map(entry => entry.record.kind)).toEqual(["attempt", "attempt", "skip"]);
    expect(saved[0]?.report?.runId).toBe(first.attemptId); expect(saved[1]?.report?.runId).toBe(repeated.attemptId);
    expect(saved[2]?.report).toBeNull();
    expect(executor.returnToPool()).toBe(true); executor.select(["exercise-0"]); await executor.start();
    expect(executor.getSnapshot().acknowledged).toHaveLength(1);
    expect(executor.getSnapshot().acknowledged[0]?.record.recordId).not.toBe(first.attemptId);
    expect(await store.list(manual.programId)).toHaveLength(5);
  });
  it("does not publish pending/failed terminal or skip writes as acknowledged, and Retry upserts once", async () => {
    const { executor, event, fake } = fixture(); executor.select(["exercise-0", "exercise-1"]); await executor.start();
    executor.handle(event("UNIT_COMPLETED")); await settle(); const hold = fake.holdNextCommit();
    executor.stop(); await settle(); expect(executor.getSnapshot().acknowledged[0]?.record).toMatchObject({ closed: false });
    expect(executor.getSnapshot().acknowledged[0]?.report).toBeNull();
    fake.commitError = "QuotaExceededError"; hold.release(); await settle();
    expect(executor.getSnapshot().acknowledged[0]?.record).toMatchObject({ closed: false });
    await executor.retry(); expect(executor.getSnapshot().acknowledged).toHaveLength(1);
    expect(executor.getSnapshot().acknowledged[0]?.record).toMatchObject({ closed: true, outcome: "completed" });
    executor.next(); fake.commitError = "QuotaExceededError"; await executor.skip();
    expect(executor.getSnapshot().acknowledged).toHaveLength(1);
    await executor.retry(); expect(executor.getSnapshot().acknowledged).toHaveLength(2);
    expect(executor.getSnapshot().acknowledged[1]?.record.kind).toBe("skip");
  });
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
  it("acknowledges the terminal result before one Next starts the next authored selection", async () => {
    const { executor, event, fake, store } = fixture(); executor.select(["exercise-0", "exercise-2", "exercise-1"]); await executor.start();
    executor.handle(event("UNIT_COMPLETED")); await settle();
    const first = executor.getSnapshot().record!, hold = fake.holdNextCommit();
    const next = executor.advanceLesson("next"); await settle();
    expect(executor.getSnapshot().run?.status).toBe("summary"); expect(executor.getSnapshot().index).toBe(0);
    await executor.advanceLesson("next"); expect(executor.getSnapshot().queue).toHaveLength(3);
    hold.release(); await next;
    expect(executor.getSnapshot().record).toMatchObject({ exerciseId: "exercise-2", exercise: testProgram().nativeExercises[2] });
    expect((await store.list(first.programId)).find(row => row.recordId === first.recordId)).toMatchObject({ closed: true, outcome: "completed" });
    expect(await store.list(first.programId)).toHaveLength(2);
  });
  it("blocks Next on a failed terminal write, retrying evidence without automatic progression", async () => {
    const { executor, fake, event } = fixture(); executor.select(["exercise-0", "exercise-1"]); await executor.start();
    executor.handle(event("UNIT_COMPLETED")); await settle(); fake.commitError = "QuotaExceededError";
    await executor.advanceLesson("next"); expect(executor.getSnapshot().error).toBeTruthy(); expect(executor.getSnapshot().index).toBe(0);
    await executor.advanceLesson("next"); expect(executor.getSnapshot().index).toBe(0);
    await executor.retry(); expect(executor.getSnapshot().durable?.closed).toBe(true); expect(executor.getSnapshot().index).toBe(0);
    await executor.advanceLesson("next"); expect(executor.getSnapshot().record?.exerciseId).toBe("exercise-1");
  });
  it("keeps Bonus identity and guards rapid Repeat with distinct new occurrence/attempt IDs", async () => {
    const { executor, event, store } = fixture(); executor.select(["exercise-0", "exercise-1"]); await executor.start();
    const first = executor.getSnapshot().record!; executor.handle(event("UNIT_COMPLETED")); await settle();
    executor.handle(event("KEEP_PLAYING")); executor.handle(event("UNIT_COMPLETED")); await settle();
    await Promise.all([executor.advanceLesson("repeat"), executor.advanceLesson("repeat")]); await settle();
    expect(executor.getSnapshot().queue).toHaveLength(3); const repeated = executor.getSnapshot().record!;
    expect(repeated.occurrenceId).not.toBe(first.occurrenceId); expect(repeated.attemptId).not.toBe(first.attemptId);
    expect(await store.list(first.programId)).toEqual(expect.arrayContaining([expect.objectContaining({ attemptId: first.attemptId, bonusUnits: 1 })]));
  });
  it("skips only a deliberately selected unstarted next exercise and leaves others unperformed", async () => {
    const { executor, event, store } = fixture(); executor.select(["exercise-0", "exercise-1", "exercise-2", "exercise-3"]); await executor.start();
    executor.handle(event("UNIT_COMPLETED")); await settle(); await executor.advanceLesson("skip");
    expect(executor.getSnapshot().index).toBe(2); expect(executor.getSnapshot().run).toBeNull();
    await executor.advanceLesson("next"); executor.stop(); await settle();
    const rows = await store.list(testProgram().programId);
    expect(rows).toHaveLength(3); expect(rows.filter(row => row.kind === "skip")).toEqual([expect.objectContaining({ exerciseId: "exercise-1" })]);
    expect(rows.find(row => row.exerciseId === "exercise-2")).toMatchObject({ outcome: "stopped-early", closed: true });
    expect(rows.some(row => row.exerciseId === "exercise-3")).toBe(false);
  });
  it("cancels a delayed transition after navigation even if foreground returns before acknowledgement", async () => {
    const { executor, event, fake } = fixture(); executor.select(["exercise-0", "exercise-1"]); await executor.start();
    executor.handle(event("UNIT_COMPLETED")); await settle(); const hold = fake.holdNextCommit(), pending = executor.advanceLesson("next"); await settle();
    executor.setForeground(false); executor.setForeground(true); hold.release(); await pending;
    expect(executor.getSnapshot().index).toBe(0); expect(executor.getSnapshot().durable?.closed).toBe(true);
  });
  it("honors the queue maximum for lesson Repeat and permits a single/empty queue", async () => {
    const { executor, event } = fixture(); await executor.advanceLesson("next"); expect(executor.getSnapshot().record).toBeNull();
    executor.select(Array(100).fill("exercise-0")); await executor.start(); executor.handle(event("UNIT_COMPLETED")); await settle();
    await executor.advanceLesson("repeat"); expect(executor.getSnapshot().queue).toHaveLength(100); expect(executor.getSnapshot().index).toBe(0);
  });
  it.each(["start", "next"] as const)("fences browser background during delayed %s even when visibility returns before acknowledgement", async action => {
    const { executor, event, fake } = fixture(); executor.select(["exercise-0", "exercise-1"]);
    if (action === "next") { await executor.start(); executor.handle(event("UNIT_COMPLETED")); await settle(); }
    const hold = fake.holdNextCommit(), pending = action === "start" ? executor.start() : executor.advanceLesson("next"); await settle();
    const visibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
    try {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange"));
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); document.dispatchEvent(new Event("visibilitychange"));
      hold.release(); await pending; await settle();
      expect(executor.getSnapshot().index).toBe(0); expect(executor.getSnapshot().durable?.closed).toBe(true);
      if (action === "start") { expect(executor.getSnapshot().run).toBeNull(); expect(executor.getSnapshot().durable?.outcome).toBe("interrupted"); }
    } finally { if (visibility) Object.defineProperty(document, "visibilityState", visibility); else Reflect.deleteProperty(document, "visibilityState"); }
  });
});
