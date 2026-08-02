import { useCallback, useState } from "react";

import FeedbackVolumeControl from "@/components/audio/feedback-volume-control";
import InstrumentVolumeControl from "@/components/audio/instrument-volume-control";
import MidiStatus from "@/components/midi/midi-status";
import PianoKeyboard from "@/components/notation/piano-keyboard";
import { useMidi } from "@/hooks/use-midi";
import { playIncorrectFeedback, playSuccessChirp } from "@/lib/audio/feedback";
import { playGrandPianoNote } from "@/lib/audio/grand-piano";
import {
  getCurrentSequenceStepMidiNumbers,
  getSequenceTargetMidiNumbers,
  sequenceStepMatchesInput,
} from "@/lib/practice/sequence-validation";
import {
  applyCompletedSequence,
  applyIncorrectSequenceAttempt,
  INITIAL_SEQUENCE_STATS,
} from "@/lib/practice/sequence-stats";
import type { FeedbackState, PracticeClefMode } from "@/types/practice";

import {
  NEXT_SEQUENCE_DELAY_MS,
  PIANO_NOTE_DURATION_MS,
  SEQUENCE_TRANSITION_GRACE_MS,
  SUCCESS_CHIRP_DELAY_MS,
} from "../sequence-timing";

import { useSequenceAttempt } from "../hooks/use-sequence-attempt";
import { useSequenceSettings } from "../hooks/use-sequence-settings";
import { useSequenceTarget } from "../hooks/use-sequence-target";
import { useSequenceTransition } from "../hooks/use-sequence-transition";
import SequenceStats from "./sequence-stats";
import SequenceCard from "./sequence-card";
import SequenceControls from "./sequence-controls";

type AnswerSource = "midi" | "virtual" | "simulation";

type SequenceStepResult = "correct" | "incorrect";

type LastStepAnswer = Readonly<{
  midiNumbers: ReadonlySet<number>;
  result: SequenceStepResult;
}>;

type SequenceSessionProps = Readonly<{
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
}>;

