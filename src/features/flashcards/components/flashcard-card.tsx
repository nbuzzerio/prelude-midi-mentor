import MusicStaff from "@/components/notation/music-staff";
import FocusStaffControl from "@/components/notation/focus-staff-control";
import PracticeSimulationControls from "@/components/practice-simulation-controls";
import type { FeedbackState, PracticeTarget } from "@/types/practice";

type FlashcardCardProps = Readonly<{
  feedback: FeedbackState;
  isFocusMode: boolean;
  practiceTarget: PracticeTarget;
  showTargetName: boolean;
  onCorrect: () => void;
  onIncorrect: () => void;
  onToggleFocusMode: () => void;
}>;

const FEEDBACK_MESSAGES: Record<FeedbackState, string> = {
  idle: "Play the target shown below.",
  correct: "Correct!",
  incorrect: "Try again.",
};

export default function FlashcardCard({
  feedback,
  isFocusMode,
  practiceTarget,
  showTargetName,
  onCorrect,
  onIncorrect,
  onToggleFocusMode,
}: FlashcardCardProps) {
  return (
    <section className="relative flex min-h-0 flex-col justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 sm:gap-4 sm:p-5">
      <div hidden={isFocusMode}>
        <PracticeSimulationControls
          onCorrect={onCorrect}
          onIncorrect={onIncorrect}
        />
      </div>

      <div className="absolute bottom-3 right-3 z-20">
        <FocusStaffControl
          isFocusMode={isFocusMode}
          onToggle={onToggleFocusMode}
        />
      </div>

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
              {practiceTarget.name.primary}
            </p>

            {practiceTarget.name.secondary ? (
              <p className="mt-0.5 text-sm font-medium text-white/60">
                {practiceTarget.name.secondary}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <MusicStaff
        isFocusMode={isFocusMode}
        practiceTarget={practiceTarget}
      />
    </section>
  );
}
