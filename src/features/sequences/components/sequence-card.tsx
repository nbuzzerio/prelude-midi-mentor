import MusicStaff from "@/components/notation/music-staff";
import FocusStaffControl from "@/components/notation/focus-staff-control";
import PracticeSimulationControls from "@/components/practice-simulation-controls";
import type {
  FeedbackState,
  SequenceExerciseType,
  SequenceTarget,
} from "@/types/practice";

type SequenceCardProps = Readonly<{
  currentStepIndex: number;
  exerciseType: SequenceExerciseType;
  feedback: FeedbackState;
  isFocusMode: boolean;
  isMobilePlayMode?: boolean;
  sequenceTarget: SequenceTarget;
  showTargetName: boolean;
  onCorrect: () => void;
  onIncorrect: () => void;
  onEnterMobilePlay?: () => void;
  onToggleFocusMode: () => void;
}>;

const FEEDBACK_MESSAGES: Record<FeedbackState, string> = {
  idle: "Play the highlighted note.",
  correct: "Correct!",
  incorrect: "Try again.",
};

export default function SequenceCard({
  currentStepIndex,
  exerciseType,
  feedback,
  isFocusMode,
  isMobilePlayMode = false,
  onCorrect,
  onIncorrect,
  onEnterMobilePlay,
  onToggleFocusMode,
  sequenceTarget,
  showTargetName,
}: SequenceCardProps) {
  const currentStepName = sequenceTarget.steps[currentStepIndex]?.name;

  return (
    <section
      aria-label="Current sequence exercise"
      className="relative flex min-h-0 flex-col justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 sm:gap-4 sm:p-5"
    >
      <div className="absolute left-3 top-3 rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-white/60">
        Step {currentStepIndex + 1} of {sequenceTarget.steps.length}
      </div>

      <div hidden={isFocusMode || isMobilePlayMode}>
        <PracticeSimulationControls
          onCorrect={onCorrect}
          onIncorrect={onIncorrect}
        />
      </div>

      <div
        className="absolute bottom-3 right-3 z-20"
        hidden={isMobilePlayMode}
      >
        <FocusStaffControl
          isFocusMode={isFocusMode}
          onToggle={onToggleFocusMode}
        />

        {!isFocusMode && onEnterMobilePlay ? (
          <button
            className="ml-2 rounded-lg border border-sky-400/50 bg-zinc-950/90 px-3 py-2 text-sm font-semibold text-sky-100 shadow-sm hover:bg-sky-400/15"
            onClick={onEnterMobilePlay}
            type="button"
          >
            Mobile Play
          </button>
        ) : null}
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
          {feedback === "idle" && exerciseType === "chord-progressions"
            ? "Play the highlighted chord."
            : FEEDBACK_MESSAGES[feedback]}
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

            {exerciseType === "chord-progressions" && currentStepName ? (
              <div className="mt-2">
                <p className="text-base font-bold text-white">
                  {currentStepName.primary}
                </p>

                {currentStepName.secondary ? (
                  <p className="mt-0.5 text-sm font-medium text-white/60">
                    {currentStepName.secondary}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <MusicStaff
        currentStepIndex={currentStepIndex}
        isFocusMode={isFocusMode}
        isMobilePlayMode={isMobilePlayMode}
        sequenceTarget={sequenceTarget}
      />
    </section>
  );
}
