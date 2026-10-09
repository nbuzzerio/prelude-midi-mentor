import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createMicrophoneCapture, type CaptureStatus } from "@/lib/audio/monophonic/microphone-capture";
import { MONOPHONIC_CONFIG, type PitchSnapshot } from "@/lib/audio/monophonic/pitch-analysis-types";
import { createAcousticOnsetDetector } from "../piece-practice-acoustic-onset";
import { acousticTargetEligible, getAcousticEligibility } from "../piece-practice-acoustic-eligibility";
import { getCurrentPiecePracticeTarget, pausePiecePracticeClock, resetPiecePracticeAcousticInput, resumePiecePracticeClock,
  skipCurrentPiecePracticeTarget, submitPiecePracticeAcousticAttack, type PiecePracticeSessionState } from "../piece-practice-session";
import type { PiecePracticeAcousticEvidence } from "../piece-practice-evidence";
import type { PiecePracticePiece } from "../piece-practice-types";
import { createCalibrationSession, assessCalibration, advanceCalibration } from "@/features/instrument-learning/calibration-session";
import { emptyCalibrationMeasurement, VIOLIN_REFERENCES, type CalibrationMeasurement } from "@/features/instrument-learning/calibration-types";
import { createCalibrationContinuity } from "@/features/instrument-learning/calibration-continuity";
import { createAcousticAnalysisCollector } from "@/features/acoustic-analysis/acoustic-analysis-collector";
import { downloadAcousticAnalysis, readAnalysisPreference, saveAnalysisPreference } from "@/features/acoustic-analysis/acoustic-analysis-browser";
import { serializeAcousticAnalysis } from "@/features/acoustic-analysis/acoustic-analysis-export";
import { equalTemperedFrequency } from "@/lib/audio/monophonic/pitch-math";
import { formatPiecePracticeWrittenPitch } from "../piece-practice-evidence";
import { createPiecePracticeRecording, type RecordingSnapshot } from "../piece-practice-recording";

type Options = Readonly<{
  piece: PiecePracticePiece; sessionState: PiecePracticeSessionState;
  onSessionStateChange: (state: PiecePracticeSessionState) => void;
  available: boolean; now: () => number; runId?: string;
}>;
const EMPTY: PitchSnapshot = { state: "listening", pitch: null, fresh: false, ageMs: null };

