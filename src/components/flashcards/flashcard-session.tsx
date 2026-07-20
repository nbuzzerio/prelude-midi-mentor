import { useCallback, useEffect, useRef, useState } from "react";
import PracticeCard from "@/components/flashcards/practice-card";
import InstrumentVolumeControl from "@/components/audio/instrument-volume-control";
import PracticeControls from "@/components/flashcards/practice-controls";
import PracticeStats from "@/components/flashcards/practice-stats";
import MidiStatus from "@/components/midi/midi-status";
import PianoKeyboard from "@/components/notation/piano-keyboard";
import { useMidi } from "@/hooks/use-midi";
import { playSuccessChirp, playIncorrectFeedback } from "@/lib/audio/feedback";
import {
  playGrandPianoChord,
  playGrandPianoNote,
  preloadGrandPianoSamples,
} from "@/lib/audio/grand-piano";
import { generatePracticeTarget } from "@/lib/music/notes";
import type {
  FeedbackState,
  PracticeClefMode,
  PracticeExerciseType,
  PracticeNoteCategory,
  PracticeStats as PracticeStatsType,
  PracticeTarget,
} from "@/types/practice";
import FeedbackVolumeControl from "../audio/feedback-volume-control";

type LastAnswer = Readonly<{
  midiNumbers: ReadonlySet<number>;
  result: "correct" | "incorrect";
}>;

type AnswerSource = "midi" | "virtual" | "simulation";

const CHORD_ATTEMPT_GRACE_MS = 225;

const PIANO_NOTE_DURATION_MS = 850;
const SUCCESS_CHIRP_DELAY_MS = 900;
const NEXT_TARGET_DELAY_MS = 1_250;

const VIRTUAL_CHORD_REPLAY_DELAY_MS = 900;
const VIRTUAL_CHORD_SUCCESS_CHIRP_DELAY_MS =
  VIRTUAL_CHORD_REPLAY_DELAY_MS + SUCCESS_CHIRP_DELAY_MS;
const VIRTUAL_CHORD_NEXT_TARGET_DELAY_MS =
  VIRTUAL_CHORD_SUCCESS_CHIRP_DELAY_MS + 350;

const INITIAL_STATS: PracticeStatsType = {
  correct: 0,
  incorrect: 0,
  streak: 0,
  totalResponseTimeMs: 0,
};

const INITIAL_PRACTICE_TARGET: PracticeTarget = {
  clef: "bass",
  notes: [
    {
      midiNumber: 48,
      name: "C",
      octave: 3,
    },
  ],
};

function notesMatchTarget(
  playedNotes: ReadonlySet<number>,
  practiceTarget: PracticeTarget,
): boolean {
  if (playedNotes.size !== practiceTarget.notes.length) {
    return false;
  }

  return practiceTarget.notes.every((note) => playedNotes.has(note.midiNumber));
}

function getTargetMidiNumbers(
  practiceTarget: PracticeTarget,
): ReadonlySet<number> {
  return new Set(practiceTarget.notes.map((note) => note.midiNumber));
}

