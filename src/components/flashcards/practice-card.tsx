import MusicStaff from "@/components/notation/music-staff";
import type { FeedbackState, PracticeTarget } from "@/types/practice";

type PracticeCardProps = Readonly<{
  feedback: FeedbackState;
  practiceTarget: PracticeTarget;
  showTargetName: boolean;
  onCorrect: () => void;
  onIncorrect: () => void;
}>;

const FEEDBACK_MESSAGES: Record<FeedbackState, string> = {
  idle: "Play the target shown below.",
  correct: "Correct!",
  incorrect: "Try again.",
};

export default function PracticeCard({
  feedback,
  practiceTarget,
  showTargetName,
  onCorrect,
  onIncorrect,
}: PracticeCardProps) {
  return (
    <section className="flex min-h-0 flex-col justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 sm:gap-4 sm:p-5">
      <div className="text-center">
        <p
          aria-live="polite"
          className={`text-sm font-semibold ${
            feedback === "correct"
              ? "text-green-400"
              : feedback === "incorrect"
                ? "text-red-400"
                : "text-white/60"
          }`}
        >
          {FEEDBACK_MESSAGES[feedback]}
        </p>

        {showTargetName && (
          <div className="mt-2">
            <p className="text-lg font-bold text-white">
              {practiceTarget.name.primary}
            </p>

            {practiceTarget.name.secondary && (
              <p className="mt-0.5 text-sm font-medium text-white/60">
                {practiceTarget.name.secondary}
              </p>
            )}
          </div>
        )}
      </div>

      <MusicStaff practiceTarget={practiceTarget} />

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
