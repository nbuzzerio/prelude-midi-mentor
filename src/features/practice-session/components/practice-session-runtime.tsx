import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type KeyboardEvent } from "react";
import { AppMidiContext } from "@/components/midi/midi-context";
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
import { PracticeSessionPrintControls } from "./practice-session-print-report";
import type { ProgramAttempt } from "../practice-program-attempt";
import { LessonExerciseFeedback, LessonNativeDetails } from "./practice-lesson-summary";

type QueuePresentation = Readonly<{
  position: number; total: number; cue: string; nextTitle?: string; nextLabel?: string; disabled: boolean; canRepeat: boolean;
  onNext: () => void; onRepeat: () => void; onFinish: () => void;
  evidence?: ProgramAttempt | null; pendingReason?: string;
}>;
type RuntimeProps = Readonly<{
  run: ActivePracticeSessionRun;
  dispatch: Dispatch<PracticeSessionRunEvent>;
  createExerciseToken: () => string;
  now: () => number;
  allowSkip?: boolean;
  /** Explicit morning-launch request for this acknowledged attempt only. */
  hostedStart?: boolean;
  onPracticeActivityChange?: (available: boolean) => void;
  /** The V2 queue host retains explicit choice across native attempt mounts. */
  keyboardChoice?: boolean | null;
  onKeyboardChoiceChange?: (visible: boolean) => void;
  lesson?: QueuePresentation;
  manualQueue?: QueuePresentation;
  entryFocusAllowed?: () => boolean;
}>;

