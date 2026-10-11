import { describe, expect, it } from "vitest";
import { createImprovMusicalClock, createImprovPerformanceFilter } from "./improv-musical-time";
import { pausePerformanceFixture, pauseSteps, fixtureObservation, performanceFixture } from "./improv-test-fixture";
import { projectImprovTiming, summarizeImprovTake } from "./improv-performance";
import { timelineFromTake, IMPROV_VISIBLE_NOTES } from "./improv-timeline";
import { encodeImprovBackup, parseImprovBackup } from "./improv-backup";
import { requireLoadedTake } from "./improv-library-validation";
import type { ImprovTakeControl } from "./improv-take";
const control = (kind: ImprovTakeControl["kind"]): ImprovTakeControl => ({ sequence: 1, afterEventSequence: 0, kind, audio: "off",
  boundary: { observation: fixtureObservation(100), validity: "valid", contextMatchesStart: true, precedesStart: false } });

describe("Improv elapsed and active musical clocks", () => {
  it("reports pause cutoffs consistently with or without later paused controller traffic", async () => {
    for (const traffic of [[], [{ atMs: 1000, bytes: [0xf8] }]]) {
      const f = await pausePerformanceFixture([{ atMs: 200 }, ...pauseSteps(500, 1500).slice(0, 2), ...traffic], 2000);
      expect(summarizeImprovTake(f.loaded)).toMatchObject({ noteAttacks: 1, unreleasedAttacks: 0, pauseCutoffAttacks: 1 });
    }
  });
  it("preserves leading silence and removes multiple intentional breaks", () => {
    const c = createImprovMusicalClock(); expect(c.position(2000)).toBe(2000);
    c.control(control("pause"), 3000); expect(c.elapsed(100_000)).toBe(3000);
    c.control(control("resume"), 100_000); expect(c.position(102_000)).toBe(5000);
    c.control(control("pause"), 103_000); c.control(control("resume"), 200_000); expect(c.position(201_000)).toBe(7000);
  });
  it.each([NaN, Infinity, -10, 0])("holds anomalous positions without changing evidence: %s", value => {
    const c = createImprovMusicalClock(); c.position(200); expect(c.position(value)).toBe(200);
  });
  it("keeps a pause open through Stop and ignores readiness acknowledgments for musical time", () => {
    const c = createImprovMusicalClock(); c.control(control("pause"), 500);
    c.control(control("resume-request"), 1000); c.control(control("resume-ack"), 2000);
    expect(c.position(3000)).toBe(500); expect(c.paused()).toBe(true);
  });
  it("does not let animation observations move an event or boundary", () => {
    const c = createImprovMusicalClock(); expect(c.elapsed(500)).toBe(500);
    expect(c.position(200)).toBe(200); c.control(control("pause"), 300); expect(c.elapsed(9999)).toBe(300);
  });
  it("removes a long pause before the first note but retains ordinary leading silence", async () => {
    const f = await pausePerformanceFixture([...pauseSteps(1100, 901_100), { atMs: 902_100, bytes: [0x90, 60, 80] }], 903_100);
    const p = projectImprovTiming(f.loaded); expect(p.durationMs).toBe(3000); expect(p.elapsedDurationMs).toBe(903_000);
    expect(p.events[0].atMs).toBe(2000); expect(p.pauseCount).toBe(1); expect(p.knownEnd).toBe(true);
  });
  it("retains paused attacks/controllers/system messages unchanged while excluding their performance", async () => {
    const steps = pauseSteps(500, 10_500);
    const f = await pausePerformanceFixture([steps[0], steps[1], { atMs: 1000, bytes: [0x90, 70, 127] },
      { atMs: 1100, bytes: [0xb0, 64, 91] }, { atMs: 1200, bytes: [0xf8] }, ...steps.slice(2), { atMs: 11_000, bytes: [0x90, 60, 30] }], 12_100);
    const p = projectImprovTiming(f.loaded); expect(p.events.map(e => e.represented)).toEqual([false, false, false, true]);
    expect(summarizeImprovTake(f.loaded)).toMatchObject({ noteAttacks: 1, pedalEvents: 0, lowestPitch: 60, highestPitch: 60, pauseCount: 1 });
    expect(f.loaded.chunks[0].events.map(e => e.raw.bytes)).toEqual([[0x90, 70, 127], [0xb0, 64, 91], [0xf8], [0x90, 60, 30]]);
  });
  it("uses the same compressed coordinates for saved staff and timing projection", async () => {
    const f = await pausePerformanceFixture([{ atMs: 200, bytes: [0x90, 60, 80] }, ...pauseSteps(500, 10_500),
      { atMs: 11_000, bytes: [0x90, 64, 90] }, { atMs: 11_100, bytes: [0x80, 64, 0] }], 12_100);
    const view = timelineFromTake(f.loaded).view(0, 0); expect(view.atMs).toBe(projectImprovTiming(f.loaded).durationMs);
    expect(view.notes.map(n => [n.pitch, n.onsetMs, n.releaseMs, n.endReason])).toEqual([[60, 100, 400, "pause"], [64, 900, 1000, undefined]]);
  });
  it("preserves equal, regressing and nonfinite raw timing across a resume", async () => {
    const f = await pausePerformanceFixture([...pauseSteps(200, 1000), { atMs: 1100, receipt: 50, bytes: [0x90, 60, 80] },
      { atMs: 1100, receipt: NaN, source: null, bytes: [0x90, 64, 80] }, { atMs: 1100, receipt: 1100, bytes: [0x90, 67, 80] }], 1200);
    const p = projectImprovTiming(f.loaded); expect(p.events.map(e => e.atMs)).toEqual([100, 100, 200]);
    expect(p.issues.length).toBeGreaterThan(0); expect(f.loaded.chunks[0].events[1].raw.receivedAtMs).toBeNaN();
  });
  it("round-trips v2 controls, raw anomalies and original first identity through JSON restore", async () => {
    const f = await pausePerformanceFixture([...pauseSteps(500, 1000), { atMs: 1200, receipt: NaN }], 1500);
    const json = encodeImprovBackup(f.evidence); expect(JSON.parse(json).version).toBe(2);
    const parsed = parseImprovBackup(json); expect(parsed).toEqual(f.evidence);
    let id = 0; const restored = await f.lib.importCollection(parsed, () => `restored-${++id}`);
    const take = await f.lib.loadTake(restored.firstTakeId!);
    expect(take.record.controls).toEqual(f.loaded.record.controls); expect(take.record.committedControlWatermark).toBe(5);
    expect(take.record.capture).toEqual(f.loaded.record.capture); expect(take.record.number).toBe(1);
    expect(projectImprovTiming(take).durationMs).toBe(projectImprovTiming(f.loaded).durationMs);
    expect(await f.lib.loadTake("take-1")).toEqual(f.loaded);
  });
  it("keeps legacy v1 records and backup encoding unchanged", async () => {
    const f = await performanceFixture([{}]); expect(f.loaded.record.schemaVersion).toBe(1);
    expect(JSON.parse(encodeImprovBackup(f.evidence)).version).toBe(1); expect(parseImprovBackup(encodeImprovBackup(f.evidence))).toEqual(f.evidence);
    expect(projectImprovTiming(f.loaded).durationMs).toBe(400);
  });
  it.each(["sequence", "order", "watermark", "clock", "accounting"])("rejects corrupt v2 control %s without repairing evidence", async kind => {
    const f = await pausePerformanceFixture(pauseSteps(500, 1000), 1500); const altered = structuredClone(f.loaded);
    const first = altered.record.controls![0];
    if (kind === "sequence") Reflect.set(first, "sequence", 2);
    if (kind === "order") Reflect.set(first, "kind", "resume");
    if (kind === "watermark") Reflect.set(first, "afterEventSequence", 1);
    if (kind === "clock") Reflect.set(first.boundary.observation.context, "ownerId", "replacement");
    if (kind === "accounting") Reflect.set(altered.record, "committedAccountedBytes", altered.record.committedAccountedBytes - 1);
    expect(() => requireLoadedTake(altered)).toThrow(); expect(() => requireLoadedTake(f.loaded)).not.toThrow();
  });
  it("bounds saved-window DOM detail in a long take with pause context", async () => {
    const f = await pausePerformanceFixture([...Array.from({ length: 2000 }, (_, i) => ({ atMs: 100 + i * 200, bytes: [0x90, i % 88 + 21, 90] })),
      ...pauseSteps(400_100, 1_000_100), { atMs: 1_000_200, bytes: [0x90, 60, 80] }], 1_300_100);
    const model = timelineFromTake(f.loaded); expect(model.view(0, 0).notes.length).toBeLessThanOrEqual(IMPROV_VISIBLE_NOTES);
    expect(model.view(0, 399_000).notes.length).toBeLessThanOrEqual(IMPROV_VISIBLE_NOTES);
    expect(projectImprovTiming(f.loaded).durationMs).toBe(700_000);
  });
});

