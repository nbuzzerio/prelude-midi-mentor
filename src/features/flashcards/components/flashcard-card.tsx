import MusicStaff from "@/components/notation/music-staff";
import FocusStaffControl from "@/components/notation/focus-staff-control";
import PracticeSimulationControls from "@/components/practice-simulation-controls";
import type { FeedbackState, PracticeTarget } from "@/types/practice";

type FlashcardCardProps = Readonly<{
  completedCount: number;
  feedback: FeedbackState;
  isFocusMode: boolean;
  isMobilePlayMode?: boolean;
  practiceTarget: PracticeTarget;
  showTargetName: boolean;
  onCorrect: () => void;
  onIncorrect: () => void;
  onEnterMobilePlay?: () => void;
  onToggleFocusMode: () => void;
}>;

const FEEDBACK_MESSAGES: Record<FeedbackState, string> = {
  idle: "Play the target shown below.",
  correct: "Correct!",
  incorrect: "Try again.",
};

export default function FlashcardCard({
  completedCount,
  feedback,
  isFocusMode,
  isMobilePlayMode = false,
  practiceTarget,
  showTargetName,
  onCorrect,
  onIncorrect,
  onEnterMobilePlay,
  onToggleFocusMode,
}: FlashcardCardProps) {
  return (
    <section className="relative flex min-h-0 flex-col justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 sm:gap-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
        Completed: {completedCount}
      </p>

      <div hidden={isFocusMode || isMobilePlayMode}>
        <PracticeSimulationControls
          onCorrect={onCorrect}
          onIncorrect={onIncorrect}
        />
      </div>

      <div className="flashcard-task-actions flex flex-wrap justify-end gap-2" hidden={isMobilePlayMode}>
        <FocusStaffControl
          isFocusMode={isFocusMode}
          onToggle={onToggleFocusMode}
        />

        {!isFocusMode && onEnterMobilePlay ? (
          <button
            className="practice-mobile-play-entry rounded-lg border border-sky-400/50 bg-zinc-950/90 px-3 py-2 text-sm font-semibold text-sky-100 shadow-sm hover:bg-sky-400/15"
            onClick={onEnterMobilePlay}
            type="button"
          >
            Mobile Play
          </button>
        ) : null}
      </div>

      <div className="px-2 text-center sm:px-20">
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
        isMobilePlayMode={isMobilePlayMode}
        practiceTarget={practiceTarget}
      />
    </section>
  );
}
