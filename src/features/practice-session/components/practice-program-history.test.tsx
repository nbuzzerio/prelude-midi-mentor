import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeImprovIndexedDb } from "../../improv/persistence/improv-indexeddb-fake";
import { IndexedDbPracticeAttempts, PRACTICE_ATTEMPT_DATABASE as DB } from "../persistence/practice-attempt-indexeddb";
import { testProgram, testAttempt, testSkip, testWallTime } from "../practice-program-test-fixtures";
import PracticeProgramHistory from "./practice-program-history";
let fake: FakeImprovIndexedDb, store: IndexedDbPracticeAttempts, original: PropertyDescriptor | undefined;
beforeEach(async () => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(testWallTime); fake = new FakeImprovIndexedDb(); original = Object.getOwnPropertyDescriptor(globalThis, "indexedDB"); Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: fake.factory }); store = new IndexedDbPracticeAttempts(fake.factory); await store.list(testProgram().programId); });
afterEach(() => { cleanup(); store.close(); vi.useRealTimers(); if (original) Object.defineProperty(globalThis, "indexedDB", original); else Reflect.deleteProperty(globalThis, "indexedDB"); });
describe("weekly saved-evidence summary", () => {
  it("uses Unknown until acknowledged reading, then keeps missing work neutral", async () => {
    render(<PracticeProgramHistory changed={0} program={testProgram()} />); expect(screen.getAllByText("Saved evidence unknown")).toHaveLength(9);
    await waitFor(() => expect(screen.getAllByText(/Not yet practiced/)).toHaveLength(9)); expect(screen.getByText(/0 distinct pool exercises attempted/)).toBeTruthy();
  });
  it("does not turn unavailable/corrupt history into zero-performance claims", async () => {
    const value = { ...testAttempt(), schemaVersion: 2 }; fake.set("records", value.recordId, value, DB);
    render(<PracticeProgramHistory changed={0} program={testProgram()} />); await screen.findByRole("alert"); expect(screen.getAllByText("Saved evidence unknown")).toHaveLength(9); expect(screen.queryByText(/Not yet practiced/)).toBeNull(); expect(fake.get("records", value.recordId, DB)).toEqual(value);
  });
  it("counts saved completions and skips separately across reloads", async () => {
    const start = testAttempt(); await store.save(start, null); await store.save({ ...start, outcome: "completed", closed: true, endedAt: start.updatedAt, prescribedUnits: 1, writeVersion: 1 }, 0); await store.save(testSkip(), null);
    render(<PracticeProgramHistory changed={1} program={testProgram()} />); await screen.findByText("1 attempts · 1 completed · 0 incomplete · 1 skips"); expect(screen.getByText(/1 distinct pool exercises attempted/)).toBeTruthy();
    cleanup(); render(<PracticeProgramHistory changed={0} program={testProgram()} />); await screen.findByText("1 attempts · 1 completed · 0 incomplete · 1 skips");
  });
});
