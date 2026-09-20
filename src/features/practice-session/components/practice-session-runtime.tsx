import { useEffect, useMemo, useRef, useState, type Dispatch, type KeyboardEvent } from "react";
import EarTrainingSession from "@/features/ear-training/components/ear-training-session";
import FlashcardSession from "@/features/flashcards/components/flashcard-session";
import MelodySession, { type MelodySessionHandle } from "@/features/melody/components/melody-session";
import SequenceSession from "@/features/sequences/components/sequence-session";
import { useMobilePlay } from "@/hooks/use-mobile-play";
import {
  getPracticeSessionProgressText,
  type ActivePracticeSessionRun,
  type CompletedPracticeSessionRun,
  type PracticeSessionRunEvent,
} from "../practice-session-runtime";
import type { PracticeSessionEngineResult } from "../practice-session-engine-result";
import { PracticeSessionCompletedReport } from "./practice-session-report";

type RuntimeProps = Readonly<{
  run: ActivePracticeSessionRun;
  dispatch: Dispatch<PracticeSessionRunEvent>;
  createExerciseToken: () => string;
  now: () => number;
}>;

export function PracticeSessionRuntime({ run, dispatch, createExerciseToken, now }: RuntimeProps) {
  const melodyRef = useRef<MelodySessionHandle>(null);
  const mobilePlayEntryRef = useRef<HTMLButtonElement>(null);
  const exerciseContextRef = useRef<HTMLHeadingElement>(null);
  const completionDialogRef = useRef<HTMLDivElement>(null);
  const completionPrimaryActionRef = useRef<HTMLButtonElement>(null);
  const previousExerciseTokenRef = useRef(run.activeExerciseToken);
  const mobilePlay = useMobilePlay();
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(true);
  const [bonusNotice, setBonusNotice] = useState<Readonly<{ token: string; message: string }> | null>(null);
  const entry = run.snapshot.exercises[run.activeExerciseIndex]!;
  const record = run.records[run.records.length - 1]!;
  const scope = { runId: run.runId, exerciseToken: run.activeExerciseToken, exerciseId: entry.id };
  const finalExercise = run.activeExerciseIndex === run.snapshot.exercises.length - 1;
  const hostedPracticePresentation = useMemo(() => ({
    isFocusMode,
    isMobilePlayMode: mobilePlay.isMobilePlayMode,
    showVirtualKeyboard,
  }), [isFocusMode, mobilePlay.isMobilePlayMode, showVirtualKeyboard]);
  const completionPending = run.completionPresentation === "target-complete";

  useEffect(() => {
    if (previousExerciseTokenRef.current === run.activeExerciseToken) return;
    previousExerciseTokenRef.current = run.activeExerciseToken;
    exerciseContextRef.current?.focus();
  }, [run.activeExerciseToken]);

  useEffect(() => {
    if (completionPending) completionPrimaryActionRef.current?.focus();
  }, [completionPending]);

  useEffect(() => {
    const handleVisibilityChange = () => dispatch({
      type: "VISIBILITY_CHANGED", runId: run.runId, exerciseToken: run.activeExerciseToken, exerciseId: entry.id,
      at: now(), foreground: document.visibilityState !== "hidden",
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [dispatch, entry.id, now, run.activeExerciseToken, run.runId]);

  const advance = (type: "ADVANCE" | "SKIP") => {
    const endedAt = now();
    dispatch(finalExercise
      ? { type, ...scope, endedAt }
      : { type, ...scope, endedAt, nextStartedAt: now(), nextExerciseToken: createExerciseToken() });
  };
  const keepPlaying = () => {
    if (entry.engine === "melody" && !melodyRef.current?.continuePractice()) {
      setBonusNotice({ token: run.activeExerciseToken, message: "Bonus practice is not ready yet. Try again from this review." });
      return;
    }
    setBonusNotice(null);
    dispatch({ type: "KEEP_PLAYING", ...scope, at: now() });
    window.setTimeout(() => exerciseContextRef.current?.focus(), 0);
  };
  const unitCompleted = () => dispatch({ type: "UNIT_COMPLETED", ...scope, at: now() });
  const targetReached = () => dispatch({ type: "TARGET_REACHED", ...scope, at: now() });
  const resultChanged = (result: PracticeSessionEngineResult) => dispatch({ type: "ENGINE_RESULT_CHANGED", ...scope, result });
  const exitMobilePlay = () => {
    mobilePlay.exitMobilePlay();
    window.setTimeout(() => mobilePlayEntryRef.current?.focus(), 0);
  };
  const containCompletionFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(completionDialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? []);
    if (controls.length === 0) return;
    const first = controls[0]!;
    const last = controls[controls.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  let engine: React.ReactNode;
  switch (entry.engine) {
    case "flashcards":
      engine = <FlashcardSession hostedPracticePresentation={hostedPracticePresentation} initialConfig={entry.config} isFocusMode={false} onPracticeResultChange={resultChanged} onPracticeUnitCompleted={unitCompleted} onToggleFocusMode={() => undefined} practiceSessionMode />;
      break;
    case "sequences":
      engine = <SequenceSession hostedPracticePresentation={hostedPracticePresentation} initialConfig={entry.config} isFocusMode={false} onPracticeResultChange={resultChanged} onPracticeUnitCompleted={unitCompleted} onScaleRepertoireCompleted={entry.target.kind === "complete-scale-repertoire" ? targetReached : undefined} onToggleFocusMode={() => undefined} practiceSessionMode />;
      break;
    case "ear-training":
      engine = <EarTrainingSession hostedPracticePresentation={hostedPracticePresentation} initialConfig={entry.config} onPracticeResultChange={resultChanged} onPracticeUnitCompleted={unitCompleted} practiceSessionMode />;
      break;
    case "melody":
      engine = <MelodySession hostedPracticePresentation={hostedPracticePresentation} initialConfig={entry.config} onPracticeResultChange={resultChanged} onPracticeTargetReached={targetReached} practiceSessionMode ref={melodyRef} />;
      break;
  }

  return <section aria-label="Active Practice Session" className={mobilePlay.isMobilePlayMode ? `practice-session-shell practice-session-mobile-play mobile-play-mode fixed inset-0 z-50 grid w-full overflow-hidden bg-zinc-950 text-white${isFocusMode ? " practice-session-focus" : ""}` : isFocusMode ? "practice-session-shell practice-session-focus fixed inset-0 z-50 grid w-full overflow-hidden bg-zinc-950 text-white" : "practice-session-shell mx-auto grid w-full max-w-7xl text-white"}>
    <div aria-hidden={completionPending || undefined} className="contents" inert={completionPending || undefined}>
    <header className={`practice-session-strip border border-sky-400/30 bg-zinc-900 ${mobilePlay.isMobilePlayMode || isFocusMode ? "p-2" : "rounded-xl p-3"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <p className="truncate font-semibold">{run.snapshot.presetName}</p>
          <h1 className="text-sm font-normal text-zinc-300 focus:outline-none" ref={exerciseContextRef} tabIndex={-1}>Exercise {run.activeExerciseIndex + 1} of {run.snapshot.exercises.length} · {entry.label}</h1>
          <p className="text-sm text-zinc-300">{getPracticeSessionProgressText(entry, record.actual)}</p>
        </div>
        <button aria-pressed={isFocusMode} className="min-h-11 rounded border border-sky-400/50 px-3 font-semibold text-sky-100" onClick={() => setIsFocusMode((current) => !current)} type="button">{isFocusMode ? "Exit Focus" : "Focus"}</button>
        <button aria-pressed={showVirtualKeyboard} className="min-h-11 rounded border border-zinc-600 px-3" onClick={() => setShowVirtualKeyboard((current) => !current)} type="button">{showVirtualKeyboard ? "Hide Keyboard" : "Show Keyboard"}</button>
        {!mobilePlay.isMobilePlayMode && <button className="practice-mobile-play-entry min-h-11 rounded border border-sky-400/50 px-3 font-semibold text-sky-100" onClick={mobilePlay.enterMobilePlay} ref={mobilePlayEntryRef} type="button">Mobile Play</button>}
        {run.completionPresentation === "practicing" && <button className="min-h-11 rounded bg-zinc-800 px-3" onClick={() => advance("SKIP")} type="button">Skip for Today</button>}
        <button className="min-h-11 rounded border border-zinc-600 px-3" onClick={() => dispatch({ type: "END", ...scope, endedAt: now() })} type="button">End Session</button>
        {mobilePlay.isMobilePlayMode && <button className="min-h-11 rounded border border-sky-400/60 px-3 font-semibold text-sky-100" onClick={exitMobilePlay} type="button">Exit Mobile Play</button>}
      </div>
      {run.completionPresentation === "bonus" && <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3"><span className="mr-auto">Target complete · Bonus practice</span><button className="min-h-11 rounded bg-sky-500 px-4 font-semibold" onClick={() => advance("ADVANCE")} type="button">{finalExercise ? "Finish Session" : "Next Exercise"}</button></div>}
      {!completionPending && bonusNotice?.token === run.activeExerciseToken && <p className="mt-2 text-sm text-amber-200" role="status">{bonusNotice.message}</p>}
    </header>
    <div className={`practice-session-engine min-h-0 [&_button[aria-keyshortcuts]]:hidden${mobilePlay.isMobilePlayMode || isFocusMode ? " overflow-hidden" : ""}`} key={`${run.runId}:${run.activeExerciseToken}`}>{engine}</div>
    </div>
    {completionPending && <div className="practice-session-completion-backdrop fixed inset-0 z-[70] grid place-items-center bg-black/65 p-4">
      <div aria-labelledby="practice-session-completion-title" aria-modal="true" className="w-full max-w-md rounded-xl border border-sky-300/50 bg-zinc-900 p-5 shadow-2xl" onKeyDown={containCompletionFocus} ref={completionDialogRef} role="dialog">
        <h2 className="text-xl font-bold" id="practice-session-completion-title">Practice Complete</h2>
        <p className="mt-2 text-sm text-zinc-300">Choose what to do with this exercise.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button className="min-h-11 rounded bg-sky-500 px-4 font-semibold" onClick={() => advance("ADVANCE")} ref={completionPrimaryActionRef} type="button">{finalExercise ? "Finish Session" : "Next Exercise"}</button>
          <button className="min-h-11 rounded bg-zinc-800 px-4" onClick={keepPlaying} type="button">Keep Playing</button>
        </div>
        {bonusNotice?.token === run.activeExerciseToken && <p className="mt-3 text-sm text-amber-200" role="status">{bonusNotice.message}</p>}
      </div>
    </div>}
  </section>;
}

export function PracticeSessionSummary({ run, onBack }: Readonly<{ run: CompletedPracticeSessionRun; onBack: () => void }>) {
  useEffect(() => document.getElementById("practice-session-summary-title")?.focus(), []);
  return <PracticeSessionCompletedReport onBack={onBack} run={run} />;
}
