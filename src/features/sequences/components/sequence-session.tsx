import { useCallback, useEffect, useRef, useState } from "react";

import FeedbackVolumeControl from "@/components/audio/feedback-volume-control";
import InstrumentVolumeControl from "@/components/audio/instrument-volume-control";
import MidiStatus from "@/components/midi/midi-status";
import PianoKeyboard from "@/components/notation/piano-keyboard";
import { useAppMidiInput } from "@/hooks/use-app-midi-input";
import { useMobilePlay } from "@/hooks/use-mobile-play";
import {
  CHORD_ATTEMPT_GRACE_MS,
  useChordAttempt,
} from "@/hooks/use-chord-attempt";
import { playIncorrectFeedback, playSuccessChirp } from "@/lib/audio/feedback";
import {
  playGrandPianoChord,
  playGrandPianoNote,
} from "@/lib/audio/grand-piano";
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
  const { enterMobilePlay, exitMobilePlay, isMobilePlayMode } =
    useMobilePlay();
  // Sequence configuration
  const {
    enabledArpeggios,
    enabledChordProgressionKeyIds,
    enabledChordProgressionTemplateIds,
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
    toggleChordProgressionKey,
    toggleChordProgressionTemplate,
    toggleDirection,
    toggleInterval,
    toggleNoteCategory,
    toggleScale,
    toggleScaleDirection,
  } = useSequenceSettings();

  const generationSettingsRef = useRef({
    enabledArpeggios,
    enabledChordProgressionKeyIds,
    enabledChordProgressionTemplateIds,
    enabledDirections,
    enabledIntervals,
    enabledNoteCategories,
    enabledScaleDirections,
    enabledScales,
    exerciseType,
    mode,
  });

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
    enabledChordProgressionKeyIds,
    enabledChordProgressionTemplateIds,
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
  const [showWholeSequence, setShowWholeSequence] = useState(false);

  const midiHeldNotesRef = useRef<ReadonlySet<number>>(new Set());
  const virtualHeldNotesRef = useRef<ReadonlySet<number>>(new Set());
  const midiAttemptAllowedLingeringRef = useRef<ReadonlySet<number>>(new Set());
  const finalizeMidiChordAttemptRef = useRef<
    (midiNumbers: ReadonlySet<number>) => void
  >(() => {});
  const {
    addNoteToAttempt: addNoteToMidiChordAttempt,
    attemptNotes: midiChordAttemptNotes,
    clearAttempt: clearMidiChordAttempt,
    isAttemptActive: isMidiChordAttemptActive,
    startAttempt: startMidiChordAttempt,
  } = useChordAttempt({
    gracePeriodMs: CHORD_ATTEMPT_GRACE_MS,
    onComplete: (midiNumbers) =>
      finalizeMidiChordAttemptRef.current(midiNumbers),
  });
  const clearVirtualSelection = useCallback(() => {
    virtualHeldNotesRef.current = new Set();
    setVirtualHeldNotes(new Set());
  }, []);

  const clearInputAttempts = useCallback(() => {
    clearMidiChordAttempt();
    clearVirtualSelection();
    midiAttemptAllowedLingeringRef.current = new Set();
  }, [clearMidiChordAttempt, clearVirtualSelection]);

  useEffect(
    () => () => {
      virtualHeldNotesRef.current = new Set();
    },
    [],
  );

  // Sequence target transitions
  const generateNextSequence = useCallback(
    (nextMode?: PracticeClefMode) => {
      clearInputAttempts();
      resetAttempt();

      setMidiHeldNotes(new Set());
      midiHeldNotesRef.current = new Set();
      setLastFailedAttemptNotes(new Set());
      setLastStepAnswer(null);
      setFeedback("idle");
      setAllowedLingeringMidiNumbers(new Set());

      generateSequenceTarget(nextMode);
    },
    [clearInputAttempts, generateSequenceTarget, resetAttempt],
  );

  const prepareSequenceRetry = useCallback(() => {
    clearVirtualSelection();
    return retrySequence();
  }, [clearVirtualSelection, retrySequence]);

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
    onRetrySequence: prepareSequenceRetry,
    onSuccessFeedback: playSuccessChirp,
  });

  useEffect(() => {
    const previousSettings = generationSettingsRef.current;

    const settingsChanged =
      previousSettings.mode !== mode ||
      previousSettings.exerciseType !== exerciseType ||
      previousSettings.enabledDirections !== enabledDirections ||
      previousSettings.enabledIntervals !== enabledIntervals ||
      previousSettings.enabledNoteCategories !== enabledNoteCategories ||
      previousSettings.enabledScales !== enabledScales ||
      previousSettings.enabledScaleDirections !== enabledScaleDirections ||
      previousSettings.enabledArpeggios !== enabledArpeggios ||
      previousSettings.enabledChordProgressionKeyIds !==
        enabledChordProgressionKeyIds ||
      previousSettings.enabledChordProgressionTemplateIds !==
        enabledChordProgressionTemplateIds;

    generationSettingsRef.current = {
      enabledArpeggios,
      enabledChordProgressionKeyIds,
      enabledChordProgressionTemplateIds,
      enabledDirections,
      enabledIntervals,
      enabledNoteCategories,
      enabledScaleDirections,
      enabledScales,
      exerciseType,
      mode,
    };

    if (!settingsChanged) {
      return;
    }

    clearTransition();
    generateNextSequence();
  }, [
    clearTransition,
    enabledArpeggios,
    enabledChordProgressionKeyIds,
    enabledChordProgressionTemplateIds,
    enabledDirections,
    enabledIntervals,
    enabledNoteCategories,
    enabledScaleDirections,
    enabledScales,
    exerciseType,
    generateNextSequence,
    mode,
  ]);

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

      clearInputAttempts();

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
      clearInputAttempts,
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
      clearInputAttempts();

      setFeedback("incorrect");
      playIncorrectFeedback();

      setLastFailedAttemptNotes(new Set(midiNumbers));

      setLastStepAnswer({
        midiNumbers: new Set(midiNumbers),
        result: "incorrect",
      });

      setStats((currentStats) => applyIncorrectSequenceAttempt(currentStats));

      setAllowedLingeringMidiNumbers(new Set());

      startIncorrectStepTransition({
        waitForMidiRelease: source === "midi",
      });
    },
    [
      clearTransition,
      clearInputAttempts,
      isSequenceTargetLocked,
      showIncorrectFeedback,
      startIncorrectStepTransition,
    ],
  );

  // Shared step grading
  const gradeCurrentStep = useCallback(
    (
      midiNumbers: ReadonlySet<number>,
      source: AnswerSource,
      allowedLingeringForAttempt = allowedLingeringMidiNumbers,
    ) => {
      if (
        isSequenceTargetLocked() ||
        !isWaitingForStep() ||
        midiNumbers.size === 0
      ) {
        return;
      }

      const target = getCurrentTarget();

      const isCorrect = sequenceStepMatchesInput({
        allowedLingeringMidiNumbers: allowedLingeringForAttempt,
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
  const finalizeMidiChordAttempt = useCallback(
    (collectedMidiNumbers: ReadonlySet<number>) => {
      const completedAttempt = new Set([
        ...collectedMidiNumbers,
        ...midiHeldNotesRef.current,
      ]);

      gradeCurrentStep(
        completedAttempt,
        "midi",
        midiAttemptAllowedLingeringRef.current,
      );
    },
    [gradeCurrentStep],
  );
  useEffect(() => {
    finalizeMidiChordAttemptRef.current = finalizeMidiChordAttempt;
  }, [finalizeMidiChordAttempt]);

  const handleMidiNotePlayed = useCallback(
    (midiNumber: number) => {
      if (isSequenceTargetLocked() || !isWaitingForStep()) {
        return;
      }

      clearVirtualSelection();
      setLastFailedAttemptNotes(new Set());
      setLastStepAnswer(null);
      setFeedback("idle");

      const target = getCurrentTarget();
      const currentStep = target.steps[currentStepIndex];

      if ((currentStep?.notes.length ?? 0) > 1) {
        if (isMidiChordAttemptActive()) {
          addNoteToMidiChordAttempt(midiNumber);
        } else {
          midiAttemptAllowedLingeringRef.current =
            allowedLingeringMidiNumbers;
          startMidiChordAttempt(midiNumber);
        }

        return;
      }

      gradeCurrentStep(new Set([midiNumber]), "midi");
    },
    [
      currentStepIndex,
      allowedLingeringMidiNumbers,
      getCurrentTarget,
      gradeCurrentStep,
      isSequenceTargetLocked,
      isWaitingForStep,
      addNoteToMidiChordAttempt,
      clearVirtualSelection,
      isMidiChordAttemptActive,
      startMidiChordAttempt,
    ],
  );

  const handleMidiHeldNotesChanged = useCallback(
    (heldNotes: ReadonlySet<number>) => {
      const nextHeldNotes = new Set(heldNotes);

      midiHeldNotesRef.current = nextHeldNotes;
      setMidiHeldNotes(nextHeldNotes);
      updateTransitionMidiHeldNotes(nextHeldNotes);
    },
    [updateTransitionMidiHeldNotes],
  );

  const { connectMidi, deviceName, error, status } = useAppMidiInput({
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

      const target = getCurrentTarget();
      const currentStep = target.steps[currentStepIndex];

      if ((currentStep?.notes.length ?? 0) > 1) {
        clearMidiChordAttempt();
        const nextSelection = new Set(virtualHeldNotesRef.current);

        if (nextSelection.has(midiNumber)) {
          nextSelection.delete(midiNumber);
        } else {
          nextSelection.add(midiNumber);
        }

        virtualHeldNotesRef.current = nextSelection;

        if (nextSelection.size < currentStep.notes.length) {
          setVirtualHeldNotes(nextSelection);
          return;
        }

        const completedSelection = new Set(nextSelection);

        clearVirtualSelection();
        playGrandPianoChord(completedSelection, PIANO_NOTE_DURATION_MS);
        gradeCurrentStep(completedSelection, "virtual");

        return;
      }

      playGrandPianoNote(midiNumber, PIANO_NOTE_DURATION_MS);
      virtualHeldNotesRef.current = new Set([midiNumber]);
      setVirtualHeldNotes(new Set([midiNumber]));

      gradeCurrentStep(new Set([midiNumber]), "virtual");
    },
    [
      currentStepIndex,
      getCurrentTarget,
      gradeCurrentStep,
      isSequenceTargetLocked,
      isWaitingForStep,
      clearMidiChordAttempt,
      clearVirtualSelection,
    ],
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
    setMode(nextMode);
  };

  const handleReset = () => {
    clearTransition();
    setStats(INITIAL_SEQUENCE_STATS);
    generateNextSequence();
  };

  const handleToggleFocusMode = () => {
    if (isMobilePlayMode) {
      exitMobilePlay();
    }

    if (!isFocusMode) {
      clearVirtualSelection();
    }

    onToggleFocusMode();
  };

  const handleEnterMobilePlay = () => {
    if (isFocusMode) {
      onToggleFocusMode();
    }

    enterMobilePlay();
  };

  useEffect(() => {
    if (!isFocusMode || !isMobilePlayMode) {
      return;
    }

    const cleanupTimer = window.setTimeout(exitMobilePlay, 0);

    return () => {
      window.clearTimeout(cleanupTimer);
    };
  }, [exitMobilePlay, isFocusMode, isMobilePlayMode]);

  // Derived display state
  const activeMidiNumbers = new Set([
    ...virtualHeldNotes,
    ...midiChordAttemptNotes,
    ...midiHeldNotes,
  ]);

  const currentStepMidiNumbers = getCurrentSequenceStepMidiNumbers(
    sequenceTarget,
    currentStepIndex,
  );
  const isMobilePlayActive = isMobilePlayMode && !isFocusMode;

  return (
    <div
      className={
        isMobilePlayActive
          ? "mobile-play-mode fixed inset-0 z-50 grid w-full overflow-hidden bg-zinc-950"
          : isFocusMode
          ? "focus-staff-mode fixed inset-0 z-50 flex w-full flex-col gap-4 overflow-auto bg-zinc-950 p-2 sm:p-5"
          : "mx-auto flex w-full max-w-7xl flex-col gap-6"
      }
    >
      {import.meta.env.DEV ? (
        <div
          className="rounded bg-zinc-900 px-3 py-2 text-xs text-zinc-300"
          hidden={isFocusMode || isMobilePlayActive}
        >
          State: {sequenceAttemptState} | Step: {currentStepIndex + 1}
        </div>
      ) : null}

      <header
        className="flex items-center justify-between gap-4"
        hidden={isMobilePlayActive}
      >
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

      {isMobilePlayActive ? (
        <>
          <button
            className="mobile-play-exit rounded-lg border border-sky-400/60 bg-zinc-950/95 px-3 py-2 text-sm font-semibold text-sky-100 shadow-lg"
            onClick={exitMobilePlay}
            type="button"
          >
            Exit Mobile Play
          </button>

        </>
      ) : null}

      <div className="practice-stage">
        <SequenceCard
          completedCount={stats.completed}
          currentStepIndex={currentStepIndex}
          exerciseType={exerciseType}
          feedback={feedback}
          isFocusMode={isFocusMode}
          isMobilePlayMode={isMobilePlayActive}
          onEnterMobilePlay={handleEnterMobilePlay}
          onCorrect={handleSimulateCorrect}
          onIncorrect={handleSimulateIncorrect}
          onToggleFocusMode={handleToggleFocusMode}
          onShowWholeSequenceChange={setShowWholeSequence}
          sequenceTarget={sequenceTarget}
          showWholeSequence={showWholeSequence}
          showTargetName={showTargetName}
        />

        <div className="mobile-play-keyboard-region" hidden={isFocusMode}>
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
        className="flex flex-col gap-6"
        hidden={isFocusMode || isMobilePlayActive}
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
            enabledChordProgressionKeyIds={enabledChordProgressionKeyIds}
            enabledChordProgressionTemplateIds={
              enabledChordProgressionTemplateIds
            }
            enabledDirections={enabledDirections}
            enabledIntervals={enabledIntervals}
            enabledNoteCategories={enabledNoteCategories}
            enabledScaleDirections={enabledScaleDirections}
            enabledScales={enabledScales}
            exerciseType={exerciseType}
            mode={mode}
            onArpeggioToggle={toggleArpeggio}
            onChordProgressionKeyToggle={toggleChordProgressionKey}
            onChordProgressionTemplateToggle={
              toggleChordProgressionTemplate
            }
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
