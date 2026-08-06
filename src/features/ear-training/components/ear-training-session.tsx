import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FeedbackVolumeControl from "@/components/audio/feedback-volume-control";
import InstrumentVolumeControl from "@/components/audio/instrument-volume-control";
import { useMobilePlay } from "@/hooks/use-mobile-play";
import { playIncorrectFeedback, playSuccessChirp } from "@/lib/audio/feedback";
import type { MusicalInterval } from "@/lib/music/intervals";
import {
  INITIAL_EAR_TRAINING_STATS,
  applyEarTrainingCompletion,
  applyEarTrainingIncorrectAttempt,
} from "../ear-training-stats";
import { isEarTrainingAnswerCorrect } from "../ear-training-validation";
import {
  EAR_TRAINING_FEEDBACK_DELAY_MS,
  EAR_TRAINING_INCORRECT_SOUND_MS,
} from "../ear-training-timing";
import { useEarTrainingPrompt } from "../hooks/use-ear-training-prompt";
import { useEarTrainingSettings } from "../hooks/use-ear-training-settings";
import { useEarTrainingTarget } from "../hooks/use-ear-training-target";
import EarTrainingCard from "./ear-training-card";
import EarTrainingControls from "./ear-training-controls";
import EarTrainingStatsView from "./ear-training-stats";

export default function EarTrainingSession() {
  const settings = useEarTrainingSettings();
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
  const [stats, setStats] = useState(INITIAL_EAR_TRAINING_STATS);
  const [feedback, setFeedback] = useState<"idle" | "correct" | "incorrect">("idle");
  const [wrongAnswers, setWrongAnswers] = useState<ReadonlySet<MusicalInterval>>(new Set());
  const [canReplay, setCanReplay] = useState(true);
  const hadIncorrectRef = useRef(false);
  const initialSettingsRef = useRef(true);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const clearTargetAttempt = useCallback(() => {
    clearTimers();
    resetPrompt();
    hadIncorrectRef.current = false;
    setWrongAnswers(new Set());
    setFeedback("idle");
    setCanReplay(true);
  }, [clearTimers, resetPrompt]);

  const prepareNextTarget = useCallback(() => {
    clearTargetAttempt();
    generateNextTarget();
  }, [clearTargetAttempt, generateNextTarget]);

  useEffect(() => {
    if (initialSettingsRef.current) {
      initialSettingsRef.current = false;
      return;
    }
    prepareNextTarget();
  }, [prepareNextTarget, settings.enabledDirections, settings.enabledIntervals]);

  useEffect(() => () => {
    clearTimers();
    cancelPrompt();
  }, [cancelPrompt, clearTimers]);

  const handleAnswer = (answer: MusicalInterval) => {
    if (isTargetLocked() || promptState !== "heard" || wrongAnswers.has(answer)) return;
    const currentTarget = getCurrentTarget();
    if (!isEarTrainingAnswerCorrect(answer, currentTarget)) {
      const alreadyIncorrect = hadIncorrectRef.current;
      setStats((current) => applyEarTrainingIncorrectAttempt(current, alreadyIncorrect));
      hadIncorrectRef.current = true;
      setWrongAnswers((current) => new Set(current).add(answer));
      setFeedback("incorrect");
      setCanReplay(false);
      playIncorrectFeedback();
      const timer = window.setTimeout(() => setCanReplay(true), EAR_TRAINING_INCORRECT_SOUND_MS);
      timersRef.current.push(timer);
      return;
    }
    if (!lockTarget()) return;
    cancelPrompt();
    setFeedback("correct");
    setStats((current) => applyEarTrainingCompletion(current, getResponseTimeMs(), hadIncorrectRef.current));
    playSuccessChirp();
    const timer = window.setTimeout(prepareNextTarget, EAR_TRAINING_FEEDBACK_DELAY_MS);
    timersRef.current.push(timer);
  };

  const handleReset = () => {
    setStats(INITIAL_EAR_TRAINING_STATS);
    prepareNextTarget();
  };

  const isMobilePlayActive = mobilePlay.isMobilePlayMode;

  return <div className={isMobilePlayActive ? "mobile-play-mode ear-training-mobile-play fixed inset-0 z-50 grid w-full overflow-hidden bg-zinc-950" : "mx-auto flex w-full max-w-7xl flex-col gap-6"}>
    <header className="flex items-center justify-between" hidden={isMobilePlayActive}>
      <div><p className="text-sm font-semibold uppercase tracking-wider text-white/60">Ear Training</p><h1 className="text-xl font-bold sm:text-3xl">Prelude: MIDI Mentor</h1></div>
      <button className="rounded-lg border border-sky-400/50 px-3 py-2 text-sm font-semibold text-sky-100" onClick={mobilePlay.enterMobilePlay} type="button">Mobile Play</button>
    </header>

    {isMobilePlayActive ? <><button className="mobile-play-exit rounded-lg border border-sky-400/60 bg-zinc-950/95 px-3 py-2 text-sm font-semibold text-sky-100" onClick={mobilePlay.exitMobilePlay} type="button">Exit Mobile Play</button><p className="mobile-play-rotate-message">Rotate your device for the best layout.</p></> : null}

    <main className="ear-training-stage min-h-0">
      <EarTrainingCard answerIntervals={settings.enabledIntervals} canReplay={canReplay} feedback={feedback} onAnswer={handleAnswer} onPlayPrompt={() => { void playPrompt(getCurrentTarget()); }} promptState={promptState} target={target} wrongAnswers={wrongAnswers} />
    </main>

    <section className="grid gap-4 md:grid-cols-2" hidden={isMobilePlayActive}>
      <EarTrainingControls {...settings} onDirectionToggle={settings.toggleDirection} onIntervalToggle={settings.toggleInterval} onReset={handleReset} />
      <div className="grid gap-4"><FeedbackVolumeControl /><InstrumentVolumeControl showReplayCompletedChords={false} /></div>
    </section>
    <div hidden={isMobilePlayActive}><EarTrainingStatsView stats={stats} /></div>
  </div>;
}
