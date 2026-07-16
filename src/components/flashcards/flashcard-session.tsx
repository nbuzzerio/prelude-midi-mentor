import { useState } from "react";
import PracticeControls from "@/components/flashcards/practice-controls";
import PracticeStats from "@/components/flashcards/practice-stats";
import TargetNoteCard from "@/components/flashcards/target-note-card";
import MidiStatus from "@/components/midi/midi-status";
import PianoKeyboard from "@/components/notation/piano-keyboard";
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

  const generateNextNote = (nextMode: PracticeMode = mode) => {
    setTargetNote(generateTargetNote(nextMode));
    setFeedback("idle");
    setStartedAt(Date.now());
  };

  const handleCorrect = () => {
    const responseTimeMs = startedAt === 0 ? 0 : Date.now() - startedAt;

    setFeedback("correct");
    setLastAnswer({
      midiNumber: targetNote.midiNumber,
      result: "correct",
    });

    setStats((currentStats) => ({
      ...currentStats,
      correct: currentStats.correct + 1,
      streak: currentStats.streak + 1,
      totalResponseTimeMs: currentStats.totalResponseTimeMs + responseTimeMs,
    }));

    window.setTimeout(() => {
      generateNextNote();
    }, 500);
  };

  const handleIncorrect = () => {
    setFeedback("incorrect");
    setLastAnswer({
      midiNumber: targetNote.midiNumber,
      result: "incorrect",
    });

    setStats((currentStats) => ({
      ...currentStats,
      incorrect: currentStats.incorrect + 1,
      streak: 0,
    }));
  };

  const handleNotePlayed = (midiNumber: number) => {
    if (midiNumber === targetNote.midiNumber) {
      handleCorrect();
      return;
    }

    handleIncorrect();
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

        <MidiStatus connected={false} />
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