/** Sole acoustic owner for one run. Never registers a MIDI consumer. */
export function usePiecePracticeAcousticInput(options: Options) {
  const latest = useRef(options);
  const detector = useRef(createAcousticOnsetDetector());
  const captureRef = useRef<ReturnType<typeof createMicrophoneCapture> | null>(null);
  const listening = useRef(false);
  const capturing = useRef(false);
  const cutoff = useRef(0);
  const [phase, setPhase] = useState<"preflight" | "practice">(() => options.sessionState.inputConfiguration?.mode === "microphone"
    && options.sessionState.inputConfiguration.instrument === "violin" && options.sessionState.status !== "piece-complete" ? "preflight" : "practice");
  const phaseRef = useRef(phase);
  const [calibration, setCalibration] = useState(() => createCalibrationSession(crypto.randomUUID()));
  const calibrationRef = useRef(calibration);
  const stability = useRef(createCalibrationContinuity(VIOLIN_REFERENCES[0]));
  const observationSequence = useRef(0);
  const [calibrationHz, setCalibrationHz] = useState<number | null>(null);
  const [calibrationFeedback, setCalibrationFeedback] = useState<ReturnType<ReturnType<typeof createCalibrationContinuity>["feedback"]>>({
    frequencyHz: null, status: "Last heard", assessment: null, confirming: false, lastHeardAt: null, ambiguity: null,
    activity: "Listening stopped", failureReason: null, liveFrequencyHz: null, lastHeardHz: null, progress: null,
  });
  const [calibrationAccepted, setCalibrationAccepted] = useState<{ referenceIndex: number; measurement: CalibrationMeasurement } | null>(null);
  const acceptedRef = useRef<typeof calibrationAccepted>(null);
  const acknowledgmentEpoch = useRef(0);
  const acceptedBoundary = useRef<{ level: number | null; quiet: boolean }>({ level: null, quiet: false });
  const lastCalibrationDisplayAt = useRef(0);
  const [analysisEnabled, setAnalysisEnabled] = useState(readAnalysisPreference);
  const [analysisNotice, setAnalysisNotice] = useState<string | null>(null);
  const analysisNoticeRef = useRef<string | null>(null);
  const [collector] = useState(() => {
    const config = options.sessionState.inputConfiguration;
    const result = createAcousticAnalysisCollector({ id: crypto.randomUUID(), runId: options.runId ?? null,
      startedAt: new Date().toISOString(), instrument: config?.mode === "microphone" ? config.instrument : "violin",
      startMeasureIndex: options.sessionState.startMeasureIndex, endMeasureIndex: options.sessionState.endMeasureIndex,
      focus: options.sessionState.assessmentFocus, pitchToleranceCents: config?.mode === "microphone" ? config.pitchToleranceCents : 25 }, options.now());
    result.setEnabled(analysisEnabled, options.now()); return result;
  });
  const [recordingSnapshot, setRecordingSnapshot] = useState<RecordingSnapshot>({
    enabled: false, phase: "off", message: "Performance recording off.", elapsedMs: 0,
    segments: [], retainedBytes: 0, limitReached: false,
  });
  const recordingRef = useRef<ReturnType<typeof createPiecePracticeRecording> | null>(null);
  const setRecordingEnabled = useCallback((enabled: boolean) => recordingRef.current?.setEnabled(enabled), []);
  const hasUnsavedRecording = useCallback(() => recordingRef.current?.hasUnsavedAudio() ?? false, []);
  const analysisGuard = useCallback((action: () => void) => {
    try { action(); } catch {
      try { collector.stop("collection-error", latest.current.now()); } catch { /* Never interrupt capture or grading. */ }
      analysisNoticeRef.current = "Analysis collection stopped after an error. Practice is unaffected.";
    }
  }, [collector]);
  const syncAnalysis = useCallback((state: PiecePracticeSessionState) => {
    analysisGuard(() => {
      const target = phaseRef.current === "practice" && state.status !== "piece-complete" ? getCurrentPiecePracticeTarget(latest.current.piece, state) : null;
      const pitch = target?.attackedPitches[0];
      const visit = collector.setTarget(target && pitch ? { id: target.id, measureIndex: target.measureIndex,
        sourceMeasureId: target.sourceMeasureId, expectedSemitone: pitch.midiNumber, expectedHz: equalTemperedFrequency(pitch.midiNumber),
        spelling: formatPiecePracticeWrittenPitch(pitch) } : null,
      target ? `${target.id}:${state.restartEvidence.length}:${state.skipEvidence.length}` : null, latest.current.now());
      collector.setContext({ phase: phaseRef.current, targetVisitId: visit,
        calibrationRevision: state.inputConfiguration?.mode === "microphone" && state.inputConfiguration.instrument === "violin" ? calibrationRef.current.revision : null,
        referenceHz: phaseRef.current === "preflight" ? VIOLIN_REFERENCES[acceptedRef.current?.referenceIndex ?? calibrationRef.current.referenceIndex]?.frequencyHz ?? null
          : target ? equalTemperedFrequency(target.expectedMidiNumbers[0]) : null, paused: !listening.current });
    });
  }, [analysisGuard, collector]);
  const [status, setStatus] = useState<CaptureStatus>({ state: "idle", message: "Microphone off. Press Start Listening when ready." });
  const [reading, setReading] = useState<PitchSnapshot>(EMPTY);
  const [needsQuiet, setNeedsQuiet] = useState(true);
  const [lastAttempt, setLastAttempt] = useState<PiecePracticeAcousticEvidence | null>(null);
  const commit = useCallback((state: PiecePracticeSessionState) => {
    if (state === latest.current.sessionState) return;
    latest.current = { ...latest.current, sessionState: state };
    latest.current.onSessionStateChange(state);
    syncAnalysis(state);
  }, [syncAnalysis]);

  useLayoutEffect(() => {
    const previous = latest.current;
    latest.current = options;
    if (previous.sessionState.acousticInputEpoch !== options.sessionState.acousticInputEpoch) {
      detector.current.reset(); cutoff.current = options.now(); setNeedsQuiet(true); setLastAttempt(null);
    } else if (getCurrentPiecePracticeTarget(previous.piece, previous.sessionState)?.id !== getCurrentPiecePracticeTarget(options.piece, options.sessionState)?.id) {
      detector.current.discardCandidate();
    }
    if (options.sessionState.restartEvidence.length > previous.sessionState.restartEvidence.length) {
      analysisGuard(() => collector.event("restart-measure", options.now()));
    }
    syncAnalysis(options.sessionState);
    recordingRef.current?.setEligible(phaseRef.current === "practice" && listening.current && options.sessionState.status !== "piece-complete" && !options.sessionState.clockPaused);
    if (capturing.current && (!options.available || options.sessionState.status === "piece-complete"
      || phaseRef.current === "practice" && options.sessionState.clockPaused && listening.current)) {
      captureRef.current?.stop(options.sessionState.status === "piece-complete" ? "idle" : "paused",
        options.available ? "Microphone off. Press Start Listening to resume practice." : "End the active Practice Session before listening.");
    }
  }, [options, analysisGuard, collector, syncAnalysis]);

  const calibrationAction = useCallback((choice: "automatic" | "continue" | "retry" | "skip") => {
    if (acceptedRef.current) return;
    if (choice === "automatic" && (!listening.current || !stability.current.confirmed(latest.current.now()))) return;
    const next = advanceCalibration(calibrationRef.current, choice);
    if (next === calibrationRef.current) return;
    if (choice === "automatic") {
      const accepted = { referenceIndex: calibrationRef.current.referenceIndex, measurement: calibrationRef.current.measurement };
      acceptedRef.current = accepted; setCalibrationAccepted(accepted); acceptedBoundary.current = { level: null, quiet: false };
    }
    calibrationRef.current = next; setCalibration(next); setCalibrationHz(null);
    analysisGuard(() => { collector.event(`calibration-${choice}`, latest.current.now()); collector.calibration(next, latest.current.now()); });
    stability.current = createCalibrationContinuity(VIOLIN_REFERENCES[Math.min(next.referenceIndex, 3)]);
    cutoff.current = latest.current.now();
    setCalibrationFeedback(stability.current.feedback(cutoff.current, listening.current));
    syncAnalysis(latest.current.sessionState);
  }, [analysisGuard, collector, syncAnalysis]);

  useEffect(() => {
    if (!calibrationAccepted || status.state !== "listening") return;
    const accepted = calibrationAccepted;
    const epoch = ++acknowledgmentEpoch.current;
    const timer = window.setTimeout(() => {
      if (!listening.current || acceptedRef.current !== accepted || acknowledgmentEpoch.current !== epoch) return;
      acceptedRef.current = null; setCalibrationAccepted(null);
      stability.current.reset();
      stability.current.waitForNewSound(acceptedBoundary.current.level, acceptedBoundary.current.quiet);
      cutoff.current = latest.current.now();
      setCalibrationFeedback(stability.current.feedback(cutoff.current, listening.current));
      syncAnalysis(latest.current.sessionState);
    }, 1200);
    return () => { acknowledgmentEpoch.current++; window.clearTimeout(timer); };
  }, [calibrationAccepted, status.state, syncAnalysis]);

  useEffect(() => {
    let mounted = true;
    // Capture and recorder share one effect lifetime. Strict Mode replay gets a
    // fresh controller instead of reusing the one permanently disposed by cleanup.
    const run = latest.current;
    const recording = createPiecePracticeRecording({
      runId: run.runId ?? crypto.randomUUID(),
      instrument: run.sessionState.inputConfiguration?.mode === "microphone" ? run.sessionState.inputConfiguration.instrument : "violin",
      analysisSessionId: collector.snapshot().session.id, originMs: collector.originMs,
      now: () => latest.current.now(),
      onChange: (snapshot) => { if (mounted && recordingRef.current === recording) setRecordingSnapshot(snapshot); },
    });
    recordingRef.current = recording;
    setRecordingSnapshot(recording.snapshot());
    const ownedDetector = detector.current;
    const eligible = () => {
      const { available, piece, sessionState } = latest.current;
      return mounted && available && document.visibilityState !== "hidden" && sessionState.status !== "piece-complete"
        && getAcousticEligibility(piece, sessionState.startMeasureIndex, sessionState.endMeasureIndex).eligible;
    };
    const capture = createMicrophoneCapture({ eligible, now: () => latest.current.now(),
      onPitch: () => { /* The bounded watchdog reads current freshness for display. */ },
      onStatus: (next) => {
        if (!mounted) return;
        listening.current = next.state === "listening";
        capturing.current = ["requesting", "starting", "listening"].includes(next.state);
        setStatus(next);
        if (!listening.current && phaseRef.current === "preflight" && calibrationRef.current.phase !== "summary") {
          // Only the pending assessment expires; committed choices and revisions survive.
          calibrationRef.current = { ...calibrationRef.current, phase: "collecting", measurement: emptyCalibrationMeasurement() };
          setCalibration(calibrationRef.current);
        }
        const { sessionState, now } = latest.current;
        analysisGuard(() => {
          collector.event(listening.current ? "resume" : "pause", now(), next.state);
          if (!listening.current) collector.resetCapture();
        });
        if (listening.current && phaseRef.current === "practice") commit(resumePiecePracticeClock(sessionState, now()));
        else {
          stability.current.reset();
          setCalibrationFeedback(stability.current.feedback(now(), listening.current));
          detector.current.reset(); cutoff.current = now(); setNeedsQuiet(true);
          commit(pausePiecePracticeClock(sessionState, now()));
        }
        recording.setEligible(listening.current && phaseRef.current === "practice" && latest.current.sessionState.status !== "piece-complete" && !latest.current.sessionState.clockPaused);
      },
      onStreamReady: (lease) => { if (mounted) recording.onStreamReady(lease); },
      onStreamEnding: (lease) => recording.onStreamEnding(lease),
      onObservation: (envelope) => {
        if (!eligible() || !listening.current || envelope.captureGeneration !== capture.generation()
          || envelope.observedAtMs < cutoff.current) return;
        const { piece, sessionState } = latest.current;
        syncAnalysis(sessionState);
        const observationId = `${calibrationRef.current.id}:observation-${observationSequence.current++}`;
        analysisGuard(() => collector.observe(envelope, observationId));
        if (phaseRef.current === "preflight") {
          if (acceptedRef.current) {
            acceptedBoundary.current.level = Number.isFinite(envelope.observation.levelDbfs) ? envelope.observation.levelDbfs : null;
            if (envelope.observation.reason === "quiet" && envelope.observation.levelDbfs < MONOPHONIC_CONFIG.minDbfs) acceptedBoundary.current.quiet = true;
            return;
          }
          const current = calibrationRef.current;
          if (current.phase !== "summary") {
            const measured = stability.current.update({ id: observationId, envelope });
            const next = assessCalibration(current, measured);
            calibrationRef.current = next;
            if (next.phase === "assessed" && (current.phase !== "assessed" || next.measurement.tuning !== current.measurement.tuning)) analysisGuard(() => collector.calibration(next, envelope.observedAtMs));
            else if (measured.status === "ambiguous" && current.measurement.status !== "ambiguous") analysisGuard(() => collector.trigger(envelope.observedAtMs, observationId));
            if (stability.current.confirmed(envelope.observedAtMs)) calibrationAction("automatic");
          }
          return;
        }
        if (sessionState.clockPaused) return;
        const attack = detector.current.update(envelope);
        setNeedsQuiet(detector.current.needsQuiet());
        const target = getCurrentPiecePracticeTarget(piece, sessionState);
        if (target && !acousticTargetEligible(target)) {
          capture.stop("error", "This target is not compatible with monophonic microphone practice. Choose another range or Staff Focus.");
          return;
        }
        if (!attack || !target) return;
        const result = submitPiecePracticeAcousticAttack(piece, sessionState, {
          targetId: target.id, inputEpoch: sessionState.acousticInputEpoch ?? 0, attack,
        });
        analysisGuard(() => collector.attempt(attack, result.evidence));
        if (!result.submitted) return;
        setLastAttempt(result.evidence);
        commit(result.state);
        detector.current.discardCandidate();
        if (result.state.status === "piece-complete") capture.stop();
      },
    });
    captureRef.current = capture;
    const background = () => capture.stop("paused", "Listening stopped in the background. Press Start Listening to resume practice.");
    const visibility = () => { if (document.visibilityState === "hidden") background(); };
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("freeze", background);
    window.addEventListener("pagehide", background);
    const watchdog = window.setInterval(() => {
      if (!mounted) return;
      setReading(capture.snapshot());
      if (phaseRef.current === "preflight" && latest.current.now() - lastCalibrationDisplayAt.current >= 200) {
        lastCalibrationDisplayAt.current = latest.current.now();
        const feedback = stability.current.feedback(latest.current.now(), listening.current);
        setCalibration(calibrationRef.current);
        setCalibrationFeedback(feedback);
        setCalibrationHz(feedback.frequencyHz);
      }
      const analysisStatus = collector.status();
      const notice = analysisStatus.stopped ? `Analysis collection stopped: ${analysisStatus.reason}. Collected evidence can still be exported; practice continues.` : analysisNoticeRef.current;
      setAnalysisNotice((previous) => previous === notice ? previous : notice);
    }, 100);
    return () => {
      mounted = false; listening.current = false; capturing.current = false;
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("freeze", background);
      window.removeEventListener("pagehide", background);
      window.clearInterval(watchdog); ownedDetector.reset(); capture.stop();
      if (captureRef.current === capture) captureRef.current = null;
      if (recordingRef.current === recording) recordingRef.current = null;
      recording.dispose();
    };
  }, [commit, analysisGuard, collector, syncAnalysis, calibrationAction]);

  const resetInput = useCallback(() => {
    analysisGuard(() => collector.event("input-reset", latest.current.now()));
    detector.current.reset(); cutoff.current = latest.current.now(); setNeedsQuiet(true); setLastAttempt(null);
    // Completed evidence is immutable; resetting a stopped owner must not create
    // another save revision just before Practice Again or Targeted Practice.
    if (latest.current.sessionState.status !== "piece-complete") {
      commit(resetPiecePracticeAcousticInput(latest.current.sessionState));
    }
  }, [commit, analysisGuard, collector]);
  const start = useCallback(() => {
    const { piece, sessionState } = latest.current;
    const eligibility = getAcousticEligibility(piece, sessionState.startMeasureIndex, sessionState.endMeasureIndex);
    if (!eligibility.eligible) { setStatus({ state: "unavailable", message: eligibility.message }); return; }
    resetInput(); void captureRef.current?.start();
  }, [resetInput]);
  const stop = useCallback(() => captureRef.current?.stop(), []);
  const enterPractice = useCallback(() => {
    if (phaseRef.current !== "preflight" || acceptedRef.current || calibrationRef.current.phase !== "summary") return;
    stability.current.reset(); phaseRef.current = "practice"; setPhase("practice");
    analysisGuard(() => collector.event("enter-practice", latest.current.now()));
    resetInput();
    if (listening.current) commit(resumePiecePracticeClock(latest.current.sessionState, latest.current.now()));
    recordingRef.current?.setEligible(listening.current && !latest.current.sessionState.clockPaused);
  }, [commit, resetInput, analysisGuard, collector]);
  const skipCalibrationAndStartPractice = useCallback(() => {
    if (phaseRef.current !== "preflight") return;
    acknowledgmentEpoch.current++; acceptedRef.current = null; setCalibrationAccepted(null);
    let next = calibrationRef.current;
    while (next.phase !== "summary") next = advanceCalibration(next, "skip");
    calibrationRef.current = next; setCalibration(next);
    analysisGuard(() => { collector.event("calibration-skip-remaining", latest.current.now()); collector.calibration(next, latest.current.now()); });
    enterPractice();
  }, [analysisGuard, collector, enterPractice]);
  const skipCurrentTarget = useCallback(() => {
    const { piece, sessionState, now } = latest.current;
    const result = skipCurrentPiecePracticeTarget(piece, sessionState, now());
    if (!result.skipped) return false;
    analysisGuard(() => collector.event("skip", now()));
    detector.current.reset(); cutoff.current = now(); setNeedsQuiet(true); setLastAttempt(null);
    commit(result.state); return true;
  }, [commit, analysisGuard, collector]);
  const changeAnalysisEnabled = useCallback((value: boolean) => {
    setAnalysisEnabled(value);
    if (!saveAnalysisPreference(value)) analysisNoticeRef.current = "Analysis preference could not be saved; it applies in this tab.";
    analysisGuard(() => collector.setEnabled(value, latest.current.now()));
    syncAnalysis(latest.current.sessionState);
  }, [analysisGuard, collector, syncAnalysis]);
  const exportAnalysis = useCallback(() => {
    try {
      const snapshot = collector.snapshot();
      downloadAcousticAnalysis(serializeAcousticAnalysis(snapshot, collector.originMs), snapshot.session.startedAt);
      analysisNoticeRef.current = "Acoustic analysis exported. This file contains local scalar evidence, not audio.";
    } catch { analysisNoticeRef.current = "Acoustic analysis could not be exported. Practice and collected evidence are unchanged."; }
    setAnalysisNotice(analysisNoticeRef.current);
  }, [collector]);
  return { status, reading, needsQuiet, lastAttempt, start, stop, resetInput, skipCurrentTarget,
    phase, calibration, calibrationHz, calibrationFeedback, calibrationAccepted, calibrationAction, enterPractice, skipCalibrationAndStartPractice,
    recording: { ...recordingSnapshot, setEnabled: setRecordingEnabled, hasUnsavedAudio: hasUnsavedRecording },
    analysis: { enabled: analysisEnabled, notice: analysisNotice, changeEnabled: changeAnalysisEnabled, export: exportAnalysis } };
}
