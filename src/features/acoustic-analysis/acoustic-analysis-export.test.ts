import { afterEach, describe, expect, it, vi } from "vitest";
import { createAcousticAnalysisCollector } from "./acoustic-analysis-collector";
import { createAcousticAnalysisBundle, isAcousticAnalysisBundle, serializeAcousticAnalysis, acousticAnalysisFilename } from "./acoustic-analysis-export";
import { readAnalysisPreference, saveAnalysisPreference, downloadAcousticAnalysis } from "./acoustic-analysis-browser";
import { version } from "../../../package.json";
import { createCalibrationSession, assessCalibration, advanceCalibration } from "@/features/instrument-learning/calibration-session";
import { createCalibrationStability } from "@/features/instrument-learning/pitch-stability";
import { VIOLIN_REFERENCES } from "@/features/instrument-learning/calibration-types";
import type { PitchObservationEnvelope } from "@/lib/audio/monophonic/pitch-analysis-types";

function source(at: number): PitchObservationEnvelope {
  return { observedAtMs: at, audioSeconds: at / 1000, captureGeneration: 1,
    observation: { frequencyHz: VIOLIN_REFERENCES[0].frequencyHz, quality: 0.99, levelDbfs: -20, reason: "usable" },
    snapshot: { state: "stable", fresh: true, ageMs: 0, pitch: { semitone: 55, frequencyHz: VIOLIN_REFERENCES[0].frequencyHz } } };
}
function collector() {
  return createAcousticAnalysisCollector({ id: "analysis", runId: "run", instrument: "violin", startedAt: "2026-10-07T12:00:00.000Z",
    startMeasureIndex: 0, endMeasureIndex: 1, focus: "upper", pitchToleranceCents: 25 }, 0);
}
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
describe("canonical analysis JSON", () => {
  it("round trips deterministically with units, reference, provenance and honest uncertainty", () => {
    const c = collector(); c.observe(source(0), "o"); const snapshot = c.snapshot();
    const json = serializeAcousticAnalysis(snapshot, 0), parsed = JSON.parse(json);
    expect(serializeAcousticAnalysis(snapshot, 0)).toBe(json); expect(isAcousticAnalysisBundle(parsed)).toBe(true);
    expect(parsed.appVersion).toBe(version); expect(parsed.definitions.frequencyUnit).toBe("Hz");
    expect(parsed.definitions.cents).toContain("Positive is sharp"); expect(parsed.definitions.reference).toContain("A4 = 440 Hz");
    expect(parsed.definitions.quality).toContain("NOT pitch-identity probability");
    expect(parsed.definitions.provenance.observation).toContain("measured-estimate");
    expect(parsed.analyzer.effectiveSampleRateHz).toBeNull(); expect(parsed.locationAssumptions).toEqual([]);
    expect(json).not.toMatch(/deviceId|groupId|deviceName|userAgent|MediaStream|PCM/);
  });
  it("exports selected raw calibration windows and retains retry revision meaning", () => {
    const c = collector(), tracker = createCalibrationStability(VIOLIN_REFERENCES[0]); let state = createCalibrationSession("cal");
    for (let at = 0; at <= 1000; at += 40) {
      const envelope = source(at); c.observe(envelope, `o-${at}`);
      state = assessCalibration(state, tracker.update({ id: `o-${at}`, envelope }));
    }
    c.calibration(state, 1000); state = advanceCalibration(state, "retry"); c.calibration(state, 1000);
    const bundle = createAcousticAnalysisBundle(c.snapshot(), 0);
    expect(bundle.calibrations[0].revision).toBe(2);
    expect(bundle.calibrations[0].attempts[0].measurement.samples.length).toBeGreaterThanOrEqual(20);
    expect(bundle.calibrations[0].attempts[0].measurement.supportingObservationIds[0]).toBe("o-200");
  });
  it("keeps target visits, attacks and current grading evidence linked", () => {
    const c = collector(); const visit = c.setTarget({ id: "t", measureIndex: 0, sourceMeasureId: "m", expectedSemitone: 55,
      expectedHz: VIOLIN_REFERENCES[0].frequencyHz, spelling: "G3" }, "t:first", 0)!;
    c.setContext({ phase: "practice", paused: false, targetVisitId: visit, referenceHz: VIOLIN_REFERENCES[0].frequencyHz, calibrationRevision: null });
    c.observe(source(0), "o");
    const attack = { source: "microphone" as const, captureGeneration: 1, sequence: 0, onsetObservedAtMs: 0, confirmedAtMs: 100,
      frequencyHz: VIOLIN_REFERENCES[0].frequencyHz, nearestSemitone: 55, articulation: "initial-acquisition" as const };
    const evidence = { source: "microphone" as const, sequence: 0, measureIndex: 0, sourceMeasureId: "m", targetId: "t", checkId: "check", occurredAtActiveMs: 100,
      expectedPitches: [], articulation: attack.articulation, confirmationDelayMs: 100, accepted: true, rejection: null,
      frequencyHz: attack.frequencyHz, nearestSemitone: 55, expectedSemitone: 55, centsFromExpected: 0, pitchToleranceCents: 25 };
    c.attempt(attack, evidence); const bundle = createAcousticAnalysisBundle(c.snapshot(), 0);
    expect(bundle.attempts[0].evidence).toEqual(evidence); expect(isAcousticAnalysisBundle(bundle)).toBe(true);
    expect(bundle.derivedSummaries[0].acquisitionTimeMs).toBeNull(); expect(bundle.derivedSummaries[0].postAcquisitionStability).toBe("unassignable");
    expect(bundle.derivedSummaries[0].firstDeviationCents).toBe(0);
    expect(isAcousticAnalysisBundle({ ...bundle, targetVisits: [] })).toBe(false);
  });
  it("rejects unknown schema, missing sections and nonfinite evidence", () => {
    const c = collector(); c.observe(source(0), "o"); const bundle = createAcousticAnalysisBundle(c.snapshot(), 0);
    expect(isAcousticAnalysisBundle({ ...bundle, schemaVersion: 2 })).toBe(false);
    expect(isAcousticAnalysisBundle({ ...bundle, trace: null })).toBe(false);
    expect(isAcousticAnalysisBundle({ ...bundle, coverage: { ...bundle.coverage, estimatedBytes: NaN } })).toBe(false);
    bundle.trace[0].observation = { ...bundle.trace[0].observation, frequencyHz: -1 };
    expect(isAcousticAnalysisBundle(bundle)).toBe(false);
  });
  it("keeps null frequency and truncation explicit", () => {
    const c = collector(), e = source(0);
    c.observe({ ...e, observation: { ...e.observation, frequencyHz: null, reason: "quiet" } }, "o"); c.stop("owner-test", 20);
    const parsed = JSON.parse(serializeAcousticAnalysis(c.snapshot(), 0));
    expect(parsed.trace[0].observation.frequencyHz).toBeNull(); expect(parsed.coverage.reason).toBe("owner-test");
  });
  it("generates a safe JSON filename and explicitly downloads only a JSON blob", () => {
    expect(acousticAnalysisFilename("2026-10-07T12:00:00.000Z")).toBe("prelude-acoustic-analysis-2026-10-07T12-00-00-000Z.json");
    const create = vi.fn((blob: Blob) => { expect(blob.type).toBe("application/json"); return "blob:analysis"; }), revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadAcousticAnalysis("{}", "2026-10-07"); expect(click).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0]).toBeInstanceOf(Blob); expect(revoke).toHaveBeenCalledWith("blob:analysis");
    vi.unstubAllGlobals();
  });
});
describe("separate local preference", () => {
  it("defaults on and remembers off without storing evidence", () => {
    expect(readAnalysisPreference()).toBe(true); expect(saveAnalysisPreference(false)).toBe(true);
    expect(readAnalysisPreference()).toBe(false); expect(localStorage.length).toBe(1);
    expect(localStorage.getItem(localStorage.key(0)!)).toBe("off");
  });
  it("tolerates blocked browser storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("blocked"); });
    expect(readAnalysisPreference()).toBe(true); expect(saveAnalysisPreference(false)).toBe(false);
  });
});
describe("synthetic duration and serialized-size characterization (not device QA)", () => {
  it.each([5, 20, 60])("bounds a %s-minute scalar run", (minutes) => {
    const c = collector(); const began = performance.now();
    for (let index = 0; index < minutes * 60 * 30; index++) c.observe(source(index * 1000 / 30), `o-${index}`);
    const snapshot = c.snapshot(), json = serializeAcousticAnalysis(snapshot, 0);
    expect(snapshot.coverage.estimatedBytes).toBeLessThanOrEqual(16 * 1024 * 1024);
    expect(snapshot.trace.length).toBeLessThanOrEqual(minutes * 600);
    console.info(`Analysis ${minutes}m: ${snapshot.trace.length} bins, ${new TextEncoder().encode(json).length} UTF-8 bytes, ${Math.round(performance.now() - began)}ms collection+snapshot+export; ${snapshot.coverage.reason ?? "complete"}`);
  });
});