export default function FlashcardSession() {
  const [mode, setMode] = useState<PracticeClefMode>("bass");

  const [replayCorrectVirtualChords, setReplayCorrectVirtualChords] =
    useState(true);

  const [enabledExerciseTypes, setEnabledExerciseTypes] = useState<
    ReadonlySet<PracticeExerciseType>
  >(new Set(["notes"]));

  const [enabledNoteCategories, setEnabledNoteCategories] = useState<
    ReadonlySet<PracticeNoteCategory>
  >(new Set(["naturals"]));

  const [practiceTarget, setPracticeTarget] = useState<PracticeTarget>(
    INITIAL_PRACTICE_TARGET,
  );

  const [virtualHeldNotes, setVirtualHeldNotes] = useState<ReadonlySet<number>>(
    new Set(),
  );

  const [midiHeldNotes, setMidiHeldNotes] = useState<ReadonlySet<number>>(
    new Set(),
  );

  const [midiAttemptNotes, setMidiAttemptNotes] = useState<ReadonlySet<number>>(
    new Set(),
  );

  const [lastFailedAttemptNotes, setLastFailedAttemptNotes] = useState<
    ReadonlySet<number>
  >(new Set());

  const [feedback, setFeedback] = useState<FeedbackState>("idle");

  const [stats, setStats] = useState<PracticeStatsType>(INITIAL_STATS);

  const [lastAnswer, setLastAnswer] = useState<LastAnswer | null>(null);

  const [startedAt, setStartedAt] = useState(0);

  const answerLockedRef = useRef(false);
  const practiceTargetRef = useRef(practiceTarget);

  const midiHeldNotesRef = useRef<Set<number>>(new Set());

  const midiAttemptNotesRef = useRef<Set<number>>(new Set());

  const midiAttemptActiveRef = useRef(false);

  const midiAttemptTimerRef = useRef<number | null>(null);

  const successChirpTimerRef = useRef<number | null>(null);
  const correctFeedbackTimerRef = useRef<number | null>(null);

  const correctFeedbackReadyRef = useRef(false);
  const waitingForMidiReleaseRef = useRef(false);

  const generateNextTargetRef = useRef<(nextMode?: PracticeClefMode) => void>(
    () => undefined,
  );

  useEffect(() => {
    preloadGrandPianoSamples();
  }, []);

  useEffect(() => {
    practiceTargetRef.current = practiceTarget;
  }, [practiceTarget]);

  const clearMidiAttempt = useCallback(() => {
    if (midiAttemptTimerRef.current !== null) {
      window.clearTimeout(midiAttemptTimerRef.current);

      midiAttemptTimerRef.current = null;
    }

    midiAttemptActiveRef.current = false;
    midiAttemptNotesRef.current = new Set();

    setMidiAttemptNotes(new Set());
  }, []);

  const clearCorrectFeedbackTimers = useCallback(() => {
    if (successChirpTimerRef.current !== null) {
      window.clearTimeout(successChirpTimerRef.current);

      successChirpTimerRef.current = null;
    }

    if (correctFeedbackTimerRef.current !== null) {
      window.clearTimeout(correctFeedbackTimerRef.current);

      correctFeedbackTimerRef.current = null;
    }

    correctFeedbackReadyRef.current = false;
    waitingForMidiReleaseRef.current = false;
  }, []);

  const tryAdvanceAfterCorrectAnswer = useCallback(() => {
    if (!correctFeedbackReadyRef.current) {
      return;
    }

    if (waitingForMidiReleaseRef.current && midiHeldNotesRef.current.size > 0) {
      return;
    }

    correctFeedbackTimerRef.current = null;
    correctFeedbackReadyRef.current = false;
    waitingForMidiReleaseRef.current = false;

    generateNextTargetRef.current();
  }, []);

  useEffect(() => {
    return () => {
      if (midiAttemptTimerRef.current !== null) {
        window.clearTimeout(midiAttemptTimerRef.current);
      }

      if (successChirpTimerRef.current !== null) {
        window.clearTimeout(successChirpTimerRef.current);
      }

      if (correctFeedbackTimerRef.current !== null) {
        window.clearTimeout(correctFeedbackTimerRef.current);
      }
    };
  }, []);

  const generateNextTarget = useCallback(
    (nextMode: PracticeClefMode = mode) => {
      const nextTarget = generatePracticeTarget(
        nextMode,
        enabledExerciseTypes,
        enabledNoteCategories,
      );

      clearMidiAttempt();
      clearCorrectFeedbackTimers();

      practiceTargetRef.current = nextTarget;
      answerLockedRef.current = false;

      setPracticeTarget(nextTarget);
      setVirtualHeldNotes(new Set());
      setMidiAttemptNotes(new Set());
      setLastFailedAttemptNotes(new Set());
      setFeedback("idle");
      setLastAnswer(null);
      setStartedAt(Date.now());
    },
    [
      clearCorrectFeedbackTimers,
      clearMidiAttempt,
      enabledExerciseTypes,
      enabledNoteCategories,
      mode,
    ],
  );

  useEffect(() => {
    generateNextTargetRef.current = generateNextTarget;
  }, [generateNextTarget]);

  const handleCorrectAnswer = useCallback(
    (midiNumbers: ReadonlySet<number>, source: AnswerSource) => {
      if (answerLockedRef.current) {
        return;
      }

      answerLockedRef.current = true;

      clearMidiAttempt();
      clearCorrectFeedbackTimers();

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

      successChirpTimerRef.current = window.setTimeout(() => {
        successChirpTimerRef.current = null;
        playSuccessChirp();
      }, successChirpDelayMs);

      setVirtualHeldNotes(new Set());
      setLastFailedAttemptNotes(new Set());

      setLastAnswer({
        midiNumbers: new Set(midiNumbers),
        result: "correct",
      });

      setStats((currentStats) => ({
        ...currentStats,
        correct: currentStats.correct + 1,
        streak: currentStats.streak + 1,
        totalResponseTimeMs: currentStats.totalResponseTimeMs + responseTimeMs,
      }));

      waitingForMidiReleaseRef.current = source === "midi";

      correctFeedbackTimerRef.current = window.setTimeout(() => {
        correctFeedbackReadyRef.current = true;
        tryAdvanceAfterCorrectAnswer();
      }, nextTargetDelayMs);
    },
    [
      clearCorrectFeedbackTimers,
      clearMidiAttempt,
      replayCorrectVirtualChords,
      startedAt,
      tryAdvanceAfterCorrectAnswer,
    ],
  );

  const handleSingleIncorrectAnswer = useCallback((midiNumber: number) => {
    if (answerLockedRef.current) {
      return;
    }

    setFeedback("incorrect");
    playIncorrectFeedback();
    setLastFailedAttemptNotes(new Set());

    setLastAnswer({
      midiNumbers: new Set([midiNumber]),
      result: "incorrect",
    });

    setStats((currentStats) => ({
      ...currentStats,
      incorrect: currentStats.incorrect + 1,
      streak: 0,
    }));
  }, []);

  const handleFailedChordAttempt = useCallback(
    (midiNumbers: ReadonlySet<number>) => {
      if (answerLockedRef.current || midiNumbers.size === 0) {
        return;
      }

      setFeedback("incorrect");
      playIncorrectFeedback();
      setLastAnswer(null);

      setLastFailedAttemptNotes(new Set(midiNumbers));

      setStats((currentStats) => ({
        ...currentStats,
        incorrect: currentStats.incorrect + 1,
        streak: 0,
      }));
    },
    [],
  );

  const finalizeMidiAttempt = useCallback(() => {
    const completedAttempt = new Set(midiAttemptNotesRef.current);

    midiAttemptTimerRef.current = null;
    midiAttemptActiveRef.current = false;
    midiAttemptNotesRef.current = new Set();

    setMidiAttemptNotes(new Set());

    if (answerLockedRef.current || completedAttempt.size === 0) {
      return;
    }

    const currentTarget = practiceTargetRef.current;

    if (notesMatchTarget(completedAttempt, currentTarget)) {
      handleCorrectAnswer(completedAttempt, "midi");

      return;
    }

    handleFailedChordAttempt(completedAttempt);
  }, [handleCorrectAnswer, handleFailedChordAttempt]);

  const startMidiAttempt = useCallback(
    (midiNumber: number) => {
      setVirtualHeldNotes(new Set());
      setLastFailedAttemptNotes(new Set());
      setLastAnswer(null);
      setFeedback("idle");

      const firstAttemptNotes = new Set([midiNumber]);

      midiAttemptActiveRef.current = true;
      midiAttemptNotesRef.current = firstAttemptNotes;

      setMidiAttemptNotes(firstAttemptNotes);

      midiAttemptTimerRef.current = window.setTimeout(
        finalizeMidiAttempt,
        CHORD_ATTEMPT_GRACE_MS,
      );
    },
    [finalizeMidiAttempt],
  );

  const addNoteToMidiAttempt = useCallback((midiNumber: number) => {
    const nextAttemptNotes = new Set(midiAttemptNotesRef.current);

    nextAttemptNotes.add(midiNumber);

    midiAttemptNotesRef.current = nextAttemptNotes;

    setMidiAttemptNotes(nextAttemptNotes);
  }, []);

  const handleMidiHeldNotesChanged = useCallback(
    (heldNotes: ReadonlySet<number>) => {
      const nextHeldNotes = new Set(heldNotes);

      midiHeldNotesRef.current = nextHeldNotes;
      setMidiHeldNotes(nextHeldNotes);

      if (nextHeldNotes.size !== 0) {
        return;
      }

      tryAdvanceAfterCorrectAnswer();
    },
    [tryAdvanceAfterCorrectAnswer],
  );

  const handleMidiNotePlayed = useCallback(
    (midiNumber: number) => {
      if (answerLockedRef.current) {
        return;
      }

      const currentTarget = practiceTargetRef.current;

      const targetMidiNumbers = getTargetMidiNumbers(currentTarget);

      if (currentTarget.notes.length === 1) {
        if (targetMidiNumbers.has(midiNumber)) {
          handleCorrectAnswer(new Set([midiNumber]), "midi");

          return;
        }

        handleSingleIncorrectAnswer(midiNumber);

        return;
      }

      if (!midiAttemptActiveRef.current) {
        startMidiAttempt(midiNumber);
        return;
      }

      addNoteToMidiAttempt(midiNumber);
    },
    [
      addNoteToMidiAttempt,
      handleCorrectAnswer,
      handleSingleIncorrectAnswer,
      startMidiAttempt,
    ],
  );

  const handleVirtualNoteToggle = useCallback(
    (midiNumber: number) => {
      if (answerLockedRef.current) {
        return;
      }

      const currentTarget = practiceTargetRef.current;

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
    [clearMidiAttempt, handleCorrectAnswer, handleSingleIncorrectAnswer],
  );

  const { connectMidi, deviceName, error, status } = useMidi({
    onHeldNotesChanged: handleMidiHeldNotesChanged,
    onNotePlayed: handleMidiNotePlayed,
  });

  const handleCorrect = () => {
    const currentTarget = practiceTargetRef.current;

    handleCorrectAnswer(getTargetMidiNumbers(currentTarget), "simulation");
  };

  const handleIncorrect = () => {
    const currentTarget = practiceTargetRef.current;

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

  const handleModeChange = (nextMode: PracticeClefMode) => {
    setMode(nextMode);
    generateNextTarget(nextMode);
  };

  const handleExerciseTypeToggle = (exerciseType: PracticeExerciseType) => {
    setEnabledExerciseTypes((currentTypes) => {
      const nextTypes = new Set(currentTypes);

      if (nextTypes.has(exerciseType)) {
        if (nextTypes.size === 1) {
          return currentTypes;
        }

        nextTypes.delete(exerciseType);
      } else {
        nextTypes.add(exerciseType);
      }

      return nextTypes;
    });
  };

  const handleNoteCategoryToggle = (category: PracticeNoteCategory) => {
    setEnabledNoteCategories((currentCategories) => {
      const nextCategories = new Set(currentCategories);

      if (nextCategories.has(category)) {
        if (nextCategories.size === 1) {
          return currentCategories;
        }

        nextCategories.delete(category);
      } else {
        nextCategories.add(category);
      }

      return nextCategories;
    });
  };

  const handleReset = () => {
    setStats(INITIAL_STATS);
    generateNextTarget();
  };

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
          onCorrect={handleCorrect}
          onIncorrect={handleIncorrect}
        />

        <PianoKeyboard
          activeMidiNumbers={activeMidiNumbers}
          failedMidiNumbers={lastFailedAttemptNotes}
          lastAnswer={lastAnswer}
          targetMidiNumbers={getTargetMidiNumbers(practiceTarget)}
          onNoteToggle={handleVirtualNoteToggle}
        />
      </div>

      <section className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <PracticeStats stats={stats} />

        <div className="flex flex-col gap-4">
          <InstrumentVolumeControl
            replayCorrectVirtualChords={replayCorrectVirtualChords}
            onReplayCorrectVirtualChordsChange={setReplayCorrectVirtualChords}
          />

          <FeedbackVolumeControl />

          <PracticeControls
            enabledExerciseTypes={enabledExerciseTypes}
            enabledNoteCategories={enabledNoteCategories}
            mode={mode}
            onExerciseTypeToggle={handleExerciseTypeToggle}
            onModeChange={handleModeChange}
            onNoteCategoryToggle={handleNoteCategoryToggle}
            onReset={handleReset}
          />
        </div>
      </section>
    </div>
  );
}
