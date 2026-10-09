import { act, cleanup, render, renderHook } from "@testing-library/react";
import { createElement, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaptureOptions, CaptureStatus } from "@/lib/audio/monophonic/microphone-capture";
import type { PitchObservation } from "@/lib/audio/monophonic/pitch-analysis-types";
import { createPitchStabilizer } from "@/lib/audio/monophonic/pitch-stabilizer";
import { centsBetween, equalTemperedFrequency } from "@/lib/audio/monophonic/pitch-math";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import { projectStaffBuilderPieceForPractice } from "../piece-practice-projection";
import { advancePiecePracticeNoAttackMeasure, createPiecePracticeSession, restartCurrentPiecePracticeMeasure, type PiecePracticeSessionState } from "../piece-practice-session";
import { usePiecePracticeAcousticInput } from "./use-piece-practice-acoustic-input";
import * as analysisCollector from "@/features/acoustic-analysis/acoustic-analysis-collector";
import * as analysisBrowser from "@/features/acoustic-analysis/acoustic-analysis-browser";
import { ViolinPreflight } from "@/features/instrument-learning/components/violin-preflight";

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
function setup(source = score, preflight = false, pitchToleranceCents = 25) {
  const projection = projectStaffBuilderPieceForPractice(source); if (!projection.ok) throw Error();
  const piece = projection.piece;
  const created = createPiecePracticeSession(piece, { startMeasureIndex: 0, startedAtMs: 0, inputConfiguration: { mode: "microphone", instrument: "violin", pitchToleranceCents } });
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
  const frame = (hz: number | null, generation = session.generation, stepMs = 40, state?: "stable" | "uncertain" | "acquiring", overrides: Partial<PitchObservation> = {}) => {
    at += stepMs;
    const observation = { frequencyHz: hz, quality: hz === null ? 0 : 0.99, levelDbfs: hz === null ? -80 : -20, reason: hz === null ? "quiet" as const : "usable" as const, ...overrides };
    act(() => session.options.onObservation?.({ observation, snapshot: { ...tracker.update(observation, at, at / 1000), ...(state ? { state, fresh: state === "stable" } : {}) }, observedAtMs: at, audioSeconds: at / 1000, captureGeneration: generation }));
  };
  const quiet = () => { for (let i = 0; i < 3; i++) frame(null); };
  const tone = (cents = 0, count = 10) => { for (let i = 0; i < count; i++) frame(equalTemperedFrequency(64) * 2 ** (cents / 1200)); };
  return { ...view, session, frame, quiet, tone, elapse: (ms: number) => act(() => { at += ms; vi.advanceTimersByTime(ms); }) };
}
beforeEach(() => { vi.useFakeTimers(); mock.sessions.length = 0; localStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

function presentation(s: ReturnType<typeof setup>) {
  const preflight = () => { const input = s.result.current.input; return createElement(ViolinPreflight, {
    calibration: input.calibration, frequencyHz: input.calibrationHz, feedback: input.calibrationFeedback, accepted: input.calibrationAccepted,
    listening: input.status.state === "listening", onAction: input.calibrationAction, onEnterPractice: input.enterPractice, onSkipCalibration: input.skipCalibrationAndStartPractice }); };
  const ui = render(preflight());
  return { ...ui, refresh: () => ui.rerender(preflight()) };
}

function pluck(s: ReturnType<typeof setup>, semitone: number, cents = 0) {
  // Nominal 30 Hz callbacks, a brief attack, then a decaying ringing signal.
  for (const [i, step] of [31, 35, 34, 37, 32, 35].entries()) {
    s.frame(equalTemperedFrequency(semitone) * 2 ** ((cents + [1, -1, 0, 1, -1, 0][i]) / 1200),
      s.session.generation, step, "acquiring", { levelDbfs: -22 - i * 2 });
    act(() => vi.advanceTimersByTime(step));
  }
}

describe("beginner pluck preparation through the React display", () => {
  it("automatically accepts the observed +5.50-cent G3 from sufficient short-pluck evidence", () => {
    const s = setup(score, true, 40); act(() => s.result.current.input.start());
    pluck(s, 55, 5.5);
    expect(s.result.current.input.calibration.attempts).toHaveLength(1);
    expect(s.result.current.input.calibration.attempts[0].measurement.cents).toBeCloseTo(5.5);
    s.frame(null); s.elapse(1200);
    expect(s.result.current.input.calibration.referenceIndex).toBe(1);
  });
  it.each([[62, -18.64, 1], [69, -19.49, 2]])("does not auto-accept %s at %s cents despite Forgiving practice, then accepts a tuned pluck", (semitone, cents, step) => {
    const s = setup(score, true, 40);
    act(() => { for (let i = 0; i < step; i++) s.result.current.input.calibrationAction("skip"); s.result.current.input.start(); });
    const ui = presentation(s);
    pluck(s, semitone, cents); ui.refresh();
    expect(s.result.current.input.calibrationAccepted).toBeNull();
    expect(s.result.current.input.calibration.referenceIndex).toBe(step);
    expect(s.result.current.input.calibration.attempts).toHaveLength(step);
    expect(ui.getByText("Estimated deviation band").nextElementSibling?.textContent).toContain("Adjust tuning");
    s.frame(null); s.elapse(300); ui.refresh();
    expect(ui.getByText("Reading status").nextElementSibling?.textContent).toContain("Last heard");
    pluck(s, semitone); s.frame(null); pluck(s, semitone); ui.refresh();
    expect(s.result.current.input.calibrationAccepted).not.toBeNull();
    expect(Math.abs(s.result.current.input.calibration.attempts[step].measurement.cents!)).toBeLessThanOrEqual(10);
  });
  it("displays a green estimate without acceptance from a single frame or held reading", () => {
    const s = setup(score, true); act(() => s.result.current.input.start());
    const ui = presentation(s);
    s.frame(equalTemperedFrequency(55) * 2 ** (5.5 / 1200)); s.elapse(220); ui.refresh();
    expect(ui.getByText("Estimated deviation band").nextElementSibling?.textContent).toContain("Ready for practice");
    expect(ui.getByText("Reading status").nextElementSibling?.textContent).toContain("Last heard");
    act(() => s.result.current.input.calibrationAction("automatic"));
    expect(s.result.current.input.calibration.attempts).toHaveLength(0);
  });
  it.each([-40, 40, -40.01, 40.01])("preserves Forgiving practice grading at %s cents after bypassing calibration", (cents) => {
    const s = setup(score, true, 40); act(() => { s.result.current.input.start(); s.result.current.input.skipCalibrationAndStartPractice(); });
    s.quiet(); s.tone(cents);
    expect(s.result.current.state.completedTargetCount).toBe(Math.abs(cents) <= 40 ? 1 : 0);
    expect(s.result.current.state.acousticEvidence?.[0].pitchToleranceCents).toBe(40);
    expect(s.result.current.input.calibration.attempts.every((a) => a.disposition === "skipped")).toBe(true);
  });
  it("updates an off-target pluck, accepts an adjusted pluck, and progresses G-D-A-E without further sound", () => {
    const s = setup(score, true); act(() => s.result.current.input.start());
    const ui = presentation(s);
    const fields = Array.from(ui.container.querySelectorAll("dt, dd"));
    pluck(s, 55, 22); ui.refresh();
    expect(ui.getByText("Concert-pitch deviation").parentElement?.className).toContain("text-yellow-200");
    expect(s.result.current.input.calibration.attempts).toHaveLength(0);
    s.frame(null); s.elapse(220); ui.refresh();
    expect(ui.getByText("Reading status").nextElementSibling?.textContent).toContain("Last heard");
    expect(ui.getByText("Detected frequency").nextElementSibling?.textContent).toContain("Hz");
    expect(Array.from(ui.container.querySelectorAll("dt, dd"))).toEqual(fields);
    for (const [index, semitone] of [55, 62, 69, 76].entries()) {
      pluck(s, semitone); ui.refresh();
      expect(s.result.current.input.calibration.attempts).toHaveLength(index + 1);
      expect(s.result.current.input.calibrationAccepted?.referenceIndex).toBe(index);
      expect(s.result.current.input.calibration.attempts[index].measurement.cents).toBeCloseTo(0, 1);
      expect(ui.getByText("Reading status").nextElementSibling?.textContent).toContain("Confirmed baseline");
      s.frame(null); s.elapse(1200); ui.refresh();
      if (index < 3) {
        expect(ui.getByRole("heading", { name: `Check open ${["G3", "D4", "A4", "E5"][index + 1]}` })).toBeTruthy();
        expect(s.result.current.input.calibrationFeedback.frequencyHz).toBeNull();
      }
    }
    expect(ui.getByRole("button", { name: "Enter Piece Practice" })).toBeTruthy();
    expect(s.result.current.state.clockPaused).toBe(true);
    expect(s.result.current.state.activeElapsedMs).toBe(0);
    expect(s.result.current.state.completedTargetCount).toBe(0);
    expect(s.result.current.state.mistakeEvidence).toEqual([]);
    expect(s.result.current.state.acousticEvidence ?? []).toEqual([]);
  });

  it("does not certify the previous string's ringing tail, even if its estimates match the next target", () => {
    const s = setup(score, true); act(() => s.result.current.input.start());
    pluck(s, 55); s.elapse(1200);
    for (let i = 0; i < 10; i++) s.frame(equalTemperedFrequency(62), s.session.generation, 34, "acquiring", { levelDbfs: -32 });
    expect(s.result.current.input.calibration.attempts).toHaveLength(1);
    s.elapse(200);
    expect(s.result.current.input.calibrationFeedback.progress?.blocker).toBe("boundary");
    s.frame(null); pluck(s, 62);
    expect(s.result.current.input.calibration.attempts).toHaveLength(2);
  });

  it("explains a short noisy pluck after it decays without erasing a previous useful reading", () => {
    const s = setup(score, true); act(() => s.result.current.input.start());
    const ui = presentation(s);
    pluck(s, 55, -65); s.frame(null);
    for (let i = 0; i < 4; i++) {
      s.frame(null, s.session.generation, 33, "uncertain", { levelDbfs: -25 - i * 3, reason: "low-periodicity" });
      act(() => vi.advanceTimersByTime(33));
    }
    s.frame(null); s.elapse(700); ui.refresh();
    expect(ui.getByText("Guidance").parentElement?.textContent).toContain("reliable repeating pitch");
    expect(ui.getByText("Detected frequency").nextElementSibling?.textContent).toContain("Hz");
    expect(ui.getByText("Reading status").nextElementSibling?.textContent).toContain("Last heard");
    expect(ui.getByText("Concert-pitch deviation").parentElement?.className).toContain("text-red-200");
    expect(s.result.current.input.calibration.attempts).toHaveLength(0);
  });

  it.each([0, 1, 2, 3])("bypasses all remaining strings from step %s while preserving prior choices and the practice onset boundary", (step) => {
    const s = setup(score, true); act(() => s.result.current.input.start());
    for (let i = 0; i < step; i++) { pluck(s, [55, 62, 69][i]); s.frame(null); s.elapse(1200); }
    const committed = s.result.current.input.calibration.attempts.slice();
    const ui = presentation(s);
    act(() => ui.getByRole("button", { name: "Skip Calibration and Start Practice" }).click());
    expect(s.result.current.input.phase).toBe("practice");
    expect(s.result.current.input.calibration.attempts).toHaveLength(4);
    expect(s.result.current.input.calibration.attempts.slice(0, step)).toEqual(committed);
    expect(s.result.current.input.calibration.attempts.slice(step).every((a) => a.disposition === "skipped" && a.measurement.medianHz === null)).toBe(true);
    s.elapse(2000); s.tone();
    expect(s.result.current.state.completedTargetCount).toBe(0);
    s.quiet(); s.tone();
    expect(s.result.current.state.completedTargetCount).toBe(1);
    expect(s.result.current.input.calibration.attempts).toHaveLength(4);
  });

  it("bypasses during accepted acknowledgment without losing the baseline or letting a timer advance again", () => {
    const s = setup(score, true); act(() => s.result.current.input.start());
    pluck(s, 55);
    const accepted = s.result.current.input.calibration.attempts[0];
    act(() => s.result.current.input.skipCalibrationAndStartPractice());
    s.elapse(5000);
    expect(s.result.current.input.phase).toBe("practice");
    expect(s.result.current.input.calibration.attempts).toHaveLength(4);
    expect(s.result.current.input.calibration.attempts[0]).toEqual(accepted);
    expect(s.result.current.input.calibrationAccepted).toBeNull();
    expect(s.result.current.state.completedTargetCount).toBe(0);
  });

  it("exports an unaccepted pluck as skipped evidence and continues collecting unchanged practice evidence", () => {
    const download = vi.spyOn(analysisBrowser, "downloadAcousticAnalysis").mockImplementation(() => {});
    const s = setup(score, true); act(() => s.result.current.input.start());
    pluck(s, 55, 22);
    act(() => s.result.current.input.skipCalibrationAndStartPractice());
    s.quiet(); s.tone();
    act(() => { s.result.current.input.stop(); s.result.current.input.analysis.export(); });
    const bundle = JSON.parse(download.mock.calls[0][0]);
    const calibration = bundle.calibrations.at(-1);
    expect(calibration.policyVersion).toBe(3);
    expect(calibration.attempts).toHaveLength(4);
    expect(calibration.attempts[0]).toMatchObject({ disposition: "skipped", measurement: { tuning: "near-target", status: "valid" } });
    expect(calibration.attempts.slice(1).every((a: { disposition: string; measurement: { medianHz: number | null } }) => a.disposition === "skipped" && a.measurement.medianHz === null)).toBe(true);
    expect(bundle.attempts).toHaveLength(1);
    expect(bundle.attempts[0].evidence.accepted).toBe(true);
    expect(bundle.attempts[0].evidence.pitchToleranceCents).toBe(25);
    expect(bundle.trace.some((row: { observation: { context: { phase: string } } }) => row.observation.context.phase === "practice")).toBe(true);
  });
});

describe("responsive preflight evidence", () => {
  it("replaces the red historical C-sharp4 screenshot reading with green live D4 before certification", () => {
    const s = setup(score, true); act(() => { s.result.current.input.calibrationAction("skip"); s.result.current.input.start(); });
    const ui = presentation(s), fields = Array.from(ui.container.querySelectorAll("dt, dd"));
    for (let i = 0; i < 6; i++) { s.frame(282.89, s.session.generation, 40, "acquiring"); act(() => vi.advanceTimersByTime(40)); }
    for (let i = 0; i < 60; i++) { s.frame(null, s.session.generation, 40, "uncertain", { reason: "aperiodic", quality: 0, levelDbfs: -20 }); act(() => vi.advanceTimersByTime(40)); }
    ui.refresh();
    expect(ui.getByText("Detected note").nextElementSibling?.textContent).toMatch(/C.*4/);
    expect(ui.getByText("Detected frequency").nextElementSibling?.textContent).toContain("282.89 Hz");
    expect(ui.getByText("Concert-pitch deviation").parentElement?.className).toContain("text-red-200");
    expect(ui.getByText("Reading status").nextElementSibling?.textContent).toContain("Last heard");
    expect(ui.getByText("Reading status").nextElementSibling?.textContent).toContain("not verified");
    expect(ui.getByText("Uncertain")).toBeTruthy();
    expect(s.result.current.input.calibrationFeedback.progress?.sampleCount).toBe(4);
    expect(ui.getByText("Guidance").parentElement?.textContent).toContain("Microphone cannot find a reliable repeating pitch");
    expect(s.result.current.input.calibration.attempts).toHaveLength(1);
    const greenHz = equalTemperedFrequency(62) * 2 ** (2 / 1200);
    for (let i = 0; i < 3; i++) { s.frame(greenHz, s.session.generation, 40, "acquiring"); act(() => vi.advanceTimersByTime(40)); }
    s.elapse(40); ui.refresh();
    expect(ui.getByText("Detected note").nextElementSibling?.textContent).toBe("D4");
    expect(ui.getByText("Detected frequency").nextElementSibling?.textContent).toContain(greenHz.toFixed(2));
    expect(ui.getByText("Concert-pitch deviation").nextElementSibling?.textContent).toContain("+2.0 cents");
    expect(ui.getByText("Concert-pitch deviation").parentElement?.className).toContain("text-green-200");
    expect(ui.getByText("Reading status").nextElementSibling?.textContent).toContain("Live estimate");
    expect(ui.getByText("Collecting")).toBeTruthy();
    expect(ui.queryByText("Accepted")).toBeNull();
    expect(s.result.current.input.calibrationAccepted).toBeNull();
    expect(Array.from(ui.container.querySelectorAll("dt, dd"))).toEqual(fields);
    expect(s.result.current.state.completedTargetCount).toBe(0);
    expect(s.result.current.state.activeElapsedMs).toBe(0);
    expect(s.result.current.state.mistakeEvidence).toHaveLength(0);
  });
  it("displays genuine evidence progress, clears expired coverage, and never accepts held numbers", () => {
    const s = setup(score, true); act(() => { s.result.current.input.calibrationAction("skip"); s.result.current.input.start(); });
    const ui = presentation(s);
    const progressArea = ui.getByText("Tuning preparation").parentElement;
    for (let i = 0; i < 20; i++) { s.frame(equalTemperedFrequency(62) * 2 ** (30 / 1200), s.session.generation, 40, "acquiring"); act(() => vi.advanceTimersByTime(40)); }
    ui.refresh();
    expect(s.result.current.input.calibrationFeedback.progress).toMatchObject({ sampleCount: 18, coverageMs: 680 });
    expect(progressArea?.textContent).toContain("Pluck");
    s.elapse(3400); ui.refresh();
    expect(s.result.current.input.calibrationFeedback.progress?.sampleCount).toBe(0);
    expect(ui.getByText("Tuning preparation").parentElement).toBe(progressArea);
    expect(ui.getByText("Reading status").nextElementSibling?.textContent).toContain("Last heard");
    act(() => s.result.current.input.calibrationAction("automatic"));
    expect(s.result.current.input.calibration.attempts).toHaveLength(1);
    expect(s.result.current.input.calibrationAccepted).toBeNull();
    s.frame(equalTemperedFrequency(62) * 2 ** (30 / 1200)); act(() => vi.advanceTimersByTime(40));
    for (let i = 0; i < 5; i++) { s.frame(equalTemperedFrequency(62) * 2 ** (30 / 1200)); act(() => vi.advanceTimersByTime(40)); }
    ui.refresh();
    expect(ui.getByText("Guidance").parentElement?.textContent).toMatch(/Pluck|pluck|No new microphone observations/);
    expect(s.result.current.input.calibrationFeedback.progress?.sampleCount).toBeLessThan(20);
    expect(ui.queryByRole("button", { name: "Retry" })).toBeNull();
  });
  it("updates live D4 Hz and cents throughout an unstable, acquiring bow stroke without accepting it", () => {
    const s = setup(score, true);
    act(() => { s.result.current.input.calibrationAction("skip"); s.result.current.input.start(); });
    const ui = presentation(s), rows = Array.from(ui.container.querySelectorAll("dt, dd"));
    const readings = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const hz = equalTemperedFrequency(62) * 2 ** (((i % 2 ? -18 : 18) + Math.sin(i)) / 1200);
      const step = [31, 37, 42, 34][i % 4];
      s.frame(hz, s.session.generation, step, "acquiring");
      act(() => vi.advanceTimersByTime(step)); ui.refresh();
      const feedback = s.result.current.input.calibrationFeedback;
      if (feedback.frequencyHz !== null) {
        expect(feedback.status).toBe("Live");
        const displayed = ui.getByText("Detected frequency").nextElementSibling!.textContent!;
        expect(displayed).toContain(feedback.frequencyHz.toFixed(2));
        readings.add(displayed);
        const cents = centsBetween(feedback.frequencyHz, equalTemperedFrequency(62));
        expect(ui.getByText("Concert-pitch deviation").nextElementSibling!.textContent).toContain(`${cents >= 0 ? "+" : ""}${cents.toFixed(1)} cents`);
      }
      expect(s.result.current.input.calibration.attempts).toHaveLength(1); // G3 explicitly skipped only.
      expect(Array.from(ui.container.querySelectorAll("dt, dd"))).toEqual(rows);
    }
    expect(readings.size).toBeGreaterThan(8);
    expect(ui.getByText(/Pitch estimates do not agree yet/)).toBeTruthy();
    expect(ui.getByText("Insufficient evidence")).toBeTruthy();
    expect(ui.getByText("Listening - Sound detected - Measuring pitch")).toBeTruthy();
    expect(s.result.current.state.completedTargetCount).toBe(0);
    expect(s.result.current.state.activeElapsedMs).toBe(0);
    expect(s.result.current.state.mistakeEvidence).toHaveLength(0);
  });
  it.each([
    ["low-periodicity", 0.6, "Sound detected - Pitch estimate uncertain (low periodicity)"],
    ["aperiodic", 0, "Sound detected - Pitch estimate uncertain (aperiodic signal)"],
    ["clipped", 0, "Sound detected - Signal clipped"],
    ["out-of-range", 0.99, "Sound detected - Pitch estimate outside supported range"],
  ] as const)("explains audible rejected %s observations without inventing a pitch", (reason, quality, message) => {
    const s = setup(score, true); act(() => { s.result.current.input.calibrationAction("skip"); s.result.current.input.start(); }); const ui = presentation(s);
    for (let i = 0; i < 60; i++) { s.frame(null, s.session.generation, 40, "uncertain", { reason, quality, levelDbfs: -20 }); act(() => vi.advanceTimersByTime(40)); }
    ui.refresh();
    expect(ui.getByText(message)).toBeTruthy();
    expect(ui.getByText("Guidance").parentElement?.textContent).toContain(reason === "low-periodicity" || reason === "aperiodic"
      ? "Microphone cannot find a reliable repeating pitch" : reason === "clipped" ? "Signal is clipped" : "Pitch estimate is outside the supported range");
    expect(s.result.current.input.calibrationFeedback.frequencyHz).toBeNull();
    expect(s.result.current.input.calibration.attempts).toHaveLength(1);
    expect(s.result.current.input.calibrationAccepted).toBeNull();
    expect(s.result.current.input.calibrationFeedback.progress).toMatchObject({ sampleCount: 0, coverageMs: 0 });
  });
  it("retains historical Hz through quiet, distinguishes missing callbacks, then resumes fresh numeric updates", () => {
    const s = setup(score, true); act(() => s.result.current.input.start()); const ui = presentation(s);
    const hz = equalTemperedFrequency(55) * 2 ** (30 / 1200);
    for (let i = 0; i < 40; i++) { s.frame(hz, s.session.generation, 40, "acquiring"); act(() => vi.advanceTimersByTime(40)); }
    for (let i = 0; i < 25; i++) { s.frame(null); act(() => vi.advanceTimersByTime(40)); }
    ui.refresh();
    expect(ui.getByText("Signal too quiet for reliable pitch")).toBeTruthy();
    expect(ui.getByText("Reading status").nextElementSibling?.textContent).toContain("Last heard");
    expect(ui.getByText("Detected frequency").nextElementSibling!.textContent).toContain(hz.toFixed(2));
    expect(ui.getByText("Last stable assessment").nextElementSibling!.textContent).toContain(hz.toFixed(2));
    s.elapse(1200); ui.refresh();
    expect(ui.getByText("Guidance").parentElement!.textContent).toContain("No new microphone observations");
    const nextHz = equalTemperedFrequency(55) * 2 ** (-30 / 1200);
    for (let i = 0; i < 6; i++) { s.frame(nextHz, s.session.generation, 40, "acquiring"); act(() => vi.advanceTimersByTime(40)); } ui.refresh();
    expect(s.result.current.input.calibrationFeedback.status).toBe("Live");
    expect(ui.getByText("Detected frequency").nextElementSibling!.textContent).toContain(nextHz.toFixed(2));
    expect(s.result.current.input.calibration.attempts).toHaveLength(0);
  });
  it.each(["sparse", "gaps"] as const)("retains compatible %s pitch evidence without accepting yellow tuning", (pattern) => {
    const s = setup(score, true); act(() => s.result.current.input.start()); const ui = presentation(s);
    for (let i = 0; i < 100; i++) {
      const usable = pattern === "sparse" ? i % 5 === 0 : i % 16 < 10;
      s.frame(usable ? equalTemperedFrequency(55) * 2 ** (30 / 1200) : null, s.session.generation, 40, "acquiring",
        usable ? {} : { reason: "low-periodicity", quality: 0.6, levelDbfs: -20 });
      act(() => vi.advanceTimersByTime(40));
    }
    ui.refresh();
    expect(s.result.current.input.calibrationFeedback.progress?.sampleCount).toBeLessThanOrEqual(24);
    expect(ui.getByText("Tuning preparation")).toBeTruthy();
    expect(ui.getByText("Guidance").parentElement?.textContent).toMatch(/Pitch gap exceeded|reliable repeating pitch|Initial 50 ms|Pluck|pluck/);
    expect(s.result.current.input.calibration.attempts).toHaveLength(0);
  });
  it("shows sustained actual D5 harmonic evidence without octave folding or calibration acceptance", () => {
    const s = setup(score, true); act(() => { s.result.current.input.calibrationAction("skip"); s.result.current.input.start(); });
    const ui = presentation(s);
    for (let i = 0; i < 70; i++) { s.frame(equalTemperedFrequency(74), s.session.generation, 40, "acquiring"); act(() => vi.advanceTimersByTime(40)); }
    ui.refresh();
    expect(ui.getByText("Detected note").nextElementSibling!.textContent).toBe("D5");
    expect(ui.getByText("Sound detected - Possible harmonic")).toBeTruthy();
    expect(ui.getByText("Possible octave/harmonic ambiguity")).toBeTruthy();
    expect(s.result.current.input.calibration.attempts).toHaveLength(1);
  });
  it("never flashes a one-frame rejection and keeps live pitch separate from the previous stable assessment", () => {
    const s = setup(score, true); act(() => s.result.current.input.start()); const ui = presentation(s);
    const hz = equalTemperedFrequency(55) * 2 ** (30 / 1200);
    for (let i = 0; i < 40; i++) { s.frame(hz); act(() => vi.advanceTimersByTime(40)); }
    for (const bad of ["quiet", "low-periodicity", "harmonic"] as const) {
      s.frame(bad === "harmonic" ? hz * 2 : null, s.session.generation, 40, "uncertain", bad === "low-periodicity" ? { reason: "low-periodicity", quality: 0.6, levelDbfs: -20 } : {});
      act(() => vi.advanceTimersByTime(40)); ui.refresh();
      expect(ui.queryByText(/Signal too quiet|Possible harmonic|low periodicity/)).toBeNull();
      for (let i = 0; i < 6; i++) { s.frame(hz); act(() => vi.advanceTimersByTime(40)); }
    }
    for (let i = 0; i < 12; i++) { s.frame(equalTemperedFrequency(55) * 2 ** ((i % 2 ? -22 : 22) / 1200)); act(() => vi.advanceTimersByTime(40)); }
    const heldAssessment = s.result.current.input.calibrationFeedback.assessment;
    for (let i = 0; i < 12; i++) { s.frame(equalTemperedFrequency(55) * 2 ** ((i % 2 ? -22 : 22) / 1200)); act(() => vi.advanceTimersByTime(40)); }
    ui.refresh();
    expect(s.result.current.input.calibrationFeedback.assessment).toEqual(heldAssessment);
    expect(s.result.current.input.calibrationFeedback.frequencyHz).not.toBe(heldAssessment!.medianHz);
    expect(s.result.current.input.calibration.attempts).toHaveLength(0);
  });
  it("commits a full stable acquiring D4 window once and advances after presentation", () => {
    const s = setup(score, true); act(() => { s.result.current.input.calibrationAction("skip"); s.result.current.input.start(); }); const ui = presentation(s);
    for (let i = 0; i < 28; i++) s.frame(equalTemperedFrequency(62), s.session.generation, 40, "acquiring");
    ui.refresh(); expect(ui.getByText(/D4 accepted/)).toBeTruthy();
    s.frame(null); s.elapse(1200); ui.refresh();
    expect(ui.getByRole("heading", { name: "Check open A4" })).toBeTruthy();
    expect(s.result.current.input.calibration.attempts).toHaveLength(2);
    s.elapse(3000);
    expect(s.result.current.input.calibration.attempts).toHaveLength(2);
    expect(s.result.current.state.activeElapsedMs).toBe(0);
    expect(s.result.current.state.mistakeEvidence).toHaveLength(0);
  });
});

describe("acoustic run ownership", () => {
  it("calibrates four bowed strings with variable cadence, null frames, reacquisition and a harmonic glitch", () => {
    const s = setup(score, true); act(() => s.result.current.input.start());
    for (const [stringIndex, semitone] of [55, 62, 69, 76].entries()) {
      expect(s.result.current.input.calibrationFeedback.frequencyHz).toBeNull();
      let count = 0;
      while (s.result.current.input.calibration.referenceIndex === stringIndex && count < 180) {
        const i = count++, step = [31, 37, 42, 34][i % 4];
        const cents = i < 40 ? 30 + Math.sin(i) : Math.max(1, 30 - (i - 40) * 0.5) + Math.sin(i);
        const hz = i === 70 ? equalTemperedFrequency(semitone) * 2 : i % 13 === 0 ? null : equalTemperedFrequency(semitone) * 2 ** (cents / 1200);
        s.frame(hz, s.session.generation, step, i % 13 === 1 ? "acquiring" : i % 17 === 0 ? "uncertain" : "stable");
        act(() => vi.advanceTimersByTime(step));
      }
      expect(s.result.current.input.calibration.referenceIndex).toBe(stringIndex + 1);
      s.frame(null); s.elapse(1200);
    }
    expect(s.result.current.input.calibration.attempts).toHaveLength(4);
    expect(s.result.current.input.calibration.attempts.every((attempt) => attempt.measurement.tuning === "within-band")).toBe(true);
    expect(s.result.current.state.completedTargetCount).toBe(0);
    expect(s.result.current.state.clockPaused).toBe(true);
  });
  it("retains the current string's last heard Hz through silence and capture stop without accepting it", () => {
    const s = setup(score, true); act(() => s.result.current.input.start());
    const hz = equalTemperedFrequency(55) * 2 ** (30 / 1200);
    for (let i = 0; i < 40; i++) { s.frame(hz); act(() => vi.advanceTimersByTime(40)); }
    expect(s.result.current.input.calibrationFeedback.status).toBe("Live");
    s.frame(null); s.elapse(200);
    expect(s.result.current.input.calibrationFeedback).toMatchObject({ frequencyHz: hz, status: "Last heard" });
    for (let i = 0; i < 40; i++) s.frame(null);
    act(() => { vi.advanceTimersByTime(1000); s.result.current.input.calibrationAction("automatic"); s.result.current.input.stop(); });
    expect(s.result.current.input.calibrationFeedback.frequencyHz).toBe(hz);
    expect(s.result.current.input.calibration.referenceIndex).toBe(0);
    expect(s.result.current.state.completedTargetCount).toBe(0);
    act(() => s.result.current.input.calibrationAction("skip"));
    expect(s.result.current.input.calibrationFeedback.frequencyHz).toBeNull();
  });

  it.each([30, -55])("reassesses %s-cent G3 continuously and advances on sustained green without Retry", (cents) => {
    const s = setup(score, true); act(() => s.result.current.input.start());
    const preflight = () => { const input = s.result.current.input; return createElement(ViolinPreflight, {
      calibration: input.calibration, frequencyHz: input.calibrationHz, listening: input.status.state === "listening",
      onAction: input.calibrationAction, onEnterPractice: input.enterPractice, onSkipCalibration: input.skipCalibrationAndStartPractice }); };
    const ui = render(preflight());
    for (const semitone of [55, 62, 69, 76]) {
      const hz = equalTemperedFrequency(semitone);
      for (let i = 0; i < 40; i++) { s.frame(hz * 2 ** (cents / 1200)); ui.rerender(preflight()); }
      expect(s.result.current.input.calibration.measurement.tuning).not.toBe("within-band");
      const revision = s.result.current.input.calibration.revision;
      for (let i = 0; i < 70; i++) { s.frame(hz); ui.rerender(preflight()); act(() => vi.advanceTimersByTime(40)); }
      expect(s.result.current.input.calibration.revision).toBe(revision + 1);
      s.frame(null); s.elapse(1200);
    }
    expect(s.result.current.input.calibration.phase).toBe("summary");
    expect(s.result.current.input.calibration.attempts).toHaveLength(4);
    expect(s.result.current.state.clockPaused).toBe(true);
    expect(s.result.current.state.completedTargetCount).toBe(0);
  });

  it("keeps accepted G3 visible for 1.2 seconds then shows a fresh D4 display", () => {
    const s = setup(score, true); act(() => s.result.current.input.start());
    const preflight = () => { const input = s.result.current.input; return createElement(ViolinPreflight, {
      calibration: input.calibration, frequencyHz: input.calibrationHz, feedback: input.calibrationFeedback, accepted: input.calibrationAccepted,
      listening: input.status.state === "listening", onAction: input.calibrationAction, onEnterPractice: input.enterPractice, onSkipCalibration: input.skipCalibrationAndStartPractice }); };
    const ui = render(preflight());
    for (let i = 0; i < 27; i++) s.frame(equalTemperedFrequency(55));
    ui.rerender(preflight());
    expect(ui.getByRole("heading", { name: "Check open G3" })).toBeTruthy();
    expect(ui.getByText(/G3 accepted/)).toBeTruthy();
    s.frame(null); s.elapse(1199); ui.rerender(preflight());
    expect(ui.getByRole("heading", { name: "Check open G3" })).toBeTruthy();
    s.elapse(1); ui.rerender(preflight());
    expect(ui.getByRole("heading", { name: "Check open D4" })).toBeTruthy();
    expect(ui.queryByText("196.00 Hz")).toBeNull();
    expect(s.result.current.input.calibration.attempts[0].reference.note).toBe("G3");
  });
  it.each(["quiet", "harmonic", "uncertain"])("keeps a committed green stroke through subsequent %s and advances after acknowledgment", (kind) => {
    const s = setup(score, true); act(() => s.result.current.input.start());
    const hz = equalTemperedFrequency(55);
    for (let i = 0; i < 27; i++) s.frame(hz);
    expect(s.result.current.input.calibration.attempts).toHaveLength(1);
    const accepted = s.result.current.input.calibration.attempts[0];
    expect(accepted.measurement.samples.length).toBeGreaterThanOrEqual(4);
    expect(s.result.current.input.calibrationAccepted?.referenceIndex).toBe(0);
    for (let i = 0; i < 10; i++) s.frame(kind === "quiet" ? null : kind === "harmonic" ? hz * 2 : hz, s.session.generation, 40, kind === "uncertain" ? "uncertain" : "stable");
    s.elapse(1199);
    expect(s.result.current.input.calibrationAccepted).not.toBeNull();
    s.elapse(1);
    expect(s.result.current.input.calibrationAccepted).toBeNull();
    expect(s.result.current.input.calibration.referenceIndex).toBe(1);
    expect(s.result.current.input.calibration.attempts).toEqual([accepted]);
    act(() => { s.result.current.input.calibrationAction("automatic"); vi.advanceTimersByTime(5000); });
    expect(s.result.current.input.calibration.attempts).toEqual([accepted]);
    expect(s.result.current.input.calibration.referenceIndex).toBe(1);
    expect(s.result.current.input.calibrationFeedback.frequencyHz).toBeNull();
    expect(s.result.current.state.completedTargetCount).toBe(0);
    expect(s.result.current.state.activeElapsedMs).toBe(0);
    expect(s.result.current.state.mistakeEvidence).toHaveLength(0);
  });
  it.each(["stop", "interruption"] as const)("does not accept incomplete evidence after %s, retaining earlier choices", (event) => {
    const s = setup(score, true);
    act(() => { s.result.current.input.calibrationAction("skip"); s.result.current.input.start(); });
    const choices = s.result.current.input.calibration.attempts;
    for (let i = 0; i < 4; i++) s.frame(equalTemperedFrequency(62));
    act(() => event === "stop" ? s.result.current.input.stop() : s.session.options.onStatus({ state: "paused", message: "Interrupted" }));
    act(() => { vi.advanceTimersByTime(5000); s.result.current.input.calibrationAction("automatic"); });
    expect(s.result.current.input.calibration.referenceIndex).toBe(1);
    expect(s.result.current.input.calibration.attempts).toBe(choices);
    act(() => s.result.current.input.start());
    s.frame(equalTemperedFrequency(62));
    expect(s.result.current.input.calibration.attempts).toBe(choices);
    for (let i = 0; i < 27; i++) s.frame(equalTemperedFrequency(62));
    expect(s.result.current.input.calibration.attempts).toHaveLength(2);
  });
  it.each(["stop", "interruption"] as const)("preserves accepted green and pauses presentation after %s", (event) => {
    const s = setup(score, true); act(() => s.result.current.input.start());
    for (let i = 0; i < 27; i++) s.frame(equalTemperedFrequency(55));
    const choices = s.result.current.input.calibration.attempts;
    act(() => event === "stop" ? s.result.current.input.stop() : s.session.options.onStatus({ state: "paused", message: "Interrupted" }));
    act(() => vi.advanceTimersByTime(5000));
    expect(s.result.current.input.calibration.attempts).toBe(choices);
    expect(s.result.current.input.calibrationAccepted?.referenceIndex).toBe(0);
    expect(s.session.start).toHaveBeenCalledTimes(1);
    act(() => s.result.current.input.start());
    s.elapse(1200);
    expect(s.result.current.input.calibrationAccepted).toBeNull();
    expect(s.result.current.input.calibration.referenceIndex).toBe(1);
    expect(s.result.current.input.calibration.attempts).toBe(choices);
  });
  it("does not accept sustained harmonic or insufficient uncertain raw evidence before green", () => {
    const s = setup(score, true); act(() => s.result.current.input.start());
    for (let i = 0; i < 45; i++) s.frame(equalTemperedFrequency(55) * 2);
    for (let i = 0; i < 3; i++) s.frame(equalTemperedFrequency(55), s.session.generation, 40, "uncertain");
    s.quiet(); act(() => vi.advanceTimersByTime(5000));
    expect(s.result.current.input.calibration.attempts).toHaveLength(0);
  });
  it("collects all four string baselines in order without changing V2 practice state", () => {
    const s = setup(score, true); act(() => s.result.current.input.start());
    for (const semitone of [55, 62, 69, 76]) {
      for (let i = 0; i < 27; i++) s.frame(equalTemperedFrequency(semitone));
      s.frame(null); s.elapse(1200);
    }
    expect(s.result.current.input.calibration.phase).toBe("summary");
    expect(s.result.current.input.calibration.attempts.map((attempt) => attempt.measurement.tuning)).toEqual(Array(4).fill("within-band"));
    expect(s.result.current.state.clockPaused).toBe(true); expect(s.result.current.state.activeElapsedMs).toBe(0);
    expect(s.result.current.state.mistakeEvidence).toHaveLength(0);
    expect(s.result.current.state).not.toHaveProperty("calibration"); expect(s.result.current.state).not.toHaveProperty("analysis");
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
    expect(s.result.current.state.mistakeEvidence).toHaveLength(0);
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
