import MusicStaff from "@/components/notation/music-staff";
import FocusStaffControl from "@/components/notation/focus-staff-control";
import PracticeSimulationControls from "@/components/practice-simulation-controls";
import type {
  FeedbackState,
  SequenceExerciseType,
  SequenceTarget,
} from "@/types/practice";
import { getSequenceMeasureWindow } from "../sequence-measure-window";

type SequenceCardProps = Readonly<{
  currentStepIndex: number;
  exerciseType: SequenceExerciseType;
  feedback: FeedbackState;
  isFocusMode: boolean;
  isMobilePlayMode?: boolean;
  showWholeSequence: boolean;
  sequenceTarget: SequenceTarget;
  showTargetName: boolean;
  onCorrect: () => void;
  onIncorrect: () => void;
  onEnterMobilePlay?: () => void;
  onToggleFocusMode: () => void;
  onShowWholeSequenceChange: (showWholeSequence: boolean) => void;
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
  onShowWholeSequenceChange,
  sequenceTarget,
  showWholeSequence,
  showTargetName,
}: SequenceCardProps) {
  const currentStepName = sequenceTarget.steps[currentStepIndex]?.name;
  const measureWindow = getSequenceMeasureWindow(
    sequenceTarget,
    currentStepIndex,
  );
  const firstVisibleStepIndex = showWholeSequence
    ? 0
    : measureWindow.firstGlobalStepIndex;
  const lastVisibleStepIndex = showWholeSequence
    ? sequenceTarget.steps.length - 1
    : measureWindow.lastGlobalStepIndex;

  return (
    <section
      aria-label="Current sequence exercise"
      className="relative flex min-h-0 flex-col justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 sm:gap-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-white/60">
        <div className="flex flex-wrap gap-2 uppercase tracking-wider">
          <span className="rounded-full bg-zinc-900 px-2.5 py-1">
            Measure {measureWindow.currentMeasureIndex + 1} of {measureWindow.measureCount}
          </span>
          <span className="rounded-full bg-zinc-900 px-2.5 py-1">
            Step {currentStepIndex + 1} of {sequenceTarget.steps.length}
          </span>
        </div>

        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm normal-case tracking-normal text-white">
          <input
            checked={showWholeSequence}
            className="size-4 accent-sky-400"
            onChange={(event) =>
              onShowWholeSequenceChange(event.target.checked)
            }
            type="checkbox"
          />
          Show whole sequence
        </label>
      </div>

      <div hidden={isFocusMode || isMobilePlayMode}>
        <PracticeSimulationControls
          onCorrect={onCorrect}
          onIncorrect={onIncorrect}
        />
      </div>

      <div className="sequence-task-actions flex flex-wrap justify-end gap-2" hidden={isMobilePlayMode}>
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
        firstVisibleStepIndex={firstVisibleStepIndex}
        isFocusMode={isFocusMode}
        isMobilePlayMode={isMobilePlayMode}
        lastVisibleStepIndex={lastVisibleStepIndex}
        sequenceTarget={sequenceTarget}
        showWholeSequence={showWholeSequence}
      />
    </section>
  );
}
