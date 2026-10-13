import { describe, expect, it, vi } from "vitest";
import { createImprovReplay, type ImprovReplayScheduler, type ImprovReplaySound } from "./improv-replay";
import { performanceFixture, pausePerformanceFixture, pauseSteps } from "./improv-test-fixture";

function clock() {
  let now = 0; const tasks = new Set<{ at: number; callback: () => void }>();
  const scheduler: ImprovReplayScheduler = { now: () => now, after: (delay, callback) => {
    const task = { at: now + delay, callback }; tasks.add(task); return () => { tasks.delete(task); };
  } };
  const advance = (end: number) => {
    while (true) {
      const task = [...tasks].filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!task) break; now = task.at; tasks.delete(task); task.callback();
    }
    now = end;
  };
  return { scheduler, advance, tasks, setNow: (value: number) => { now = value; } };
}
function sound(started: () => Promise<boolean> = () => Promise.resolve(true)) {
  const voices: { release: ReturnType<typeof vi.fn>; started: Promise<boolean> }[] = [];
  const attack = vi.fn<ImprovReplaySound["attack"]>(() => {
    const voice = { release: vi.fn(), started: started() }; voices.push(voice); return voice;
  });
  return { adapter: { attack, dispose: vi.fn() }, attack, voices };
}
function setup(started?: () => Promise<boolean>) { const c = clock(); const s = sound(started); return { ...c, ...s, engine: createImprovReplay(s.adapter, c.scheduler) }; }

