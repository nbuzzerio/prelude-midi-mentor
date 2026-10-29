import { describe, expect, it } from "vitest";
import { pausePerformanceFixture, pauseSteps, performanceFixture } from "../improv-test-fixture";
import { collectImprovInsightEvidence } from "./improv-insight-evidence";
import { analyzeImprovPatterns } from "./improv-pattern-insights";

const gesture = [60, 64, 62, 67, 64];
const messages = (pitches: number[], spacing = 300) => pitches.flatMap((pitch, i) => [
  { bytes: [0x90, pitch, 80], receivedAtMs: 200 + i * spacing }, { bytes: [0x80, pitch, 0], receivedAtMs: 400 + i * spacing },
]);
const rhythmicMessages = (pitches: number[], start: number, offsets = [0, 200, 600, 900, 1500]) => pitches.flatMap((pitch, i) => [
  { bytes: [0x90, pitch, 80], receivedAtMs: start + offsets[i] },
  { bytes: [0x80, pitch, 0], receivedAtMs: start + offsets[i] + 100 },
]);

describe("interval and rhythm motifs", () => {
  it("finds repeated and transposed gestures with non-overlapping occurrences", async () => {
    const { loaded } = await performanceFixture(messages([...gesture, ...gesture, ...gesture.map(p => p + 2)]), { end: 5000 });
    const { motifs } = analyzeImprovPatterns(collectImprovInsightEvidence(loaded));
    expect(motifs).toHaveLength(1);
    expect(motifs[0].intervals).toEqual([4, -2, 5, -3]);
    expect(motifs[0].occurrences.map(o => o.transpositionSemitones)).toEqual([0, 0, 2]);
  });
  it.each([
    ["ascending", [60, 64, 67, 69, 76]],
    ["descending", [76, 72, 69, 67, 60]],
    ["uniform ascending leaps", [60, 63, 66, 69, 72]],
    ["uniform descending leaps", [72, 69, 66, 63, 60]],
  ])("finds repeated and transposed %s figures with contrasting rhythm", async (_direction, pitches) => {
    const { loaded } = await performanceFixture([
      ...rhythmicMessages(pitches, 200), ...rhythmicMessages(pitches, 4000),
      ...rhythmicMessages(pitches.map(pitch => pitch + 2), 8000),
    ], { end: 10000 });
    const { motifs } = analyzeImprovPatterns(collectImprovInsightEvidence(loaded));
    expect(motifs).toHaveLength(1);
    expect(motifs[0].label).toBe("Figure 1");
    expect(motifs[0].intervals).toEqual(pitches.slice(1).map((pitch, i) => pitch - pitches[i]));
    expect(motifs[0].rhythmRatios).toEqual([1, 2, 1.5, 3]);
    expect(motifs[0].occurrences.map(occurrence => occurrence.transpositionSemitones)).toEqual([0, 0, 2]);
    expect(motifs[0].evidence.join(" ")).toContain("Figure 1: repeated or transposed");
  });
  it("allows varied directional leaps with uniform rhythm", async () => {
    const pitches = [60, 64, 67, 69, 76];
    const { loaded } = await performanceFixture([...messages(pitches),
      ...messages(pitches).map(message => ({ ...message, receivedAtMs: message.receivedAtMs + 4000 })),
    ], { end: 6000 });
    expect(analyzeImprovPatterns(collectImprovInsightEvidence(loaded)).motifs).toHaveLength(1);
  });
  it("suppresses uniform repeated leaps without rhythmic contrast", async () => {
    const pitches = [60, 63, 66, 69, 72];
    const { loaded } = await performanceFixture([...messages(pitches),
      ...messages(pitches).map(message => ({ ...message, receivedAtMs: message.receivedAtMs + 4000 })),
    ], { end: 6000 });
    expect(analyzeImprovPatterns(collectImprovInsightEvidence(loaded)).motifs).toHaveLength(0);
  });
  it("does not group directional leaps with different relative rhythms", async () => {
    const pitches = [60, 64, 67, 69, 76];
    const { loaded } = await performanceFixture([...rhythmicMessages(pitches, 200),
      ...rhythmicMessages(pitches.map(pitch => pitch + 2), 4000, [0, 300, 600, 900, 1200]),
    ], { end: 6000 });
    expect(analyzeImprovPatterns(collectImprovInsightEvidence(loaded)).motifs).toHaveLength(0);
  });
  it.each([
    ["ascending diatonic", [60, 62, 64, 65, 67]],
    ["descending diatonic", [67, 65, 64, 62, 60]],
    ["ascending chromatic", [60, 61, 62, 63, 64]],
    ["descending chromatic", [64, 63, 62, 61, 60]],
  ])("suppresses repeated %s steps even with contrasting rhythm", async (_direction, pitches) => {
    const { loaded } = await performanceFixture([
      ...rhythmicMessages(pitches, 200), ...rhythmicMessages(pitches, 4000),
    ], { end: 6000 });
    expect(analyzeImprovPatterns(collectImprovInsightEvidence(loaded)).motifs).toHaveLength(0);
  });
  it("numbers distinct final figures after suppressing shifted duplicates", async () => {
    const secondGesture = [72, 67, 70, 65, 69];
    const { loaded } = await performanceFixture(messages([...gesture, ...gesture, ...gesture,
      ...secondGesture, ...secondGesture, ...secondGesture]), { end: 10000 });
    const evidence = collectImprovInsightEvidence(loaded), result = analyzeImprovPatterns(evidence);
    expect(result.motifs.map(motif => motif.label)).toEqual(["Figure 1", "Figure 2"]);
    expect(result.motifs.map(motif => motif.intervals)).toEqual([[4, -2, 5, -3], [-5, 3, -5, 4]]);
    for (const motif of result.motifs) {
      expect(motif.occurrences).toHaveLength(3);
      expect(motif.evidence.join(" ")).toContain(`${motif.label}: repeated five-note pattern.`);
    }
    const spans = result.motifs.flatMap(motif => motif.occurrences).sort((a, b) => a.startMs - b.startMs);
    for (let i = 1; i < spans.length; i++) expect(spans[i].startMs).toBeGreaterThanOrEqual(spans[i - 1].endMs);
    expect(analyzeImprovPatterns(evidence)).toEqual(result);
  });
  it("requires matching rhythm as well as pitch intervals", async () => {
    const second = gesture.flatMap((pitch, i) => [
      { bytes: [0x90, pitch, 80], receivedAtMs: 2000 + i * i * 180 },
      { bytes: [0x80, pitch, 0], receivedAtMs: 2100 + i * i * 180 },
    ]);
    const { loaded } = await performanceFixture([...messages(gesture), ...second], { end: 6000 });
    expect(analyzeImprovPatterns(collectImprovInsightEvidence(loaded)).motifs).toHaveLength(0);
  });
  it("does not count overlapping windows as separate occurrences", async () => {
    const { loaded } = await performanceFixture(messages([60, 64, 67, 60, 64, 67, 60, 64]), { end: 3000 });
    expect(analyzeImprovPatterns(collectImprovInsightEvidence(loaded)).motifs).toHaveLength(0);
  });
  it("suppresses repetitive single pitches and straight scale coincidences", async () => {
    const { loaded } = await performanceFixture(messages([...Array<number>(10).fill(60), ...[60, 62, 64, 65, 67], ...[60, 62, 64, 65, 67]]), { end: 7000 });
    expect(analyzeImprovPatterns(collectImprovInsightEvidence(loaded)).motifs).toHaveLength(0);
  });
  it("does not construct motif windows across pauses", async () => {
    const first = messages(gesture).map(message => ({ atMs: message.receivedAtMs, bytes: message.bytes }));
    const split = messages(gesture).map(message => ({ atMs: message.receivedAtMs + 2000, bytes: message.bytes }));
    const { loaded } = await pausePerformanceFixture([...first, ...split.slice(0, 4), ...pauseSteps(2700, 5000),
      ...split.slice(4).map(step => ({ ...step, atMs: step.atMs + 2300 }))], 6000);
    expect(analyzeImprovPatterns(collectImprovInsightEvidence(loaded)).motifs).toHaveLength(0);
  });
  it("omits polyphonic runs", async () => {
    const { loaded } = await performanceFixture([...messages([...gesture, ...gesture]),
      { bytes: [0x90, 48, 80], receivedAtMs: 150 }, { bytes: [0x80, 48, 0], receivedAtMs: 3500 },
    ].sort((a, b) => a.receivedAtMs - b.receivedAtMs), { end: 4000 });
    expect(analyzeImprovPatterns(collectImprovInsightEvidence(loaded)).motifs).toHaveLength(0);
  });
  it("caps recurring occurrences and reports omitted evidence", async () => {
    const { loaded } = await performanceFixture(messages(Array.from({ length: 12 }, () => gesture).flat()), { end: 20000 });
    const result = analyzeImprovPatterns(collectImprovInsightEvidence(loaded));
    expect(result.motifs[0].occurrences).toHaveLength(8);
    expect(result.truncated).toBe(true);
  });
});
