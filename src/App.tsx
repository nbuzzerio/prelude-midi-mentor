import { useState } from "react";

import FlashcardSession from "./features/flashcards/components/flashcard-session";
import SequenceSession from "./features/sequences/components/sequence-session";
import FreeplaySession from "./features/freeplay/freeplay-session";
import EarTrainingSession from "./features/ear-training/components/ear-training-session";
import { useFocusMode } from "./hooks/use-focus-mode";

type PracticeSection = "flashcards" | "sequence" | "freeplay" | "ear-training";

export default function App() {
  const [practiceSection, setPracticeSection] =
    useState<PracticeSection>("freeplay");
  const { exitFocusMode, isFocusMode, toggleFocusMode } = useFocusMode(
    practiceSection !== "ear-training",
  );

  let content;

  switch (practiceSection) {
    case "flashcards":
      content = (
        <FlashcardSession
          isFocusMode={isFocusMode}
          onToggleFocusMode={toggleFocusMode}
        />
      );
      break;

    case "sequence":
      content = (
        <SequenceSession
          isFocusMode={isFocusMode}
          onToggleFocusMode={toggleFocusMode}
        />
      );
      break;

    case "freeplay":
      content = (
        <FreeplaySession
          isFocusMode={isFocusMode}
          onToggleFocusMode={toggleFocusMode}
        />
      );
      break;

    case "ear-training":
      content = <EarTrainingSession />;
      break;

    default:
      content = null;
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-2 sm:p-5 lg:p-10">
      <div
        className="mx-auto mb-4 flex w-full max-w-7xl gap-2"
        hidden={isFocusMode}
      >
        <button
          className={`rounded px-4 py-2 transition ${
            practiceSection === "freeplay"
              ? "bg-sky-500 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
          onClick={() => setPracticeSection("freeplay")}
          type="button"
        >
          Free Play
        </button>

        <button
          className={`rounded px-4 py-2 transition ${
            practiceSection === "ear-training"
              ? "bg-sky-500 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
          onClick={() => {
            exitFocusMode();
            setPracticeSection("ear-training");
          }}
          type="button"
        >
          Ear Training
        </button>

        <button
          className={`rounded px-4 py-2 transition ${
            practiceSection === "flashcards"
              ? "bg-sky-500 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
          onClick={() => setPracticeSection("flashcards")}
          type="button"
        >
          Flashcards
        </button>

        <button
          className={`rounded px-4 py-2 transition ${
            practiceSection === "sequence"
              ? "bg-sky-500 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
          onClick={() => setPracticeSection("sequence")}
          type="button"
        >
          Sequences
        </button>
      </div>

      {content}
    </main>
  );
}