export default function SequenceSession({
  isFocusMode,
  onToggleFocusMode,
}: SequenceSessionProps) {
  // Sequence configuration
  const {
    enabledArpeggios,
    enabledDirections,
    enabledIntervals,
    enabledNoteCategories,
    enabledScaleDirections,
    enabledScales,
    exerciseType,
    mode,
    setExerciseType,
    setMode,
    setShowTargetName,
    showTargetName,
    toggleArpeggio,
    toggleDirection,
    toggleInterval,
    toggleNoteCategory,
    toggleScale,
    toggleScaleDirection,
  } = useSequenceSettings();

  // Current sequence target
  const {
    generateNextTarget: generateSequenceTarget,
    getCurrentTarget,
    isSequenceTargetLocked,
    lockSequenceTarget,
    sequenceTarget,
    startedAt,
  } = useSequenceTarget({
    enabledArpeggios,
    enabledDirections,
    enabledIntervals,
    enabledNoteCategories,
    enabledScaleDirections,
    enabledScales,
    exerciseType,
    mode,
  });

  // Current attempt and step progress
  const {
    beginNextStep,
    completeCurrentStep,
    currentStepIndex,
    isWaitingForStep,
    resetAttempt,
    retrySequence,
    showCorrectFeedback,
    showIncorrectFeedback,
    state: sequenceAttemptState,
  } = useSequenceAttempt({
    sequenceTarget,
  });

  // Presentation state
  const [virtualHeldNotes, setVirtualHeldNotes] = useState<ReadonlySet<number>>(
    new Set(),
  );

  const [midiHeldNotes, setMidiHeldNotes] = useState<ReadonlySet<number>>(
    new Set(),
  );

  const [lastFailedAttemptNotes, setLastFailedAttemptNotes] = useState<
    ReadonlySet<number>
  >(new Set());

  const [feedback, setFeedback] = useState<FeedbackState>("idle");

  const [lastStepAnswer, setLastStepAnswer] = useState<LastStepAnswer | null>(
    null,
  );

  const [allowedLingeringMidiNumbers, setAllowedLingeringMidiNumbers] =
    useState<ReadonlySet<number>>(new Set());

  const [stats, setStats] = useState(INITIAL_SEQUENCE_STATS);

  // Sequence target transitions
  const generateNextSequence = useCallback(
    (nextMode?: PracticeClefMode) => {
      resetAttempt();

      setVirtualHeldNotes(new Set());
      setMidiHeldNotes(new Set());
      setLastFailedAttemptNotes(new Set());
      setLastStepAnswer(null);
      setFeedback("idle");
      setAllowedLingeringMidiNumbers(new Set());

      generateSequenceTarget(nextMode);
    },
    [generateSequenceTarget, resetAttempt],
  );

  // Timed transitions between steps and complete sequences
  const {
    clearTransition,
    startIncorrectStepTransition,
    startSequenceCompletionTransition,
    startStepTransition,
    updateMidiHeldNotes: updateTransitionMidiHeldNotes,
  } = useSequenceTransition({
    onAdvanceSequence: generateNextSequence,
    onAdvanceStep: beginNextStep,
    onRetrySequence: retrySequence,
    onSuccessFeedback: playSuccessChirp,
  });

  // Complete sequence handling
  const handleCompletedSequence = useCallback(
    (source: AnswerSource) => {
      if (!lockSequenceTarget()) {
        return;
      }

      clearTransition();

      const responseTimeMs = startedAt === 0 ? 0 : Date.now() - startedAt;

      setFeedback("correct");
      setLastFailedAttemptNotes(new Set());

      setStats((currentStats) =>
        applyCompletedSequence(currentStats, responseTimeMs),
      );

      startSequenceCompletionTransition({
        nextSequenceDelayMs: NEXT_SEQUENCE_DELAY_MS,
        successChirpDelayMs: SUCCESS_CHIRP_DELAY_MS,
        waitForMidiRelease: source === "midi",
      });
    },
    [
      clearTransition,
      lockSequenceTarget,
      startSequenceCompletionTransition,
      startedAt,
    ],
  );

  // Correct step handling
  const handleCorrectStep = useCallback(
    (midiNumbers: ReadonlySet<number>, source: AnswerSource) => {
      if (isSequenceTargetLocked() || !showCorrectFeedback()) {
        return;
      }

      setFeedback("correct");
      setLastFailedAttemptNotes(new Set());

      setLastStepAnswer({
        midiNumbers: new Set(midiNumbers),
        result: "correct",
      });

      const target = getCurrentTarget();

      const completedStepMidiNumbers = getCurrentSequenceStepMidiNumbers(
        target,
        currentStepIndex,
      );

      const result = completeCurrentStep();

      setAllowedLingeringMidiNumbers(completedStepMidiNumbers);

      window.setTimeout(() => {
        setAllowedLingeringMidiNumbers(new Set());
      }, SEQUENCE_TRANSITION_GRACE_MS);

      if (result.sequenceComplete) {
        handleCompletedSequence(source);
        return;
      }

      startStepTransition({
        stepDelayMs: 0,
        waitForMidiRelease: false,
      });
    },
    [
      completeCurrentStep,
      currentStepIndex,
      getCurrentTarget,
      handleCompletedSequence,
      isSequenceTargetLocked,
      showCorrectFeedback,
      startStepTransition,
    ],
  );

  // Incorrect step handling
  const handleIncorrectStep = useCallback(
    (midiNumbers: ReadonlySet<number>, source: AnswerSource) => {
      if (
        isSequenceTargetLocked() ||
        midiNumbers.size === 0 ||
        !showIncorrectFeedback()
      ) {
        return;
      }

      clearTransition();

      setFeedback("incorrect");
      playIncorrectFeedback();

      setLastFailedAttemptNotes(new Set(midiNumbers));

      setLastStepAnswer({
        midiNumbers: new Set(midiNumbers),
        result: "incorrect",
      });

      setStats((currentStats) => applyIncorrectSequenceAttempt(currentStats));

      setVirtualHeldNotes(new Set());
      setAllowedLingeringMidiNumbers(new Set());

      startIncorrectStepTransition({
        waitForMidiRelease: source === "midi",
      });
    },
    [
      clearTransition,
      isSequenceTargetLocked,
      showIncorrectFeedback,
      startIncorrectStepTransition,
    ],
  );

  // Shared step grading
  const gradeCurrentStep = useCallback(
    (midiNumbers: ReadonlySet<number>, source: AnswerSource) => {
      if (
        isSequenceTargetLocked() ||
        !isWaitingForStep() ||
        midiNumbers.size === 0
      ) {
        return;
      }

      const target = getCurrentTarget();

      const isCorrect = sequenceStepMatchesInput({
        allowedLingeringMidiNumbers,
        inputMidiNumbers: midiNumbers,
        sequenceTarget: target,
        stepIndex: currentStepIndex,
      });
      if (isCorrect) {
        handleCorrectStep(midiNumbers, source);
        return;
      }

      handleIncorrectStep(midiNumbers, source);
    },
    [
      allowedLingeringMidiNumbers,
      currentStepIndex,
      getCurrentTarget,
      handleCorrectStep,
      handleIncorrectStep,
      isSequenceTargetLocked,
      isWaitingForStep,
    ],
  );

  // MIDI input
  const handleMidiNotePlayed = useCallback(
    (midiNumber: number) => {
      if (isSequenceTargetLocked() || !isWaitingForStep()) {
        return;
      }

      setVirtualHeldNotes(new Set());
      setLastFailedAttemptNotes(new Set());
      setLastStepAnswer(null);
      setFeedback("idle");

      gradeCurrentStep(new Set([midiNumber]), "midi");
    },
    [gradeCurrentStep, isSequenceTargetLocked, isWaitingForStep],
  );

  const handleMidiHeldNotesChanged = useCallback(
    (heldNotes: ReadonlySet<number>) => {
      const nextHeldNotes = new Set(heldNotes);

      setMidiHeldNotes(nextHeldNotes);
      updateTransitionMidiHeldNotes(nextHeldNotes);
    },
    [updateTransitionMidiHeldNotes],
  );

  const { connectMidi, deviceName, error, status } = useMidi({
    onHeldNotesChanged: handleMidiHeldNotesChanged,
    onNotePlayed: handleMidiNotePlayed,
  });

  // Virtual keyboard input
  const handleVirtualNoteToggle = useCallback(
    (midiNumber: number) => {
      if (isSequenceTargetLocked() || !isWaitingForStep()) {
        return;
      }

      setLastFailedAttemptNotes(new Set());
      setLastStepAnswer(null);
      setFeedback("idle");

      playGrandPianoNote(midiNumber, PIANO_NOTE_DURATION_MS);

      /*
       * TODO(PianoKeyboard refactor):
       * Sequence Mode treats a click as a discrete
       * note attempt rather than a persistent selection.
       */
      setVirtualHeldNotes(new Set([midiNumber]));

      gradeCurrentStep(new Set([midiNumber]), "virtual");
    },
    [gradeCurrentStep, isSequenceTargetLocked, isWaitingForStep],
  );

  // Development simulation controls
  const handleSimulateCorrect = () => {
    const target = getCurrentTarget();

    const correctMidiNumbers = getCurrentSequenceStepMidiNumbers(
      target,
      currentStepIndex,
    );

    gradeCurrentStep(correctMidiNumbers, "simulation");
  };

  const handleSimulateIncorrect = () => {
    const target = getCurrentTarget();

    const targetMidiNumbers = getSequenceTargetMidiNumbers(target);

    let incorrectMidiNumber = 48;

    while (targetMidiNumbers.has(incorrectMidiNumber)) {
      incorrectMidiNumber += 1;
    }

    gradeCurrentStep(new Set([incorrectMidiNumber]), "simulation");
  };

  // Session controls
  const handleModeChange = (nextMode: PracticeClefMode) => {
    clearTransition();
    setMode(nextMode);
    generateNextSequence(nextMode);
  };

  const handleReset = () => {
    clearTransition();
    setStats(INITIAL_SEQUENCE_STATS);
    generateNextSequence();
  };

  // Derived display state
  const activeMidiNumbers = new Set([...virtualHeldNotes, ...midiHeldNotes]);

  const currentStepMidiNumbers = getCurrentSequenceStepMidiNumbers(
    sequenceTarget,
    currentStepIndex,
  );

  return (
    <div
      className={
        isFocusMode
          ? "focus-staff-mode fixed inset-0 z-50 flex w-full flex-col gap-4 overflow-auto bg-zinc-950 p-2 sm:p-5"
          : "mx-auto flex w-full max-w-7xl flex-col gap-6"
      }
    >
      {import.meta.env.DEV ? (
        <div
          className="rounded bg-zinc-900 px-3 py-2 text-xs text-zinc-300"
          hidden={isFocusMode}
        >
          State: {sequenceAttemptState} | Step: {currentStepIndex + 1}
        </div>
      ) : null}

      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="hidden text-sm font-semibold uppercase tracking-wider text-white/60 sm:block">
            Sequence trainer
          </p>

          <h1 className="text-xl font-bold text-white sm:mt-1 sm:text-3xl">
            Prelude: MIDI Mentor
          </h1>
        </div>

        <MidiStatus
          deviceName={deviceName}
          error={error}
          onConnect={() => {
            void connectMidi();
          }}
          status={status}
        />
      </header>

      <div className="practice-stage">
        <SequenceCard
          currentStepIndex={currentStepIndex}
          feedback={feedback}
          isFocusMode={isFocusMode}
          onCorrect={handleSimulateCorrect}
          onIncorrect={handleSimulateIncorrect}
          onToggleFocusMode={onToggleFocusMode}
          sequenceTarget={sequenceTarget}
          showTargetName={showTargetName}
        />

        <div hidden={isFocusMode}>
          <PianoKeyboard
            activeMidiNumbers={activeMidiNumbers}
            failedMidiNumbers={lastFailedAttemptNotes}
            lastAnswer={lastStepAnswer}
            onNoteToggle={handleVirtualNoteToggle}
            targetMidiNumbers={currentStepMidiNumbers}
          />
        </div>
      </div>

      <section
        className="relative -my-20 flex flex-col gap-6"
        hidden={isFocusMode}
      >
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-[1fr_2.4fr]">
          <div className="flex flex-col gap-4">
            <FeedbackVolumeControl />

            <InstrumentVolumeControl
              onReplayCorrectVirtualChordsChange={() => {
                // Sequence Mode does not currently replay chords.
              }}
              replayCorrectVirtualChords={false}
            />
          </div>

          <SequenceControls
            enabledArpeggios={enabledArpeggios}
            enabledDirections={enabledDirections}
            enabledIntervals={enabledIntervals}
            enabledNoteCategories={enabledNoteCategories}
            enabledScaleDirections={enabledScaleDirections}
            enabledScales={enabledScales}
            exerciseType={exerciseType}
            mode={mode}
            onArpeggioToggle={toggleArpeggio}
            onDirectionToggle={toggleDirection}
            onExerciseTypeChange={setExerciseType}
            onIntervalToggle={toggleInterval}
            onModeChange={handleModeChange}
            onNoteCategoryToggle={toggleNoteCategory}
            onReset={handleReset}
            onScaleToggle={toggleScale}
            onScaleDirectionToggle={toggleScaleDirection}
            onShowTargetNameChange={setShowTargetName}
            showTargetName={showTargetName}
          />
        </div>

        <SequenceStats stats={stats} />
      </section>
    </div>
  );
}
