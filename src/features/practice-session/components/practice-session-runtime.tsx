import { useEffect, useRef, useState, type Dispatch } from "react";
import EarTrainingSession from "@/features/ear-training/components/ear-training-session";
import FlashcardSession from "@/features/flashcards/components/flashcard-session";
import MelodySession, { type MelodySessionHandle } from "@/features/melody/components/melody-session";
import SequenceSession from "@/features/sequences/components/sequence-session";
import { useMobilePlay } from "@/hooks/use-mobile-play";
import {
  getPracticeSessionProgressText,
  getPracticeSessionRecordSummary,
  type ActivePracticeSessionRun,
  type CompletedPracticeSessionRun,
  type PracticeSessionRunEvent,
} from "../practice-session-runtime";

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
  const previousExerciseTokenRef = useRef(run.activeExerciseToken);
  const mobilePlay = useMobilePlay();
  const [bonusNotice, setBonusNotice] = useState<Readonly<{ token: string; message: string }> | null>(null);
  const entry = run.snapshot.exercises[run.activeExerciseIndex]!;
  const record = run.records[run.records.length - 1]!;
  const scope = { runId: run.runId, exerciseToken: run.activeExerciseToken, exerciseId: entry.id };
  const finalExercise = run.activeExerciseIndex === run.snapshot.exercises.length - 1;
  const hostedMobilePlay = { active: mobilePlay.isMobilePlayMode } as const;

  useEffect(() => {
    if (previousExerciseTokenRef.current === run.activeExerciseToken) return;
    previousExerciseTokenRef.current = run.activeExerciseToken;
    exerciseContextRef.current?.focus();
  }, [run.activeExerciseToken]);

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
    dispatch({ type: "KEEP_PLAYING", ...scope });
  };
  const unitCompleted = () => dispatch({ type: "UNIT_COMPLETED", ...scope });
  const targetReached = () => dispatch({ type: "TARGET_REACHED", ...scope });
  const exitMobilePlay = () => {
    mobilePlay.exitMobilePlay();
    window.setTimeout(() => mobilePlayEntryRef.current?.focus(), 0);
  };

  let engine: React.ReactNode;
  switch (entry.engine) {
    case "flashcards":
      engine = <FlashcardSession hostedMobilePlay={hostedMobilePlay} initialConfig={entry.config} isFocusMode={false} onPracticeUnitCompleted={unitCompleted} onToggleFocusMode={() => undefined} practiceSessionMode />;
      break;
    case "sequences":
      engine = <SequenceSession hostedMobilePlay={hostedMobilePlay} initialConfig={entry.config} isFocusMode={false} onPracticeUnitCompleted={unitCompleted} onScaleRepertoireCompleted={entry.target.kind === "complete-scale-repertoire" ? targetReached : undefined} onToggleFocusMode={() => undefined} practiceSessionMode />;
      break;
    case "ear-training":
      engine = <EarTrainingSession hostedMobilePlay={hostedMobilePlay} initialConfig={entry.config} onPracticeUnitCompleted={unitCompleted} practiceSessionMode />;
      break;
    case "melody":
      engine = <MelodySession hostedMobilePlay={hostedMobilePlay} initialConfig={entry.config} onPracticeTargetReached={targetReached} practiceSessionMode ref={melodyRef} />;
      break;
  }

  return <section aria-label="Active Practice Session" className={mobilePlay.isMobilePlayMode ? "practice-session-mobile-play mobile-play-mode fixed inset-0 z-50 grid w-full overflow-hidden bg-zinc-950 text-white" : "mx-auto w-full max-w-7xl space-y-4 text-white"}>
    <header className={mobilePlay.isMobilePlayMode ? "practice-session-mobile-play-strip border-b border-sky-400/30 bg-zinc-900 p-2" : "rounded-xl border border-sky-400/30 bg-zinc-900 p-3"}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <p className="truncate font-semibold">{run.snapshot.presetName}</p>
          <h1 className="text-sm font-normal text-zinc-300 focus:outline-none" ref={exerciseContextRef} tabIndex={-1}>Exercise {run.activeExerciseIndex + 1} of {run.snapshot.exercises.length} · {entry.label}</h1>
          <p className="text-sm text-zinc-300">{getPracticeSessionProgressText(entry, record.actual)}</p>
        </div>
        {!mobilePlay.isMobilePlayMode && <button className="practice-mobile-play-entry min-h-11 rounded border border-sky-400/50 px-3 font-semibold text-sky-100" onClick={mobilePlay.enterMobilePlay} ref={mobilePlayEntryRef} type="button">Mobile Play</button>}
        {run.completionPresentation === "practicing" && <button className="min-h-11 rounded bg-zinc-800 px-3" onClick={() => advance("SKIP")} type="button">Skip for Today</button>}
        <button className="min-h-11 rounded border border-zinc-600 px-3" onClick={() => dispatch({ type: "END", ...scope, endedAt: now() })} type="button">End Session</button>
        {mobilePlay.isMobilePlayMode && <button className="min-h-11 rounded border border-sky-400/60 px-3 font-semibold text-sky-100" onClick={exitMobilePlay} type="button">Exit Mobile Play</button>}
      </div>
      {run.completionPresentation === "target-complete" && <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
        <strong className="mr-auto">Practice Complete</strong>
        <button className="min-h-11 rounded bg-sky-500 px-4 font-semibold" onClick={() => advance("ADVANCE")} type="button">{finalExercise ? "Finish Session" : "Next Exercise"}</button>
        <button className="min-h-11 rounded bg-zinc-800 px-4" onClick={keepPlaying} type="button">Keep Playing</button>
      </div>}
      {run.completionPresentation === "bonus" && <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3"><span className="mr-auto">Target complete · Bonus practice</span><button className="min-h-11 rounded bg-sky-500 px-4 font-semibold" onClick={() => advance("ADVANCE")} type="button">{finalExercise ? "Finish Session" : "Next Exercise"}</button></div>}
      {bonusNotice?.token === run.activeExerciseToken && <p className="mt-2 text-sm text-amber-200" role="status">{bonusNotice.message}</p>}
    </header>
    <div className={mobilePlay.isMobilePlayMode ? "practice-session-mobile-play-engine min-h-0 overflow-hidden [&_button[aria-keyshortcuts]]:hidden" : "[&_button[aria-keyshortcuts]]:hidden"} key={`${run.runId}:${run.activeExerciseToken}`}>{engine}</div>
  </section>;
}

export function PracticeSessionSummary({ run, onBack }: Readonly<{ run: CompletedPracticeSessionRun; onBack: () => void }>) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return <section aria-labelledby="practice-session-summary-title" className="mx-auto w-full max-w-3xl rounded-xl border border-white/10 bg-white/5 p-5 text-white">
    <p className="text-sm text-zinc-400">{run.snapshot.presetName}</p>
    <h1 className="mt-1 text-2xl font-bold focus:outline-none" id="practice-session-summary-title" ref={headingRef} tabIndex={-1}>Practice session complete</h1>
    <ol className="mt-5 space-y-3">{run.records.map((record) => {
      const entry = run.snapshot.exercises[record.exerciseIndex]!;
      return <li className="rounded-lg bg-zinc-900 p-3" key={record.exerciseId}><strong>{record.label}</strong><p className="text-sm text-zinc-300">{getPracticeSessionRecordSummary(record, entry)}</p></li>;
    })}</ol>
    <button className="mt-5 min-h-11 rounded bg-sky-500 px-4 font-semibold" onClick={onBack} type="button">Back to Practice Sessions</button>
  </section>;
}
