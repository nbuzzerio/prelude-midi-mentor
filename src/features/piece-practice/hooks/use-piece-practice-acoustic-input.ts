import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createMicrophoneCapture, type CaptureStatus } from "@/lib/audio/monophonic/microphone-capture";
import type { PitchSnapshot } from "@/lib/audio/monophonic/pitch-analysis-types";
import { createAcousticOnsetDetector } from "../piece-practice-acoustic-onset";
import { acousticTargetEligible, getAcousticEligibility } from "../piece-practice-acoustic-eligibility";
import { getCurrentPiecePracticeTarget, pausePiecePracticeClock, resetPiecePracticeAcousticInput, resumePiecePracticeClock,
  skipCurrentPiecePracticeTarget, submitPiecePracticeAcousticAttack, type PiecePracticeSessionState } from "../piece-practice-session";
import type { PiecePracticeAcousticEvidence } from "../piece-practice-evidence";
import type { PiecePracticePiece } from "../piece-practice-types";

type Options = Readonly<{
  piece: PiecePracticePiece; sessionState: PiecePracticeSessionState;
  onSessionStateChange: (state: PiecePracticeSessionState) => void;
  available: boolean; now: () => number;
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
  const [status, setStatus] = useState<CaptureStatus>({ state: "idle", message: "Microphone off. Press Start Listening when ready." });
  const [reading, setReading] = useState<PitchSnapshot>(EMPTY);
  const [needsQuiet, setNeedsQuiet] = useState(true);
  const [lastAttempt, setLastAttempt] = useState<PiecePracticeAcousticEvidence | null>(null);
  const commit = useCallback((state: PiecePracticeSessionState) => {
    if (state === latest.current.sessionState) return;
    latest.current = { ...latest.current, sessionState: state };
    latest.current.onSessionStateChange(state);
  }, []);

  useLayoutEffect(() => {
    const previous = latest.current;
    latest.current = options;
    if (previous.sessionState.acousticInputEpoch !== options.sessionState.acousticInputEpoch) {
      detector.current.reset(); cutoff.current = options.now(); setNeedsQuiet(true); setLastAttempt(null);
    } else if (getCurrentPiecePracticeTarget(previous.piece, previous.sessionState)?.id !== getCurrentPiecePracticeTarget(options.piece, options.sessionState)?.id) {
      detector.current.discardCandidate();
    }
    if (capturing.current && (!options.available || options.sessionState.status === "piece-complete"
      || options.sessionState.clockPaused && listening.current)) {
      captureRef.current?.stop(options.sessionState.status === "piece-complete" ? "idle" : "paused",
        options.available ? "Microphone off. Press Start Listening to resume practice." : "End the active Practice Session before listening.");
    }
  }, [options]);

  useEffect(() => {
    let mounted = true;
    const ownedDetector = detector.current;
    const eligible = () => {
      const { available, piece, sessionState } = latest.current;
      return mounted && available && document.visibilityState !== "hidden" && sessionState.status !== "piece-complete"
        && getAcousticEligibility(piece, sessionState.startMeasureIndex, sessionState.endMeasureIndex).eligible;
    };
    const capture = createMicrophoneCapture({ eligible, now: () => latest.current.now(),
      onPitch: (snapshot) => { if (mounted) setReading(snapshot); },
      onStatus: (next) => {
        if (!mounted) return;
        listening.current = next.state === "listening";
        capturing.current = ["requesting", "starting", "listening"].includes(next.state);
        setStatus(next);
        const { sessionState, now } = latest.current;
        if (listening.current) commit(resumePiecePracticeClock(sessionState, now()));
        else {
          detector.current.reset(); cutoff.current = now(); setNeedsQuiet(true);
          commit(pausePiecePracticeClock(sessionState, now()));
        }
      },
      onObservation: (envelope) => {
        if (!eligible() || !listening.current || envelope.captureGeneration !== capture.generation()
          || envelope.observedAtMs < cutoff.current) return;
        const { piece, sessionState } = latest.current;
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
    const watchdog = window.setInterval(() => { if (mounted) setReading(capture.snapshot()); }, 50);
    return () => {
      mounted = false; listening.current = false;
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("freeze", background);
      window.removeEventListener("pagehide", background);
      window.clearInterval(watchdog); ownedDetector.reset(); capture.stop(); captureRef.current = null;
    };
  }, [commit]);

  const resetInput = useCallback(() => {
    detector.current.reset(); cutoff.current = latest.current.now(); setNeedsQuiet(true); setLastAttempt(null);
    // Completed evidence is immutable; resetting a stopped owner must not create
    // another save revision just before Practice Again or Targeted Practice.
    if (latest.current.sessionState.status !== "piece-complete") {
      commit(resetPiecePracticeAcousticInput(latest.current.sessionState));
    }
  }, [commit]);
  const start = useCallback(() => {
    const { piece, sessionState } = latest.current;
    const eligibility = getAcousticEligibility(piece, sessionState.startMeasureIndex, sessionState.endMeasureIndex);
    if (!eligibility.eligible) { setStatus({ state: "unavailable", message: eligibility.message }); return; }
    resetInput(); void captureRef.current?.start();
  }, [resetInput]);
  const stop = useCallback(() => captureRef.current?.stop(), []);
  const skipCurrentTarget = useCallback(() => {
    const { piece, sessionState, now } = latest.current;
    const result = skipCurrentPiecePracticeTarget(piece, sessionState, now());
    if (!result.skipped) return false;
    detector.current.reset(); cutoff.current = now(); setNeedsQuiet(true); setLastAttempt(null);
    commit(result.state); return true;
  }, [commit]);
  return { status, reading, needsQuiet, lastAttempt, start, stop, resetInput, skipCurrentTarget };
}
