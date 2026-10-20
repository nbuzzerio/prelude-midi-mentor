import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContinuousSession } from "./continuous-session";
import { projectContinuousPassage } from "./continuous-projection";
import { attack, measure, note, raw, TEST_DATE, TEST_INPUT, testScore } from "./continuous-test-fixtures";
import { validateContinuousAttempt } from "./continuous-store";
import type { ContinuousAttempt } from "./continuous-types";

function audioFixture() {
  const nodes: { stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
  return { currentTime: 0, state: "running" as AudioContextState, destination: {},
    createOscillator: vi.fn(() => { const node = { frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, type: "sine" as OscillatorType,
      connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }; nodes.push(node); return node; }),
    createGain: vi.fn(() => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() })),
    resume: vi.fn(async () => {}), close: vi.fn(async () => {}), nodes };
}
function deferred() { let resolve!: () => void; let reject!: (error: Error) => void; const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
function setup() {
  const p = projectContinuousPassage(testScore(), 0, 1, 60);
  const audio = audioFixture();
  const records = new Map<string, ContinuousAttempt>();
  const store = { save: vi.fn(async (a: ContinuousAttempt) => { validateContinuousAttempt(a); records.set(a.id, a); }), list: vi.fn(async () => [...records.values()]) };
  let sequence = 0;
  const factory = vi.fn(() => audio);
  const session = new ContinuousSession(p, TEST_INPUT, store, factory, () => TEST_DATE, () => `attempt-${++sequence}`, () => audio.currentTime * 1000 - 3100);
  session.ownershipChanged(true);
  const at = (ms: number) => { audio.currentTime = 4.1 + ms / 1000; session.tick(); };
  const finish = () => at(p.durationMs + p.tailMs + 1);
  return { session, p, audio, factory, store, records, at, finish };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
describe("continuous session authority and persistence acknowledgements", () => {
  it("waits indefinitely in Ready without audio, scoring, storage or a running timer", () => {
    const s = setup(); s.session.rawMessage(raw()); vi.advanceTimersByTime(60000);
    expect(s.session.snapshot()).toMatchObject({ phase: "ready", elapsedMs: 0, attempt: null });
    expect(s.factory).not.toHaveBeenCalled(); expect(s.store.save).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("waits for delayed start acknowledgement before scheduling count-in, fencing double clicks", async () => {
    const s = setup(); const pending = deferred(); s.store.save.mockImplementationOnce(() => pending.promise);
    s.session.begin(); s.session.begin(); await flush();
    expect(s.session.snapshot().phase).toBe("starting");
    expect(s.audio.createOscillator).not.toHaveBeenCalled(); expect(s.factory).toHaveBeenCalledTimes(1);
    pending.resolve(); await flush();
    expect(s.session.snapshot().phase).toBe("count-in");
    expect(s.audio.createOscillator).toHaveBeenCalledTimes(12);
    s.session.stop(); await flush();
  });
  it("retries failed start with the same identity and a fresh explicit activation", async () => {
    const s = setup(); s.store.save.mockRejectedValueOnce(Error("quota"));
    s.session.begin(); await flush();
    expect(s.session.snapshot()).toMatchObject({ phase: "ready", save: "failed" });
    expect(s.audio.createOscillator).not.toHaveBeenCalled();
    const id = s.session.snapshot().attempt!.id;
    s.session.begin(); await flush();
    expect(s.session.snapshot().attempt!.id).toBe(id);
    expect(s.session.snapshot().phase).toBe("count-in");
    s.session.stop(); await flush();
  });
  it("ignores count-in/pre-downbeat notes and transitions exactly at the normal first downbeat", async () => {
    const s = setup(); s.session.begin(); await flush();
    s.audio.currentTime = 4; s.session.rawMessage(raw());
    s.audio.currentTime = 4.1; s.session.tick(); s.session.rawMessage(raw());
    expect(s.session.snapshot().phase).toBe("playing");
    expect(s.session.snapshot().attempt!.attacks).toHaveLength(1);
    expect(s.session.snapshot().attempt!.attacks[0]!.timeMs).toBe(0);
    s.session.stop(); await flush();
  });
  it("continues through silence and mistakes, including final tail, then acknowledges a bounded result", async () => {
    const s = setup(); s.session.begin(); await flush(); s.at(4500);
    s.session.rawMessage(raw(62));
    s.at(s.p.durationMs + s.p.tailMs - 1);
    expect(s.session.snapshot().phase).toBe("playing");
    s.finish(); await flush();
    const v = s.session.snapshot();
    expect(v).toMatchObject({ phase: "results", save: "saved" });
    expect(v.attempt!.status).toBe("completed");
    expect(v.attempt!.assessment).toMatchObject({ missing: 2, extras: [1] });
    expect(s.audio.close).toHaveBeenCalledTimes(1);
    expect(s.audio.nodes.every((n) => n.disconnect.mock.calls.length === 1)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("allows the final sixteenth-note onset its complete association window", async () => {
    const source = { ...testScore(), measures: [measure("m", [note("last", 1800, 60, "sixteenth")])] };
    const p = projectContinuousPassage(source, 0, 0, 120);
    const audio = audioFixture();
    const session = new ContinuousSession(p, TEST_INPUT, { save: async () => {}, list: async () => [] }, () => audio, () => TEST_DATE, () => "last-onset", () => -1100);
    session.ownershipChanged(true); session.begin(); await flush();
    audio.currentTime = 2.1 + 2.1; session.tick(); session.rawMessage(raw());
    expect(session.snapshot().attempt!.attacks).toHaveLength(1);
    audio.currentTime = 4.4; session.tick(); await flush();
    expect(session.snapshot().attempt!.assessment).toMatchObject({ matched: 1, late: 1 });
  });
  it("retains pending terminal evidence and retries without creating another performance", async () => {
    const s = setup(); s.session.begin(); await flush();
    const id = s.session.snapshot().attempt!.id;
    s.store.save.mockRejectedValueOnce(Error("quota")); s.finish(); await flush();
    expect(s.session.snapshot().save).toBe("failed"); s.session.replay();
    expect(s.session.snapshot().phase).toBe("results");
    expect(s.session.canExit()).toBe(false);
    s.session.retrySave(); s.session.retrySave(); await flush();
    expect(s.session.snapshot()).toMatchObject({ save: "saved", attempt: { id, terminalSaveAttempts: 2 } });
    expect(s.records.size).toBe(1);
  });
  it("blocks Replay until delayed terminal acknowledgement and freezes replay music/policy", async () => {
    const s = setup(); s.session.begin(); await flush();
    const pending = deferred(); s.store.save.mockImplementationOnce(() => pending.promise);
    s.finish(); s.session.replay(); expect(s.session.snapshot().phase).toBe("results");
    pending.resolve(); await flush(); const oldId = s.session.snapshot().attempt!.id;
    s.session.replay(); s.session.rawMessage(raw());
    expect(s.session.snapshot()).toMatchObject({ phase: "ready", attempt: null });
    expect(s.session.passage).toBe(s.p);
    s.session.begin(); await flush();
    expect(s.session.snapshot().attempt!.id).not.toBe(oldId);
    expect(s.session.snapshot().attempt!.attacks).toEqual([]);
    s.session.stop(); await flush();
  });
  it.each(["background", "disconnect", "ownership", "unmount", "audio"])("interrupts on %s and never fabricates future misses", async (reason) => {
    const s = setup(); s.session.begin(); await flush(); s.at(100);
    if (reason === "disconnect") s.session.disconnect(TEST_INPUT.id);
    else if (reason === "ownership") s.session.ownershipChanged(false);
    else if (reason === "audio") { s.audio.state = "suspended"; s.session.tick(); }
    else s.session.interrupt(reason);
    await flush();
    expect(s.session.snapshot()).toMatchObject({ phase: "results", save: "saved", attempt: { status: "interrupted" } });
    expect(s.session.snapshot().attempt!.assessment).toMatchObject({ missing: 0, unobserved: 2 });
    expect(s.audio.close).toHaveBeenCalledTimes(1);
  });
  it("cancels a pending start without allowing late acknowledgement to schedule sound", async () => {
    const s = setup(); const pending = deferred(); s.store.save.mockImplementationOnce(() => pending.promise);
    s.session.begin(); s.session.interrupt("exit"); await flush(); pending.resolve(); await flush();
    expect(s.session.snapshot().phase).toBe("results");
    expect(s.audio.createOscillator).not.toHaveBeenCalled();
    expect(s.audio.close).toHaveBeenCalledTimes(1);
  });
  it("records audio activation denial as failed and cancels all native resources", async () => {
    const s = setup(); s.audio.state = "suspended"; s.audio.resume.mockRejectedValueOnce(Error("denied"));
    s.session.begin(); await flush();
    expect(s.session.snapshot()).toMatchObject({ phase: "results", save: "saved", attempt: { status: "failed" } });
    expect(s.audio.createOscillator).not.toHaveBeenCalled();
  });
  it("refuses a start without ownership or selected physical identity", () => {
    const s = setup(); s.session.ownershipChanged(false); s.session.begin();
    expect(s.factory).not.toHaveBeenCalled();
  });
  it("records only raw attacks rather than polling held pitch state", async () => {
    const s = setup(); s.session.begin(); await flush(); s.at(0); s.session.rawMessage(raw());
    s.at(4000); s.finish(); await flush();
    expect(s.session.snapshot().attempt!.attacks).toHaveLength(1);
    expect(s.session.snapshot().attempt!.assessment).toMatchObject({ matched: 1, missing: 1 });
  });
  it("retains bounded observed evidence for stopped sessions", async () => {
    const s = setup(); s.session.begin(); await flush(); s.at(500); s.session.stop(); await flush();
    const a = s.session.snapshot().attempt!;
    expect(a.assessment).toMatchObject({ missing: 1, unobserved: 1 });
    expect(() => validateContinuousAttempt({ ...a, attacks: [attack(1, 60, -1)] })).toThrow(/evidence/);
  });
  it("rejects delayed count-in notes and stale queued messages from an earlier replay", async () => {
    const s = setup(); s.session.begin(); await flush(); s.at(100);
    s.session.rawMessage(raw(60, 80, 500, 1100));
    expect(s.session.snapshot().attempt!.attacks).toEqual([]);
    s.finish(); await flush(); s.session.replay(); s.session.begin(); await flush();
    s.audio.currentTime += 4.2; s.session.tick();
    s.session.rawMessage(raw(60, 80, 1100, 14000));
    expect(s.session.snapshot().attempt!.attacks).toEqual([]);
    s.session.stop(); await flush();
  });
  it("does not race a disconnected piano into a scored start and can start after reconnecting", async () => {
    const s = setup(); s.session.disconnect(TEST_INPUT.id); s.session.begin();
    expect(s.factory).not.toHaveBeenCalled();
    s.session.reconnect(TEST_INPUT.id); s.session.begin(); await flush();
    expect(s.session.snapshot().phase).toBe("count-in"); s.session.stop(); await flush();
  });
  it("interrupts a failed checkpoint and retains evidence for terminal saving", async () => {
    const s = setup(); s.session.begin(); await flush(); s.store.save.mockRejectedValueOnce(Error("checkpoint"));
    s.at(2100); await flush();
    expect(s.session.snapshot()).toMatchObject({ phase: "results", save: "saved", attempt: { status: "interrupted" } });
  });
});
