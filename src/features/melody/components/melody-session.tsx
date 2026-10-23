import { DEFAULT_MELODY_CONFIG, melodyConfigToSettings, parseMelodyConfig, type MelodyConfig } from "../melody-config";
import { requireConfig } from "@/lib/config-validation";
import { MelodySettingsControls, MelodyPracticeOptions } from "./melody-settings-controls";
import { useCallback, useEffect, useEffectEvent, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import MidiStatus from "@/components/midi/midi-status";
import PianoKeyboard from "@/components/notation/piano-keyboard";
import { MelodyActiveScore } from "./melody-active-score";
import { STAFF_BUILDER_TICKS_PER_QUARTER } from "@/features/staff-builder/staff-builder-time";
import { useAppMidiInput } from "@/hooks/use-app-midi-input";
import { useMobilePlay } from "@/hooks/use-mobile-play";
import type { HostedPracticePresentation } from "@/types/hosted-practice-presentation";
import { createMelodyBrowserAudioContext, type MelodyOwnedAudioContext } from "../melody-browser-audio";
import { createMelodyPerformanceClock, type MelodyPerformanceClock } from "../melody-clock";
import {
  appendMelodyContinuousTrialRetry,
  canStartMelodyContinuousDiagnosticTrial,
  createMelodyContinuousDeadline,
  createMelodyContinuousDiagnosticTrial,
  getMelodyContinuousRemainingMs,
  getMelodyContinuousTrialRetryCount,
  getMelodyContinuousTrialsNeedingReview,
  getNextMelodyContinuousTrialNeedingReviewId,
  isMelodyContinuousTrialMastered,
  type MelodyContinuousDiagnosticTrial,
  type MelodyContinuousDurationMinutes,
} from "../melody-continuous-practice";
import { projectMelodyExerciseToPracticeDisplayScore } from "../melody-display-score";
import { generateMelodyExercise } from "../melody-generator";
import { MELODY_PHASE_ONE_METER } from "../melody-meter";
import { getMelodyPreparatoryLeadIn } from "../melody-preparatory-lead-in";
import { createMelodyPerformanceRecorder, type MelodyPerformanceRecorder } from "../melody-performance";
import { shouldTryAnotherFromPedal } from "../melody-pedal-result-action";
import { evaluateMelodyAttempt, type MelodyAttemptResult } from "../melody-scoring";
import { getMelodyPerformancePhase } from "../melody-timing";
import { createMelodyPracticeResult, type MelodyPracticeResultV1 } from "../melody-practice-result";
import type { MelodyExercise, MelodySeed, MelodySettings } from "../melody-types";

import { MelodyResults } from "./melody-results";
import {
  MelodyTimedSessionReview,
  type MelodyReviewFilter,
  type MelodyReviewResultView,
} from "./melody-timed-session-review";

type MelodyPresentationState = "setup" | "ready" | "starting" | "count-in" | "performing" | "results" | "review";
type MelodyAttemptContext =
  | Readonly<{ kind: "single" }>
  | Readonly<{ kind: "diagnostic" }>
  | Readonly<{ kind: "review-retry"; trialId: MelodyContinuousDiagnosticTrial["id"] }>;
type MelodyAudioFactory = typeof createMelodyBrowserAudioContext;
let runtimeSeedCounter = 0;
const defaultSeedFactory = (): MelodySeed => `melody-runtime-${Date.now()}-${runtimeSeedCounter++}`;
const defaultNowMs = () => performance.now();
const EMPTY = new Set<number>();

function formatRemainingTime(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

/** Runtime action only; never part of a saved Melody prescription. */
export type MelodySessionHandle = Readonly<{
  /** Resume continuous practice after timed achievement, retaining all original/retry evidence.
   * Returns false outside settled, achieved Review (including after unmount).
   */
  continuePractice: () => boolean;
}>;

export default function MelodySession({
  initialConfig = DEFAULT_MELODY_CONFIG, onPracticeTargetReached, onPracticeResultChange, onPracticeActivityChange, ref,
  practiceSessionMode = false,
  hostedStart = false,
  hostedPracticePresentation,
  seedFactory = defaultSeedFactory, createAudioContext = createMelodyBrowserAudioContext, nowMs = defaultNowMs,
}: Readonly<{
  initialConfig?: MelodyConfig;
  /** Timed practice only: delivered after final evidence and achievement commit. */
  onPracticeTargetReached?: () => void;
  onPracticeResultChange?: (result: MelodyPracticeResultV1) => void;
  onPracticeActivityChange?: (available: boolean) => void;
  practiceSessionMode?: boolean;
  /** Opt-in start of this acknowledged hosted attempt; standalone stays manual. */
  hostedStart?: boolean;
  hostedPracticePresentation?: HostedPracticePresentation;
  ref?: Ref<MelodySessionHandle>;
  seedFactory?: () => MelodySeed;
  createAudioContext?: MelodyAudioFactory;
  nowMs?: () => number;
}>) {
  const [mountConfig] = useState(() => requireConfig(parseMelodyConfig(initialConfig)));
  const [settings, setSettings] = useState<MelodySettings>(() => melodyConfigToSettings(mountConfig));
  const [exercise, setExercise] = useState<MelodyExercise>(() => generateMelodyExercise(settings, seedFactory()));
  const [presentation, setPresentation] = useState<MelodyPresentationState>("setup");
  useEffect(() => {
    if (!practiceSessionMode) return;
    onPracticeActivityChange?.(presentation === "count-in" || presentation === "performing");
    return () => onPracticeActivityChange?.(false);
  }, [practiceSessionMode, presentation, onPracticeActivityChange]);
  const [result, setResult] = useState<MelodyAttemptResult | null>(null);
  const [statusMessage, setStatusMessage] = useState("Ready to start.");
  const [audioError, setAudioError] = useState<string | null>(null);
  const [interruptionNotice, setInterruptionNotice] = useState<string | null>(null);
  const [activeTick, setActiveTick] = useState<number | undefined>();
  const [preparationTick, setPreparationTick] = useState<number | undefined>();
  const [activeVirtual, setActiveVirtual] = useState<ReadonlySet<number>>(EMPTY);
  const [lockedSource, setLockedSource] = useState<"midi" | "virtual" | null>(null);
  const [continuousPractice, setContinuousPractice] = useState(mountConfig.continuousPractice);
  const [continuousDurationMinutes, setContinuousDurationMinutes] =
    useState<MelodyContinuousDurationMinutes>(mountConfig.continuousDurationMinutes);
  const [continuousSessionActive, setContinuousSessionActive] = useState(false);
  const [continuousHistory, setContinuousHistory] = useState<
    readonly MelodyContinuousDiagnosticTrial[]
  >([]);
  const [continuousDeadlineMs, setContinuousDeadlineMs] = useState<number | null>(null);
  const [timerDisplayNowMs, setTimerDisplayNowMs] = useState(0);
  const [continuousInterrupted, setContinuousInterrupted] = useState(false);
  const [reviewTrialId, setReviewTrialId] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<MelodyReviewFilter>("all");
  const [reviewResultView, setReviewResultView] = useState<MelodyReviewResultView>("original");
  const [reviewPinnedTrialId, setReviewPinnedTrialId] = useState<string | null>(null);
  const clockRef = useRef<MelodyPerformanceClock | null>(null);
  const audioContextRef = useRef<MelodyOwnedAudioContext | null>(null);
  const recorderRef = useRef<MelodyPerformanceRecorder | null>(null);
  const pendingContinuationRef = useRef<{ exercise: MelodyExercise; generation: number } | null>(null);
  const inputOwnedRef = useRef(true);
  const readyAttemptRef = useRef<MelodyAttemptContext | null>(null);
  const readyStartedAtMsRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(false);
  const timedRunRef = useRef(0);
  const targetAchievedRef = useRef(false);
  const notifiedRunRef = useRef<number | null>(null);
  const [achievedRun, setAchievedRun] = useState<number | null>(null);

  const resetTimedTarget = () => {
    timedRunRef.current += 1;
    targetAchievedRef.current = false;
    setAchievedRun(null);
  };
  const presentationRef = useRef<MelodyPresentationState>(presentation);
  const resultRef = useRef<MelodyAttemptResult | null>(result);
  const sustainPedalDownRef = useRef(false);
  const pedalReadyInResultsRef = useRef(false);
  const continuousSessionActiveRef = useRef(false);
  const continuousHistoryRef = useRef<readonly MelodyContinuousDiagnosticTrial[]>([]);
  const continuousDeadlineMsRef = useRef<number | null>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const reviewTrialHeadingRef = useRef<HTMLHeadingElement>(null);
  const reviewFocusTargetRef = useRef<"review" | "trial">("review");
  const mobilePlayEntryRef = useRef<HTMLButtonElement>(null);
  const scoreRegionRef = useRef<HTMLDivElement>(null);
  const previousExerciseIdRef = useRef(exercise.id);
  const { enterMobilePlay, exitMobilePlay, isMobilePlayMode: localMobilePlayMode } = useMobilePlay();
  const isHostedPresentation = hostedPracticePresentation !== undefined;
  const isMobilePlayMode = hostedPracticePresentation?.isMobilePlayMode ?? localMobilePlayMode;
  const isHostedFocus = hostedPracticePresentation?.isFocusMode ?? false;
  const showVirtualKeyboard = hostedPracticePresentation?.showVirtualKeyboard ?? true;
  const score = useMemo(() => projectMelodyExerciseToPracticeDisplayScore(exercise), [exercise]);
  const preparatoryLeadIn = getMelodyPreparatoryLeadIn(MELODY_PHASE_ONE_METER.timeSignature);
  const reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clearContinuousDeadline = useCallback(() => {
    readyStartedAtMsRef.current = null;
    continuousDeadlineMsRef.current = null;
    setContinuousDeadlineMs(null);
  }, []);
  const publishPracticeResult = useCallback((trials: readonly MelodyContinuousDiagnosticTrial[], interrupted = false) => {
    onPracticeResultChange?.(createMelodyPracticeResult(trials, interrupted));
  }, [onPracticeResultChange]);

  const resetReviewPresentation = useCallback(() => {
    setReviewTrialId(null);
    setReviewFilter("all");
    setReviewResultView("original");
    setReviewPinnedTrialId(null);
    reviewFocusTargetRef.current = "review";
  }, []);

  const enterReview = useCallback((
    trials: readonly MelodyContinuousDiagnosticTrial[],
    interrupted: boolean,
    focusTarget: "review" | "trial" = "review",
  ) => {
    continuousSessionActiveRef.current = false;
    setContinuousSessionActive(false);
    clearContinuousDeadline();
    setContinuousInterrupted(interrupted);
    const firstNeedsReview = getMelodyContinuousTrialsNeedingReview(trials)[0] ?? null;
    const selected = firstNeedsReview ?? trials[0] ?? null;
    setReviewFilter(firstNeedsReview ? "needs-review" : "all");
    setReviewTrialId(selected?.id ?? null);
    setReviewResultView(selected && getMelodyContinuousTrialRetryCount(selected) > 0 ? "latest" : "original");
    setReviewPinnedTrialId(null);
    reviewFocusTargetRef.current = focusTarget;
    setPresentation("review");
  }, [clearContinuousDeadline]);

  const finishTimedTarget = useCallback((trials: readonly MelodyContinuousDiagnosticTrial[]) => {
    if (!mountedRef.current || targetAchievedRef.current || !continuousSessionActiveRef.current) return;
    targetAchievedRef.current = true;
    enterReview(trials, false);
    setStatusMessage("Timed diagnostic complete.");
    setAchievedRun(timedRunRef.current);
  }, [enterReview]);

  const cancelAttempt = useCallback(() => {
    generationRef.current += 1;
    pendingContinuationRef.current = null;
    readyAttemptRef.current = null;
    clockRef.current?.cancel();
    clockRef.current = null;
    recorderRef.current = null;
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    setActiveTick(undefined);
    setPreparationTick(undefined);
    setActiveVirtual(EMPTY);
    setLockedSource(null);
  }, []);

  const stopPlaying = useCallback((reason?: string) => {
    if (!mountedRef.current || !["ready", "starting", "count-in", "performing"].includes(presentationRef.current)) return;
    cancelAttempt();
    setResult(null);
    if (continuousSessionActiveRef.current) {
      publishPracticeResult(continuousHistoryRef.current, !!reason);
      presentationRef.current = "review";
      enterReview(continuousHistoryRef.current, !!reason);
    } else {
      presentationRef.current = "setup";
      setPresentation("setup");
    }
    setInterruptionNotice(reason ?? "Playing stopped. Completed trials were preserved.");
  }, [cancelAttempt, enterReview, publishPracticeResult]);

  useEffect(() => {
    const context = audioContextRef.current;
    if (!context) return;
    const changed = () => { if (clockRef.current && context.state !== "running") stopPlaying("Playing interrupted because the audio clock stopped. Start deliberately when audio is available."); };
    context.addEventListener?.("statechange", changed);
    return () => context.removeEventListener?.("statechange", changed);
  }, [presentation, stopPlaying]);

  presentationRef.current = presentation;
  resultRef.current = result;
  continuousSessionActiveRef.current = continuousSessionActive;
  continuousHistoryRef.current = continuousHistory;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelAttempt();
      const context = audioContextRef.current;
      audioContextRef.current = null;
      if (!context?.close) return;
      try { void context.close().catch(() => undefined); } catch { /* Browser audio teardown is best-effort. */ }
    };
  }, [cancelAttempt]);
  useEffect(() => { if (presentation === "results") resultsHeadingRef.current?.focus(); }, [presentation]);
  useEffect(() => {
    if (presentation !== "review") return;
    if (reviewFocusTargetRef.current === "trial") reviewTrialHeadingRef.current?.focus();
    else reviewHeadingRef.current?.focus();
  }, [presentation, continuousHistory]);
  useEffect(() => {
    if (previousExerciseIdRef.current === exercise.id) return;
    previousExerciseIdRef.current = exercise.id;
    scoreRegionRef.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [exercise.id]);
  // Effects run after evidence/Review has committed. Mark delivered before calling
  // the host, which may immediately continue, replace, or unmount this engine.
  useEffect(() => {
    if (achievedRun === null || achievedRun !== timedRunRef.current
      || !targetAchievedRef.current || notifiedRunRef.current === achievedRun) return;
    notifiedRunRef.current = achievedRun;
    onPracticeTargetReached?.();
  }, [achievedRun, onPracticeTargetReached]);
  useEffect(() => {
    if (!continuousSessionActive || continuousDeadlineMs === null) return;
    const run = timedRunRef.current;
    let disposed = false;
    const updateTimer = () => {
      if (disposed || !mountedRef.current || run !== timedRunRef.current
        || continuousDeadlineMsRef.current !== continuousDeadlineMs || readyStartedAtMsRef.current !== null) return;
      const currentNowMs = nowMs();
      setTimerDisplayNowMs(currentNowMs);
      if (presentationRef.current === "results"
        && !canStartMelodyContinuousDiagnosticTrial(continuousDeadlineMs, currentNowMs)) {
        finishTimedTarget(continuousHistoryRef.current);
      }
    };
    updateTimer();
    const timer = window.setInterval(updateTimer, 1000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [continuousDeadlineMs, continuousSessionActive, finishTimedTarget, nowMs]);
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden" || !(["ready", "starting", "count-in", "performing"] as MelodyPresentationState[]).includes(presentationRef.current)) return;
      cancelAttempt();
      setResult(null);
      if (continuousSessionActiveRef.current) {
        publishPracticeResult(continuousHistoryRef.current, true);
        enterReview(continuousHistoryRef.current, true);
        setInterruptionNotice("Timed diagnostic interrupted because Prelude was no longer active.");
        setStatusMessage("Timed diagnostic interrupted. Completed trials were preserved.");
        return;
      }
      setPresentation("setup");
      continuousSessionActiveRef.current = false;
      setContinuousSessionActive(false);
      setInterruptionNotice("Exercise stopped because Prelude was no longer active.");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [cancelAttempt, enterReview, publishPracticeResult]);

  function sampleClock(
    generation: number,
    exerciseToPerform: MelodyExercise,
    attemptContext: MelodyAttemptContext,
  ) {
    const clock = clockRef.current;
    if (!clock || generation !== generationRef.current) return;
    if (audioContextRef.current?.state !== "running") {
      stopPlaying("Playing interrupted because the audio clock stopped. Start deliberately when audio is available.");
      return;
    }
    const now = clock.nowSeconds();
    const phase = getMelodyPerformancePhase(clock, now);
    if (phase === "complete") {
      const recorder = recorderRef.current;
      if (!recorder) return;
      const nextResult = evaluateMelodyAttempt(exerciseToPerform, recorder.getAttacks());
      clock.cancel();
      clockRef.current = null;
      recorderRef.current = null;
      setActiveTick(undefined);
      setPreparationTick(undefined);
      setResult(nextResult);
      resultRef.current = nextResult;
      if (attemptContext.kind === "diagnostic") {
        const previousHistory = continuousHistoryRef.current;
        const entry = createMelodyContinuousDiagnosticTrial(
          previousHistory.length + 1,
          exerciseToPerform,
          nextResult,
        );
        const nextHistory = [...previousHistory, entry];
        continuousHistoryRef.current = nextHistory;
        setContinuousHistory(nextHistory);
        publishPracticeResult(nextHistory);
        const deadlineMs = continuousDeadlineMsRef.current;
        if (deadlineMs !== null
          && !canStartMelodyContinuousDiagnosticTrial(deadlineMs, nowMs())) {
          finishTimedTarget(nextHistory);
          return;
        }
        pedalReadyInResultsRef.current = !sustainPedalDownRef.current;
        setPresentation("results");
        setStatusMessage("Exercise complete. Results are ready.");
        return;
      }
      if (attemptContext.kind === "review-retry") {
        const previousHistory = continuousHistoryRef.current;
        const previousTrial = previousHistory.find(({ id }) => id === attemptContext.trialId);
        if (!previousTrial) {
          throw new Error(`Cannot complete Melody retry: unknown diagnostic trial "${attemptContext.trialId}".`);
        }
        const wasMastered = isMelodyContinuousTrialMastered(previousTrial);
        const nextHistory = appendMelodyContinuousTrialRetry(
          previousHistory,
          attemptContext.trialId,
          nextResult,
        );
        const updatedTrial = nextHistory.find(({ id }) => id === attemptContext.trialId)!;
        continuousHistoryRef.current = nextHistory;
        setContinuousHistory(nextHistory);
        publishPracticeResult(nextHistory);
        setReviewTrialId(attemptContext.trialId);
        setReviewResultView("latest");
        if (reviewFilter === "needs-review"
          && !wasMastered
          && isMelodyContinuousTrialMastered(updatedTrial)) {
          setReviewPinnedTrialId(attemptContext.trialId);
        }
        reviewFocusTargetRef.current = "trial";
        setPresentation("review");
        setStatusMessage("Melody retry complete. Review updated.");
        return;
      }
      pedalReadyInResultsRef.current = !sustainPedalDownRef.current;
      setPresentation("results");
      setStatusMessage("Exercise complete. Results are ready.");
      return;
    }
    if (phase === "count-in") {
      setPresentation("count-in");
      setStatusMessage("Preparatory lead-in started.");
      const rawLeadInTick = ((now - clock.countInStartedAtSeconds) / clock.quarterBeatSeconds) * STAFF_BUILDER_TICKS_PER_QUARTER;
      const clampedLeadInTick = Math.max(0, Math.min(preparatoryLeadIn.durationTicks, rawLeadInTick));
      const displayedLeadInTick = reducedMotion
        ? Math.floor(clampedLeadInTick / preparatoryLeadIn.pulseTicks) * preparatoryLeadIn.pulseTicks
        : clampedLeadInTick;
      setActiveTick(now < clock.countInStartedAtSeconds ? -preparatoryLeadIn.durationTicks - 1 : displayedLeadInTick - preparatoryLeadIn.durationTicks);
      setPreparationTick(now >= clock.countInStartedAtSeconds ? clampedLeadInTick : undefined);
    } else {
      setPreparationTick(undefined);
      setPresentation("performing");
      setStatusMessage("Performance started.");
      const rawTick = ((now - clock.performanceStartedAtSeconds) / clock.quarterBeatSeconds) * STAFF_BUILDER_TICKS_PER_QUARTER;
      const clamped = Math.max(0, Math.min(exerciseToPerform.measures.length * MELODY_PHASE_ONE_METER.capacityTicks, rawTick));
      setActiveTick(reducedMotion ? Math.floor(clamped / MELODY_PHASE_ONE_METER.subdivisionTicks) * MELODY_PHASE_ONE_METER.subdivisionTicks : clamped);
    }
    animationRef.current = requestAnimationFrame(() => sampleClock(generation, exerciseToPerform, attemptContext));
  }

  const beginAttempt = async (
    exerciseToPerform: MelodyExercise,
    attemptContext: MelodyAttemptContext,
  ) => {
    if (!inputOwnedRef.current) {
      stopPlaying("Playing interrupted because MIDI input ownership changed.");
      return;
    }
    if (presentationRef.current === "starting" || presentationRef.current === "count-in" || presentationRef.current === "performing" || document.visibilityState === "hidden") return;
    readyAttemptRef.current = null;
    cancelAttempt();
    const generation = generationRef.current;
    setAudioError(null);
    setInterruptionNotice(null);
    setResult(null);
    presentationRef.current = "starting";
    setPresentation("starting");
    try {
      let audioContext = audioContextRef.current;
      if (!audioContext) {
        audioContext = createAudioContext();
        audioContextRef.current = audioContext;
      }
      const clock = await createMelodyPerformanceClock(exerciseToPerform, audioContext);
      if (generation !== generationRef.current) { clock.cancel(); return; }
      clockRef.current = clock;
      recorderRef.current = createMelodyPerformanceRecorder(exerciseToPerform, clock);
      // Readiness is not timed practice. Rebase only the session budget; the
      // native AudioContext clock, count-in and expected attacks stay unchanged.
      if (readyStartedAtMsRef.current !== null && continuousDeadlineMsRef.current !== null) {
        const deadlineMs = continuousDeadlineMsRef.current + Math.max(0, nowMs() - readyStartedAtMsRef.current);
        continuousDeadlineMsRef.current = deadlineMs;
        setContinuousDeadlineMs(deadlineMs);
        setTimerDisplayNowMs(nowMs());
      }
      readyStartedAtMsRef.current = null;
      if (attemptContext.kind === "diagnostic"
        && continuousSessionActiveRef.current
        && !targetAchievedRef.current
        && continuousDeadlineMsRef.current === null) {
        const startedAtMs = nowMs();
        const deadlineMs = createMelodyContinuousDeadline(startedAtMs, continuousDurationMinutes);
        continuousDeadlineMsRef.current = deadlineMs;
        setContinuousDeadlineMs(deadlineMs);
        setTimerDisplayNowMs(startedAtMs);
      }
      setPresentation("count-in");
      setActiveTick(-preparatoryLeadIn.durationTicks - 1);
      setStatusMessage("Preparatory lead-in started.");
      animationRef.current = requestAnimationFrame(() => sampleClock(generation, exerciseToPerform, attemptContext));
    } catch {
      if (generation !== generationRef.current) return;
      if (attemptContext.kind === "review-retry") {
        setPresentation("review");
        reviewFocusTargetRef.current = "trial";
        setAudioError("Prelude couldn't start the Melody audio clock. Try again.");
        setStatusMessage("Melody retry audio could not start.");
        return;
      }
      if (continuousSessionActiveRef.current && continuousHistoryRef.current.length > 0) {
        publishPracticeResult(continuousHistoryRef.current, true);
        enterReview(continuousHistoryRef.current, true);
        setInterruptionNotice("Timed diagnostic interrupted because the next audio clock could not start.");
        setStatusMessage("Timed diagnostic interrupted. Completed trials were preserved.");
        return;
      }
      setPresentation("setup");
      setAudioError("Prelude couldn't start the Melody audio clock. Try again.");
      setStatusMessage("Melody audio could not start.");
      continuousSessionActiveRef.current = false;
      continuousHistoryRef.current = [];
      setContinuousSessionActive(false);
      setContinuousHistory([]);
      clearContinuousDeadline();
    }
  };

  const prepareAttempt = (attemptContext: MelodyAttemptContext) => {
    cancelAttempt();
    readyAttemptRef.current = attemptContext;
    if (continuousDeadlineMsRef.current !== null) {
      readyStartedAtMsRef.current = nowMs();
      setTimerDisplayNowMs(readyStartedAtMsRef.current);
    }
    setResult(null);
    setAudioError(null);
    presentationRef.current = "ready";
    setPresentation("ready");
    setStatusMessage("Ready. Study the opening measure, then begin count-in.");
  };

  const startPreparedContinuation = useEffectEvent(() => {
    const pending = pendingContinuationRef.current;
    if (!pending || pending.exercise !== exercise || pending.generation !== generationRef.current || presentationRef.current !== "ready") return;
    pendingContinuationRef.current = null;
    const deadline = continuousDeadlineMsRef.current;
    if (deadline !== null && !canStartMelodyContinuousDiagnosticTrial(deadline, nowMs())) {
      finishTimedTarget(continuousHistoryRef.current);
      return;
    }
    void beginAttempt(pending.exercise, { kind: "diagnostic" });
  });
  useEffect(() => { startPreparedContinuation(); }, [exercise, presentation]);

  const start = () => beginAttempt(exercise, { kind: "single" });

  const record = useCallback((midiNumber: number, source: "midi" | "virtual") => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorder.recordAttack(midiNumber, source);
    setLockedSource(recorder.getLockedSource());
  }, []);
  const midi = useAppMidiInput({
    onNotePlayed: (midiNumber) => record(midiNumber, "midi"),
    onInputConnectionChange: change => { if (change.state === "disconnected") stopPlaying("Playing interrupted because a MIDI input disconnected."); },
    onOwnershipChange: active => { inputOwnedRef.current = active; if (!active) stopPlaying("Playing interrupted because MIDI input ownership changed."); },
    onSustainPedalChanged: (isDown) => {
      sustainPedalDownRef.current = isDown;
      if (presentationRef.current !== "results") return;
      if (!isDown) {
        pedalReadyInResultsRef.current = true;
        return;
      }
      if (!pedalReadyInResultsRef.current) return;
      pedalReadyInResultsRef.current = false;
      const completedResult = resultRef.current;
      if (!completedResult) return;
      if (continuousSessionActiveRef.current) tryAnother();
      else if (shouldTryAnotherFromPedal(completedResult)) tryAnother();
      else retrySame();
    },
  });

  const replaceExercise = (nextSettings: MelodySettings, seed: MelodySeed) => {
    resetTimedTarget();
    cancelAttempt();
    setSettings(nextSettings);
    setExercise(generateMelodyExercise(nextSettings, seed));
    setResult(null);
    setPresentation("setup");
    setStatusMessage("Ready to start.");
    setInterruptionNotice(null);
    continuousSessionActiveRef.current = false;
    continuousHistoryRef.current = [];
    setContinuousSessionActive(false);
    setContinuousHistory([]);
    publishPracticeResult([]);
    clearContinuousDeadline();
    setContinuousInterrupted(false);
    resetReviewPresentation();
  };
  const changeSetting = <K extends keyof MelodySettings>(key: K, value: MelodySettings[K]) => replaceExercise({ ...settings, [key]: value }, seedFactory());
  const retrySame = () => {
    if (continuousSessionActiveRef.current) {
      prepareAttempt({ kind: "diagnostic" });
      return;
    }
    cancelAttempt(); setResult(null); setPresentation("setup"); setStatusMessage("Ready to retry the same melody.");
  };
  const tryAnother = () => {
    if (presentationRef.current !== "results") return;
    if (continuousSessionActiveRef.current) {
      const deadlineMs = continuousDeadlineMsRef.current;
      if (deadlineMs !== null
        && !canStartMelodyContinuousDiagnosticTrial(deadlineMs, nowMs())) {
        finishTimedTarget(continuousHistoryRef.current);
        return;
      }
      try {
        const nextExercise = generateMelodyExercise(settings, seedFactory());
        setExercise(nextExercise);
        prepareAttempt({ kind: "diagnostic" });
        pendingContinuationRef.current = { exercise: nextExercise, generation: generationRef.current };
      } catch {
        cancelAttempt();
        publishPracticeResult(continuousHistoryRef.current, true);
        presentationRef.current = "review";
        enterReview(continuousHistoryRef.current, true);
        setInterruptionNotice("Playing interrupted because the next phrase could not be generated. Completed trials were preserved.");
      }
      return;
    }
    replaceExercise(settings, seedFactory());
  };
  const returnSettings = () => {
    resetTimedTarget();
    cancelAttempt(); setResult(null); setPresentation("setup"); setStatusMessage("Settings ready.");
    continuousSessionActiveRef.current = false;
    continuousHistoryRef.current = [];
    setContinuousSessionActive(false);
    setContinuousHistory([]);
    clearContinuousDeadline();
    setContinuousInterrupted(false);
    resetReviewPresentation();
  };

  const startContinuousSession = (useNewExercise = false, prepareOnly = false) => {
    resetTimedTarget();
    const exerciseToPerform = useNewExercise
      ? generateMelodyExercise(settings, seedFactory())
      : exercise;
    if (useNewExercise) setExercise(exerciseToPerform);
    continuousSessionActiveRef.current = true;
    continuousHistoryRef.current = [];
    setContinuousSessionActive(true);
    setContinuousHistory([]);
    publishPracticeResult([]);
    clearContinuousDeadline();
    setContinuousInterrupted(false);
    resetReviewPresentation();
    if (prepareOnly) prepareAttempt({ kind: "diagnostic" });
    else void beginAttempt(exerciseToPerform, { kind: "diagnostic" });
  };
  const hostedStartConsumed = useRef(false);
  const startHostedSession = useEffectEvent(() => startContinuousSession(false, true));
  useEffect(() => {
    if (!practiceSessionMode || !hostedStart) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || hostedStartConsumed.current) return;
      hostedStartConsumed.current = true;
      startHostedSession();
    });
    return () => { cancelled = true; };
  }, [practiceSessionMode, hostedStart]);

  useImperativeHandle(ref, () => ({
    continuePractice: () => {
      if (!mountedRef.current || !targetAchievedRef.current
        || presentationRef.current !== "review" || continuousSessionActiveRef.current) return false;
      const nextExercise = generateMelodyExercise(settings, seedFactory());
      // Synchronous guard also rejects repeated calls before React rerenders.
      continuousSessionActiveRef.current = true;
      setContinuousSessionActive(true);
      setExercise(nextExercise);
      prepareAttempt({ kind: "diagnostic" });
      return true;
    },
  }));

  const selectReviewTrial = (trialId: string) => {
    const selected = continuousHistoryRef.current.find(({ id }) => id === trialId);
    if (!selected) return;
    setReviewTrialId(trialId);
    setReviewResultView(getMelodyContinuousTrialRetryCount(selected) > 0 ? "latest" : "original");
    setReviewPinnedTrialId(null);
  };

  const changeReviewFilter = (filter: MelodyReviewFilter) => {
    setReviewFilter(filter);
    setReviewPinnedTrialId(null);
    if (filter !== "needs-review") return;
    const current = continuousHistoryRef.current.find(({ id }) => id === reviewTrialId);
    if (current && !isMelodyContinuousTrialMastered(current)) return;
    const firstNeedsReview = getMelodyContinuousTrialsNeedingReview(continuousHistoryRef.current)[0];
    if (firstNeedsReview) selectReviewTrial(firstNeedsReview.id);
  };

  const reviewMistakes = () => {
    const firstNeedsReview = getMelodyContinuousTrialsNeedingReview(continuousHistoryRef.current)[0];
    setReviewFilter("needs-review");
    setReviewPinnedTrialId(null);
    if (firstNeedsReview) selectReviewTrial(firstNeedsReview.id);
  };

  const retryReviewTrial = (trialId: string) => {
    const trial = continuousHistoryRef.current.find(({ id }) => id === trialId);
    if (!trial) return;
    setExercise(trial.exercise);
    prepareAttempt({ kind: "review-retry", trialId });
  };

  const nextNeedsReview = (trialId: string) => {
    const nextTrialId = getNextMelodyContinuousTrialNeedingReviewId(
      continuousHistoryRef.current,
      trialId,
    );
    setReviewPinnedTrialId(null);
    if (nextTrialId) selectReviewTrial(nextTrialId);
  };

  const handleExitMobilePlay = () => {
    exitMobilePlay();
    window.setTimeout(() => mobilePlayEntryRef.current?.focus(), 0);
  };

  const targetMeasureIndex = activeTick === undefined || activeTick < 0
    ? 0
    : Math.min(exercise.measures.length - 1, Math.floor(activeTick / MELODY_PHASE_ONE_METER.capacityTicks));
  const displayMeasureIndex = activeTick === undefined ? null : activeTick < 0 ? 0 : targetMeasureIndex + 1;
  const measureTick = activeTick === undefined
    ? undefined
    : activeTick < 0
      ? activeTick + preparatoryLeadIn.durationTicks
      : activeTick - targetMeasureIndex * MELODY_PHASE_ONE_METER.capacityTicks;
  const range = settings.staff === "treble" ? { min: 60, max: 72 } : { min: 48, max: 60 };

  return <section className={isMobilePlayMode || isHostedFocus ? isHostedPresentation ? `melody-session melody-session-${presentation} melody-mobile-play grid h-full min-h-0 w-full overflow-y-auto bg-zinc-950 text-zinc-100` : `melody-session melody-session-${presentation} melody-mobile-play mobile-play-mode fixed inset-0 z-50 grid w-full overflow-y-auto bg-zinc-950 text-zinc-100` : `melody-session melody-session-${presentation} mx-auto ${presentation === "results" || presentation === "review" ? "max-w-6xl space-y-5" : "w-full space-y-3"} text-zinc-100`} data-testid="melody-session">
    <header className="melody-header flex flex-wrap items-center justify-between gap-3" hidden={isMobilePlayMode || isHostedFocus}><div><h1 className="text-2xl font-semibold">Melody</h1><p>Read ahead, keep the pulse, and play through mistakes.</p></div><div className="flex items-center gap-2">{!isHostedPresentation && <button className="practice-mobile-play-entry rounded-lg border border-sky-400/50 bg-zinc-950/90 px-3 py-2 text-sm font-semibold text-sky-100 shadow-sm hover:bg-sky-400/15" onClick={enterMobilePlay} ref={mobilePlayEntryRef} type="button">Mobile Play</button>}<MidiStatus deviceName={midi.deviceName} error={midi.error} onConnect={midi.connectMidi} status={midi.status} /></div></header>
    {isMobilePlayMode ? <><p className="melody-mobile-play-context">Melody · {settings.tempoBpm} BPM · {settings.measureCount} {settings.measureCount === 1 ? "measure" : "measures"}</p>{!isHostedPresentation && <button className="mobile-play-exit rounded-lg border border-sky-400/60 bg-zinc-950/95 px-3 py-2 text-sm font-semibold text-sky-100 shadow-lg" onClick={handleExitMobilePlay} type="button">Exit Mobile Play</button>}</> : null}
    <p aria-live="polite" className="sr-only">{statusMessage}</p>
    {presentation === "setup" && !practiceSessionMode && <MelodySettingsControls settings={settings} onChange={changeSetting}>
      <MelodyPracticeOptions continuousPractice={continuousPractice} continuousDurationMinutes={continuousDurationMinutes} onContinuousPracticeChange={setContinuousPractice} onDurationChange={setContinuousDurationMinutes} />
    </MelodySettingsControls>}
    {presentation !== "results" && presentation !== "review" && <div className="melody-practice" data-keyboard-visible={showVirtualKeyboard}>
      <div className="melody-reading-controls">
      <div className="melody-reading-transport">
      {(presentation === "setup" || presentation === "ready") && <div className="melody-ready-controls"><p className="text-sm">Ready. Study the music for as long as you need.</p><button className="min-h-11 rounded bg-sky-500 px-4 py-2 font-semibold" onClick={() => readyAttemptRef.current ? void beginAttempt(exercise, readyAttemptRef.current) : continuousPractice ? startContinuousSession() : void start()} type="button">Ready — Begin Count-in</button></div>}
      {presentation === "starting" && <p>Starting audio…</p>}
      {presentation === "count-in" && <p className="melody-play-status text-sm"><strong>Count-in</strong> · {preparatoryLeadIn.pulseCount} preparatory beats</p>}
      {presentation === "performing" && <p className="melody-play-status text-sm"><strong>Play</strong>{lockedSource ? ` · Input: ${lockedSource === "midi" ? "MIDI" : "On-screen keyboard"}` : ""}</p>}
      {["starting", "count-in", "performing"].includes(presentation) && <button className="min-h-11 rounded border border-sky-400 px-3" onClick={() => stopPlaying()} type="button">Stop Playing</button>}
      </div>
        <div className="melody-reading-meta">
      {(isHostedFocus || isMobilePlayMode) && <div className="melody-connection-controls"><MidiStatus deviceName={midi.deviceName} error={midi.error} onConnect={midi.connectMidi} status={midi.status} /></div>}
      {continuousPractice && <p className="melody-time-status">{continuousSessionActive && continuousDeadlineMs !== null && presentation !== "setup" ? <>Time remaining: {formatRemainingTime(getMelodyContinuousRemainingMs(continuousDeadlineMs, timerDisplayNowMs))} · Trials completed: {continuousHistory.length}</> : null}</p>}
        </div>
      </div>
      <div aria-label="Melody exercise score and preparatory lead-in" className="melody-score-scroll melody-active-score-region" ref={scoreRegionRef} tabIndex={0}><MelodyActiveScore preparationTick={preparationTick} activeTick={activeTick} displayMeasureIndex={displayMeasureIndex} expanded={!showVirtualKeyboard} measureCount={exercise.measures.length as 1 | 2} measureTick={measureTick} score={score} staff={settings.staff} /></div>
      {hostedStart && presentation === "starting" && <div className="space-y-2"><p className="text-sm text-amber-200">If your browser needs another tap to enable audio, continue here. Your saved attempt remains the same.</p><button className="min-h-11 rounded bg-sky-500 px-4 py-2 font-semibold" onClick={() => { void audioContextRef.current?.resume().catch(() => setAudioError("Audio is still unavailable. End this exercise and try again when audio is available.")); }} type="button">Enable audio and continue</button></div>}
      {audioError && <p role="alert" className="text-red-300">{audioError}</p>}
      {interruptionNotice && <p aria-live="polite" className="text-amber-200" role="status">{interruptionNotice}</p>}
      <div className="melody-keyboard" hidden={!showVirtualKeyboard}><PianoKeyboard activeMidiNumbers={activeVirtual} failedMidiNumbers={EMPTY} lastAnswer={null} maxMidi={range.max} minMidi={range.min} onNotePress={(note) => { setActiveVirtual((current) => new Set(current).add(note)); record(note, "virtual"); }} onNoteRelease={(note) => setActiveVirtual((current) => { const next = new Set(current); next.delete(note); return next; })} onNoteToggle={(note) => record(note, "virtual")} targetMidiNumbers={EMPTY} visualMode="freeplay" /></div></div>}
    {presentation === "results" && result && <div className={practiceSessionMode ? "[&_.melody-result-settings]:hidden" : undefined}><MelodyResults compact={!!hostedPracticePresentation?.isPlayingView} continuousProgress={continuousSessionActive ? `Diagnostic trial ${continuousHistory.length} complete${continuousDeadlineMs === null ? "" : ` · Time remaining: ${formatRemainingTime(getMelodyContinuousRemainingMs(continuousDeadlineMs, timerDisplayNowMs))}`}` : undefined} exercise={exercise} onRetrySame={retrySame} onSettings={returnSettings} onTryAnother={tryAnother} ref={resultsHeadingRef} result={result} showRetrySame={!continuousSessionActive} /></div>}
    {presentation === "review" && <MelodyTimedSessionReview durationMinutes={continuousDurationMinutes} filter={reviewFilter} interrupted={continuousInterrupted} onFilterChange={changeReviewFilter} onNewTimedSession={() => startContinuousSession(true, true)} onNextNeedsReview={nextNeedsReview} onResultViewChange={setReviewResultView} onRetryTrial={retryReviewTrial} onReviewMistakes={reviewMistakes} onSelectTrial={selectReviewTrial} onSettings={returnSettings} pinnedTrialId={reviewPinnedTrialId} ref={reviewHeadingRef} resultView={reviewResultView} selectedTrialId={reviewTrialId} showSessionActions={!practiceSessionMode} trialHeadingRef={reviewTrialHeadingRef} trials={continuousHistory} />}
  </section>;
}
