import { useRef, useState, type Dispatch } from "react";
import EarTrainingSession from "@/features/ear-training/components/ear-training-session";
import FlashcardSession from "@/features/flashcards/components/flashcard-session";
import MelodySession, { type MelodySessionHandle } from "@/features/melody/components/melody-session";
import SequenceSession from "@/features/sequences/components/sequence-session";
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
  const [bonusNotice, setBonusNotice] = useState<Readonly<{ token: string; message: string }> | null>(null);
  const entry = run.snapshot.exercises[run.activeExerciseIndex]!;
  const record = run.records[run.records.length - 1]!;
  const scope = { runId: run.runId, exerciseToken: run.activeExerciseToken, exerciseId: entry.id };
  const finalExercise = run.activeExerciseIndex === run.snapshot.exercises.length - 1;

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

  let engine: React.ReactNode;
  switch (entry.engine) {
    case "flashcards":
      engine = <FlashcardSession initialConfig={entry.config} isFocusMode={false} onPracticeUnitCompleted={unitCompleted} onToggleFocusMode={() => undefined} practiceSessionMode />;
      break;
    case "sequences":
      engine = <SequenceSession initialConfig={entry.config} isFocusMode={false} onPracticeUnitCompleted={unitCompleted} onScaleRepertoireCompleted={entry.target.kind === "complete-scale-repertoire" ? targetReached : undefined} onToggleFocusMode={() => undefined} practiceSessionMode />;
      break;
    case "ear-training":
      engine = <EarTrainingSession initialConfig={entry.config} onPracticeUnitCompleted={unitCompleted} practiceSessionMode />;
      break;
    case "melody":
      engine = <MelodySession initialConfig={entry.config} onPracticeTargetReached={targetReached} practiceSessionMode ref={melodyRef} />;
      break;
  }

  return <section aria-label="Active Practice Session" className="mx-auto w-full max-w-7xl space-y-4 text-white">
    <header className="rounded-xl border border-sky-400/30 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <p className="truncate font-semibold">{run.snapshot.presetName}</p>
          <p className="text-sm text-zinc-300">Exercise {run.activeExerciseIndex + 1} of {run.snapshot.exercises.length} · {entry.label}</p>
          <p className="text-sm text-zinc-300">{getPracticeSessionProgressText(entry, record.actual)}</p>
        </div>
        {run.completionPresentation === "practicing" && <button className="min-h-11 rounded bg-zinc-800 px-3" onClick={() => advance("SKIP")} type="button">Skip for Today</button>}
        <button className="min-h-11 rounded border border-zinc-600 px-3" onClick={() => dispatch({ type: "END", ...scope, endedAt: now() })} type="button">End Session</button>
      </div>
      {run.completionPresentation === "target-complete" && <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
        <strong className="mr-auto">Practice Complete</strong>
        <button className="min-h-11 rounded bg-sky-500 px-4 font-semibold" onClick={() => advance("ADVANCE")} type="button">{finalExercise ? "Finish Session" : "Next Exercise"}</button>
        <button className="min-h-11 rounded bg-zinc-800 px-4" onClick={keepPlaying} type="button">Keep Playing</button>
      </div>}
      {run.completionPresentation === "bonus" && <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3"><span className="mr-auto">Target complete · Bonus practice</span><button className="min-h-11 rounded bg-sky-500 px-4 font-semibold" onClick={() => advance("ADVANCE")} type="button">{finalExercise ? "Finish Session" : "Next Exercise"}</button></div>}
      {bonusNotice?.token === run.activeExerciseToken && <p className="mt-2 text-sm text-amber-200" role="status">{bonusNotice.message}</p>}
    </header>
    <div className="[&_button[aria-keyshortcuts]]:hidden" key={`${run.runId}:${run.activeExerciseToken}`}>{engine}</div>
  </section>;
}

export function PracticeSessionSummary({ run, onBack }: Readonly<{ run: CompletedPracticeSessionRun; onBack: () => void }>) {
  return <section aria-labelledby="practice-session-summary-title" className="mx-auto w-full max-w-3xl rounded-xl border border-white/10 bg-white/5 p-5 text-white">
    <p className="text-sm text-zinc-400">{run.snapshot.presetName}</p>
    <h1 className="mt-1 text-2xl font-bold" id="practice-session-summary-title">Practice session complete</h1>
    <ol className="mt-5 space-y-3">{run.records.map((record) => {
      const entry = run.snapshot.exercises[record.exerciseIndex]!;
      return <li className="rounded-lg bg-zinc-900 p-3" key={record.exerciseId}><strong>{record.label}</strong><p className="text-sm text-zinc-300">{getPracticeSessionRecordSummary(record, entry)}</p></li>;
    })}</ol>
    <button className="mt-5 min-h-11 rounded bg-sky-500 px-4 font-semibold" onClick={onBack} type="button">Back to Practice Sessions</button>
  </section>;
}
