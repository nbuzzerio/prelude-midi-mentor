import { describe, expect, it } from "vitest";
import { decodeImprovMessage, IMPROV_PROJECTION_LIMIT_MS, projectImprovTiming, summarizeImprovTake } from "./improv-performance";
import { performanceFixture } from "./improv-test-fixture";

describe("separate Improv timing projection", () => {
  it("uses receipt time from Start and retains leading/trailing gaps and delivery order", async () => {
    const { loaded } = await performanceFixture([{ receivedAtMs: 200 }, { receivedAtMs: 200 }, { receivedAtMs: 450 }], { end: 1000 });
    expect(projectImprovTiming(loaded)).toMatchObject({ durationMs: 900, knownEnd: true,
      events: [{ sequence: 1, atMs: 100, source: "receipt" }, { sequence: 2, atMs: 100 }, { sequence: 3, atMs: 350 }] });
    expect(loaded.chunks[0].events.map((e) => e.raw.receivedAtMs)).toEqual([200, 200, 450]);
  });
  it("flags regressing source/receipt clocks while holding projected delivery order", async () => {
    const { loaded } = await performanceFixture([{ receivedAtMs: 300, sourceTimeStampMs: 290 }, { receivedAtMs: 250, sourceTimeStampMs: 240 }]);
    const timing = projectImprovTiming(loaded);
    expect(timing.events.map((e) => e.atMs)).toEqual([200, 200]);
    expect(timing.issues.map((i) => i.reason)).toContain("position-held-in-delivery-order");
    expect(timing.issues.map((i) => i.reason)).toContain("regressing-browser-timestamp");
    expect(loaded.chunks[0].events[1].raw.receivedAtMs).toBe(250);
  });
  it("uses explicitly uncertain browser fallback, then previous position for unusable times", async () => {
    const { loaded } = await performanceFixture([{ receivedAtMs: NaN, sourceTimeStampMs: 200 }, { receivedAtMs: Infinity, sourceTimeStampMs: null },
      { receivedAtMs: -1, sourceTimeStampMs: -Infinity }, { receivedAtMs: IMPROV_PROJECTION_LIMIT_MS + 101 }]);
    const result = projectImprovTiming(loaded);
    expect(result.events.map((e) => e.atMs)).toEqual([100, 100, 100, 100]);
    expect(result.events[0].source).toBe("unverified-browser-fallback");
    expect(result.issues.map((i) => i.reason)).toContain("browser-clock-unverified");
  });
  it("projects before-Start evidence explicitly without discarding it", async () => {
    const { loaded } = await performanceFixture([{ receivedAtMs: 50 }]);
    expect(projectImprovTiming(loaded).events[0].atMs).toBe(0);
    expect(loaded.chunks[0].events[0].raw.receivedAtMs).toBe(50);
  });
  it("does not truncate delivered evidence beyond a terminal observation", async () => {
    const { loaded } = await performanceFixture([{ receivedAtMs: 700 }], { end: 500 });
    expect(projectImprovTiming(loaded)).toMatchObject({ durationMs: 600, issues: [{ sequence: null, reason: "delivered-events-after-observed-end" }] });
  });
  it.each(["incomplete", "recording"] as const)("ends %s projection at the durable prefix without claiming a Stop", async (mode) => {
    const { loaded } = await performanceFixture([{ receivedAtMs: 200 }, { receivedAtMs: 800 }], { mode, committedCount: 1 });
    expect(projectImprovTiming(loaded)).toMatchObject({ knownEnd: false, durationMs: 100 });
    expect(loaded.record.capture.terminal).toBeNull();
  });
  it("ignores invalid/mismatched terminal clock domains", async () => {
    const { loaded } = await performanceFixture([{ receivedAtMs: 200 }], { end: NaN });
    expect(projectImprovTiming(loaded)).toMatchObject({ knownEnd: false, durationMs: 100 });
  });
  it("keeps empty completed take duration", async () => {
    expect(projectImprovTiming((await performanceFixture([], { end: 2000 })).loaded)).toMatchObject({ events: [], durationMs: 1900, knownEnd: true });
  });
  it("a terminal from another owner/clock cannot supply a trusted end", async () => {
    const { loaded } = await performanceFixture([{ receivedAtMs: 200 }]); const changed = structuredClone(loaded);
    const terminal = changed.record.capture.terminal!;
    Reflect.set(terminal.boundary, "contextMatchesStart", false);
    Reflect.set(terminal.boundary.observation.context, "clockId", "different-document");
    expect(projectImprovTiming(changed)).toMatchObject({ knownEnd: false, durationMs: 100 });
  });
});