describe("explicit MIDI piano replay", () => {
  it("reads the scheduler anchor through leading/trailing silence, freezes Stop and restarts at zero", async () => {
    const { loaded } = await performanceFixture([{ receivedAtMs: 1200 }, { receivedAtMs: 1300, bytes: [0x80, 60, 0] }], { end: 5100 });
    const before = structuredClone(loaded); const s = setup(); s.setNow(20_000);
    const first = s.engine.play(loaded);
    expect(first.transport.positionMs()).toBe(0); expect(first.transport.active()).toBe(true);
    s.advance(20_500); expect(first.transport.positionMs()).toBe(500); expect(s.attack).not.toHaveBeenCalled();
    s.advance(21_100); expect(s.attack).toHaveBeenCalledOnce(); expect(first.transport.positionMs()).toBe(1100);
    s.advance(22_345); first.stop(); expect(first.transport.positionMs()).toBe(2345); expect(first.transport.active()).toBe(false);
    s.advance(25_000); expect(first.transport.positionMs()).toBe(2345);
    const next = s.engine.play(loaded); expect(next.transport.positionMs()).toBe(0); expect(first.transport.positionMs()).toBe(2345);
    s.advance(30_000); await expect(next.completion).resolves.toBe("completed");
    expect(next.transport.positionMs()).toBe(next.timing.durationMs); expect(next.transport.positionMs()).toBe(5000);
    s.advance(40_000); expect(next.transport.positionMs()).toBe(5000); expect(loaded).toEqual(before);
  });
  it("holds the last valid position on clock regression, unavailable reads and transport failure", async () => {
    const { loaded } = await performanceFixture([{}], { end: 5100 }); const s = setup(); const run = s.engine.play(loaded);
    s.setNow(2000); expect(run.transport.positionMs()).toBe(2000);
    s.setNow(1500); expect(run.transport.positionMs()).toBe(2000);
    s.setNow(NaN); expect(run.transport.positionMs()).toBe(2000);
    [...s.tasks][0].callback(); await expect(run.completion).resolves.toBe("failed");
    s.setNow(4000); expect(run.transport.positionMs()).toBe(2000); expect(run.transport.active()).toBe(false);
  });
  it("reuses capture-pause compression once for the clock, events and terminal position", async () => {
    const f = await pausePerformanceFixture([{ atMs: 200 }, ...pauseSteps(500, 10_500),
      { atMs: 10_600, bytes: [0x90, 64, 90] }, { atMs: 10_700, bytes: [0x80, 64, 0] }], 11_100);
    const before = structuredClone(f.loaded); const s = setup(); const run = s.engine.play(f.loaded);
    expect(run.timing.durationMs).toBe(1000);
    s.advance(500); expect(run.transport.positionMs()).toBe(500);
    expect(s.attack.mock.calls.map(([note]) => note.pitch)).toEqual([60, 64]);
    s.advance(1000); await expect(run.completion).resolves.toBe("completed");
    expect(run.transport.positionMs()).toBe(1000); expect(f.loaded).toEqual(before);
  });
  it.each(["completed", "cancelled"] as const)("labels generated %s replay cleanup separately from raw releases", async result => {
    const f = await pausePerformanceFixture([{ atMs: 200 }], 500); const before = structuredClone(f.loaded);
    const s = setup(); const run = s.engine.play(f.loaded); s.advance(100);
    if (result === "completed") s.advance(400); else run.stop();
    await expect(run.completion).resolves.toBe(result); expect(s.voices[0].release).toHaveBeenCalledOnce();
    expect(run.generated()).toEqual([{ kind: result === "completed" ? "terminal-cleanup" : "replay-stop-cleanup", atMs: result === "completed" ? 400 : null }]);
    expect(f.loaded).toEqual(before);
  });
  it("prepares long paused system-message context without scheduling a collapsed playback burst", async () => {
    const p = pauseSteps(500, 10_500); const f = await pausePerformanceFixture([p[0], p[1],
      ...Array.from({ length: 10_000 }, () => ({ atMs: 1000, bytes: [0xf8] })), ...p.slice(2), { atMs: 10_600 }], 10_700);
    const s = setup(); const run = s.engine.play(f.loaded); expect(run.ignored()).toHaveLength(10_000);
    expect(s.tasks.size).toBe(1); s.advance(500); expect(s.attack).toHaveBeenCalledOnce(); s.advance(600);
    await expect(run.completion).resolves.toBe("completed"); expect(s.tasks.size).toBe(0); expect(f.loaded.record.committedEventWatermark).toBe(10_001);
  });
  it("replays compressed segments, cleans held voices at the seam and excludes paused attacks", async () => {
    const p = pauseSteps(500, 10_500);
    const f = await pausePerformanceFixture([{ atMs: 200, bytes: [0x90, 60, 80] }, p[0], p[1], { atMs: 1000, bytes: [0x90, 70, 50] },
      ...p.slice(2), { atMs: 10_500, bytes: [0x90, 64, 90] }, { atMs: 10_600, bytes: [0x80, 64, 0] }], 10_700);
    const s = setup(); const run = s.engine.play(f.loaded); s.advance(100); expect(s.attack).toHaveBeenCalledOnce();
    s.advance(400); expect(s.voices[0].release).toHaveBeenCalledOnce(); expect(s.attack.mock.calls.map(([note]) => note.pitch)).toEqual([60, 64]);
    s.advance(600); await expect(run.completion).resolves.toBe("completed"); expect(s.tasks.size).toBe(0);
    expect(run.generated()).toEqual([{ kind: "pause-boundary-cleanup", atMs: 400 }]); expect(run.ignored()[0].reason).toBe("intentional-pause-context");
  });
  it("does not release a fresh same-pitch voice for a key held across Pause", async () => {
    const f = await pausePerformanceFixture([{ atMs: 200 }, ...pauseSteps(500, 10_500), { atMs: 10_500, bytes: [0x90, 60, 90] },
      { atMs: 10_600, bytes: [0x80, 60, 0] }, { atMs: 10_700, bytes: [0x80, 60, 0] }], 10_800);
    const s = setup(); const run = s.engine.play(f.loaded); s.advance(500); expect(s.voices[1].release).not.toHaveBeenCalled();
    s.advance(600); expect(s.voices[1].release).toHaveBeenCalledOnce(); s.advance(700); await run.completion;
    expect(run.ignored()[0].reason).toBe("cross-pause-release");
  });
  it("restores observed pedal after Resume without claiming acoustic sustain", async () => {
    const p = pauseSteps(500, 10_500); const f = await pausePerformanceFixture([p[0], p[1], { atMs: 1000, bytes: [0xb0, 64, 91] },
      ...p.slice(2), { atMs: 10_500 }, { atMs: 10_600, bytes: [0x80, 60, 0] }, { atMs: 10_700, bytes: [0xb0, 64, 0] }], 10_800);
    const s = setup(); const run = s.engine.play(f.loaded); s.advance(500); expect(s.voices[0].release).not.toHaveBeenCalled();
    s.advance(600); expect(s.voices[0].release).toHaveBeenCalledOnce(); s.advance(700); await run.completion;
    expect(run.generated().some(e => e.kind === "resume-observed-controller-restore")).toBe(true);
  });
  it("does not play on construction, schedules leading silence, velocities and completion", async () => {
    const { loaded } = await performanceFixture([{ bytes: [0x93, 60, 64], receivedAtMs: 200 }, { bytes: [0x83, 60, 10], receivedAtMs: 300 }]);
    const s = setup(); expect(s.attack).not.toHaveBeenCalled(); const run = s.engine.play(loaded);
    s.advance(99); expect(s.attack).not.toHaveBeenCalled(); s.advance(100);
    expect(s.attack).toHaveBeenCalledWith({ pitch: 60, channel: 3, velocity: 64, gain: 64 / 127 });
    s.advance(200); expect(s.voices[0].release).toHaveBeenCalledTimes(1); s.advance(400);
    await expect(run.completion).resolves.toBe("completed"); expect(s.tasks.size).toBe(0);
  });
  it("preserves simultaneous chord attacks and overlapping pitch polyphony", async () => {
    const { loaded } = await performanceFixture([{ bytes: [0x90, 60, 20], receivedAtMs: 100 }, { bytes: [0x90, 64, 60], receivedAtMs: 100 },
      { bytes: [0x90, 60, 90], receivedAtMs: 100 }]);
    const s = setup(); const run = s.engine.play(loaded);
    expect(s.attack.mock.calls.map(([note]) => note.pitch)).toEqual([60, 64, 60]); expect(s.tasks.size).toBe(1);
    s.advance(400); await expect(run.completion).resolves.toBe("completed"); expect(s.voices.every((v) => v.release.mock.calls.length === 1)).toBe(true);
  });
  it("uses FIFO for overlapping same-pitch release encodings", async () => {
    const { loaded } = await performanceFixture([{ bytes: [0x90, 60, 20], receivedAtMs: 100 }, { bytes: [0x90, 60, 90], receivedAtMs: 100 },
      { bytes: [0x90, 60, 0], receivedAtMs: 200 }, { bytes: [0x80, 60, 44], receivedAtMs: 300 }]);
    const s = setup(); s.engine.play(loaded); s.advance(100);
    expect(s.voices[0].release).toHaveBeenCalledTimes(1); expect(s.voices[1].release).not.toHaveBeenCalled();
    s.advance(200); expect(s.voices[1].release).toHaveBeenCalledTimes(1); s.engine.stop();
  });
  it("pairs releases per channel without releasing another channel's pitch", async () => {
    const { loaded } = await performanceFixture([{ bytes: [0x90, 60, 20], receivedAtMs: 100 }, { bytes: [0x91, 60, 90], receivedAtMs: 100 },
      { bytes: [0x81, 60, 1], receivedAtMs: 200 }]);
    const s = setup(); s.engine.play(loaded); s.advance(100);
    expect(s.voices[0].release).not.toHaveBeenCalled(); expect(s.voices[1].release).toHaveBeenCalledTimes(1); s.engine.stop();
  });
  it("interprets CC64 >=64 conventionally while preserving repeated/intermediate evidence", async () => {
    const { loaded } = await performanceFixture([{ bytes: [0xb1, 64, 64], receivedAtMs: 100 }, { bytes: [0x91, 60, 90], receivedAtMs: 100 },
      { bytes: [0x81, 60, 1], receivedAtMs: 200 }, { bytes: [0xb1, 64, 90], receivedAtMs: 210 },
      { bytes: [0xb1, 64, 90], receivedAtMs: 220 }, { bytes: [0xb1, 64, 63], receivedAtMs: 300 }]);
    const before = structuredClone(loaded); const s = setup(); s.engine.play(loaded); s.advance(150);
    expect(s.voices[0].release).not.toHaveBeenCalled(); s.advance(200); expect(s.voices[0].release).toHaveBeenCalledTimes(1);
    s.advance(400); expect(loaded).toEqual(before);
  });
  it("pedal-up releases only deferred voices on its channel and keeps held keys sounding", async () => {
    const { loaded } = await performanceFixture([{ bytes: [0xb0, 64, 127], receivedAtMs: 100 }, { bytes: [0x90, 60, 90], receivedAtMs: 100 },
      { bytes: [0x90, 64, 90], receivedAtMs: 100 }, { bytes: [0x80, 60, 0], receivedAtMs: 150 },
      { bytes: [0xb1, 64, 0], receivedAtMs: 200 }, { bytes: [0xb0, 64, 0], receivedAtMs: 300 }]);
    const s = setup(); s.engine.play(loaded); s.advance(100); expect(s.voices[0].release).not.toHaveBeenCalled();
    s.advance(200); expect(s.voices[0].release).toHaveBeenCalledTimes(1); expect(s.voices[1].release).not.toHaveBeenCalled(); s.engine.stop();
  });
  it("Stop releases held and sustained voices, cancels timers and is idempotent", async () => {
    const { loaded } = await performanceFixture([{ bytes: [0xb0, 64, 127], receivedAtMs: 100 }, { bytes: [0x90, 60, 90], receivedAtMs: 100 },
      { bytes: [0x80, 60, 0], receivedAtMs: 110 }, { bytes: [0x90, 64, 90], receivedAtMs: 120 }]);
    const s = setup(); const run = s.engine.play(loaded); s.advance(20); run.stop(); run.stop(); s.engine.stop();
    await expect(run.completion).resolves.toBe("cancelled"); expect(s.voices.every((v) => v.release.mock.calls.length === 1)).toBe(true);
    expect(s.tasks.size).toBe(0); s.advance(1000); expect(s.attack).toHaveBeenCalledTimes(2);
  });
  it.each(["recording", "incomplete", "interrupted"] as const)("ends %s playback safely without modifying incomplete captures", async (mode) => {
    const { loaded } = await performanceFixture([{ receivedAtMs: 100 }], { mode }); const before = structuredClone(loaded);
    const s = setup(); const run = s.engine.play(loaded); s.advance(400); await expect(run.completion).resolves.toBe("completed");
    expect(s.voices[0].release).toHaveBeenCalledTimes(1); expect(loaded).toEqual(before);
  });
  it("empty takes retain duration, do not synthesize unknown initial keys/pedal and finish", async () => {
    const { loaded } = await performanceFixture([], { end: 1000 }); const s = setup(); const run = s.engine.play(loaded);
    s.advance(899); expect(s.attack).not.toHaveBeenCalled(); s.advance(900); await expect(run.completion).resolves.toBe("completed");
  });
  it("reports unrendered, malformed and unmatched messages without inventing voices", async () => {
    const { loaded } = await performanceFixture([{ bytes: [0x80, 60, 1] }, { bytes: [0xc0, 2] }, { bytes: [0xf8] },
      { bytes: [0x90, 60] }, { bytes: null, dataStatus: "unavailable" }]); const s = setup(); const run = s.engine.play(loaded); s.advance(400);
    expect(s.attack).not.toHaveBeenCalled(); expect(run.ignored().map((e) => e.reason)).toEqual(["unmatched-release", "not-rendered-by-piano-replay", "unsupported", "malformed", "missing"]);
  });
  it("projects anomalous times without sorting or unbounded delays", async () => {
    const { loaded } = await performanceFixture([{ receivedAtMs: NaN, sourceTimeStampMs: 200 }, { receivedAtMs: 150 }, { receivedAtMs: Infinity, sourceTimeStampMs: null }]);
    const s = setup(); const run = s.engine.play(loaded); s.advance(100);
    expect(s.attack).toHaveBeenCalledTimes(3); expect(run.timing.events.map((e) => e.atMs)).toEqual([100, 100, 100]); s.engine.stop();
  });
  it("replaces playback and ignores stale scheduled callbacks", async () => {
    const { loaded } = await performanceFixture([{ receivedAtMs: 100 }, { receivedAtMs: 200 }]); const s = setup();
    const one = s.engine.play(loaded); const stale = [...s.tasks][0].callback; const two = s.engine.play(loaded); stale();
    await expect(one.completion).resolves.toBe("cancelled"); expect(s.attack).toHaveBeenCalledTimes(2); two.stop();
  });
  it("late start failure from a cancelled generation cannot cancel its replacement", async () => {
    let finish!: (ok: boolean) => void; const s = setup(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const { loaded } = await performanceFixture([{ receivedAtMs: 100 }]); const one = s.engine.play(loaded); const oldFinish = finish;
    const two = s.engine.play(loaded); oldFinish(false); await Promise.resolve(); expect(s.voices[1].release).not.toHaveBeenCalled();
    finish(true); s.advance(400); await expect(one.completion).resolves.toBe("cancelled"); await expect(two.completion).resolves.toBe("completed");
  });
  it("failed or rejected audio startup ends the run and releases every voice", async () => {
    const { loaded } = await performanceFixture([{ receivedAtMs: 100 }]); const s = setup(() => Promise.reject(new Error("blocked")));
    const run = s.engine.play(loaded); await expect(run.completion).resolves.toBe("failed"); expect(s.voices[0].release).toHaveBeenCalledTimes(1); expect(s.tasks.size).toBe(0);
  });
  it("disposal is safe for Strict Mode setup/cleanup and new independent instances", async () => {
    const { loaded } = await performanceFixture([{ receivedAtMs: 100 }]); const s = setup(); const run = s.engine.play(loaded);
    s.engine.dispose(); s.engine.dispose(); await expect(run.completion).resolves.toBe("cancelled"); expect(s.adapter.dispose).toHaveBeenCalledTimes(1);
    expect(() => s.engine.play(loaded)).toThrow(/disposed/); const next = setup(); next.engine.play(loaded); expect(next.attack).toHaveBeenCalledTimes(1); next.engine.dispose();
  });
  it("continues releasing other voices if one adapter release throws", async () => {
    const { loaded } = await performanceFixture([{ receivedAtMs: 100 }, { bytes: [0x90, 64, 90], receivedAtMs: 100 }]); const s = setup(); const run = s.engine.play(loaded);
    s.voices[0].release.mockImplementation(() => { throw new Error("voice failed"); }); run.stop();
    await expect(run.completion).resolves.toBe("failed"); expect(s.voices[1].release).toHaveBeenCalledTimes(1);
  });
  it("fails safely if scheduling or the monotonic clock becomes unavailable", async () => {
    const { loaded } = await performanceFixture([{ receivedAtMs: 100 }]); const s = sound();
    const engine = createImprovReplay(s.adapter, { now: () => 0, after: () => { throw new Error("scheduler"); } });
    await expect(engine.play(loaded).completion).resolves.toBe("failed"); expect(s.voices[0].release).toHaveBeenCalledTimes(1);
  });
  it("ends explicitly at the live voice limit, releases the prefix and never starts later attacks", async () => {
    const { loaded } = await performanceFixture([{ receivedAtMs: 100 }, { receivedAtMs: 100 }, { receivedAtMs: 100 }, { receivedAtMs: 100 }]);
    const c = clock(); const s = sound(); const engine = createImprovReplay(s.adapter, c.scheduler, { maxVoices: 2 });
    const run = engine.play(loaded); await expect(run.completion).resolves.toBe("failed");
    expect(s.attack).toHaveBeenCalledTimes(2); expect(s.voices.every((v) => v.release.mock.calls.length === 1)).toBe(true);
    expect(run.ignored()).toContainEqual({ sequence: 3, reason: "replay-voice-limit" }); expect(loaded.record.committedEventWatermark).toBe(4);
  });
  it("naturally ended samples free voice capacity without inventing a captured release", async () => {
    const { loaded } = await performanceFixture([{ receivedAtMs: 100 }, { receivedAtMs: 200 }]); const c = clock();
    let end!: () => void;
    const adapter = { attack: vi.fn(() => ({ started: Promise.resolve(true), release: vi.fn(), ended: new Promise<void>((done) => { end = done; }) })) };
    const run = createImprovReplay(adapter, c.scheduler, { maxVoices: 1 }).play(loaded); end(); await Promise.resolve(); c.advance(100);
    expect(adapter.attack).toHaveBeenCalledTimes(2); run.stop(); expect(loaded.chunks[0].events).toHaveLength(2);
  });
  it("a regressing scheduling clock ends safely instead of resuming a prior playback", async () => {
    const { loaded } = await performanceFixture([{ receivedAtMs: 100 }]); const s = setup(); s.setNow(1000);
    const run = s.engine.play(loaded); const stale = [...s.tasks][0].callback; s.setNow(500); stale();
    await expect(run.completion).resolves.toBe("failed"); expect(s.voices[0].release).toHaveBeenCalledTimes(1);
  });
});
