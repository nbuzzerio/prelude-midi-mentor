import { useEffect, useMemo, useRef } from "react";
import FeedbackVolumeControl from "@/components/audio/feedback-volume-control";
import InstrumentVolumeControl from "@/components/audio/instrument-volume-control";
import { useMobilePlay } from "@/hooks/use-mobile-play";
import { useEarTrainingAttempt } from "../hooks/use-ear-training-attempt";
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
  const {
    answer,
    canReplay,
    feedback,
    prepareNextTarget,
    resetSession,
    stats,
    wrongAnswers,
  } = useEarTrainingAttempt({
    cancelPrompt,
    generateNextTarget,
    getCurrentTarget,
    getResponseTimeMs,
    isTargetLocked,
    lockTarget,
    promptState,
    resetPrompt,
  });
  const initialSettingsRef = useRef(true);

  useEffect(() => {
    if (initialSettingsRef.current) {
      initialSettingsRef.current = false;
      return;
    }
    prepareNextTarget();
  }, [prepareNextTarget, settings.enabledDirections, settings.enabledIntervals]);

  const isMobilePlayActive = mobilePlay.isMobilePlayMode;

  return <div className={isMobilePlayActive ? "mobile-play-mode ear-training-mobile-play fixed inset-0 z-50 grid w-full overflow-hidden bg-zinc-950" : "mx-auto flex w-full max-w-7xl flex-col gap-6"}>
    <header className="flex items-center justify-between" hidden={isMobilePlayActive}>
      <div><p className="text-sm font-semibold uppercase tracking-wider text-white/60">Ear Training</p><h1 className="text-xl font-bold sm:text-3xl">Prelude: MIDI Mentor</h1></div>
      <button className="rounded-lg border border-sky-400/50 px-3 py-2 text-sm font-semibold text-sky-100" onClick={mobilePlay.enterMobilePlay} type="button">Mobile Play</button>
    </header>

    {isMobilePlayActive ? <><button className="mobile-play-exit rounded-lg border border-sky-400/60 bg-zinc-950/95 px-3 py-2 text-sm font-semibold text-sky-100" onClick={mobilePlay.exitMobilePlay} type="button">Exit Mobile Play</button><p className="mobile-play-rotate-message">Rotate your device for the best layout.</p></> : null}

    <main className="ear-training-stage min-h-0">
      <EarTrainingCard answerIntervals={settings.enabledIntervals} canReplay={canReplay} feedback={feedback} onAnswer={answer} onPlayPrompt={() => { void playPrompt(getCurrentTarget()); }} promptState={promptState} target={target} wrongAnswers={wrongAnswers} />
    </main>

    <section className="grid gap-4 md:grid-cols-2" hidden={isMobilePlayActive}>
      <EarTrainingControls {...settings} onDirectionToggle={settings.toggleDirection} onIntervalToggle={settings.toggleInterval} onReset={resetSession} />
      <div className="grid gap-4"><FeedbackVolumeControl /><InstrumentVolumeControl showReplayCompletedChords={false} /></div>
    </section>
    <div hidden={isMobilePlayActive}><EarTrainingStatsView stats={stats} /></div>
  </div>;
}
