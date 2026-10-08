import { act, cleanup, render, renderHook } from "@testing-library/react";
import { createElement, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaptureOptions, CaptureStatus } from "@/lib/audio/monophonic/microphone-capture";
import { createPitchStabilizer } from "@/lib/audio/monophonic/pitch-stabilizer";
import { equalTemperedFrequency } from "@/lib/audio/monophonic/pitch-math";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import { projectStaffBuilderPieceForPractice } from "../piece-practice-projection";
import { advancePiecePracticeNoAttackMeasure, createPiecePracticeSession, restartCurrentPiecePracticeMeasure, type PiecePracticeSessionState } from "../piece-practice-session";
import { usePiecePracticeAcousticInput } from "./use-piece-practice-acoustic-input";
import * as analysisCollector from "@/features/acoustic-analysis/acoustic-analysis-collector";
import * as analysisBrowser from "@/features/acoustic-analysis/acoustic-analysis-browser";
import { ViolinPreflight } from "@/features/instrument-learning/components/violin-preflight";
import { CALIBRATION_POLICY } from "@/features/instrument-learning/calibration-types";

const mock = vi.hoisted(() => ({ sessions: [] as { options: CaptureOptions; generation: number; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] }));
vi.mock("@/lib/audio/monophonic/microphone-capture", () => ({ createMicrophoneCapture: (options: CaptureOptions) => {
  const session = { options, generation: 0, start: vi.fn(), stop: vi.fn() };
  session.start.mockImplementation(async () => {
    if (!options.eligible()) { options.onStatus({ state: "paused", message: "Unavailable" }); return; }
    session.generation++; options.onStatus({ state: "requesting", message: "Permission" });
    options.onStatus({ state: "listening", message: "Listening" });
  });
  session.stop.mockImplementation((state: CaptureStatus["state"] = "idle", message = "Off") => {
    session.generation++; options.onStatus({ state, message });
  });
  mock.sessions.push(session);
  return { ...session, generation: () => session.generation, snapshot: () => ({ state: "listening", pitch: null, fresh: false, ageMs: null }) };
} }));
const score: StaffBuilderScore = {
  schemaVersion: 4, id: "repeats", title: "Repeated E4", createdAt: "2026-10-06T12:00:00.000Z", updatedAt: "2026-10-06T12:00:00.000Z",
  initialKeySignatureId: "c-major", initialTimeSignature: "4/4", tempoBpm: 120, annotations: [], ties: [], measures: [{ id: "m", events: [
    ...[0, 1, 2].map((i) => ({ id: `e${i}`, kind: "notes" as const, staff: "treble" as const, startTick: i * 480,
      rhythm: { status: "final" as const, duration: "quarter" as const }, pitches: [{ id: `p${i}`, midiNumber: 64, letter: "E" as const, accidental: "natural" as const, octave: 4 }] })),
    { id: "r", kind: "rest", staff: "treble", startTick: 1440, rhythm: { status: "final", duration: "quarter" } },
    { id: "b", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "whole" } },
  ] }],
};
function setup(source = score, preflight = false) {
  const projection = projectStaffBuilderPieceForPractice(source); if (!projection.ok) throw Error();
  const piece = projection.piece;
  const created = createPiecePracticeSession(piece, { startMeasureIndex: 0, startedAtMs: 0, inputConfiguration: { mode: "microphone", instrument: "violin", pitchToleranceCents: 25 } });
  if (!created.ok) throw Error();
  let at = 0;
  const tracker = createPitchStabilizer();
  const view = renderHook(({ available }) => {
    const [state, setState] = useState<PiecePracticeSessionState>(created.state);
    const input = usePiecePracticeAcousticInput({ piece, sessionState: state, onSessionStateChange: setState, available, now: () => at });
    return { input, state, restart: () => setState((current) => restartCurrentPiecePracticeMeasure(piece, current, at)),
      nextMeasure: () => setState((current) => advancePiecePracticeNoAttackMeasure(piece, current, at).state) };
  }, { initialProps: { available: true } });
  const session = mock.sessions.at(-1)!;
  if (!preflight) act(() => {
    for (let i = 0; i < 4; i++) view.result.current.input.calibrationAction("skip");
    view.result.current.input.enterPractice();
  });
  const frame = (hz: number | null, generation = session.generation) => {
    at += 40;
    const observation = { frequencyHz: hz, quality: hz === null ? 0 : 0.99, levelDbfs: hz === null ? -80 : -20, reason: hz === null ? "quiet" as const : "usable" as const };
    act(() => session.options.onObservation?.({ observation, snapshot: tracker.update(observation, at, at / 1000), observedAtMs: at, audioSeconds: at / 1000, captureGeneration: generation }));
  };
  const quiet = () => { for (let i = 0; i < 3; i++) frame(null); };
  const tone = (cents = 0, count = 10) => { for (let i = 0; i < count; i++) frame(equalTemperedFrequency(64) * 2 ** (cents / 1200)); };
  return { ...view, session, frame, quiet, tone };
}
beforeEach(() => { vi.useFakeTimers(); mock.sessions.length = 0; localStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("acoustic run ownership", () => {
  it.each(["stop", "interruption"] as const)("requires a fresh green assessment after %s before automatic advancement", (event) => {
    const s = setup(score, true);
    act(() => { s.result.current.input.calibrationAction("skip"); s.result.current.input.start(); });
    const pitch = equalTemperedFrequency(62);
    for (let i = 0; i < 40; i++) s.frame(pitch);
    const assessed = s.result.current.input.calibration;
    expect(assessed.phase).toBe("assessed"); expect(assessed.measurement.tuning).toBe("within-band");
    const preflight = () => {
      const input = s.result.current.input;
      return createElement(ViolinPreflight, { calibration: input.calibration, frequencyHz: input.calibrationHz,
        listening: input.status.state === "listening", onAction: input.calibrationAction, onEnterPractice: input.enterPractice });
    };
    const ui = render(preflight());
    act(() => vi.advanceTimersByTime(CALIBRATION_POLICY.acknowledgmentMs / 2));
    act(() => event === "stop" ? s.result.current.input.stop() : s.session.options.onStatus({ state: "paused", message: "Microphone interrupted" }));
    ui.rerender(preflight());
    act(() => s.result.current.input.calibrationAction("automatic"));
    act(() => s.result.current.input.start()); ui.rerender(preflight());
    act(() => vi.advanceTimersByTime(CALIBRATION_POLICY.acknowledgmentMs * 2));
    expect(s.result.current.input.calibration.phase).toBe("collecting");
    expect(s.result.current.input.calibration.referenceIndex).toBe(assessed.referenceIndex);
    expect(s.result.current.input.calibration.revision).toBe(assessed.revision);
    expect(s.result.current.input.calibration.attempts).toBe(assessed.attempts);
    s.frame(pitch); ui.rerender(preflight());
    act(() => vi.advanceTimersByTime(CALIBRATION_POLICY.acknowledgmentMs * 2));
    expect(s.result.current.input.calibration.referenceIndex).toBe(assessed.referenceIndex);
    for (let i = 0; i < 40; i++) s.frame(pitch);
    expect(s.result.current.input.calibration.phase).toBe("assessed"); ui.rerender(preflight());
    act(() => vi.advanceTimersByTime(CALIBRATION_POLICY.acknowledgmentMs));
    expect(s.result.current.input.calibration.referenceIndex).toBe(assessed.referenceIndex + 1);
    expect(s.result.current.input.calibration.revision).toBe(assessed.revision + 1);
    expect(s.result.current.input.calibration.attempts[1].choice).toBe("automatic");
  });
  it("collects all four string baselines in order without changing V2 practice state", () => {
    const s = setup(score, true); act(() => s.result.current.input.start());
    for (const semitone of [55, 62, 69, 76]) {
      s.quiet(); for (let i = 0; i < 40; i++) s.frame(equalTemperedFrequency(semitone));
      expect(s.result.current.input.calibration.phase).toBe("assessed");
      act(() => s.result.current.input.calibrationAction("automatic"));
    }
    expect(s.result.current.input.calibration.phase).toBe("summary");
    expect(s.result.current.input.calibration.attempts.map((attempt) => attempt.measurement.tuning)).toEqual(Array(4).fill("within-band"));
    expect(s.result.current.state.clockPaused).toBe(true); expect(s.result.current.state).not.toHaveProperty("calibration");
    expect(s.result.current.state).not.toHaveProperty("analysis");
  });
  it("isolates collector failure from acoustic grading", () => {
    const create = analysisCollector.createAcousticAnalysisCollector;
    vi.spyOn(analysisCollector, "createAcousticAnalysisCollector").mockImplementation((...args) => ({ ...create(...args), observe: () => { throw Error("collector failed"); } }));
    const s = setup(); act(() => s.result.current.input.start()); s.quiet(); s.tone();
    expect(s.result.current.state.completedTargetCount).toBe(1);
    act(() => vi.advanceTimersByTime(100)); expect(s.result.current.input.analysis.notice).toContain("collection-error");
  });
  it("exports through completion and keeps grading active when analysis is off", () => {
    const download = vi.spyOn(analysisBrowser, "downloadAcousticAnalysis").mockImplementation(() => {});
    const s = setup(); act(() => { s.result.current.input.analysis.changeEnabled(false); s.result.current.input.start(); });
    for (let i = 0; i < 3; i++) { s.quiet(); s.tone(); }
    expect(s.result.current.state.status).toBe("piece-complete");
    act(() => s.result.current.input.analysis.export());
    expect(download).toHaveBeenCalledOnce(); const bundle = JSON.parse(download.mock.calls[0][0]);
    expect(bundle.trace).toEqual([]); expect(bundle.attempts).toEqual([]);
    expect(analysisBrowser.readAnalysisPreference()).toBe(false);
  });
  it("resumes linked attempt collection on the same target after toggling Off then On", () => {
    const download = vi.spyOn(analysisBrowser, "downloadAcousticAnalysis").mockImplementation(() => {});
    const s = setup(); act(() => s.result.current.input.start()); s.quiet(); s.tone(35);
    act(() => s.result.current.input.analysis.changeEnabled(false)); s.tone(35);
    act(() => s.result.current.input.analysis.changeEnabled(true)); s.quiet(); s.tone();
    act(() => { s.result.current.input.stop(); s.result.current.input.analysis.export(); });
    const bundle = JSON.parse(download.mock.calls[0][0]); expect(bundle.attempts).toHaveLength(2);
    expect(bundle.attempts[1].evidence.accepted).toBe(true); expect(bundle.coverage.gaps.some((gap: { reason: string }) => gap.reason === "collection-disabled")).toBe(true);
    act(() => vi.advanceTimersByTime(100)); expect(s.result.current.input.analysis.notice).toContain("exported");
  });
  it("keeps calibration tones out of evidence/time and requires fresh quiet before the first target", () => {
    const s = setup(score, true); act(() => s.result.current.input.start());
    s.quiet(); s.tone(0, 40);
    expect(s.result.current.state.clockPaused).toBe(true); expect(s.result.current.state.activeElapsedMs).toBe(0);
    expect(s.result.current.state.mistakeEvidence).toHaveLength(0); expect(s.result.current.state.acousticEvidence ?? []).toHaveLength(0);
    act(() => { for (let i = 0; i < 4; i++) s.result.current.input.calibrationAction("skip"); s.result.current.input.enterPractice(); });
    s.tone(0, 40); expect(s.result.current.state.completedTargetCount).toBe(0);
    s.quiet(); s.tone(); expect(s.result.current.state.completedTargetCount).toBe(1);
  });
  it("interruption during preflight does not resume practice on Start", () => {
    const s = setup(score, true); act(() => s.result.current.input.start());
    act(() => window.dispatchEvent(new Event("pagehide")));
    act(() => s.result.current.input.start());
    expect(s.result.current.input.phase).toBe("preflight"); expect(s.result.current.state.clockPaused).toBe(true);
  });
  it("preserves quiet articulation history through a targetless measure without advancing it from sound", () => {
    const source: StaffBuilderScore = { ...score, measures: [0, 1, 2].map((index) => ({ id: `measure-${index}`, events: [
      index === 1
        ? { id: `rest-${index}`, kind: "rest", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "whole" } }
        : { id: `note-${index}`, kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "whole" },
          pitches: [{ id: `pitch-${index}`, midiNumber: 64, letter: "E", accidental: "natural", octave: 4 }] },
      { id: `bass-${index}`, kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "whole" } },
    ] })) };
    const s = setup(source); act(() => s.result.current.input.start()); s.quiet(); s.tone();
    expect(s.result.current.state.currentMeasureIndex).toBe(1);
    s.tone(); expect(s.result.current.state.status).toBe("awaiting-explicit-measure-advance");
    s.quiet(); act(() => s.result.current.nextMeasure()); s.tone();
    expect(s.result.current.state.status).toBe("piece-complete");
    expect(s.result.current.state.acousticEvidence?.map((attack) => attack.articulation)).toEqual(["initial-acquisition", "after-quiet"]);
  });
  it("starts explicitly, begins paused, and never advances repeated E4 from a held sound", () => {
    const s = setup(); expect(s.session.start).not.toHaveBeenCalled(); expect(s.result.current.state.clockPaused).toBe(true);
    act(() => s.result.current.input.start()); s.quiet(); s.tone(0, 40);
    expect(s.result.current.state.completedTargetCount).toBe(1); expect(s.result.current.state.acousticEvidence).toHaveLength(1);
    expect(s.result.current.state.attackEvidence).toBeUndefined();
  });
  it("intonation rejection consumes the attack until fresh articulation", () => {
    const s = setup(); act(() => s.result.current.input.start()); s.quiet(); s.tone(35); s.tone(0);
    expect(s.result.current.state.completedTargetCount).toBe(0); expect(s.result.current.state.mistakeEvidence).toHaveLength(1);
    s.quiet(); s.tone(); expect(s.result.current.state.completedTargetCount).toBe(1);
  });
  it.each(["restart", "skip"] as const)("%s cannot manufacture an initial attack from sustained sound", (action) => {
    const s = setup(); act(() => s.result.current.input.start()); s.quiet(); s.tone();
    act(() => action === "restart" ? s.result.current.restart() : s.result.current.input.skipCurrentTarget());
    const before = s.result.current.state.completedTargetCount; s.tone(); expect(s.result.current.state.completedTargetCount).toBe(before);
    s.quiet(); s.tone(); expect(s.result.current.state.completedTargetCount).toBe(before + 1);
  });
  it("stops on completion and invalidates late callbacks", () => {
    const s = setup(); act(() => s.result.current.input.start());
    for (let i = 0; i < 3; i++) { s.quiet(); s.tone(); }
    expect(s.result.current.state.status).toBe("piece-complete"); expect(s.session.stop).toHaveBeenCalled();
    const before = s.result.current.state; s.quiet(); s.tone(); expect(s.result.current.state).toBe(before);
  });
  it.each(["pagehide", "freeze", "visibilitychange"])("%s stops capture, pauses time, and needs explicit restart", (event) => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const s = setup(); act(() => s.result.current.input.start()); s.quiet(); s.tone();
    if (event === "visibilitychange") visibility.mockReturnValue("hidden");
    act(() => (event === "pagehide" ? window : document).dispatchEvent(new Event(event)));
    expect(s.result.current.state.clockPaused).toBe(true); expect(s.result.current.input.status.state).toBe("paused");
    visibility.mockReturnValue("visible"); act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(s.session.start).toHaveBeenCalledTimes(1); expect(s.result.current.state.clockPaused).toBe(true);
  });
  it("hosted-run exclusion stops listening without automatic recovery", () => {
    const s = setup(); act(() => s.result.current.input.start()); s.rerender({ available: false });
    expect(s.session.options.eligible()).toBe(false); expect(s.result.current.state.clockPaused).toBe(true);
    s.rerender({ available: true }); expect(s.session.start).toHaveBeenCalledTimes(1);
  });
  it("denial or track/context interruption pauses and discards stale generation observations", () => {
    const s = setup(); act(() => s.result.current.input.start()); s.quiet(); s.tone(); const previousGeneration = s.session.generation;
    act(() => s.session.options.onStatus({ state: "denied", message: "Permission denied" }));
    expect(s.result.current.state.clockPaused).toBe(true);
    act(() => s.result.current.input.start());
    for (let i = 0; i < 10; i++) s.frame(equalTemperedFrequency(64), previousGeneration);
    expect(s.result.current.state.completedTargetCount).toBe(1);
  });
  it("unmount stops capture and ignores subsequent status and observation callbacks", () => {
    const s = setup(); act(() => s.result.current.input.start()); const state = s.result.current.state;
    s.unmount(); expect(s.session.stop).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    act(() => s.session.options.onStatus({ state: "listening", message: "Late" })); s.quiet(); s.tone();
    expect(s.result.current.state).toBe(state);
  });
});
