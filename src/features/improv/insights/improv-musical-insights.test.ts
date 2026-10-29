import { describe, expect, it } from "vitest";
import { pausePerformanceFixture, pauseSteps, performanceFixture } from "../improv-test-fixture";
import { analyzeImprovTake } from "./improv-musical-insights";
import { exportImprovMidi } from "../improv-midi-export";
import { immutableCopy, type ImprovLoadedTake } from "../improv-library";

describe("saved-take musical insights", () => {
  it("returns an immutable versioned result without changing legacy raw evidence or MIDI export", async () => {
    const { loaded } = await performanceFixture([
      { bytes: [0x90, 60, 90] }, { bytes: [0x90, 64, 80] }, { bytes: [0x80, 60, 0] }, { bytes: [0x80, 64, 0] },
    ]);
    const before = JSON.stringify(loaded), midi = exportImprovMidi(loaded);
    const result = analyzeImprovTake(loaded);
    expect(result.version).toBe(1);
    expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(loaded)).toBe(before);
    expect(exportImprovMidi(loaded)).toEqual(midi);
    expect(result.overview.noteAttacks).toBe(2);
  });
  it("does not use unsaved events to complete a musical gesture", async () => {
    const { loaded } = await performanceFixture([
      { bytes: [0x90, 60, 90] }, { bytes: [0x90, 64, 90] }, { bytes: [0x90, 67, 90] },
    ], { mode: "incomplete", committedCount: 2 });
    const result = analyzeImprovTake(loaded);
    expect(result.overview.eventCount).toBe(2);
    expect(result.harmony).toHaveLength(0);
    expect(result.limitations.join(" ")).toContain("durable prefix");
  });
  it("reports capture interruption separately from a complete observed terminal boundary", async () => {
    const { loaded } = await performanceFixture([
      { bytes: [0x90, 60, 90] }, { bytes: [0x80, 60, 0] },
    ], { mode: "interrupted" });
    const result = analyzeImprovTake(loaded);
    expect(result.overview.knownEnd).toBe(true);
    expect(result.limitations.join(" ")).toContain("Capture was interrupted");
  });
  it("caps activity output explicitly while keeping full-journal attack totals", async () => {
    const { loaded } = await performanceFixture(Array.from({ length: 70 }, (_, i) => [
      { bytes: [0x90, 60, 90], receivedAtMs: 200 + i * 2000 }, { bytes: [0x80, 60, 0], receivedAtMs: 300 + i * 2000 },
    ]).flat(), { end: 140500 });
    const result = analyzeImprovTake(loaded);
    expect(result.phrases).toHaveLength(64);
    expect(result.rests).toHaveLength(64);
    expect(result.caps.truncated).toEqual(expect.arrayContaining(["phrases", "rests"]));
    expect(result.overview.noteAttacks).toBe(70);
  });
  it("keeps v2 raw controls, timing, JSON evidence and MIDI export unchanged", async () => {
    const { loaded } = await pausePerformanceFixture([
      { bytes: [0x90, 60, 90], atMs: 200 }, { bytes: [0x80, 60, 0], atMs: 400 }, ...pauseSteps(500, 2000),
      { bytes: [0x90, 64, 90], atMs: 2200 }, { bytes: [0x80, 64, 0], atMs: 2400 },
    ], 2500);
    const before = JSON.stringify(loaded), midi = exportImprovMidi(loaded);
    const result = analyzeImprovTake(loaded);
    expect(result.overview).toMatchObject({ pauseCount: 1, durationMs: 900 });
    expect(JSON.stringify(loaded)).toBe(before);
    expect(exportImprovMidi(loaded)).toEqual(midi);
  });
  it("analyzes a 100,000-event journal expanded from persisted legacy evidence with bounded output", async () => {
    // Fake IndexedDB clones every checkpoint; isolate analysis complexity from that fixture's storage cost.
    const { loaded } = await performanceFixture([{ bytes: [0x90, 60, 90], receivedAtMs: 200, sourceTimeStampMs: 200 }], { end: 100300 });
    const seed = loaded.chunks[0].events[0];
    const events = Array.from({ length: 100_000 }, (_, i) => ({ ...seed, sequence: i + 1,
      raw: { ...seed.raw, sequence: i + 1, bytes: [i < 50_000 ? 0x90 : 0x80, 60, i < 50_000 ? 90 : 0],
        receivedAtMs: 200 + i, sourceTimeStampMs: 200 + i } }));
    const chunks = Array.from({ length: Math.ceil(events.length / 256) }, (_, index) => ({ ...loaded.chunks[0], index,
      startSequence: index * 256 + 1, endSequence: Math.min((index + 1) * 256, events.length), events: events.slice(index * 256, (index + 1) * 256) }));
    const large: ImprovLoadedTake = immutableCopy({ record: { ...loaded.record, chunkCount: chunks.length, committedEventWatermark: events.length,
      capture: { ...loaded.record.capture, eventCount: events.length, eventWatermark: events.length, lastTransportSequence: events.length } }, chunks });
    const result = analyzeImprovTake(large);
    expect(result.overview).toMatchObject({ eventCount: 100_000, noteAttacks: 50_000,
      maximumKeyDownPolyphony: 50_000, unmatchedReleases: 0, unreleasedAttacks: 0, pairedNoteCount: 0 });
    expect(result.harmony).toHaveLength(0);
    expect(result.motifs).toHaveLength(0);
    expect(result.tonal.hypotheses).toHaveLength(24);
    expect(result.phrases.length).toBeLessThanOrEqual(result.caps.phrases);
  }, 30_000);
});
