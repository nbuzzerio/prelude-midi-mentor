import { describe, expect, it } from "vitest";
import { pausePerformanceFixture, pauseSteps, performanceFixture } from "../improv-test-fixture";
import { collectImprovInsightEvidence, monophonicInsightRuns } from "./improv-insight-evidence";
import { analyzeImprovHarmony } from "./improv-harmonic-insights";
import { analyzeImprovPatterns } from "./improv-pattern-insights";

describe("musical-insight evidence", () => {
  it("measures attacks, velocities, key lifetimes and pitch classes from the full journal", async () => {
    const { loaded } = await performanceFixture([
      { bytes: [0x90, 60, 30], receivedAtMs: 120 }, { bytes: [0x90, 64, 100], receivedAtMs: 150 },
      { bytes: [0x80, 60, 0], receivedAtMs: 220 }, { bytes: [0x90, 64, 0], receivedAtMs: 350 },
    ]);
    const result = collectImprovInsightEvidence(loaded);
    expect(result.overview).toMatchObject({ eventCount: 4, noteAttacks: 2, lowestPitch: 60, highestPitch: 64,
      meanVelocity: 65, maximumKeyDownPolyphony: 2, meanKeyDownDurationMs: 150,
      velocityDistribution: { soft: 1, medium: 0, strong: 1 }, sustain: { initialState: "unknown", observedPedalMessages: 0 } });
    expect(result.overview.pitchClassDistribution[0].attacks).toBe(1);
    expect(monophonicInsightRuns(result.notes)).toEqual([]);
  });

  it("pairs overlapping identical pitches FIFO and excludes the entire ambiguous group", async () => {
    const { loaded } = await performanceFixture([
      { bytes: [0x90, 60, 90] }, { bytes: [0x90, 60, 80] }, { bytes: [0x80, 60, 0] }, { bytes: [0x80, 60, 0] },
    ]);
    const result = collectImprovInsightEvidence(loaded);
    expect(result.notes.map(note => note.ambiguous)).toEqual([true, true]);
    expect(result.overview.pairedNoteCount).toBe(0);
    expect(result.limitations.join(" ")).toContain("FIFO");
  });

  it("separates capture pauses even when musical positions meet", async () => {
    const { loaded } = await pausePerformanceFixture([
      { atMs: 200, bytes: [0x90, 60, 80] }, ...pauseSteps(400, 5000),
      { atMs: 5010, bytes: [0x80, 60, 0] }, { atMs: 5020, bytes: [0x90, 64, 80] },
      { atMs: 5200, bytes: [0x80, 64, 0] },
    ], 5300);
    const result = collectImprovInsightEvidence(loaded);
    expect(result.overview).toMatchObject({ noteAttacks: 2, durationMs: 600, pauseCount: 1, pauseCutoffAttacks: 1 });
    expect(result.phrases).toHaveLength(2);
    expect(result.rests).toHaveLength(0);
    expect(result.overview.rhythm.pairedInterAttackCount).toBe(0);
    expect(result.notes[1].startMs).toBe(320);
  });

  it("finds released-key rests rather than mistaking a held note for a rest", async () => {
    const { loaded } = await performanceFixture([
      { bytes: [0x90, 60, 90], receivedAtMs: 200 }, { bytes: [0x80, 60, 0], receivedAtMs: 3200 },
      { bytes: [0x90, 62, 90], receivedAtMs: 3300 }, { bytes: [0x80, 62, 0], receivedAtMs: 3400 },
      { bytes: [0x90, 64, 90], receivedAtMs: 5000 }, { bytes: [0x80, 64, 0], receivedAtMs: 5100 },
    ], { end: 5200 });
    const result = collectImprovInsightEvidence(loaded);
    expect(result.phrases).toHaveLength(2);
    expect(result.rests).toEqual([{ startMs: 3300, endMs: 4900 }]);
  });

  it("reports unknown ends, unmatched releases, malformed messages and unsupported controls", async () => {
    const { loaded } = await performanceFixture([
      { bytes: [0x80, 55, 0] }, { bytes: [0x90, 60] }, { bytes: null, dataStatus: "unavailable" },
      { bytes: [0xe0, 1, 70] }, { bytes: [0xb0, 66, 127] }, { bytes: [0x90, 60, 90] },
    ], { mode: "incomplete" });
    const result = collectImprovInsightEvidence(loaded);
    expect(result.overview).toMatchObject({ knownEnd: false, unmatchedReleases: 1, unreleasedAttacks: 1 });
    expect(result.limitations.join(" ")).toMatch(/durable prefix/);
    expect(result.limitations.join(" ")).toMatch(/pitch bend/);
  });

  it("tracks observed pedal transitions without assuming initial pedal-up", async () => {
    const { loaded } = await performanceFixture([
      { bytes: [0xb0, 64, 127] }, { bytes: [0x90, 60, 90] }, { bytes: [0x80, 60, 0] }, { bytes: [0xb0, 64, 0] },
    ]);
    const result = collectImprovInsightEvidence(loaded);
    expect(result.overview.sustain).toEqual({ initialState: "unknown", observedPedalMessages: 2, downMessages: 1, upMessages: 1 });
    expect(monophonicInsightRuns(result.notes)).toHaveLength(0);
  });

  it("preserves physical key lifetimes across clock and unsupported controller messages", async () => {
    const { loaded } = await performanceFixture([
      { bytes: [0x90, 60, 90], receivedAtMs: 200 }, { bytes: [0xf8], receivedAtMs: 250 },
      { bytes: [0xe0, 1, 70], receivedAtMs: 300 }, { bytes: [0x90, 64, 90], receivedAtMs: 350 },
      { bytes: [0x80, 60, 0], receivedAtMs: 400 }, { bytes: [0x80, 64, 0], receivedAtMs: 450 },
    ]);
    const result = collectImprovInsightEvidence(loaded);
    expect(result.overview).toMatchObject({ pairedNoteCount: 2, meanKeyDownDurationMs: 150,
      unmatchedReleases: 0, maximumKeyDownPolyphony: 2 });
    expect(result.notes.every(note => !note.inferenceEligible)).toBe(true);
    expect(result.limitations.join(" ")).toContain("1 MIDI clock");
  });

  it("does not infer durations or rhythm from clamped or out-of-boundary receipts", async () => {
    const { loaded } = await performanceFixture([
      { bytes: [0x90, 60, 90], receivedAtMs: 50 }, { bytes: [0x80, 60, 0], receivedAtMs: 150 },
      { bytes: [0x90, 64, 90], receivedAtMs: 200 }, { bytes: [0x80, 64, 0], receivedAtMs: 250 },
      { bytes: [0x90, 67, 90], receivedAtMs: 700 }, { bytes: [0x80, 67, 0], receivedAtMs: 800 },
    ], { end: 500 });
    const result = collectImprovInsightEvidence(loaded);
    expect(result.overview.pairedNoteCount).toBe(1);
    expect(result.overview.rhythm.pairedInterAttackCount).toBe(0);
    expect(result.notes.map(note => note.timingReliable)).toEqual([false, true, false]);
  });

  it("keeps valid physical MIDI clock-interleaved notes eligible for inference", async () => {
    const { loaded } = await performanceFixture([
      { bytes: [0x90, 60, 90], receivedAtMs: 200 }, { bytes: [0xf8], receivedAtMs: 250 },
      { bytes: [0xfe], receivedAtMs: 280 }, { bytes: [0x80, 60, 0], receivedAtMs: 400 },
    ]);
    expect(collectImprovInsightEvidence(loaded).notes[0].inferenceEligible).toBe(true);
  });

  it("preserves physical occupancy across inference boundaries for rests and monophonic runs", async () => {
    const { loaded } = await performanceFixture([
      { bytes: [0x90, 48, 90], receivedAtMs: 200 }, { bytes: [0xb1, 66, 127], receivedAtMs: 1000 },
      ...[60, 64, 62, 67, 64].flatMap((pitch, i) => [
        { bytes: [0x92, pitch, 90], receivedAtMs: 1500 + i * 2500 },
        { bytes: [0x82, pitch, 0], receivedAtMs: 1600 + i * 2500 },
      ]),
      { bytes: [0x80, 48, 0], receivedAtMs: 15000 },
    ].sort((a, b) => a.receivedAtMs - b.receivedAtMs), { end: 15100 });
    const result = collectImprovInsightEvidence(loaded);
    expect(result.rests).toHaveLength(0);
    expect(result.phrases).toHaveLength(1);
    expect(monophonicInsightRuns(result.notes)).toHaveLength(0);
  });

  it.each([
    [0xb0, 7, 100], [0xb0, 10, 64], [0xb0, 11, 127], [0xb0, 39, 1], [0xb0, 42, 1], [0xb0, 43, 1],
    [0xb0, 0, 1], [0xb0, 32, 1], [0xb0, 67, 127], [0xc0, 40], [0xa0, 60, 80], [0xd0, 80],
  ])("preserves nominal-note continuity across ordinary expressive message %j", async (...bytes) => {
    const { loaded } = await performanceFixture([
      { bytes: [0x90, 60, 90] }, { bytes }, { bytes: [0x80, 60, 0] },
      { bytes: [0x90, 64, 90] }, { bytes: [0x80, 64, 0] },
    ]);
    const result = collectImprovInsightEvidence(loaded);
    expect(result.notes.every(note => note.pitchEligible && note.inferenceEligible)).toBe(true);
    expect(monophonicInsightRuns(result.notes).map(run => run.length)).toEqual([2]);
    expect(result.limitations.join(" ")).toContain("device-specific pitch routing");
  });

  it("recovers new notes after bend center without repairing bent lifetimes or affecting another channel", async () => {
    const { loaded } = await performanceFixture([
      { bytes: [0x90, 60, 90] }, { bytes: [0xe0, 0, 70] }, { bytes: [0x90, 64, 90] },
      { bytes: [0x91, 67, 90] }, { bytes: [0xe0, 0, 64] }, { bytes: [0x80, 60, 0] },
      { bytes: [0x80, 64, 0] }, { bytes: [0x81, 67, 0] }, { bytes: [0x90, 72, 90] }, { bytes: [0x80, 72, 0] },
    ]);
    const result = collectImprovInsightEvidence(loaded);
    expect(result.notes.map(note => note.pitchEligible)).toEqual([false, false, true, true]);
    expect(result.notes.map(note => note.inferenceEligible)).toEqual([false, false, true, true]);
    expect(result.overview).toMatchObject({ pairedNoteCount: 4, noteAttacks: 4, unmatchedReleases: 0, maximumKeyDownPolyphony: 3 });
  });

  it("accepts an observed centered bend before notes without requiring a verified initial state", async () => {
    const { loaded } = await performanceFixture([{ bytes: [0xe0, 0, 64] }, { bytes: [0x90, 60, 90] }, { bytes: [0x80, 60, 0] }]);
    const result = collectImprovInsightEvidence(loaded);
    expect(result.notes[0]).toMatchObject({ pitchEligible: true, inferenceEligible: true });
    expect(result.limitations.join(" ")).toContain("controller state are unknown");
  });

  it.each([[0xb0, 6, 1], [0xb0, 38, 1], [0xb0, 96, 0], [0xb0, 97, 0], [0xf0, 0x7e, 0x7f, 0xf7], [0xe0, 0]])(
    "does not clear unsupported pitch/tuning uncertainty %j with center or Reset All Controllers", async (...bytes) => {
      const { loaded } = await performanceFixture([
        { bytes: [0xb0, 101, 0] }, { bytes: [0xb0, 100, 1] }, { bytes },
        { bytes: [0xe0, 0, 64] }, { bytes: [0xb0, 121, 0] }, { bytes: [0x90, 60, 90] }, { bytes: [0x80, 60, 0] },
      ]);
      const result = collectImprovInsightEvidence(loaded);
      expect(result.notes[0]).toMatchObject({ reliable: true, pitchEligible: false, inferenceEligible: false });
      expect(result.limitations.join(" ")).toContain("do not clear this uncertainty");
    });

  it.each([[101, 100, 0, 1], [101, 100, 127, 127], [99, 98, 2, 3], [99, 98, 127, 127]])(
    "preserves nominal-note inference across parameter selection without data entry %j", async (msb, lsb, high, low) => {
      const { loaded } = await performanceFixture([
        { bytes: [0x90, 60, 90] }, { bytes: [0xb0, msb, high] }, { bytes: [0xb0, lsb, low] }, { bytes: [0x80, 60, 0] },
        { bytes: [0x90, 64, 90] }, { bytes: [0x80, 64, 0] },
      ]);
      const result = collectImprovInsightEvidence(loaded);
      expect(result.notes.every(note => note.pitchEligible && note.inferenceEligible)).toBe(true);
      expect(monophonicInsightRuns(result.notes).map(run => run.length)).toEqual([2]);
    });

  it("recovers bend with controller reset but keeps the already affected lifetime excluded", async () => {
    const { loaded } = await performanceFixture([
      { bytes: [0x90, 60, 90] }, { bytes: [0xe0, 0, 70] }, { bytes: [0xb0, 121, 0] }, { bytes: [0x80, 60, 0] },
      { bytes: [0x90, 64, 90] }, { bytes: [0x80, 64, 0] },
    ]);
    expect(collectImprovInsightEvidence(loaded).notes.map(note => note.pitchEligible)).toEqual([false, true]);
  });

  it("requires both observed modulation components to clear and retains lifetime taint", async () => {
    const { loaded } = await performanceFixture([
      { bytes: [0x90, 60, 90] }, { bytes: [0xb0, 1, 64] }, { bytes: [0xb0, 33, 0] }, { bytes: [0x80, 60, 0] },
      { bytes: [0x90, 62, 90] }, { bytes: [0x80, 62, 0] }, { bytes: [0xb0, 33, 1] }, { bytes: [0xb0, 1, 0] },
      { bytes: [0x90, 64, 90] }, { bytes: [0x80, 64, 0] }, { bytes: [0xb0, 33, 0] },
      { bytes: [0x90, 65, 90] }, { bytes: [0x80, 65, 0] },
    ]);
    expect(collectImprovInsightEvidence(loaded).notes.map(note => note.pitchEligible)).toEqual([false, false, false, true]);
  });

  it.each([64, 66, 69])("retains held-key chords and tonal pitch, but omits notes affected during their lifetime by pedal %i", async pedal => {
    const { loaded } = await performanceFixture([
      ...[60, 64, 67].map(pitch => ({ bytes: [0x90, pitch, 90], receivedAtMs: 200 })),
      { bytes: [0xb0, pedal, 127], receivedAtMs: 250 }, { bytes: [0xb0, pedal, 0], receivedAtMs: 300 },
      ...[60, 64, 67].map(pitch => ({ bytes: [0x80, pitch, 0], receivedAtMs: 400 })),
      { bytes: [0x90, 72, 90], receivedAtMs: 410 }, { bytes: [0x80, 72, 0], receivedAtMs: 450 },
    ]);
    const result = collectImprovInsightEvidence(loaded);
    expect(result.notes.every(note => note.pitchEligible && note.inferenceEligible)).toBe(true);
    expect(result.notes.map(note => note.pedalDown)).toEqual([true, true, true, false]);
    expect(analyzeImprovHarmony(result).regions).toEqual([expect.objectContaining({ label: "C major", kind: "held" })]);
    expect(monophonicInsightRuns(result.notes).flat().map(note => note.pitch)).toEqual([72]);
  });

  it("keeps independent pedals down until each has recovered", async () => {
    const { loaded } = await performanceFixture([
      { bytes: [0xb0, 64, 127] }, { bytes: [0xb0, 66, 127] }, { bytes: [0xb0, 64, 0] },
      { bytes: [0x90, 60, 90] }, { bytes: [0x80, 60, 0] }, { bytes: [0xb0, 66, 0] },
      { bytes: [0x90, 64, 90] }, { bytes: [0x80, 64, 0] },
    ]);
    const result = collectImprovInsightEvidence(loaded);
    expect(result.notes.map(note => note.pedalDown)).toEqual([true, false]);
    expect(monophonicInsightRuns(result.notes).flat().map(note => note.pitch)).toEqual([64]);
  });

  it("tracks controller recovery through pauses without joining cutoff or sustained notes", async () => {
    const { loaded } = await pausePerformanceFixture([
      { atMs: 200, bytes: [0x90, 60, 90] }, { atMs: 250, bytes: [0xb0, 64, 127] },
      { atMs: 300, bytes: [0xe0, 0, 70] }, ...pauseSteps(400, 5000).slice(0, 2),
      { atMs: 1000, bytes: [0xe0, 0, 64] }, { atMs: 1100, bytes: [0xb0, 64, 0] },
      ...pauseSteps(400, 5000).slice(2), { atMs: 5100, bytes: [0x90, 64, 90] }, { atMs: 5200, bytes: [0x80, 64, 0] },
    ], 5300);
    const result = collectImprovInsightEvidence(loaded);
    expect(result.overview).toMatchObject({ pauseCutoffAttacks: 1, pairedNoteCount: 1 });
    expect(result.notes.map(note => note.pitchEligible)).toEqual([false, true]);
    expect(monophonicInsightRuns(result.notes).flat().map(note => note.pitch)).toEqual([64]);
  });

  it.each([
    { name: "bend and center", messages: [[0xe1, 0, 70], [0xe1, 0, 64]] },
    { name: "modulation and zero", messages: [[0xb1, 1, 64], [0xb1, 1, 0]] },
    { name: "controller reset", messages: [[0xb1, 121, 0], [0xb1, 121, 0]] },
    { name: "unsupported tuning", messages: [[0xb1, 101, 0], [0xb1, 6, 1]] },
  ])("preserves actual harmony and motifs on an unaffected channel across $name", async ({ messages }) => {
    const chord = await performanceFixture([
      { bytes: [0x90, 60, 90], receivedAtMs: 200 }, { bytes: messages[0], receivedAtMs: 225 },
      { bytes: [0x90, 64, 90], receivedAtMs: 250 }, { bytes: messages[1], receivedAtMs: 275 },
      { bytes: [0x90, 67, 90], receivedAtMs: 300 },
      ...[60, 64, 67].map(pitch => ({ bytes: [0x80, pitch, 0], receivedAtMs: 450 })),
    ]);
    expect(analyzeImprovHarmony(collectImprovInsightEvidence(chord.loaded)).regions)
      .toEqual([expect.objectContaining({ label: "C major", kind: "held" })]);
    const pitches = [60, 64, 62, 67, 64, 60, 64, 62, 67, 64];
    const gesture = await performanceFixture(pitches.flatMap((pitch, index) => [
      { bytes: [0x90, pitch, 90], receivedAtMs: 200 + index * 300 },
      { bytes: messages[index % messages.length], receivedAtMs: 250 + index * 300 },
      { bytes: [0x80, pitch, 0], receivedAtMs: 400 + index * 300 },
    ]), { end: 3300 });
    const patterns = analyzeImprovPatterns(collectImprovInsightEvidence(gesture.loaded));
    expect(patterns.motifs).toHaveLength(1);
    expect(patterns.motifs[0].intervals).toEqual([4, -2, 5, -3]);
    expect(patterns.motifs[0].occurrences).toHaveLength(2);
  });
});
