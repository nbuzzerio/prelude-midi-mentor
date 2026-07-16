import { useCallback, useEffect, useRef, useState } from "react";
import PracticeControls from "@/components/flashcards/practice-controls";
import PracticeStats from "@/components/flashcards/practice-stats";
import TargetNoteCard from "@/components/flashcards/target-note-card";
import MidiStatus from "@/components/midi/midi-status";
import PianoKeyboard from "@/components/notation/piano-keyboard";
import { useMidi } from "@/hooks/use-midi";
import { generateTargetNote } from "@/lib/music/notes";
import type {
  FeedbackState,
  PracticeMode,
  PracticeStats as PracticeStatsType,
  TargetNote,
} from "@/types/practice";

type LastAnswer = Readonly<{
  midiNumber: number;
  result: "correct" | "incorrect";
}>;

const INITIAL_STATS: PracticeStatsType = {
  correct: 0,
  incorrect: 0,
  streak: 0,
  totalResponseTimeMs: 0,
};

const INITIAL_TARGET_NOTE: TargetNote = {
  clef: "bass",
  midiNumber: 48,
  name: "C",
  octave: 3,
};

export default function FlashcardSession() {
  const [mode, setMode] = useState<PracticeMode>("bass");
  const [targetNote, setTargetNote] = useState<TargetNote>(INITIAL_TARGET_NOTE);
  const [feedback, setFeedback] = useState<FeedbackState>("idle");
  const [stats, setStats] = useState<PracticeStatsType>(INITIAL_STATS);
  const [lastAnswer, setLastAnswer] = useState<LastAnswer | null>(null);
  const [startedAt, setStartedAt] = useState(0);

  const answerLockedRef = useRef(false);
  const targetNoteRef = useRef(targetNote);

  useEffect(() => {
    targetNoteRef.current = targetNote;
  }, [targetNote]);

  const generateNextNote = useCallback(
    (nextMode: PracticeMode = mode) => {
      const nextTarget = generateTargetNote(nextMode);

      targetNoteRef.current = nextTarget;
      answerLockedRef.current = false;

      setTargetNote(nextTarget);
      setFeedback("idle");
      setStartedAt(Date.now());
    },
    [mode],
  );

  const handleNotePlayed = useCallback(
    (midiNumber: number) => {
      if (answerLockedRef.current) {
        return;
      }

      const currentTarget = targetNoteRef.current;

      if (midiNumber === currentTarget.midiNumber) {
        answerLockedRef.current = true;

        const responseTimeMs = startedAt === 0 ? 0 : Date.now() - startedAt;

        setFeedback("correct");
        setLastAnswer({
          midiNumber,
          result: "correct",
        });

        setStats((currentStats) => ({
          ...currentStats,
          correct: currentStats.correct + 1,
          streak: currentStats.streak + 1,
          totalResponseTimeMs:
            currentStats.totalResponseTimeMs + responseTimeMs,
        }));

        window.setTimeout(() => {
          generateNextNote();
        }, 500);

        return;
      }

      setFeedback("incorrect");
      setLastAnswer({
        midiNumber,
        result: "incorrect",
      });

      setStats((currentStats) => ({
        ...currentStats,
        incorrect: currentStats.incorrect + 1,
        streak: 0,
      }));
    },
    [generateNextNote, startedAt],
  );

  const {
    connectMidi,
    deviceName,
    error: midiError,
    status: midiStatus,
  } = useMidi({
    onNotePlayed: handleNotePlayed,
  });

  const handleCorrect = () => {
    handleNotePlayed(targetNoteRef.current.midiNumber);
  };

  const handleIncorrect = () => {
    const incorrectMidiNumber =
      targetNoteRef.current.midiNumber === 48 ? 49 : 48;

    handleNotePlayed(incorrectMidiNumber);
  };

  const handleModeChange = (nextMode: PracticeMode) => {
    setMode(nextMode);
    setLastAnswer(null);
    generateNextNote(nextMode);
  };

  const handleReset = () => {
    setStats(INITIAL_STATS);
    setLastAnswer(null);
    generateNextNote();
  };

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
        <TargetNoteCard
          feedback={feedback}
          targetNote={targetNote}
          onCorrect={handleCorrect}
          onIncorrect={handleIncorrect}
        />

        <PianoKeyboard
          lastAnswer={lastAnswer}
          onNotePlayed={handleNotePlayed}
        />
      </div>

      <section className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <PracticeStats stats={stats} />

        <PracticeControls
          mode={mode}
          onModeChange={handleModeChange}
          onReset={handleReset}
        />
      </section>
    </div>
  );
}
