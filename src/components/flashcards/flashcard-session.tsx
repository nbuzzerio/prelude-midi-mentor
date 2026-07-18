import { useCallback, useEffect, useRef, useState } from "react";
import PracticeCard from "@/components/flashcards/practice-card";
import PracticeControls from "@/components/flashcards/practice-controls";
import PracticeStats from "@/components/flashcards/practice-stats";
import MidiStatus from "@/components/midi/midi-status";
import PianoKeyboard from "@/components/notation/piano-keyboard";
import { useMidi } from "@/hooks/use-midi";
import { generatePracticeTarget } from "@/lib/music/notes";
import type {
  FeedbackState,
  PracticeClefMode,
  PracticeExerciseType,
  PracticeStats as PracticeStatsType,
  PracticeTarget,
} from "@/types/practice";

type LastAnswer = Readonly<{
  midiNumbers: ReadonlySet<number>;
  result: "correct" | "incorrect";
}>;

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

function heldNotesMatchTarget(
  heldNotes: ReadonlySet<number>,
  practiceTarget: PracticeTarget,
): boolean {
  if (heldNotes.size !== practiceTarget.notes.length) {
    return false;
  }

  return practiceTarget.notes.every((note) => heldNotes.has(note.midiNumber));
}

function getTargetMidiNumbers(
  practiceTarget: PracticeTarget,
): ReadonlySet<number> {
  return new Set(practiceTarget.notes.map((note) => note.midiNumber));
}