describe("raw-compatible message interpretation", () => {
  it.each([[0x91, 60, 0], [0x81, 60, 30], [0xb9, 64, 45], [0xc2, 12], [0xd3, 100], [0xe4, 0, 64]])("preserves channel bytes %j", (...bytes) => {
    const result = decodeImprovMessage({ bytes, dataStatus: "available" }); expect(result.kind).toBe("channel"); expect(result.bytes).toEqual(bytes); expect(result.channel).toBe(bytes[0] & 15);
  });
  it.each([[], [0x90, 60], [0x90, 60, 128], [0xc0, 1, 2], [NaN], [0x90, -1, 1], [0xf0, 1]])("identifies malformed bytes %j", (...bytes) => {
    expect(decodeImprovMessage({ bytes, dataStatus: "available" }).kind).toBe("malformed");
  });
  it("distinguishes complete SysEx, reset, missing and unreadable data", () => {
    expect(decodeImprovMessage({ bytes: [0xf0, 0x7d, 1, 0xf7], dataStatus: "available" }).kind).toBe("sysex");
    expect(decodeImprovMessage({ bytes: [0xff], dataStatus: "available" }).kind).toBe("unsupported");
    expect(decodeImprovMessage({ bytes: null, dataStatus: "unreadable" }).kind).toBe("missing");
  });
});

describe("bounded descriptive review without grading", () => {
  it("counts attacks, velocities, channel-aware key-down polyphony, pedal observations and valid pairs", async () => {
    const { loaded } = await performanceFixture([
      { bytes: [0x90, 60, 80], receivedAtMs: 200 }, { bytes: [0x91, 64, 100], receivedAtMs: 200 },
      { bytes: [0xb0, 64, 44], receivedAtMs: 210 }, { bytes: [0x90, 60, 0], receivedAtMs: 300 }, { bytes: [0x81, 64, 12], receivedAtMs: 350 },
    ]);
    expect(summarizeImprovTake(loaded)).toMatchObject({ noteAttacks: 2, lowestPitch: 60, highestPitch: 64,
      velocity: { minimum: 80, maximum: 100, mean: 90 }, pedalEvents: 1, maximumKeyDownPolyphony: 2,
      unambiguousReceiptPairedDurationsMs: [100, 150], projectedInterAttackGapsMs: [0], observedBoundaryDurationMs: 400, unreleasedAttacks: 0 });
    expect(summarizeImprovTake(loaded)).not.toHaveProperty("accuracy");
  });
  it("excludes ambiguous same-pitch durations, retains unmatched and repeated evidence", async () => {
    const { loaded } = await performanceFixture([{ bytes: [0x90, 60, 1] }, { bytes: [0x90, 60, 127] }, { bytes: [0x80, 60, 5] },
      { bytes: [0x80, 61, 3] }, { bytes: [0xb0, 64, 64] }, { bytes: [0xb0, 64, 64] }]);
    expect(summarizeImprovTake(loaded)).toMatchObject({ repeatedOverlappingAttacks: 1, unmatchedReleases: 1, unreleasedAttacks: 1,
      unambiguousReceiptPairedDurationsMs: [], pedalEvents: 2 });
  });
  it("uses null for unknown duration and pitch/velocity observations in empty incomplete takes", async () => {
    expect(summarizeImprovTake((await performanceFixture([], { mode: "incomplete" })).loaded)).toMatchObject({ observedBoundaryDurationMs: null, lowestPitch: null, velocity: { mean: null }, noteAttacks: 0 });
  });
});
