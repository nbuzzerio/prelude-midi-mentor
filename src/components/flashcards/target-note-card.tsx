import MusicStaff from "@/components/notation/music-staff";
import type { FeedbackState, TargetNote } from "@/types/practice";

type TargetNoteCardProps = Readonly<{
  feedback: FeedbackState;
  targetNote: TargetNote;
  onCorrect: () => void;
  onIncorrect: () => void;
}>;

const FEEDBACK_MESSAGES: Record<FeedbackState, string> = {
  idle: "Play the note shown below.",
  correct: "Correct!",
  incorrect: "Try again.",
};

export default function TargetNoteCard({
  feedback,
  targetNote,
  onCorrect,
  onIncorrect,
}: TargetNoteCardProps) {
  return (
    <section className="flex min-h-0 flex-col justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 sm:gap-4 sm:p-5">
      <p
        aria-live="polite"
        className={`text-center text-sm font-semibold ${
          feedback === "correct"
            ? "text-green-400"
            : feedback === "incorrect"
              ? "text-red-400"
              : "text-white/60"
        }`}
      >
        {FEEDBACK_MESSAGES[feedback]}
      </p>

      <MusicStaff targetNote={targetNote} />

      <div className="practice-simulation-controls grid grid-cols-2 gap-3">
        <button
          className="rounded-xl bg-green-700 px-4 py-3 font-semibold text-white hover:bg-green-600"
          onClick={onCorrect}
          type="button"
        >
          Simulate correct
        </button>

        <button
          className="rounded-xl bg-red-800 px-4 py-3 font-semibold text-white hover:bg-red-700"
          onClick={onIncorrect}
          type="button"
        >
          Simulate incorrect
        </button>
      </div>
    </section>
  );
}
