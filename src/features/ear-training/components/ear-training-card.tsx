import { getIntervalLabel, type MusicalInterval } from "@/lib/music/intervals";
import type { EarTrainingPromptState } from "../hooks/use-ear-training-prompt";
import type { EarTrainingTarget } from "../ear-training-types";

type Props = Readonly<{
  canReplay: boolean;
  answerIntervals: ReadonlySet<MusicalInterval>;
  feedback: "idle" | "correct" | "incorrect";
  onAnswer: (answer: MusicalInterval) => void;
  onPlayPrompt: () => void;
  promptState: EarTrainingPromptState;
  target: EarTrainingTarget;
  wrongAnswers: ReadonlySet<MusicalInterval>;
}>;

export default function EarTrainingCard({ answerIntervals, canReplay, feedback, onAnswer, onPlayPrompt, promptState, target, wrongAnswers }: Props) {
  const hasHeard = promptState === "heard";
  const status = promptState === "playing"
    ? "Playing interval prompt."
    : promptState === "failed"
      ? "Audio could not start. Tap Play Prompt to try again."
      : feedback === "correct"
        ? `Correct: ${target.direction} ${getIntervalLabel(target.interval).toLowerCase()}.`
        : feedback === "incorrect"
          ? "Try again."
          : "Listen to the interval.";

  return <section aria-label="Ear Training prompt" className="ear-training-card flex min-h-0 flex-col justify-center gap-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
    <div className="text-center">
      <p aria-live="polite" role="status" className="text-base font-semibold text-white/80">{status}</p>
      <button className="mt-4 rounded-lg bg-sky-500 px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={!canReplay || feedback === "correct"} onClick={onPlayPrompt} type="button">
        {promptState !== "ready" || wrongAnswers.size > 0 ? "Replay Prompt" : "Play Prompt"}
      </button>
    </div>

    {feedback === "correct" ? <p className="text-center text-xl font-bold text-green-400">{target.direction === "ascending" ? "Ascending" : "Descending"} {getIntervalLabel(target.interval).toLowerCase()}</p> : null}

    <div aria-label="Interval answers" className="ear-training-answer-grid grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {[...answerIntervals].map((interval) => {
        const isWrong = wrongAnswers.has(interval);
        const isCorrect = feedback === "correct" && interval === target.interval;
        return <button
          aria-pressed={isCorrect}
          className={`rounded-lg border px-3 py-3 text-sm font-semibold ${isCorrect ? "border-green-400 bg-green-500/20 text-green-200" : isWrong ? "border-red-400 bg-red-500/20 text-red-200" : "border-white/15 bg-white/5 text-white"}`}
          disabled={!hasHeard || !canReplay || feedback === "correct" || isWrong}
          key={interval}
          onClick={() => onAnswer(interval)}
          type="button"
        >{getIntervalLabel(interval)}</button>;
      })}
    </div>
  </section>;
}