describe("cross-pause channel/pitch FIFO interpretation", () => {
  it.each([0, 1, 15])("excludes ghost releases while preserving fresh attacks on channel %s", channel => {
    const f = createImprovPerformanceFilter(); const on = [0x90 | channel, 60, 80], off = [0x80 | channel, 60, 20];
    expect(f.accept(on, false)).toBe(true); f.pause(); expect(f.accept(on, true)).toBe(false);
    expect(f.accept(on, false)).toBe(true); expect(f.accept(off, false)).toBe(false);
    expect(f.accept(off, false)).toBe(false); expect(f.accept(off, false)).toBe(true);
  });
  it("observes pedal changes during pauses without representing them as performance", () => {
    const f = createImprovPerformanceFilter(); expect(f.accept([0xb2, 64, 37], true)).toBe(false);
    expect(f.pedals()).toEqual([[2, 37]]); expect(f.accept([0xb2, 64, 127], false)).toBe(true); expect(f.pedals()).toEqual([[2, 127]]);
  });
  it("handles velocity-zero release and keeps channels independent", () => {
    const f = createImprovPerformanceFilter(); f.accept([0x90, 60, 90], false); f.pause();
    f.accept([0x91, 60, 90], false); expect(f.accept([0x90, 60, 0], false)).toBe(false);
    expect(f.accept([0x91, 60, 0], false)).toBe(true);
  });
});
