import { useCallback, useState } from "react";

import InstrumentVolumeControl from "@/components/audio/instrument-volume-control";
import FeedbackVolumeControl from "@/components/audio/feedback-volume-control";
import PracticeCard from "@/components/flashcards/practice-card";
import PracticeControls from "@/components/flashcards/practice-controls";
import PracticeStats from "@/components/flashcards/practice-stats";
import MidiStatus from "@/components/midi/midi-status";
import PianoKeyboard from "@/components/notation/piano-keyboard";

import { useCorrectAnswerSequence } from "@/features/flashcards/hooks/use-correct-answer-sequence";
import { useFlashcardSettings } from "@/features/flashcards/hooks/use-flashcard-settings";
import { useFlashcardTarget } from "@/features/flashcards/hooks/use-flashcard-target";
import { useMidiChordAttempt } from "@/features/flashcards/hooks/use-midi-chord-attempt";
import {
  CHORD_ATTEMPT_GRACE_MS,
  NEXT_TARGET_DELAY_MS,
  PIANO_NOTE_DURATION_MS,
  SUCCESS_CHIRP_DELAY_MS,
  VIRTUAL_CHORD_NEXT_TARGET_DELAY_MS,
  VIRTUAL_CHORD_REPLAY_DELAY_MS,
  VIRTUAL_CHORD_SUCCESS_CHIRP_DELAY_MS,
} from "@/features/flashcards/flashcard-timing";

import { useMidi } from "@/hooks/use-midi";

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

type LastAnswer = Readonly<{
  midiNumbers: ReadonlySet<number>;
  result: "correct" | "incorrect";
}>;

type AnswerSource = "midi" | "virtual" | "simulation";

export default function FlashcardSession() {
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

  // Current practice target
  const {
    generateNextTarget: generateTarget,
    getCurrentTarget,
    isAnswerLocked,
    lockAnswer,
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

  // MIDI chord-attempt lifecycle
  const {
    addNoteToAttempt: addNoteToMidiAttempt,
    attemptNotes: midiAttemptNotes,
    clearAttempt: clearMidiAttempt,
    isAttemptActive: isMidiAttemptActive,
    startAttempt: startMidiAttempt,
  } = useMidiChordAttempt(CHORD_ATTEMPT_GRACE_MS);

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

  const handleCorrectAnswer = useCallback(
    (midiNumbers: ReadonlySet<number>, source: AnswerSource) => {
      if (!lockAnswer()) {
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
      lockAnswer,
      replayCorrectVirtualChords,
      startCorrectAnswerSequence,
      startedAt,
    ],
  );

  // Incorrect-answer handling
  const handleSingleIncorrectAnswer = useCallback(
    (midiNumber: number) => {
      if (isAnswerLocked()) {
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
    [isAnswerLocked],
  );

  const handleFailedChordAttempt = useCallback(
    (midiNumbers: ReadonlySet<number>) => {
      if (isAnswerLocked() || midiNumbers.size === 0) {
        return;
      }

      setFeedback("incorrect");
      playIncorrectFeedback();
      setLastAnswer(null);

      setLastFailedAttemptNotes(new Set(midiNumbers));

      setStats(applyIncorrectAttempt);
    },
    [isAnswerLocked],
  );

  // MIDI input
  const finalizeMidiAttempt = useCallback(
    (completedAttempt: ReadonlySet<number>) => {
      if (isAnswerLocked() || completedAttempt.size === 0) {
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
      isAnswerLocked,
    ],
  );

  const handleStartMidiAttempt = useCallback(
    (midiNumber: number) => {
      setVirtualHeldNotes(new Set());
      setLastFailedAttemptNotes(new Set());
      setLastAnswer(null);
      setFeedback("idle");

      startMidiAttempt(midiNumber, finalizeMidiAttempt);
    },
    [finalizeMidiAttempt, startMidiAttempt],
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
      if (isAnswerLocked()) {
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
      isAnswerLocked,
    ],
  );

  // Virtual keyboard input
  const handleVirtualNoteToggle = useCallback(
    (midiNumber: number) => {
      if (isAnswerLocked()) {
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
      isAnswerLocked,
    ],
  );

  const { connectMidi, deviceName, error, status } = useMidi({
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
    clearCorrectAnswerSequence();
    setMode(nextMode);
    generateNextTarget(nextMode);
  };

  const handleReset = () => {
    clearCorrectAnswerSequence();
    setStats(INITIAL_PRACTICE_STATS);
    generateNextTarget();
  };

  // Derived display state
  const activeMidiNumbers = new Set([
    ...virtualHeldNotes,
    ...midiAttemptNotes,
    ...midiHeldNotes,
  ]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="hidden text-sm font-semibold uppercase tracking-wider text-white/60 sm:block">
            Sight-reading trainer
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
        <PracticeCard
          feedback={feedback}
          practiceTarget={practiceTarget}
          showTargetName={showTargetName}
          onCorrect={handleSimulateCorrect}
          onIncorrect={handleSimulateIncorrect}
        />

        <PianoKeyboard
          activeMidiNumbers={activeMidiNumbers}
          failedMidiNumbers={lastFailedAttemptNotes}
          lastAnswer={lastAnswer}
          targetMidiNumbers={getTargetMidiNumbers(practiceTarget)}
          onNoteToggle={handleVirtualNoteToggle}
        />
      </div>

      {/* TODO(v1): Remove temporary negative margin after final page layout pass. */}
      <section className="relative -my-72 flex flex-col gap-6">
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.4fr]">
          <InstrumentVolumeControl
            replayCorrectVirtualChords={replayCorrectVirtualChords}
            onReplayCorrectVirtualChordsChange={setReplayCorrectVirtualChords}
          />

          <FeedbackVolumeControl />
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
        </div>

        <PracticeStats stats={stats} />
      </section>
    </div>
  );
}
