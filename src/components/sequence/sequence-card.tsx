import MusicStaff from "@/components/notation/music-staff";
import PracticeSimulationControls from "@/components/practice-simulation-controls";
import type { FeedbackState, SequenceTarget } from "@/types/practice";

type SequenceCardProps = Readonly<{
  currentStepIndex: number;
  feedback: FeedbackState;
  sequenceTarget: SequenceTarget;
  showTargetName: boolean;
  onCorrect: () => void;
  onIncorrect: () => void;
}>;

const FEEDBACK_MESSAGES: Record<FeedbackState, string> = {
  idle: "Play the highlighted note.",
  correct: "Correct!",
  incorrect: "Try again.",
};

export default function SequenceCard({
  currentStepIndex,
  feedback,
  onCorrect,
  onIncorrect,
  sequenceTarget,
  showTargetName,
}: SequenceCardProps) {
  return (
    <section
      aria-label="Current sequence exercise"
      className="relative flex min-h-0 flex-col justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 sm:gap-4 sm:p-5"
    >
      <div className="absolute left-3 top-3 rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-white/60">
        Step {currentStepIndex + 1} of {sequenceTarget.steps.length}
      </div>

      <PracticeSimulationControls
        onCorrect={onCorrect}
        onIncorrect={onIncorrect}
      />

      <div className="px-20 text-center">
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

        {showTargetName ? (
          <div className="mt-2">
            <p className="text-lg font-bold text-white">
              {sequenceTarget.name.primary}
            </p>

            {sequenceTarget.name.secondary ? (
              <p className="mt-0.5 text-sm font-medium text-white/60">
                {sequenceTarget.name.secondary}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <MusicStaff
        currentStepIndex={currentStepIndex}
        sequenceTarget={sequenceTarget}
      />
    </section>
  );
}
