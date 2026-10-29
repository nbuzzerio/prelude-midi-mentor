import { describe, expect, it } from "vitest";
import { pausePerformanceFixture, pauseSteps, performanceFixture } from "../improv-test-fixture";
import { collectImprovInsightEvidence } from "./improv-insight-evidence";
import { analyzeImprovHarmony } from "./improv-harmonic-insights";

async function chord(pitches: number[], stagger = 0, pedal = false) {
  const { loaded } = await performanceFixture([
    ...(pedal ? [{ bytes: [0xb0, 64, 127], receivedAtMs: 110 }] : []),
    ...pitches.flatMap((pitch, i) => [
      { bytes: [0x90, pitch, 90], receivedAtMs: 200 + i * stagger },
      { bytes: [0x80, pitch, 0], receivedAtMs: (stagger ? 400 + i * stagger : 700) },
    ]).sort((a, b) => a.receivedAtMs - b.receivedAtMs),
  ], { end: 3000 });
  return analyzeImprovHarmony(collectImprovInsightEvidence(loaded));
}

describe("harmonic regions", () => {
  it("recognizes complete held major triads including inversions", async () => {
    const result = await chord([64, 67, 72]);
    expect(result.regions).toMatchObject([{ label: "C major", kind: "held", startMs: 100, endMs: 600 }]);
  });
  it("recognizes complete dominant sevenths", async () => {
    expect((await chord([67, 71, 74, 77])).regions[0].label).toBe("G dominant seventh");
  });
  it("distinguishes arpeggio-like outlines from simultaneous chords", async () => {
    expect((await chord([60, 64, 67], 300)).regions).toMatchObject([{ label: "C major", kind: "arpeggiated" }]);
  });
  it("does not label incomplete dyads or dense pitch-class clusters", async () => {
    expect((await chord([60, 64])).regions).toHaveLength(0);
    expect((await chord([60, 61, 64, 67, 70])).regions).toHaveLength(0);
  });
  it("does not infer a chord from pedal-retained sequential tones", async () => {
    expect((await chord([60, 64, 67], 300, true)).regions).toHaveLength(0);
  });
  it("offers explicit root alternatives for symmetric augmented or diminished-seventh sets", async () => {
    expect((await chord([60, 64, 68])).regions[0].label).toBe("C augmented / E augmented / A♭ augmented");
    expect((await chord([60, 63, 66, 69])).regions[0].label).toContain(" / ");
  });
  it("recognizes minor-major sevenths without assuming a minor-scale variant", async () => {
    expect((await chord([60, 63, 67, 71])).regions[0].label).toBe("C minor-major seventh");
  });
  it("consolidates octave revoicing without duplicating a held chord region", async () => {
    const { loaded } = await performanceFixture([
      ...[60, 64, 67].map(pitch => ({ bytes: [0x90, pitch, 90], receivedAtMs: 200 })),
      { bytes: [0x90, 72, 90], receivedAtMs: 400 }, { bytes: [0x80, 60, 0], receivedAtMs: 600 },
      ...[64, 67, 72].map(pitch => ({ bytes: [0x80, pitch, 0], receivedAtMs: 800 })),
    ], { end: 900 });
    expect(analyzeImprovHarmony(collectImprovInsightEvidence(loaded)).regions).toMatchObject([
      { label: "C major", startMs: 100, endMs: 700 },
    ]);
  });
  it("never joins harmonic regions across a compressed pause", async () => {
    const { loaded } = await pausePerformanceFixture([
      ...[60, 64, 67].map(pitch => ({ bytes: [0x90, pitch, 90], atMs: 200 })),
      ...[60, 64, 67].map(pitch => ({ bytes: [0x80, pitch, 0], atMs: 400 })),
      ...pauseSteps(400, 5000),
      ...[60, 64, 67].map(pitch => ({ bytes: [0x90, pitch, 90], atMs: 5000 })),
      ...[60, 64, 67].map(pitch => ({ bytes: [0x80, pitch, 0], atMs: 5200 })),
    ], 5300);
    expect(analyzeImprovHarmony(collectImprovInsightEvidence(loaded)).regions).toHaveLength(2);
  });
  it("measures stable chords after merging frequent octave-doubling changes", async () => {
    const { loaded } = await performanceFixture([
      ...[60, 64, 67].map(pitch => ({ bytes: [0x90, pitch, 90], receivedAtMs: 200 })),
      ...Array.from({ length: 10 }, (_, i) => [
        { bytes: [0x90, 72, 90], receivedAtMs: 250 + i * 100 },
        { bytes: [0x80, 72, 0], receivedAtMs: 300 + i * 100 },
      ]).flat(),
      ...[60, 64, 67].map(pitch => ({ bytes: [0x80, pitch, 0], receivedAtMs: 1250 })),
    ], { end: 1300 });
    const regions = analyzeImprovHarmony(collectImprovInsightEvidence(loaded)).regions;
    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({ label: "C major", startMs: 100, endMs: 1150 });
    expect(regions[0].evidence.join(" ")).toContain("1050 ms");
  });
  it("caps separate harmonic regions without truncating analysis input", async () => {
    const { loaded } = await performanceFixture(Array.from({ length: 70 }, (_, i) => [
      ...[60, 64, 67].map(pitch => ({ bytes: [0x90, pitch, 90], receivedAtMs: 200 + i * 500 })),
      ...[60, 64, 67].map(pitch => ({ bytes: [0x80, pitch, 0], receivedAtMs: 500 + i * 500 })),
    ]).flat(), { end: 36000 });
    const result = analyzeImprovHarmony(collectImprovInsightEvidence(loaded));
    expect(result.regions).toHaveLength(64);
    expect(result.truncated).toBe(true);
  });
});
