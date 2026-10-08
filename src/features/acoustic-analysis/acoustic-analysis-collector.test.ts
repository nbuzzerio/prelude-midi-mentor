import { describe, expect, it } from "vitest";
import { createAcousticAnalysisCollector } from "./acoustic-analysis-collector";
import { ANALYSIS_POLICY, type AnalysisContext, type AnalysisData } from "./acoustic-analysis-types";
import type { PitchObservationEnvelope } from "@/lib/audio/monophonic/pitch-analysis-types";

export const analysisSession: AnalysisData["session"] = { id: "analysis-a", runId: "run", startedAt: "2026-10-07T12:00:00.000Z",
  instrument: "violin", startMeasureIndex: 0, endMeasureIndex: null, focus: "upper", pitchToleranceCents: 25 };
export function envelope(at: number, frequencyHz: number | null = 440, generation = 1): PitchObservationEnvelope {
  return { observedAtMs: at, audioSeconds: at / 1000, captureGeneration: generation,
    observation: { frequencyHz, quality: 0.99, levelDbfs: -20, reason: frequencyHz === null ? "quiet" : "usable" },
    snapshot: { state: "stable", fresh: true, ageMs: 0, pitch: { frequencyHz: 440, semitone: 69 } } };
}
const context: AnalysisContext = { phase: "practice", paused: false, calibrationRevision: null, referenceHz: 440, targetVisitId: null };
describe("bounded scalar collector", () => {
  it("bins actual timestamps and scalar evidence, never interpolating", () => {
    const c = createAcousticAnalysisCollector(analysisSession, 1000); c.setContext(context);
    [1007, 1041, 1093, 1118].forEach((at) => c.observe(envelope(at), `o-${at}`));
    const data = c.snapshot();
    expect(data.trace.map((bin) => bin.observation.atMs)).toEqual([7, 118]);
    expect(data.trace.map((bin) => bin.sourceCount)).toEqual([3, 1]);
    expect(data.trace[0].minimumCents).toBe(0); expect(data.trace[0].reasons.usable).toBe(3);
    expect(data.trace[0].observation.trackedHz).toBe(440);
  });
  it("preserves null rejected observations and per-bin rejection counts", () => {
    const c = createAcousticAnalysisCollector(analysisSession, 0); c.observe(envelope(1, null), "quiet"); c.observe(envelope(40), "tone");
    const bin = c.snapshot().trace[0]; expect(bin.observation.frequencyHz).toBeNull(); expect(bin.usableCount).toBe(1);
    expect(bin.reasons).toEqual({ quiet: 1, usable: 1 });
  });
  it("splits bins at phase, pause, reference and capture boundaries", () => {
    const c = createAcousticAnalysisCollector(analysisSession, 0);
    c.observe(envelope(1), "a"); c.setContext(context); c.observe(envelope(20), "b");
    c.setContext({ ...context, paused: true }); c.observe(envelope(30), "c");
    c.setContext({ ...context, referenceHz: 330 }); c.observe(envelope(40), "d"); c.observe(envelope(50, 440, 2), "e");
    expect(c.snapshot().trace).toHaveLength(5); expect(c.snapshot().captureSegments).toHaveLength(2);
  });
  it("distinguishes visits to the same target and globally namespaces capture segments", () => {
    const c = createAcousticAnalysisCollector(analysisSession, 0);
    const target = { id: "t", measureIndex: 0, sourceMeasureId: "m", expectedSemitone: 69, expectedHz: 440, spelling: "A4" };
    const first = c.setTarget(target, "t:first", 0); const repeat = c.setTarget(target, "t:restart", 1);
    expect(first).not.toBe(repeat); expect(c.snapshot().targets).toHaveLength(1);
    c.observe(envelope(2), "a");
    const other = createAcousticAnalysisCollector({ ...analysisSession, id: "analysis-b" }, 0); other.observe(envelope(2), "b");
    expect(c.snapshot().captureSegments[0].id).not.toBe(other.snapshot().captureSegments[0].id);
  });
  it("evicts the four-second ring while retaining the earlier downsampled trace", () => {
    const c = createAcousticAnalysisCollector(analysisSession, 0);
    for (let at = 0; at <= 8000; at += 40) c.observe(envelope(at), `o-${at}`);
    expect(c.ringSize()).toBe(101); expect(c.snapshot().trace[0].observation.atMs).toBe(0);
    c.trigger(8000, "mark"); expect(c.snapshot().highResolutionWindows[0].observations[0].atMs).toBe(7000);
  });
  it("retains pre/post observations and merges overlapping windows", () => {
    const c = createAcousticAnalysisCollector(analysisSession, 0);
    for (let at = 0; at <= 2000; at += 40) c.observe(envelope(at), `o-${at}`);
    c.trigger(2000, "a"); c.trigger(2500, "b");
    for (let at = 2040; at <= 5000; at += 40) c.observe(envelope(at), `o-${at}`);
    const windows = c.snapshot().highResolutionWindows;
    expect(windows).toHaveLength(1); expect(windows[0].startMs).toBe(1000); expect(windows[0].endMs).toBe(4500);
    expect(windows[0].triggerIds).toEqual(["a", "b"]); expect(windows[0].observations.at(-1)?.atMs).toBe(4480);
    expect(new Set(windows[0].observations.map((row) => row.id)).size).toBe(windows[0].observations.length);
  });
  it("automatically captures an octave jump without altering the estimate", () => {
    const c = createAcousticAnalysisCollector(analysisSession, 0); c.observe(envelope(0), "a"); c.observe(envelope(40, 880), "b");
    expect(c.snapshot().highResolutionWindows[0].observations.at(-1)?.frequencyHz).toBe(880);
  });
  it("caps diagnostic coverage while reserving calibration capacity", () => {
    const c = createAcousticAnalysisCollector(analysisSession, 0);
    for (let at = 2000; at < 100000; at += 4000) c.trigger(at, `t-${at}`);
    const before = c.snapshot(); expect(before.coverage.omittedWindows).toBeGreaterThan(0);
    c.trigger(110000, "calibration", "calibration", { startMs: 109000, endMs: 110000 });
    const data = c.snapshot(); expect(data.highResolutionWindows.some((window) => window.kind === "calibration")).toBe(true);
    expect(data.highResolutionWindows.reduce((sum, window) => sum + window.endMs - window.startMs, 0)).toBeLessThanOrEqual(60000);
  });
  it.each(["duration-limit", "event-limit", "memory-budget"])("preserves collected evidence on %s", (reason) => {
    const c = createAcousticAnalysisCollector(analysisSession, 0, reason === "duration-limit" ? { durationMs: 100 }
      : reason === "event-limit" ? { eventLimit: 2 } : { estimatedBudgetBytes: 3000 });
    c.observe(envelope(0), "first");
    if (reason === "event-limit") { c.event("a", 20); c.event("b", 30); }
    else c.observe(envelope(100), "next");
    expect(c.status().reason).toBe(reason); expect(c.snapshot().trace[0].observation.id).toBe("first");
    c.observe(envelope(200), "late"); expect(c.snapshot().trace.some((bin) => bin.observation.id === "late")).toBe(false);
  });
  it("disabled collection retains no trace and records the missing interval on resume", () => {
    const c = createAcousticAnalysisCollector(analysisSession, 0); c.setEnabled(false, 0); c.observe(envelope(40), "off");
    expect(c.snapshot().trace).toHaveLength(0); c.setEnabled(true, 100); c.observe(envelope(120), "on");
    expect(c.snapshot().trace[0].observation.id).toBe("on"); expect(c.snapshot().coverage.gaps[0].reason).toBe("collection-disabled");
  });
  it("records gaps and projects only allowlisted scalar fields", () => {
    const c = createAcousticAnalysisCollector(analysisSession, 0);
    const e = { ...envelope(0), deviceId: "private", waveform: new Float32Array(4) };
    c.observe(e, "a"); c.observe(envelope(200), "b");
    expect(c.snapshot().coverage.gaps).toEqual([{ startMs: 0, endMs: 200, reason: "observation-gap" }]);
    const json = JSON.stringify(c.snapshot()); expect(json).not.toMatch(/deviceId|waveform|private|MediaStream/);
  });
  it("snapshot does not mutate or flush ongoing binning", () => {
    const c = createAcousticAnalysisCollector(analysisSession, 0); c.observe(envelope(0), "a");
    const before = c.snapshot(); c.observe(envelope(40), "b");
    expect(before.trace[0].sourceCount).toBe(1); expect(c.snapshot().trace[0].sourceCount).toBe(2);
  });
  it("declares conservative storage allowances separately from actual heap size", () => {
    expect(ANALYSIS_POLICY.estimatedBudgetBytes).toBe(16 * 1024 * 1024);
  });
});
