import { useCallback, useEffect, useRef, useState } from "react";

import InstrumentVolumeControl from "@/components/audio/instrument-volume-control";
import FeedbackVolumeControl from "@/components/audio/feedback-volume-control";
import MidiStatus from "@/components/midi/midi-status";
import PianoKeyboard from "@/components/notation/piano-keyboard";
import { MobileDisclosure } from "@/components/layout/mobile-disclosure";

import { useCorrectAnswerSequence } from "@/features/flashcards/hooks/use-correct-answer-sequence";
import { useFlashcardSettings } from "@/features/flashcards/hooks/use-flashcard-settings";
import { useFlashcardTarget } from "@/features/flashcards/hooks/use-flashcard-target";
import {
  CHORD_ATTEMPT_GRACE_MS,
  useChordAttempt,
} from "@/hooks/use-chord-attempt";
import {
  NEXT_TARGET_DELAY_MS,
  PIANO_NOTE_DURATION_MS,
  SUCCESS_CHIRP_DELAY_MS,
  VIRTUAL_CHORD_NEXT_TARGET_DELAY_MS,
  VIRTUAL_CHORD_REPLAY_DELAY_MS,
  VIRTUAL_CHORD_SUCCESS_CHIRP_DELAY_MS,
} from "@/features/flashcards/flashcard-timing";

import { useAppMidiInput } from "@/hooks/use-app-midi-input";
import { useMobilePlay } from "@/hooks/use-mobile-play";

import { playIncorrectFeedback, playSuccessChirp } from "@/lib/audio/feedback";
import {
  playGrandPianoChord,
  playGrandPianoNote,
} from "@/lib/audio/grand-piano";
import {
  getTargetMidiNumbers,
  notesMatchTarget,
} from "@/lib/practice/answer-validation";
import {
  applyCorrectAttempt,
  applyIncorrectAttempt,
  INITIAL_PRACTICE_STATS,
} from "@/lib/practice/session-stats";

import type { FeedbackState, PracticeClefMode } from "@/types/practice";
import FlashcardCard from "./flashcard-card";
import PracticeControls from "./practice-controls";
import PracticeStats from "./practice-stats";

type LastAnswer = Readonly<{
  midiNumbers: ReadonlySet<number>;
  result: "correct" | "incorrect";
}>;

type AnswerSource = "midi" | "virtual" | "simulation";

type FlashcardSessionProps = Readonly<{
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
}>;