export function PracticeSessionRuntime({ run, dispatch, createExerciseToken, now, allowSkip = true, hostedStart = false, lesson: dailyLesson, manualQueue, entryFocusAllowed, onPracticeActivityChange, keyboardChoice, onKeyboardChoiceChange }: RuntimeProps) {
  // Both V2 entry routes present the outer queue; their native start policies stay separate.
  const lesson = dailyLesson ?? manualQueue;
  const isV2 = lesson !== undefined;
  const melodyRef = useRef<MelodySessionHandle>(null);
  const mobilePlayEntryRef = useRef<HTMLButtonElement>(null);
  const exerciseContextRef = useRef<HTMLHeadingElement>(null);
  const completionDialogRef = useRef<HTMLDivElement>(null);
  const completionPrimaryActionRef = useRef<HTMLButtonElement>(null);
  const previousExerciseTokenRef = useRef(run.activeExerciseToken);
  const entryFocused = useRef<string | null>(null);
  const completionFocused = useRef<string | null>(null);
  const interaction = useRef(0);
  const completionIntent = useRef<{ token: string; interaction: number } | null>(null);
  const mobilePlay = useMobilePlay();
  const [isFocusMode, setIsFocusMode] = useState(false);
  const midi = useContext(AppMidiContext);
  const [localKeyboardChoice, setLocalKeyboardChoice] = useState<boolean | null>(null);
  const explicitKeyboardChoice = keyboardChoice === undefined ? localKeyboardChoice : keyboardChoice;
  const showVirtualKeyboard = explicitKeyboardChoice ?? midi?.status !== "connected";
  const chooseKeyboard = onKeyboardChoiceChange ?? setLocalKeyboardChoice;
  const [bonusNotice, setBonusNotice] = useState<Readonly<{ token: string; message: string }> | null>(null);
  const entry = run.snapshot.exercises[run.activeExerciseIndex]!;
  const record = run.records[run.records.length - 1]!;
  const scope = { runId: run.runId, exerciseToken: run.activeExerciseToken, exerciseId: entry.id };
  const finalExercise = run.activeExerciseIndex === run.snapshot.exercises.length - 1;
  const hostedPracticePresentation = useMemo(() => ({
    isFocusMode,
    isMobilePlayMode: mobilePlay.isMobilePlayMode,
    showVirtualKeyboard,
    isPlayingView: isV2,
  }), [isFocusMode, mobilePlay.isMobilePlayMode, showVirtualKeyboard, isV2]);
  const targetComplete = run.completionPresentation === "target-complete";
  const completionPending = targetComplete && !lesson;
  const lessonCompletionReady = !!lesson && targetComplete && !lesson.disabled;
  const finishLabel = dailyLesson ? "Finish Lesson" : "Finish practice";
  const scopeNote = lesson ? `${dailyLesson ? "Today's Piano Lesson" : "Manual V2 practice"} · exercise ${lesson.position} of ${lesson.total}. This is a single-attempt native report; other selections are not included.` : undefined;
  const readingActivityChanged = useCallback((active: boolean) => {
    dispatch({ type: "ENGINE_ACTIVITY_CHANGED", runId: run.runId, exerciseToken: run.activeExerciseToken, exerciseId: entry.id, at: now(), active });
    onPracticeActivityChange?.(active);
  }, [dispatch, run.runId, run.activeExerciseToken, entry.id, now, onPracticeActivityChange]);

  useEffect(() => {
    if (entry.engine !== "flashcards" && entry.engine !== "sequences") return;
    onPracticeActivityChange?.(true);
    return () => onPracticeActivityChange?.(false);
  }, [entry.engine, onPracticeActivityChange]);

  useEffect(() => {
    const interacted = () => { interaction.current++; };
    document.addEventListener("pointerdown", interacted, true);
    document.addEventListener("keydown", interacted, true);
    return () => { document.removeEventListener("pointerdown", interacted, true); document.removeEventListener("keydown", interacted, true); };
  }, []);

  useLayoutEffect(() => {
    if (manualQueue && targetComplete && completionIntent.current?.token !== run.activeExerciseToken) completionIntent.current = { token: run.activeExerciseToken, interaction: interaction.current };
  }, [manualQueue, targetComplete, run.activeExerciseToken]);

  useEffect(() => {
    if (!manualQueue || entryFocused.current === run.activeExerciseToken) return;
    entryFocused.current = run.activeExerciseToken;
    if (!targetComplete && (!entryFocusAllowed || entryFocusAllowed()) && document.visibilityState !== "hidden") {
      exerciseContextRef.current?.focus({ preventScroll: true });
      exerciseContextRef.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
  }, [manualQueue, entryFocusAllowed, run.activeExerciseToken, targetComplete]);

  useEffect(() => {
    if (manualQueue) return;
    if (previousExerciseTokenRef.current === run.activeExerciseToken) return;
    previousExerciseTokenRef.current = run.activeExerciseToken;
    exerciseContextRef.current?.focus();
  }, [run.activeExerciseToken, manualQueue]);

  useEffect(() => {
    if (manualQueue) {
      if (!lessonCompletionReady || manualQueue.evidence?.attemptId !== run.runId || manualQueue.evidence.outcome !== "completed" || completionFocused.current === run.activeExerciseToken) return;
      completionFocused.current = run.activeExerciseToken;
      if (completionIntent.current?.interaction === interaction.current && document.visibilityState !== "hidden") completionPrimaryActionRef.current?.focus();
      return;
    }
    if (completionPending || lessonCompletionReady) completionPrimaryActionRef.current?.focus();
  }, [completionPending, lessonCompletionReady, manualQueue, run.runId, run.activeExerciseToken]);

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
      engine = <EarTrainingSession hostedStart={hostedStart} onPracticeActivityChange={onPracticeActivityChange} hostedPracticePresentation={hostedPracticePresentation} initialConfig={entry.config} onPracticeResultChange={resultChanged} onPracticeUnitCompleted={unitCompleted} practiceSessionMode />;
      break;
    case "melody":
      engine = <MelodySession hostedStart={hostedStart} onPracticeActivityChange={readingActivityChanged} hostedPracticePresentation={hostedPracticePresentation} initialConfig={entry.config} onPracticeResultChange={resultChanged} onPracticeTargetReached={targetReached} practiceSessionMode ref={melodyRef} />;
      break;
  }

  return <section data-engine={entry.engine} aria-label="Active Practice Session" style={lesson && targetComplete ? { minHeight: 0 } : undefined} className={mobilePlay.isMobilePlayMode ? `practice-session-shell practice-session-mobile-play mobile-play-mode fixed inset-0 z-50 grid w-full overflow-hidden bg-zinc-950 text-white${isFocusMode ? " practice-session-focus" : ""}` : isFocusMode ? "practice-session-shell practice-session-focus fixed inset-0 z-50 grid w-full overflow-hidden bg-zinc-950 text-white" : "practice-session-shell mx-auto grid w-full max-w-7xl text-white"}>
    <div aria-hidden={completionPending || undefined} className="contents" inert={completionPending || undefined}>
    <header style={lesson && (targetComplete || !isFocusMode && !mobilePlay.isMobilePlayMode) ? { maxHeight: "none", overflowY: "visible" } : undefined} className={`practice-session-strip border border-sky-400/30 bg-zinc-900 ${mobilePlay.isMobilePlayMode || isFocusMode ? "p-2" : "rounded-xl p-3"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          {!lesson && <p className="truncate font-semibold">{run.snapshot.presetName}</p>}
          <h1 className={lesson ? "text-lg font-semibold focus:outline-none" : "text-sm font-normal text-zinc-300 focus:outline-none"} ref={exerciseContextRef} tabIndex={-1}>Exercise {lesson?.position ?? run.activeExerciseIndex + 1} of {lesson?.total ?? run.snapshot.exercises.length} · {entry.label}</h1>
          <p className="text-sm text-zinc-300">{getPracticeSessionProgressText(entry, record.actual)}</p>
          {lesson && !targetComplete && <p className="mt-1 text-sm text-sky-100">{lesson.cue}</p>}
          {lesson?.nextTitle && !targetComplete && <p className="mt-1 text-xs text-zinc-400">Up next: {lesson.nextTitle}</p>}
        </div>
        <button aria-pressed={isFocusMode} className="min-h-11 rounded border border-zinc-600 px-3 text-zinc-300" onClick={() => setIsFocusMode((current) => !current)} type="button">{isFocusMode ? "Exit Focus" : "Focus"}</button>
        <button hidden={!!lesson && targetComplete} aria-pressed={showVirtualKeyboard} className="min-h-11 rounded border border-zinc-600 px-3 text-zinc-300" onClick={() => chooseKeyboard(!showVirtualKeyboard)} type="button">{showVirtualKeyboard ? "Hide Keyboard" : "Show Keyboard"}</button>
        {!mobilePlay.isMobilePlayMode && (lesson ? <details><summary className="min-h-11 cursor-pointer py-3 text-sm text-zinc-400">View options</summary><button className="practice-mobile-play-entry min-h-11 rounded border border-zinc-600 px-3" onClick={mobilePlay.enterMobilePlay} ref={mobilePlayEntryRef} type="button">Mobile Play</button></details> : <button className="practice-mobile-play-entry min-h-11 rounded border border-sky-400/50 px-3 font-semibold text-sky-100" onClick={mobilePlay.enterMobilePlay} ref={mobilePlayEntryRef} type="button">Mobile Play</button>)}
        {allowSkip && run.completionPresentation === "practicing" && <button className="min-h-11 rounded bg-zinc-800 px-3" onClick={() => advance("SKIP")} type="button">Skip for Today</button>}
        <button className="min-h-11 rounded border border-zinc-600 px-3" onClick={() => dispatch({ type: "END", ...scope, endedAt: now() })} type="button">{lesson ? "Stop Exercise" : "End Session"}</button>
        {lesson && !targetComplete && <button className="min-h-11 border-l border-zinc-700 px-3 text-sm text-zinc-400 disabled:opacity-40" disabled={lesson.disabled} onClick={lesson.onFinish} type="button">{finishLabel} early</button>}
        {mobilePlay.isMobilePlayMode && <button className="min-h-11 rounded border border-sky-400/60 px-3 font-semibold text-sky-100" onClick={exitMobilePlay} type="button">Exit Mobile Play</button>}
      </div>
      {lesson && (targetComplete || run.completionPresentation === "bonus") && <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
        <h2 className="font-semibold" role="status">{targetComplete ? `${entry.label} complete` : "Target complete · Bonus practice"}</h2>
        <button aria-label={lesson.nextTitle ? lesson.nextLabel ?? "Next Exercise" : finishLabel} aria-description={lesson.nextTitle ? `Continue to ${lesson.nextTitle}` : undefined} className="lesson-primary min-h-12 max-w-full rounded bg-sky-500 px-5 py-3 text-left font-semibold disabled:opacity-40" disabled={lesson.disabled} onClick={lesson.nextTitle ? lesson.onNext : lesson.onFinish} ref={completionPrimaryActionRef} type="button">{lesson.nextTitle ? <>{lesson.nextLabel ?? "Next Exercise"} <span aria-hidden="true">→ {lesson.nextTitle}</span></> : finishLabel}</button>
        {lesson.disabled && <p className="text-sm text-amber-200" role="status">{lesson.pendingReason ?? "Saving results before continuing…"}</p>}
        {targetComplete && lesson.evidence?.attemptId === run.runId && lesson.evidence.outcome === "completed" && <LessonExerciseFeedback compact attempt={lesson.evidence} />}
        <details><summary className="min-h-11 cursor-pointer py-3 text-sm text-zinc-400">More practice options</summary><div className="flex flex-wrap gap-2">
          {targetComplete && <button className="min-h-11 rounded border border-zinc-600 px-3 disabled:opacity-40" disabled={lesson.disabled} onClick={keepPlaying} type="button">Keep Playing</button>}
          <button className="min-h-11 rounded border border-zinc-600 px-3 disabled:opacity-40" disabled={lesson.disabled || !lesson.canRepeat} onClick={lesson.onRepeat} type="button">Repeat Exercise</button>
        </div></details>
        {targetComplete && <LessonNativeDetails pending={lesson.disabled} run={run} scopeNote={scopeNote} />}
      </div>}
      {!lesson && run.completionPresentation === "bonus" && <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3"><span className="mr-auto">Target complete · Bonus practice</span><button className="min-h-11 rounded bg-sky-500 px-4 font-semibold" onClick={() => advance("ADVANCE")} type="button">{finalExercise ? "Finish Session" : "Next Exercise"}</button></div>}
      {!completionPending && bonusNotice?.token === run.activeExerciseToken && <p className="mt-2 text-sm text-amber-200" role="status">{bonusNotice.message}</p>}
    </header>
    <div hidden={!!lesson && targetComplete} inert={!!lesson && targetComplete || undefined} className={`practice-session-engine min-h-0${lesson ? " [&>*>header>div:first-child:has(h1)]:hidden [&>*>header]:justify-end" : ""}${mobilePlay.isMobilePlayMode || isFocusMode ? " overflow-hidden" : ""}`} key={`${run.runId}:${run.activeExerciseToken}`}>{engine}</div>
    </div>
    {completionPending && <div className="practice-session-completion-backdrop fixed inset-0 z-[70] grid place-items-center bg-black/65 p-4">
      <div aria-labelledby="practice-session-completion-title" aria-modal="true" className="w-full max-w-md rounded-xl border border-sky-300/50 bg-zinc-900 p-5 shadow-2xl" onKeyDown={containCompletionFocus} ref={completionDialogRef} role="dialog">
        <h2 className="text-xl font-bold" id="practice-session-completion-title">Practice Complete</h2>
        <p className="mt-2 text-sm text-zinc-300">Choose what to do with this exercise.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button className="min-h-11 rounded bg-sky-500 px-4 font-semibold" onClick={() => advance("ADVANCE")} ref={completionPrimaryActionRef} type="button">{finalExercise ? "Finish Session" : "Next Exercise"}</button>
          <button className="min-h-11 rounded bg-zinc-800 px-4" onClick={keepPlaying} type="button">Keep Playing</button>
          <button className="min-h-11 rounded border border-zinc-600 px-4 sm:col-span-2" onClick={() => dispatch({ type: "END", ...scope, endedAt: now() })} type="button">End Session</button>
        </div>
        {bonusNotice?.token === run.activeExerciseToken && <p className="mt-3 text-sm text-amber-200" role="status">{bonusNotice.message}</p>}
      </div>
    </div>}
  </section>;
}

export function PracticeSessionSummary({ run, onBack }: Readonly<{ run: CompletedPracticeSessionRun; onBack: () => void }>) {
  useEffect(() => document.getElementById("practice-session-summary-title")?.focus(), []);
  return <PracticeSessionCompletedReport onBack={onBack} renderActions={(report) => <PracticeSessionPrintControls report={report} />} run={run} />;
}