export default function FlashcardSession() {
  const [mode, setMode] = useState<PracticeClefMode>("bass");

  const [enabledExerciseTypes, setEnabledExerciseTypes] = useState<
    ReadonlySet<PracticeExerciseType>
  >(new Set(["notes"]));

  const [practiceTarget, setPracticeTarget] = useState<PracticeTarget>(
    INITIAL_PRACTICE_TARGET,
  );

  const [virtualHeldNotes, setVirtualHeldNotes] = useState<ReadonlySet<number>>(
    new Set(),
  );

  const [midiHeldNotes, setMidiHeldNotes] = useState<ReadonlySet<number>>(
    new Set(),
  );

  const [feedback, setFeedback] = useState<FeedbackState>("idle");

  const [stats, setStats] = useState<PracticeStatsType>(INITIAL_STATS);

  const [lastAnswer, setLastAnswer] = useState<LastAnswer | null>(null);

  const [startedAt, setStartedAt] = useState(0);

  const answerLockedRef = useRef(false);
  const practiceTargetRef = useRef(practiceTarget);

  useEffect(() => {
    practiceTargetRef.current = practiceTarget;
  }, [practiceTarget]);

  const generateNextTarget = useCallback(
    (nextMode: PracticeClefMode = mode) => {
      const nextTarget = generatePracticeTarget(nextMode, enabledExerciseTypes);

      practiceTargetRef.current = nextTarget;
      answerLockedRef.current = false;

      setPracticeTarget(nextTarget);
      setVirtualHeldNotes(new Set());
      setMidiHeldNotes(new Set());
      setFeedback("idle");
      setLastAnswer(null);
      setStartedAt(Date.now());
    },
    [enabledExerciseTypes, mode],
  );

  const handleCorrectAnswer = useCallback(
    (midiNumbers: ReadonlySet<number>) => {
      if (answerLockedRef.current) {
        return;
      }

      answerLockedRef.current = true;

      const responseTimeMs = startedAt === 0 ? 0 : Date.now() - startedAt;

      setFeedback("correct");

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

      window.setTimeout(() => {
        generateNextTarget();
      }, 500);
    },
    [generateNextTarget, startedAt],
  );

  const handleIncorrectAnswer = useCallback(
    (midiNumbers: ReadonlySet<number>) => {
      if (answerLockedRef.current) {
        return;
      }

      setFeedback("incorrect");

      setLastAnswer({
        midiNumbers: new Set(midiNumbers),
        result: "incorrect",
      });

      setStats((currentStats) => ({
        ...currentStats,
        incorrect: currentStats.incorrect + 1,
        streak: 0,
      }));
    },
    [],
  );

  const handleHeldNotesChanged = useCallback(
    (heldNotes: ReadonlySet<number>) => {
      setMidiHeldNotes(new Set(heldNotes));

      if (answerLockedRef.current) {
        return;
      }

      const currentTarget = practiceTargetRef.current;

      if (!heldNotesMatchTarget(heldNotes, currentTarget)) {
        return;
      }

      handleCorrectAnswer(heldNotes);
    },
    [handleCorrectAnswer],
  );

  const handleVirtualNoteToggle = useCallback(
    (midiNumber: number) => {
      if (answerLockedRef.current) {
        return;
      }

      setLastAnswer(null);
      setFeedback("idle");

      setVirtualHeldNotes((currentNotes) => {
        const nextNotes = new Set<number>(currentNotes);

        if (nextNotes.has(midiNumber)) {
          nextNotes.delete(midiNumber);
        } else {
          nextNotes.add(midiNumber);
        }

        const currentTarget = practiceTargetRef.current;

        if (heldNotesMatchTarget(nextNotes, currentTarget)) {
          handleCorrectAnswer(nextNotes);
        }

        return nextNotes;
      });
    },
    [handleCorrectAnswer],
  );

  const handleNotePlayed = useCallback(
    (midiNumber: number) => {
      if (answerLockedRef.current) {
        return;
      }

      const currentTarget = practiceTargetRef.current;

      const expectedMidiNumbers = getTargetMidiNumbers(currentTarget);

      if (!expectedMidiNumbers.has(midiNumber)) {
        handleIncorrectAnswer(new Set([midiNumber]));

        return;
      }

      /*
       * Physical MIDI chord validation is handled by
       * handleHeldNotesChanged. A standalone note-on event
       * can complete only a single-note target.
       */
      if (currentTarget.notes.length === 1) {
        handleCorrectAnswer(new Set([midiNumber]));
      }
    },
    [handleCorrectAnswer, handleIncorrectAnswer],
  );

  const {
    connectMidi,
    deviceName,
    error: midiError,
    status: midiStatus,
  } = useMidi({
    onHeldNotesChanged: handleHeldNotesChanged,
    onNotePlayed: handleNotePlayed,
  });

  const handleCorrect = () => {
    const currentTarget = practiceTargetRef.current;

    handleCorrectAnswer(getTargetMidiNumbers(currentTarget));
  };

  const handleIncorrect = () => {
    const currentTarget = practiceTargetRef.current;

    const expectedMidiNumbers = getTargetMidiNumbers(currentTarget);

    let incorrectMidiNumber = 48;

    while (expectedMidiNumbers.has(incorrectMidiNumber)) {
      incorrectMidiNumber += 1;
    }

    handleIncorrectAnswer(new Set([incorrectMidiNumber]));
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

  const handleReset = () => {
    setStats(INITIAL_STATS);
    generateNextTarget();
  };

  const displayedMidiNumbers = new Set([...virtualHeldNotes, ...midiHeldNotes]);

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
          error={midiError}
          onConnect={() => {
            void connectMidi();
          }}
          status={midiStatus}
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
          lastAnswer={lastAnswer}
          selectedMidiNumbers={displayedMidiNumbers}
          targetMidiNumbers={getTargetMidiNumbers(practiceTarget)}
          onNoteToggle={handleVirtualNoteToggle}
        />
      </div>

      <section className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <PracticeStats stats={stats} />

        <PracticeControls
          enabledExerciseTypes={enabledExerciseTypes}
          mode={mode}
          onExerciseTypeToggle={handleExerciseTypeToggle}
          onModeChange={handleModeChange}
          onReset={handleReset}
        />
      </section>
    </div>
  );
}
