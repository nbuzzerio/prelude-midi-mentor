import type { EarTrainingConfig } from "../ear-training-config";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef } from "react";
import FeedbackVolumeControl from "@/components/audio/feedback-volume-control";
import InstrumentVolumeControl from "@/components/audio/instrument-volume-control";
import MidiStatus from "@/components/midi/midi-status";
import { useAppMidiInput } from "@/hooks/use-app-midi-input";
import { useMobilePlay } from "@/hooks/use-mobile-play";
import type { HostedPracticePresentation } from "@/types/hosted-practice-presentation";
import { useEarTrainingAttempt } from "../hooks/use-ear-training-attempt";
import { useEarTrainingPrompt } from "../hooks/use-ear-training-prompt";
import { useEarTrainingSettings } from "../hooks/use-ear-training-settings";
import { useEarTrainingTarget } from "../hooks/use-ear-training-target";
import EarTrainingCard from "./ear-training-card";
import EarTrainingControls from "./ear-training-controls";
import EarTrainingStatsView from "./ear-training-stats";
import type { EarTrainingPracticeResultV1 } from "../ear-training-practice-result";

export default function EarTrainingSession({ initialConfig, onPracticeUnitCompleted, onPracticeResultChange, onPracticeActivityChange, practiceSessionMode = false, hostedPracticePresentation, hostedStart = false }: Readonly<{
  initialConfig?: EarTrainingConfig;
  onPracticeUnitCompleted?: () => void;
  onPracticeResultChange?: (result: EarTrainingPracticeResultV1) => void;
  onPracticeActivityChange?: (available: boolean) => void;
  practiceSessionMode?: boolean;
  hostedPracticePresentation?: HostedPracticePresentation;
  /** Opt-in first prompt after the host has durably acknowledged Start. */
  hostedStart?: boolean;
}> = {}) {
  const settings = useEarTrainingSettings(initialConfig);
  const targetOptions = useMemo(() => ({ enabledDirections: settings.enabledDirections, enabledIntervals: settings.enabledIntervals }), [settings.enabledDirections, settings.enabledIntervals]);
  const {
    generateNextTarget,
    getCurrentTarget,
    isTargetLocked,
    lockTarget,
    target,
  } = useEarTrainingTarget(targetOptions);
  const {
    cancelPrompt,
    getResponseTimeMs,
    playPrompt,
    resetPrompt,
    state: promptState,
  } = useEarTrainingPrompt();
  const mobilePlay = useMobilePlay();
  const {
    answer,
    canReplay,
    feedback,
    prepareNextTarget,
    resetSession,
    stats,
    wrongAnswers,
  } = useEarTrainingAttempt({
    onPracticeUnitCompleted,
    onPracticeResultChange,
    cancelPrompt,
    generateNextTarget,
    getCurrentTarget,
    getResponseTimeMs,
    isTargetLocked,
    lockTarget,
    promptState,
    resetPrompt,
  });
  const previousSettingsRef = useRef(targetOptions);
  useEffect(() => {
    if (!practiceSessionMode) return;
    // Conservatively begin pacing only once the native prompt has completed.
    onPracticeActivityChange?.(promptState === "heard");
    return () => onPracticeActivityChange?.(false);
  }, [practiceSessionMode, promptState, onPracticeActivityChange]);

  const playCurrentPrompt = useCallback(() => {
    if (!canReplay || feedback === "correct" || promptState === "playing") return;
    void playPrompt(getCurrentTarget());
  }, [canReplay, feedback, getCurrentTarget, playPrompt, promptState]);
  const hostedStartConsumed = useRef(false);
  const startHostedPrompt = useEffectEvent(() => playCurrentPrompt());
  useEffect(() => {
    if (!practiceSessionMode || !hostedStart) return;
    let cancelled = false;
    // Defer past Strict Mode's discarded setup, retaining the native player owner.
    queueMicrotask(() => {
      if (cancelled || hostedStartConsumed.current) return;
      hostedStartConsumed.current = true;
      startHostedPrompt();
    });
    return () => { cancelled = true; };
  }, [practiceSessionMode, hostedStart]);
  const midi = useAppMidiInput({
    onSustainPedalChanged: (isDown) => {
      if (isDown) playCurrentPrompt();
    },
  });

  useEffect(() => {
    if (previousSettingsRef.current === targetOptions) return;
    previousSettingsRef.current = targetOptions;
    prepareNextTarget();
  }, [prepareNextTarget, targetOptions]);

  const isHostedPresentation = hostedPracticePresentation !== undefined;
  const isMobilePlayActive = hostedPracticePresentation?.isMobilePlayMode ?? mobilePlay.isMobilePlayMode;
  const isHostedFocus = hostedPracticePresentation?.isFocusMode ?? false;

  return <div className={isMobilePlayActive ? isHostedPresentation ? "ear-training-mobile-play grid h-full min-h-0 w-full overflow-hidden bg-zinc-950" : "mobile-play-mode ear-training-mobile-play fixed inset-0 z-50 grid w-full overflow-hidden bg-zinc-950" : isHostedFocus ? "ear-training-mobile-play grid h-full min-h-0 w-full overflow-hidden bg-zinc-950" : "mx-auto flex w-full max-w-7xl flex-col gap-6"}>
    <header className="ear-training-header flex items-center justify-between gap-2" hidden={isMobilePlayActive || isHostedFocus}>
      <div className="min-w-0"><p className="hidden text-sm font-semibold uppercase tracking-wider text-white/60 sm:block">Ear Training</p><h1 className="truncate text-lg font-bold sm:text-3xl"><span className="sm:hidden">Prelude · Ear Training</span><span className="hidden sm:inline">Prelude: MIDI Mentor</span></h1></div>
      <div className="flex items-center gap-2">
        {!isHostedPresentation && <button className="practice-mobile-play-entry shrink-0 rounded-lg border border-sky-400/50 px-3 py-2 text-sm font-semibold text-sky-100" onClick={mobilePlay.enterMobilePlay} type="button">Mobile Play</button>}
        <MidiStatus deviceName={midi.deviceName} error={midi.error} onConnect={midi.connectMidi} status={midi.status} />
      </div>
    </header>

    {isMobilePlayActive && !isHostedPresentation ? <button className="mobile-play-exit rounded-lg border border-sky-400/60 bg-zinc-950/95 px-3 py-2 text-sm font-semibold text-sky-100" onClick={mobilePlay.exitMobilePlay} type="button">Exit Mobile Play</button> : null}

    <main className="ear-training-stage min-h-0">
      {hostedStart && promptState === "failed" && <p className="mb-3 text-sm text-amber-200" role="status">Your browser may need another tap to enable audio. Use Replay Prompt to hear this interval; your saved attempt remains the same.</p>}
      <EarTrainingCard answerIntervals={settings.enabledIntervals} canReplay={canReplay} feedback={feedback} onAnswer={answer} onPlayPrompt={playCurrentPrompt} promptState={promptState} target={target} wrongAnswers={wrongAnswers} />
    </main>

    <section className="grid gap-4 md:grid-cols-2" hidden={isMobilePlayActive || isHostedFocus}>
      {!practiceSessionMode && <EarTrainingControls {...settings} onDirectionToggle={settings.toggleDirection} onIntervalToggle={settings.toggleInterval} onReset={resetSession} />}
      <div className="grid gap-4"><FeedbackVolumeControl /><InstrumentVolumeControl showReplayCompletedChords={false} /></div>
    </section>
    <div hidden={isMobilePlayActive || isHostedFocus}><EarTrainingStatsView stats={stats} /></div>
  </div>;
}