export default function FlashcardSession({
  isFocusMode,
  onToggleFocusMode,
}: FlashcardSessionProps) {
  const { enterMobilePlay, exitMobilePlay, isMobilePlayMode } =
    useMobilePlay();
  // Practice configuration
  const {
    enabledExerciseTypes,
    enabledNoteCategories,
    enabledTriadPositions,
    enabledTriadQualities,
    mode,
    replayCorrectVirtualChords,
    setMode,
    setReplayCorrectVirtualChords,
    setShowTargetName,
    showTargetName,
    toggleExerciseType,
    toggleNoteCategory,
    toggleTriadPosition,
    toggleTriadQuality,
  } = useFlashcardSettings();

  const generationSettingsRef = useRef({
    enabledExerciseTypes,
    enabledNoteCategories,
    enabledTriadPositions,
    enabledTriadQualities,
    mode,
  });

  // Current practice target
  const {
    generateNextTarget: generateTarget,
    getCurrentTarget,
    isFlashcardTargetLocked,
    lockFlashcardTarget,
    practiceTarget,
    startedAt,
  } = useFlashcardTarget({
    enabledExerciseTypes,
    enabledNoteCategories,
    enabledTriadPositions,
    enabledTriadQualities,
    mode,
  });

  // Session presentation state
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

  const [stats, setStats] = useState(INITIAL_PRACTICE_STATS);

  const [lastAnswer, setLastAnswer] = useState<LastAnswer | null>(null);

  const finalizeMidiAttemptRef = useRef<
    (midiNumbers: ReadonlySet<number>) => void
  >(() => {});

  // MIDI chord-attempt lifecycle
  const {
    addNoteToAttempt: addNoteToMidiAttempt,
    attemptNotes: midiAttemptNotes,
    clearAttempt: clearMidiAttempt,
    isAttemptActive: isMidiAttemptActive,
    startAttempt: startMidiAttempt,
  } = useChordAttempt({
    gracePeriodMs: CHORD_ATTEMPT_GRACE_MS,
    onComplete: (midiNumbers) => finalizeMidiAttemptRef.current(midiNumbers),
  });

  // Target transitions
  const generateNextTarget = useCallback(
    (nextMode?: PracticeClefMode) => {
      clearMidiAttempt();

      setVirtualHeldNotes(new Set());
      setLastFailedAttemptNotes(new Set());
      setFeedback("idle");
      setLastAnswer(null);

      generateTarget(nextMode);
    },
    [clearMidiAttempt, generateTarget],
  );

  // Correct-answer lifecycle
  const {
    clearSequence: clearCorrectAnswerSequence,
    startSequence: startCorrectAnswerSequence,
    updateMidiHeldNotes: updateCorrectAnswerMidiHeldNotes,
  } = useCorrectAnswerSequence({
    onAdvance: generateNextTarget,
    onSuccessFeedback: playSuccessChirp,
  });

  useEffect(() => {
    const previousSettings = generationSettingsRef.current;

    const settingsChanged =
      previousSettings.mode !== mode ||
      previousSettings.enabledExerciseTypes !== enabledExerciseTypes ||
      previousSettings.enabledNoteCategories !== enabledNoteCategories ||
      previousSettings.enabledTriadQualities !== enabledTriadQualities ||
      previousSettings.enabledTriadPositions !== enabledTriadPositions;

    generationSettingsRef.current = {
      enabledExerciseTypes,
      enabledNoteCategories,
      enabledTriadPositions,
      enabledTriadQualities,
      mode,
    };

    if (!settingsChanged) {
      return;
    }

    clearCorrectAnswerSequence();
    generateNextTarget();
  }, [
    clearCorrectAnswerSequence,
    enabledExerciseTypes,
    enabledNoteCategories,
    enabledTriadPositions,
    enabledTriadQualities,
    generateNextTarget,
    mode,
  ]);

  const handleCorrectAnswer = useCallback(
    (midiNumbers: ReadonlySet<number>, source: AnswerSource) => {
      if (!lockFlashcardTarget()) {
        return;
      }

      clearMidiAttempt();
      clearCorrectAnswerSequence();

      const responseTimeMs = startedAt === 0 ? 0 : Date.now() - startedAt;

      const shouldReplayVirtualChord =
        source === "virtual" &&
        midiNumbers.size > 1 &&
        replayCorrectVirtualChords;

      const successChirpDelayMs = shouldReplayVirtualChord
        ? VIRTUAL_CHORD_SUCCESS_CHIRP_DELAY_MS
        : SUCCESS_CHIRP_DELAY_MS;

      const nextTargetDelayMs = shouldReplayVirtualChord
        ? VIRTUAL_CHORD_NEXT_TARGET_DELAY_MS
        : NEXT_TARGET_DELAY_MS;

      setFeedback("correct");

      if (shouldReplayVirtualChord) {
        window.setTimeout(() => {
          playGrandPianoChord(midiNumbers, PIANO_NOTE_DURATION_MS);
        }, VIRTUAL_CHORD_REPLAY_DELAY_MS);
      }

      setVirtualHeldNotes(new Set());
      setLastFailedAttemptNotes(new Set());

      setLastAnswer({
        midiNumbers: new Set(midiNumbers),
        result: "correct",
      });

      setStats((currentStats) =>
        applyCorrectAttempt(currentStats, responseTimeMs),
      );

      startCorrectAnswerSequence({
        nextTargetDelayMs,
        successChirpDelayMs,
        waitForMidiRelease: source === "midi",
      });
    },
    [
      clearCorrectAnswerSequence,
      clearMidiAttempt,
      lockFlashcardTarget,
      replayCorrectVirtualChords,
      startCorrectAnswerSequence,
      startedAt,
    ],
  );

  // Incorrect-answer handling
  const handleSingleIncorrectAnswer = useCallback(
    (midiNumber: number) => {
      if (isFlashcardTargetLocked()) {
        return;
      }

      setFeedback("incorrect");
      playIncorrectFeedback();
      setLastFailedAttemptNotes(new Set());

      setLastAnswer({
        midiNumbers: new Set([midiNumber]),
        result: "incorrect",
      });

      setStats(applyIncorrectAttempt);
    },
    [isFlashcardTargetLocked],
  );

  const handleFailedChordAttempt = useCallback(
    (midiNumbers: ReadonlySet<number>) => {
      if (isFlashcardTargetLocked() || midiNumbers.size === 0) {
        return;
      }

      setFeedback("incorrect");
      playIncorrectFeedback();
      setLastAnswer(null);

      setLastFailedAttemptNotes(new Set(midiNumbers));

      setStats(applyIncorrectAttempt);
    },
    [isFlashcardTargetLocked],
  );

  // MIDI input
  const finalizeMidiAttempt = useCallback(
    (completedAttempt: ReadonlySet<number>) => {
      if (isFlashcardTargetLocked() || completedAttempt.size === 0) {
        return;
      }

      const currentTarget = getCurrentTarget();

      if (notesMatchTarget(completedAttempt, currentTarget)) {
        handleCorrectAnswer(completedAttempt, "midi");

        return;
      }

      handleFailedChordAttempt(completedAttempt);
    },
    [
      handleCorrectAnswer,
      handleFailedChordAttempt,
      getCurrentTarget,
      isFlashcardTargetLocked,
    ],
  );

  useEffect(() => {
    finalizeMidiAttemptRef.current = finalizeMidiAttempt;
  }, [finalizeMidiAttempt]);

  const handleStartMidiAttempt = useCallback(
    (midiNumber: number) => {
      setVirtualHeldNotes(new Set());
      setLastFailedAttemptNotes(new Set());
      setLastAnswer(null);
      setFeedback("idle");

      startMidiAttempt(midiNumber);
    },
    [startMidiAttempt],
  );

  const handleMidiHeldNotesChanged = useCallback(
    (heldNotes: ReadonlySet<number>) => {
      const nextHeldNotes = new Set(heldNotes);

      setMidiHeldNotes(nextHeldNotes);
      updateCorrectAnswerMidiHeldNotes(nextHeldNotes);
    },
    [updateCorrectAnswerMidiHeldNotes],
  );

  const handleMidiNotePlayed = useCallback(
    (midiNumber: number) => {
      if (isFlashcardTargetLocked()) {
        return;
      }

      const currentTarget = getCurrentTarget();

      const targetMidiNumbers = getTargetMidiNumbers(currentTarget);

      if (currentTarget.notes.length === 1) {
        if (targetMidiNumbers.has(midiNumber)) {
          handleCorrectAnswer(new Set([midiNumber]), "midi");

          return;
        }

        handleSingleIncorrectAnswer(midiNumber);

        return;
      }

      if (!isMidiAttemptActive()) {
        handleStartMidiAttempt(midiNumber);
        return;
      }

      addNoteToMidiAttempt(midiNumber);
    },
    [
      addNoteToMidiAttempt,
      handleCorrectAnswer,
      handleSingleIncorrectAnswer,
      handleStartMidiAttempt,
      isMidiAttemptActive,
      getCurrentTarget,
      isFlashcardTargetLocked,
    ],
  );

  // Virtual keyboard input
  const handleVirtualNoteToggle = useCallback(
    (midiNumber: number) => {
      if (isFlashcardTargetLocked()) {
        return;
      }

      const currentTarget = getCurrentTarget();

      const targetMidiNumbers = getTargetMidiNumbers(currentTarget);

      if (currentTarget.notes.length === 1) {
        playGrandPianoNote(midiNumber, PIANO_NOTE_DURATION_MS);

        if (targetMidiNumbers.has(midiNumber)) {
          handleCorrectAnswer(new Set([midiNumber]), "virtual");

          return;
        }

        handleSingleIncorrectAnswer(midiNumber);

        return;
      }

      clearMidiAttempt();
      setLastAnswer(null);
      setFeedback("idle");

      setVirtualHeldNotes((currentNotes) => {
        if (currentNotes.size === 0) {
          setLastFailedAttemptNotes(new Set());
        }

        const nextNotes = new Set(currentNotes);

        if (nextNotes.has(midiNumber)) {
          nextNotes.delete(midiNumber);
        } else {
          nextNotes.add(midiNumber);

          playGrandPianoNote(midiNumber, PIANO_NOTE_DURATION_MS);
        }

        if (notesMatchTarget(nextNotes, currentTarget)) {
          handleCorrectAnswer(nextNotes, "virtual");
        }

        return nextNotes;
      });
    },
    [
      clearMidiAttempt,
      handleCorrectAnswer,
      handleSingleIncorrectAnswer,
      getCurrentTarget,
      isFlashcardTargetLocked,
    ],
  );

  const { connectMidi, deviceName, error, status } = useAppMidiInput({
    onHeldNotesChanged: handleMidiHeldNotesChanged,
    onNotePlayed: handleMidiNotePlayed,
  });

  // Development simulation controls
  const handleSimulateCorrect = () => {
    const currentTarget = getCurrentTarget();

    handleCorrectAnswer(getTargetMidiNumbers(currentTarget), "simulation");
  };

  const handleSimulateIncorrect = () => {
    const currentTarget = getCurrentTarget();

    const targetMidiNumbers = getTargetMidiNumbers(currentTarget);

    let incorrectMidiNumber = 48;

    while (targetMidiNumbers.has(incorrectMidiNumber)) {
      incorrectMidiNumber += 1;
    }

    if (currentTarget.notes.length === 1) {
      handleSingleIncorrectAnswer(incorrectMidiNumber);

      return;
    }

    const simulatedAttempt = new Set(
      currentTarget.notes
        .slice(0, Math.max(0, currentTarget.notes.length - 1))
        .map((note) => note.midiNumber),
    );

    simulatedAttempt.add(incorrectMidiNumber);

    setVirtualHeldNotes(new Set());
    clearMidiAttempt();

    handleFailedChordAttempt(simulatedAttempt);
  };

  // Session controls
  const handleModeChange = (nextMode: PracticeClefMode) => {
    setMode(nextMode);
  };

  const handleReset = () => {
    clearCorrectAnswerSequence();
    setStats(INITIAL_PRACTICE_STATS);
    generateNextTarget();
  };

  const handleEnterMobilePlay = () => {
    if (isFocusMode) {
      onToggleFocusMode();
    }

    enterMobilePlay();
  };

  const handleToggleFocusMode = () => {
    if (isMobilePlayMode) {
      exitMobilePlay();
    }

    onToggleFocusMode();
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
    ...midiAttemptNotes,
    ...midiHeldNotes,
  ]);
  const isMobilePlayActive = isMobilePlayMode && !isFocusMode;

  return (
    <div
      className={
        isMobilePlayActive
          ? "mobile-play-mode fixed inset-0 z-50 grid w-full overflow-hidden bg-zinc-950"
          : isFocusMode
          ? "focus-staff-mode fixed inset-0 z-50 flex w-full flex-col gap-4 overflow-auto bg-zinc-950 p-2 sm:p-5"
          : "flashcard-session mx-auto flex w-full max-w-7xl flex-col gap-3 sm:gap-6"
      }
    >
      <header
        className="flashcard-header flex items-center justify-between gap-2 sm:gap-4"
        hidden={isMobilePlayActive}
      >
        <div className="min-w-0">
          <p className="hidden text-sm font-semibold uppercase tracking-wider text-white/60 sm:block">
            Sight-reading trainer
          </p>

          <h1 className="truncate text-lg font-bold text-white sm:mt-1 sm:text-3xl">
            <span className="sm:hidden">Prelude · Flashcards</span>
            <span className="hidden sm:inline">Prelude: MIDI Mentor</span>
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

      <div className="practice-stage flashcard-practice-stage">
        <FlashcardCard
          feedback={feedback}
          isFocusMode={isFocusMode}
          isMobilePlayMode={isMobilePlayActive}
          onEnterMobilePlay={handleEnterMobilePlay}
          practiceTarget={practiceTarget}
          showTargetName={showTargetName}
          onCorrect={handleSimulateCorrect}
          onIncorrect={handleSimulateIncorrect}
          onToggleFocusMode={handleToggleFocusMode}
        />

        <div className="mobile-play-keyboard-region" hidden={isFocusMode}>
          <PianoKeyboard
            activeMidiNumbers={activeMidiNumbers}
            failedMidiNumbers={lastFailedAttemptNotes}
            lastAnswer={lastAnswer}
            targetMidiNumbers={getTargetMidiNumbers(practiceTarget)}
            onNoteToggle={handleVirtualNoteToggle}
          />
        </div>
      </div>

      <section
        className="flashcard-secondary flex flex-col gap-3 sm:gap-6"
        hidden={isFocusMode || isMobilePlayActive}
      >
        <div className="grid items-start gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-[1fr_2.4fr]">
          <MobileDisclosure className="flashcard-sound-disclosure" title="Sound & Feedback">
            <div className="flex flex-col gap-3 sm:gap-4">
            <FeedbackVolumeControl />

            <InstrumentVolumeControl
              replayCorrectVirtualChords={replayCorrectVirtualChords}
              onReplayCorrectVirtualChordsChange={setReplayCorrectVirtualChords}
            />
            </div>
          </MobileDisclosure>

          <MobileDisclosure title="Practice Settings">
            <PracticeControls
              enabledExerciseTypes={enabledExerciseTypes}
              enabledNoteCategories={enabledNoteCategories}
              enabledTriadPositions={enabledTriadPositions}
              enabledTriadQualities={enabledTriadQualities}
              mode={mode}
              showTargetName={showTargetName}
              onModeChange={handleModeChange}
              onReset={handleReset}
              onShowTargetNameChange={setShowTargetName}
              onExerciseTypeToggle={toggleExerciseType}
              onNoteCategoryToggle={toggleNoteCategory}
              onTriadPositionToggle={toggleTriadPosition}
              onTriadQualityToggle={toggleTriadQuality}
            />
          </MobileDisclosure>
        </div>

        <PracticeStats stats={stats} />
      </section>
    </div>
  );
}
