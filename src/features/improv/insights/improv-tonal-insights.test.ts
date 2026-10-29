import { describe, expect, it } from "vitest";
import { performanceFixture } from "../improv-test-fixture";
import { collectImprovInsightEvidence } from "./improv-insight-evidence";
import { analyzeImprovTonality } from "./improv-tonal-insights";

async function tonal(pitches: number[]) {
  const { loaded } = await performanceFixture(pitches.flatMap((pitch, i) => [
    { bytes: [0x90, pitch, 80], receivedAtMs: 200 + i * 400 }, { bytes: [0x80, pitch, 0], receivedAtMs: 500 + i * 400 },
  ]), { end: 600 + pitches.length * 400 });
  return analyzeImprovTonality(collectImprovInsightEvidence(loaded));
}

describe("tonal hypotheses", () => {
  it("ranks tonic-weighted major material while preserving all 24 alternatives", async () => {
    const result = await tonal([60, 64, 67, 60, 62, 64, 65, 67, 69, 71, 72, 67, 64, 60, 60, 60]);
    expect(result.hypotheses).toHaveLength(24);
    expect(new Set(result.hypotheses.map(h => h.label)).size).toBe(24);
    expect(result.hypotheses[0].label).toBe("C major");
    expect(result.status).toBe("supported");
    expect(result.reasons.join(" ")).toContain("not probabilities");
  });

  it("ranks tonic-weighted natural-minor material", async () => {
    const result = await tonal([57, 60, 64, 57, 59, 60, 62, 64, 65, 67, 69, 64, 60, 57, 57, 57]);
    expect(result.hypotheses[0].label).toBe("A minor");
    expect(result.status).toBe("supported");
    expect(result.reasons.join(" ")).toContain("classical melodic-minor");
  });

  it("does not decide a key from a short triad", async () => {
    const result = await tonal([60, 64, 67]);
    expect(result.status).toBe("insufficient");
    expect(result.hypotheses).toHaveLength(24);
  });

  it("treats evenly chromatic material as ambiguous", async () => {
    const result = await tonal(Array.from({ length: 36 }, (_, i) => 60 + i % 12));
    expect(result.status).toBe("ambiguous");
    expect(result.hypotheses.every(h => Number.isFinite(h.score))).toBe(true);
  });

  it("retains relative-major/minor ambiguity in evenly distributed diatonic material", async () => {
    const result = await tonal(Array.from({ length: 28 }, (_, i) => [60, 62, 64, 65, 67, 69, 71][i % 7]));
    expect(result.status).toBe("ambiguous");
  });

  it("gives empty evidence no positive fit or coverage", async () => {
    const result = await tonal([]);
    expect(result.status).toBe("insufficient");
    expect(result.hypotheses.every(h => h.score === 0 && h.coverage === 0)).toBe(true);
  });
  it("does not treat an unreleased final attack's synthetic tail as observed tonal duration", async () => {
    const { loaded } = await performanceFixture([60, 64, 67, 60, 62, 64, 65, 67, 69, 71, 60, 60].flatMap((pitch, i) => [
      { bytes: [0x90, pitch, 90], receivedAtMs: 200 + i * 100 },
      ...(i < 11 ? [{ bytes: [0x80, pitch, 0], receivedAtMs: 250 + i * 100 }] : []),
    ]), { end: 20000 });
    expect(analyzeImprovTonality(collectImprovInsightEvidence(loaded)).status).toBe("insufficient");
  });
  it("uses conventional minor tonic spellings instead of theoretical double-accidental keys", async () => {
    const result = await tonal([]);
    expect(result.hypotheses.find(h => h.mode === "minor" && h.tonicPitchClass === 1)?.label).toBe("C♯ minor");
    expect(result.hypotheses.find(h => h.mode === "minor" && h.tonicPitchClass === 8)?.label).toBe("G♯ minor");
  });

  it.each(["before", "during"])("does not support the formerly confident major fixture from notes bent %s their lifetimes", async timing => {
    const pitches = [60, 64, 67, 60, 62, 64, 65, 67, 69, 71, 72, 67, 64, 60, 60, 60];
    const { loaded } = await performanceFixture([
      ...(timing === "before" ? [{ bytes: [0xe0, 0, 70], receivedAtMs: 150 }] : []),
      ...pitches.flatMap((pitch, i) => [
        { bytes: [0x90, pitch, 80], receivedAtMs: 200 + i * 400 },
        ...(timing === "during" ? [{ bytes: [0xe0, 0, 70], receivedAtMs: 250 + i * 400 },
          { bytes: [0xe0, 0, 64], receivedAtMs: 300 + i * 400 }] : []),
        { bytes: [0x80, pitch, 0], receivedAtMs: 500 + i * 400 },
      ]),
    ], { end: 7100 });
    const evidence = collectImprovInsightEvidence(loaded), result = analyzeImprovTonality(evidence);
    expect(evidence.overview).toMatchObject({ noteAttacks: 16, pairedNoteCount: 16 });
    expect(evidence.overview.pitchClassDistribution[0].attacks).toBe(6);
    expect(result.status).toBe("insufficient");
    expect(result.hypotheses.every(hypothesis => hypothesis.score === 0 && hypothesis.coverage === 0)).toBe(true);
    expect(result.reasons.join(" ")).toContain("16 attacks affected by pitch bend");
  });

  it("retains nominal tonal support under sustain while excluding monophonic inference", async () => {
    const pitches = [60, 64, 67, 60, 62, 64, 65, 67, 69, 71, 72, 67, 64, 60, 60, 60];
    const { loaded } = await performanceFixture([
      { bytes: [0xb0, 64, 127], receivedAtMs: 150 },
      ...pitches.flatMap((pitch, i) => [
        { bytes: [0x90, pitch, 80], receivedAtMs: 200 + i * 400 }, { bytes: [0x80, pitch, 0], receivedAtMs: 500 + i * 400 },
      ]),
    ], { end: 7100 });
    const result = analyzeImprovTonality(collectImprovInsightEvidence(loaded));
    expect(result.status).toBe("supported");
    expect(result.hypotheses).toEqual((await tonal(pitches)).hypotheses);
    expect(result.reasons.join(" ")).toContain("not verified sounding pitches");
  });

  it("recovers tonal support from new centered notes and does not count earlier bent attacks", async () => {
    const pitches = [60, 64, 67, 60, 62, 64, 65, 67, 69, 71, 72, 67, 64, 60, 60, 60];
    const { loaded } = await performanceFixture([
      { bytes: [0xe0, 0, 70], receivedAtMs: 120 }, { bytes: [0x90, 61, 80], receivedAtMs: 130 },
      { bytes: [0x80, 61, 0], receivedAtMs: 150 }, { bytes: [0xe0, 0, 64], receivedAtMs: 180 },
      ...pitches.flatMap((pitch, i) => [
        { bytes: [0x90, pitch, 80], receivedAtMs: 200 + i * 400 }, { bytes: [0x80, pitch, 0], receivedAtMs: 500 + i * 400 },
      ]),
    ], { end: 7100 });
    const result = analyzeImprovTonality(collectImprovInsightEvidence(loaded));
    expect(result.status).toBe("supported");
    expect(result.hypotheses).toEqual((await tonal(pitches)).hypotheses);
    expect(result.reasons.join(" ")).toContain("1 attacks affected");
  });

  it("keeps count-only tonal support for unpaired attacks without claiming their durations", async () => {
    const { loaded } = await performanceFixture([{ bytes: [0x90, 60, 90], receivedAtMs: 200 }], { end: 20000 });
    const result = analyzeImprovTonality(collectImprovInsightEvidence(loaded));
    expect(result.reasons[0]).toContain("1 pitched attacks");
    expect(result.status).toBe("insufficient");
    expect(result.hypotheses.some(hypothesis => hypothesis.score > 0)).toBe(true);
  });
});
